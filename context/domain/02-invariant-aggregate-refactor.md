---
title: Invariant Aggregate Refactor — The Sugar Plan Consistency Guardian
created: 2026-08-08
type: refactor-plan
---

> **Deliverable:** a refactoring PLAN, not an implementation. No production code is
> modified here. All claims cite verified `file:line` references. Assumptions and
> open questions are labelled explicitly.

---

# STEP 0 — Discovered Context

## Sources consulted

| Source                                                       | What it gave                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `context/foundation/prd.md`                                  | Vision, success criteria, **Guardrails**, FR-008/FR-009/FR-010, NFRs, access control, non-goals |
| `context/foundation/domain_knowledge.md`                     | Winemaking rules behind sugar & process-plan generation                                         |
| `context/foundation/test-plan.md`                            | Risk register (Risk #1, #4, #7) and current test coverage                                       |
| `context/foundation/tech-stack.md`, `README.md`, `AGENTS.md` | Stack, layers, conventions                                                                      |
| `context/changes/data-access-repository-layer/change.md`     | Planned repository seam (ADR-style)                                                             |
| Source tree under `src/`, `supabase/migrations/`             | Actual enforcement locations                                                                    |

**Limitation (labelled):** A prior `context/domain/01-domain-distillation.md`
(the expected output of `.github/prompts/ddd-1-distillation.md`) does **not**
exist in the repository. This plan therefore performs its own discovery from the
PRD and source code rather than building on a distillation map. This is an
observed fact, not an assumption.

## Technology stack & layers

Astro 6 SSR + React 19 islands, Supabase (Postgres + RLS), Cloudflare Workers,
zod validation, Vitest (unit + integration), Playwright (e2e), Stryker (mutation).
Verified in `package.json:14-20`, `astro.config.mjs`, `AGENTS.md:22-45`.

Business logic currently resides across these layers:

| Layer                        | Location                       | Business logic present                                                                   |
| ---------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| UI / client                  | `src/components/batches/*.tsx` | **Sugar calculation, validation warnings, dry→0 reset** (the core domain math runs here) |
| API / route                  | `src/pages/api/batches/**`     | Input parsing (zod), persistence orchestration, **process-plan generation**              |
| Application / domain service | `src/lib/services/*.ts`        | Pure functions: `calculateSugar`, `validateBatch`, `generateProcessPlan`                 |
| Schema / contract            | `src/lib/schemas/*.ts`         | zod shape + range checks (`min(0)`, enums)                                               |
| Persistence                  | `supabase/migrations/*.sql`    | Tables, RLS, `regenerate_diary_entries` RPC, moddatetime + promotion triggers            |

**Key structural observation (observed fact):** the pure domain services exist in
`src/lib/services/`, but the two that encode the product's headline guarantee —
`calculateSugar` (`src/lib/services/sugar-calculation.ts:36`) and `validateBatch`
(`src/lib/services/batch-validation.ts:131`) — are imported **only** by client
components (`src/components/batches/BatchForm.tsx:4,6`,
`src/components/batches/IngredientsSection.tsx:20`) and by tests. No API route
imports them. Only `generateProcessPlan` runs server-side
(`src/pages/api/batches/index.ts:3`, `src/pages/api/batches/[id]/diary/regenerate.ts:3`).

---

# STEP 1 — Business Invariant Catalog

Each invariant below is a rule that must always hold, with its rationale and
verified evidence.

### INV-1 — Sugar plan must be mathematically consistent with batch parameters

**Rule.** For any persisted batch, the stored `fermentation_sugar_kg` and
`sweetness_sugar_kg` must equal the values the calculation formula produces from
that batch's own `target_volume_liters`, `target_abv`, `planned_sweetness`, and
`ingredients` — or be a **deliberate, recorded** user override. In particular:

- `fermentation_sugar_kg = max(0, target_abv × 17 × target_volume_liters − Σ ingredient_sugar_grams) / 1000`
- `sweetness_sugar_kg = SWEETNESS_MIDPOINTS[planned_sweetness] × target_volume_liters / 1000`
- Sub-rule **INV-1a**: `planned_sweetness = 'dry' ⇒ sweetness_sugar_kg = 0`.

**Why it exists.** PRD Guardrail: _"Sugar calculation must be mathematically
correct — wrong math destroys user trust immediately"_ (`prd.md:37`). It is the
product's core differentiator (`prd.md:87`) and top risk (`test-plan.md:45`,
Risk #1, High/High; `test-plan.md:48`, Risk #4, Medium/High).

**Evidence.**

- Formula & constants: `src/lib/services/sugar-calculation.ts:3,5-10,36-59`.
- Persisted fields: `src/types.ts:20-21`; columns `supabase/migrations/20260613140000_sugar_fields_to_batch_columns.sql:6-7`.
- Client is the only calculator: `src/components/batches/IngredientsSection.tsx:126-142` (`handleCalculate`).
- Dry→0 reset is client-only: `src/components/batches/BatchForm.tsx:151-153`.

### INV-2 — One user's batch data is never visible to another user

**Rule.** Every read/write of a batch (and its diary entries) is scoped to the
owning user.

**Why.** PRD: _"One user's batch data is never visible to another user"_
(`prd.md:82`); access-control section (`prd.md:95-97`).

**Evidence (enforced at persistence).** RLS policies
`supabase/migrations/20260530213000_batch_schema_with_rls.sql:68-81`; ownership
check inside `regenerate_diary_entries`
(`supabase/migrations/20260614130000_diary_entries_process_plan.sql:52-54`);
route/middleware auth gate `src/middleware.ts:4,19-23`.

### INV-3 — Diary regeneration is atomic and preserves user-authored entries

**Rule.** Regenerating the auto process plan replaces only `entry_type = 'auto'`
entries, atomically, and never destroys `user` entries; an edited auto entry is
promoted to `user` so it survives regeneration.

**Why.** FR-010/FR-011 (`prd.md:74-75`); NFR _"Auto-generated … always editable"_
(`prd.md:83`); design intent recorded in the `regenerate-dirty-guard` and
`process-plan-generation` changes.

**Evidence (enforced at persistence).** Atomic delete+insert in one
`SECURITY DEFINER` function
(`supabase/migrations/20260614130000_diary_entries_process_plan.sql:47-61`);
promotion trigger (`…:29-44`); route calls the RPC
(`src/pages/api/batches/[id]/diary/regenerate.ts:32-35`).

### INV-4 — Validation warnings are advisory (soft), never blocking

**Rule.** Plan-consistency warnings inform but never prevent saving.

**Why.** PRD Guardrail (`prd.md:38`); NFR (`prd.md:81`).

**Evidence (by design, client-only).** Warnings computed in the form
(`src/components/batches/BatchForm.tsx:54-81`); no server code consumes
`validateBatch`. This invariant is _intended_ to be non-enforcing, so its
client-only location is acceptable (unlike INV-1).

### INV-5 — Process plan steps are derived deterministically from batch state

**Rule.** The generated plan contains exactly the steps whose conditions hold for
the batch (e.g. the "add fermentation sugar" step appears **iff**
`fermentation_sugar_kg > 0`; pulp-only steps for pulp; non-dry-only steps for
sweetening).

**Why.** FR-010 (`prd.md:74`); domain rules (`domain_knowledge.md:295-327`).

**Evidence (enforced server-side).** `generateProcessPlan`
(`src/lib/services/process-plan-generation.ts:165-171`) with conditions
(`…:41-49`), invoked at `src/pages/api/batches/index.ts:44` and
`…/diary/regenerate.ts:29`. **Coupling note:** the `hasFermentationSugar`
condition (`…:45`) reads the _client-supplied_ `fermentation_sugar_kg`, so INV-5's
correctness is downstream of INV-1.

---

# STEP 2 — Classification & Selection

Evaluated on Business Criticality, Distribution/Scattering, and Enforcement
Quality.

| Invariant                        | Business criticality                                            | Distribution (layers enforcing)                                     | Enforcement quality                                               |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **INV-1 Sugar plan consistency** | **Highest** — named PRD guardrail; core differentiator; Risk #1 | Client only (services live in `lib/` but are _called_ only from UI) | **Violable** — server persists arbitrary `min(0)` values verbatim |
| INV-2 User data isolation        | High                                                            | Persistence (RLS) + middleware                                      | Enforced (defense-in-depth)                                       |
| INV-3 Regeneration atomicity     | Medium-High                                                     | Persistence (RPC + trigger)                                         | Enforced                                                          |
| INV-4 Warnings are soft          | Medium                                                          | Client only                                                         | Enforced (by design; soft is the goal)                            |
| INV-5 Process-plan determinism   | High                                                            | Domain service + API                                                | Partially enforced (correct, but depends on INV-1 inputs)         |

## Enforcement classification of INV-1

- **Declared:** formula exists and is correct as a pure function
  (`sugar-calculation.ts:36-59`).
- **Enforced where?** Only in the browser, and only when the user clicks the
  manual **🧮 Calculate** button (`IngredientsSection.tsx:126-142,199-207`).
- **Server enforcement:** **none.** `POST` inserts the client's `batchData`
  as-is (`src/pages/api/batches/index.ts:29-33`); `PUT` updates with
  `result.data` as-is (`src/pages/api/batches/[id]/index.ts:52`). zod only checks
  `z.number().min(0)` (`src/lib/schemas/batch.ts:19-20,35-36`).
- **Persistence enforcement:** **none.** Columns are `NUMERIC NOT NULL DEFAULT 0`
  with **no CHECK constraint**
  (`supabase/migrations/20260613140000_sugar_fields_to_batch_columns.sql:6-7`).

→ **Classification: VIOLABLE.**

## Selection

**Selected #1 invariant: INV-1 — Sugar plan consistency.**

It is simultaneously the **most business-critical** (the single guardrail the PRD
says "destroys user trust immediately" if wrong, and the top-ranked risk in the
test plan) and the **least reliably enforced** (computed only in the UI, behind a
manual button, with the server and database accepting any non-negative number).
INV-2 and INV-3 are more critical-than-average but already enforced at the
database; INV-4 is intentionally soft; INV-5 is correct but inherits INV-1's
weakness. INV-1 offers the highest combined domain value and architectural-risk
reduction.

**Confirming evidence that the gap is real and known.** The existing integration
test `src/__tests__/integration/sugar-pipeline.test.ts:231-267` is titled
_"Sugar persistence roundtrip (Risk #4)"_ and asserts that
independently-supplied sugar values _"survive the full POST → DB → query
roundtrip without corruption"_ — i.e. it verifies the server stores whatever it
is given. Its own note (`…:232-235`) states the calculation _"is covered by unit
tests"_ on the client. The roundtrip test is green precisely because the server
does no recomputation.

---

# STEP 3 — Diagnosis of INV-1

## Where the rule currently lives

| Concern                     | Location                                                                         | Behaviour                                                                 |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Formula (source of truth)   | `src/lib/services/sugar-calculation.ts:36-59`                                    | Correct pure function; not called server-side                             |
| Trigger to compute          | `src/components/batches/IngredientsSection.tsx:126-142`                          | **Manual** button; only fires on user click                               |
| Direct manual edit of sugar | `src/components/batches/IngredientsSection.tsx:174-197` (`SugarCard` `onChange`) | User can type any kg into the card, bypassing the formula entirely        |
| Dry⇒0 sub-rule (INV-1a)     | `src/components/batches/BatchForm.tsx:151-153`                                   | Client resets to `"0"` on sweetness change; **not** re-asserted on submit |
| Submit payload              | `src/components/batches/BatchForm.tsx:174-175`                                   | Sends `parseFloat(form.fermentation_sugar_kg)                             |     | 0` — a free-form string→number |
| Server create               | `src/pages/api/batches/index.ts:26-33`                                           | Spreads `batchData` (incl. sugar) straight into `insert`                  |
| Server update               | `src/pages/api/batches/[id]/index.ts:46-52`                                      | Spreads `result.data` (incl. sugar) straight into `update`                |
| Schema guard                | `src/lib/schemas/batch.ts:19-20,35-36`                                           | `z.number().min(0)` — range only, no relationship to parameters           |
| DB guard                    | `…20260613140000….sql:6-7`                                                       | `NUMERIC NOT NULL DEFAULT 0`, no CHECK                                    |

## Missing enforcement points

- **No server-side recomputation.** Neither `POST` nor `PUT` calls
  `calculateSugar`. The domain math is absent from the trust boundary.
- **No consistency validation.** Nothing compares persisted sugar against the
  canonical value for the batch's parameters.
- **No INV-1a backstop.** A `dry` batch may be stored with `sweetness_sugar_kg > 0`;
  the only guard is a client state reset (`BatchForm.tsx:151-153`).
- **No database CHECK constraint** on either column.

## How the invariant can currently be violated (fail paths)

1. **Direct API call.** `POST /api/batches` (or `PUT`) with
   `{ target_volume_liters: 20, target_abv: 12, ingredients: [], fermentation_sugar_kg: 0 }`
   persists `0` although the formula requires `4.08 kg`. Accepted with `201`
   (`index.ts:29-33`; schema allows it, `batch.ts:19`).
2. **Stale UI value on edit.** Open a batch, change `target_abv`, click Save
   **without** re-clicking Calculate → the previous (now stale) sugar value is
   submitted and stored (`BatchForm.tsx:174-175` reads current form state; no
   recompute on submit).
3. **Manual card edit.** Type an arbitrary number into the Fermentation/Sweetness
   `SugarCard` (`IngredientsSection.tsx:174-197`) — persisted verbatim.
4. **Dry inconsistency.** Set `planned_sweetness = 'dry'` via API with
   `sweetness_sugar_kg = 5` → stored; INV-1a violated (no server/DB guard).
5. **Downstream corruption of INV-5.** A wrong `fermentation_sugar_kg` flips the
   `hasFermentationSugar` condition (`process-plan-generation.ts:45`), so the
   generated diary either omits a needed "add fermentation sugar" step or invents
   one — a _visible_ wrong artefact produced from bad data
   (`src/pages/api/batches/index.ts:44`).

## Where the UI is the only guardian / where behaviour is silently permissive

- The **only** place the formula is applied is the client
  (`IngredientsSection.tsx:126-142`); the server is a pass-through.
- The dry⇒0 rule is guarded **only** by a client `setForm` reset
  (`BatchForm.tsx:151-153`).
- Errors are not "swallowed" so much as **never checked**: the server has no code
  path that could reject an inconsistent sugar plan, so inconsistency is accepted
  as success (`201`/`200`).

---

# STEP 4 — Guardian Aggregate Design

## Central design tension (must be respected)

INV-1 is **not** simply "server always overwrites sugar with the formula." Two
PRD requirements pull the other way:

- FR-006: for non-dry wines the app auto-creates sugar entries _"which the user
  can manually adjust"_ (`prd.md:66`).
- NFR: _"Auto-generated sugar entries … always editable"_ (`prd.md:83`).

So the guardian must distinguish a **canonical (auto) plan** from a **deliberate
manual override**, guarantee the former is always exactly the formula output, and
record the latter transparently — while forbidding the current failure mode:
a value that is _neither_ canonical _nor_ a recorded override (i.e. silent drift).
The correctness **guardrail** (INV-1) is hard; the **warnings** (INV-4) stay soft.

## Aggregate Responsibility

- **Aggregate root:** `BatchPlan`.
- **Invariant owned:** INV-1 (incl. INV-1a). The `BatchPlan` is the single place
  that computes and validates the sugar plan.
- **Boundary:** one batch and the state the formula depends on — parameters
  (`target_volume_liters`, `target_abv`, `planned_sweetness`), the `ingredients`
  collection, and the `SugarPlan` value object. These must change together and be
  validated together. Diary entries are a **separate** aggregate referenced by id
  (they have their own atomic lifecycle, INV-3); `BatchPlan` emits the
  generation _input_ but does not own diary rows.
- **Lifecycle:** created on `POST`; revised on `PUT`; loaded/saved as a whole via
  its repository. Every mutation re-establishes INV-1 before persistence.

## Value object: `SugarPlan`

```
SugarPlan {
  fermentationSugarKg: number   // ≥ 0
  sweetnessSugarKg: number       // ≥ 0
  source: 'auto' | 'manual'      // provenance (see Open Questions — needs a column)
}

// Factory — the ONE server-side computation, wrapping the existing pure fn:
SugarPlan.canonical(params, ingredients) -> SugarPlan
  // delegates to calculateSugar(...)  [src/lib/services/sugar-calculation.ts:36]
  // returns { ...result, source: 'auto' }
```

`SugarPlan.canonical` reuses `calculateSugar` unchanged — the refactor moves
_where it is called_ (into the aggregate, server-side), not the math.

## Domain Operations

Signatures are design pseudocode (TypeScript-flavoured), **not** code to commit.

### `BatchPlan.create(input): BatchPlan`

- **Preconditions:** `input` parsed by zod (name, process_type, enums, ranges).
- **Behaviour:**
  - Compute `canonical = SugarPlan.canonical(params, ingredients)`.
  - If `input.sugarDirective.mode === 'manual'`: build a **manual** `SugarPlan`
    from the supplied kg (still `≥ 0`); else use `canonical`.
  - Enforce **INV-1a**: if `planned_sweetness === 'dry'` then `sweetnessSugarKg`
    must be `0` — for `manual`, reject if non-zero; for `auto`, canonical already
    yields `0`.
- **Postconditions:** the returned aggregate's `SugarPlan` is either exactly
  `canonical` or a validated recorded override. Never a stale/auto-mismatched value.

### `BatchPlan.reviseParameters(patch): void`

- **Preconditions:** aggregate loaded for the owning user; `patch` validated.
- **Behaviour:**
  - Apply parameter/ingredient changes.
  - Recompute `canonical` for the **new** state.
  - If current plan `source === 'auto'` → replace with `canonical` (auto follows
    parameters — fixes fail-path #2).
  - If `source === 'manual'` and `patch` does not re-assert an override →
    **re-validate** the override against the new parameters and **fail fast** with
    `SugarPlanInconsistentError` if it is no longer explainable, OR (product
    choice, see Open Questions) revert to `canonical`. Default: fail fast.
  - Re-enforce INV-1a.
- **Postconditions:** INV-1 holds for the revised state.

### `BatchPlan.overrideSugar(fermentationKg, sweetnessKg): void`

- **Preconditions:** `fermentationKg ≥ 0`, `sweetnessKg ≥ 0`; if `dry`,
  `sweetnessKg === 0`.
- **Behaviour:** set `SugarPlan` with `source = 'manual'`. This is the _only_
  sanctioned way to store a non-canonical value — making manual edits explicit
  and transparent (satisfies FR-006 / `prd.md:83`).
- **Postconditions:** override recorded with provenance; INV-1 satisfied via the
  "deliberate override" branch.

### `BatchPlan.processPlanInput(): GenerationInput`

- Returns the derived input for `generateProcessPlan`
  (`src/lib/services/process-plan-generation.ts:4`) using the **validated**
  `fermentationSugarKg`, closing the INV-5 coupling (fail-path #5).

**Fail-fast rule:** illegal operations throw named domain errors; the aggregate
never silently coerces an inconsistent plan into a "valid" one.

## Domain Errors

| Error                           | Meaning                                                                       | Replaces today's silent behaviour                                  |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `NegativeSugarAmountError`      | kg `< 0`                                                                      | Currently the only guard (zod `min(0)`) — kept, now a domain error |
| `DryWineSweetnessError`         | `dry` batch with `sweetnessSugarKg > 0` (INV-1a)                              | Today: accepted (fail-path #4)                                     |
| `SugarPlanInconsistentError`    | persisted/submitted plan is neither canonical nor a valid recorded override   | Today: accepted verbatim (fail-paths #1–#3)                        |
| `MissingCalculationInputsError` | override/consistency requested but `target_volume_liters`/`target_abv` absent | Today: undefined behaviour                                         |

## Repository Design

```
interface BatchPlanRepository {
  load(batchId, userId): Promise<BatchPlan | null>   // whole aggregate
  save(plan: BatchPlan): Promise<void>               // whole aggregate, one row
}
SupabaseBatchPlanRepository implements BatchPlanRepository
```

- Loads the whole aggregate (batch row incl. `ingredients` JSONB + sugar columns)
  rather than scattered queries; persists it as a whole.
- **Atomicity:** the sugar plan lives in a **single `batches` row**
  (`…20260613140000….sql:6-7`), so a normal `UPDATE`/`INSERT` is already atomic
  for INV-1 — no multi-statement transaction is required for the sugar guarantee
  itself. (Contrast INV-3, which genuinely needs the multi-row
  `regenerate_diary_entries` transaction — out of scope for INV-1.) The create
  path's _diary_ insert remains best-effort and separate
  (`src/pages/api/batches/index.ts:42-77`); this refactor does not change that.
- **Alignment:** this is the natural first consumer of the already-planned
  repository seam (`context/changes/data-access-repository-layer/change.md`),
  and constructor-injects the Supabase client so the aggregate stays
  Astro-free/unit-testable (per that change's findings, lines 44-57).
- **Defense-in-depth (recommended):** add a DB CHECK for INV-1a
  (`planned_sweetness <> 'dry' OR sweetness_sugar_kg = 0`) as a backstop — the one
  sub-rule expressible as a pure single-row constraint.

## API / Route Design (thin endpoints)

Target flow for `POST /api/batches` and `PUT /api/batches/[id]`:

```
parse input (zod)                    // src/lib/schemas/batch.ts  (unchanged shape + sugarDirective)
  → repo.load / new BatchPlan.create // aggregate computes canonical SugarPlan server-side
  → BatchPlan.revise/override        // enforces INV-1 & INV-1a, throws domain errors
  → repo.save                        // persist whole aggregate
  → map domain error → HTTP          // 4xx w/ details; else 200/201
  → response
```

- **Enforcement moves from client to server.** The browser's **🧮 Calculate**
  button (`IngredientsSection.tsx:126-142`) becomes a _live preview only_; the
  server is authoritative. The client may stop sending computed sugar entirely
  and instead send parameters + an explicit `sugarDirective` when the user
  overrides.
- Domain errors map to `jsonError` / `jsonValidationError`
  (`src/lib/api.ts:17-32`) — consistent with existing handlers.

---

# STEP 5 — Before/After, Refactoring Plan, Tests, Registry

## Before / After

| Enforcement location                               | Current behaviour                                | Future behaviour                                                                      | Responsibility change                        |
| -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `IngredientsSection.handleCalculate` (`…:126-142`) | Manual button is the only place the formula runs | Live **preview**; not authoritative                                                   | UI loses ownership of correctness            |
| `SugarCard` onChange (`…:174-197`)                 | Free manual edit persisted verbatim              | Edit routes through explicit override → server records `source='manual'`              | Manual edits become explicit & transparent   |
| `BatchForm` dry reset (`BatchForm.tsx:151-153`)    | Client-only `setForm('0')`                       | Server enforces INV-1a; client reset is cosmetic                                      | Sub-rule moves server-side                   |
| `POST` handler (`index.ts:29-33`)                  | Inserts client sugar as-is                       | Calls `BatchPlan.create` → canonical/override → save                                  | Route becomes thin; domain owns math         |
| `PUT` handler (`[id]/index.ts:46-52`)              | Updates client sugar as-is                       | Loads aggregate, `reviseParameters`, save                                             | Route becomes thin; stale-value path closed  |
| zod schema (`batch.ts:19-20,35-36`)                | `min(0)` only                                    | Unchanged shape; add optional `sugarDirective`; relationship checks move to aggregate | Schema stays structural; semantics in domain |
| DB columns (`…20260613140000….sql:6-7`)            | No CHECK                                         | Add INV-1a CHECK backstop                                                             | Persistence gains a guardrail                |
| `generateProcessPlan` input (`index.ts:44`)        | Uses unvalidated client sugar                    | Uses `BatchPlan.processPlanInput()` (validated)                                       | INV-5 no longer inherits INV-1 risk          |

## Refactoring Phases

### Phase 1 — Server-side canonical calculation (close the trust boundary)

- **Objective:** make the server compute `SugarPlan.canonical` and persist it for
  the `auto` case; reject negative/dry violations.
- **Affected:** new `BatchPlan` aggregate + `SugarPlan` VO in `src/lib/domain/`
  (new), wrapping `calculateSugar`; `POST`/`PUT` handlers; schema gains optional
  `sugarDirective`.
- **Risk:** Medium — changes what values get stored; must not regress the
  editable-sugar UX.
- **Verification:** unit tests on the aggregate; integration test that a
  parameters-only `POST` yields formula-correct persisted sugar (inverts the
  current "roundtrip verbatim" assertion in `sugar-pipeline.test.ts:231-267`).

### Phase 2 — Explicit manual override with provenance

- **Objective:** support `source='manual'` overrides transparently (FR-006).
- **Affected:** migration adding provenance column(s) (see Open Questions);
  aggregate `overrideSugar`; client edit path emits an override directive.
- **Risk:** Medium — schema change + backfill; requires product decision on
  revise semantics.
- **Verification:** integration tests for override persisted as manual; revise of
  parameters re-validates/reverts per chosen policy.

### Phase 3 — Repository extraction

- **Objective:** move data access behind `BatchPlanRepository`.
- **Affected:** handlers depend on the repo, not raw Supabase chains; aligns with
  `data-access-repository-layer`.
- **Risk:** Low-Medium — mechanical; covered by existing HTTP integration tests.
- **Verification:** existing happy-path integration suite stays green; add
  failing-repository unit tests.

### Phase 4 — Persistence backstop + INV-5 wiring

- **Objective:** add the INV-1a DB CHECK; feed `generateProcessPlan` from the
  validated aggregate.
- **Affected:** new migration; `index.ts:44` and `regenerate.ts:29` use
  `BatchPlan.processPlanInput()`.
- **Risk:** Low.
- **Verification:** migration test (dry + sweetness>0 rejected); process-plan
  generation test driven by validated sugar.

## Testing Strategy

The project is test-first-friendly (Vitest unit + integration, Stryker, Playwright;
`package.json:14-20`; `test-plan.md`). **Phases 1, 2, and 4 should be implemented
test-first** — they encode business rules with clear pass/fail oracles. Phase 3 is
a structural refactor validated by keeping the existing suite green.

Test cases (independently derived expected values, per the repo's oracle
convention in `sugar-pipeline.test.ts:4-14`):

- **Valid operations:** parameters-only create → persisted sugar equals formula
  (dry and non-dry); explicit override persisted with `source='manual'`.
- **Invalid operations:** `POST`/`PUT` with `fermentation_sugar_kg` that
  contradicts parameters and no override → `SugarPlanInconsistentError` (4xx);
  `dry` + `sweetness_sugar_kg > 0` → `DryWineSweetnessError`; negative kg →
  `NegativeSugarAmountError`.
- **Valid state transitions:** revise `target_abv` on an `auto` plan → sugar
  recomputed and re-persisted (closes fail-path #2).
- **Invalid state transitions:** revise parameters that strand a `manual`
  override → fail fast (or revert, per policy) — asserted either way.
- **Atomicity/consistency:** single-row update leaves no partial state; INV-1a DB
  CHECK rejects the violating row (Phase 4).
- **Regression inversion:** update `sugar-pipeline.test.ts` so the roundtrip
  asserts _server-computed_ correctness rather than _verbatim_ passthrough.
- **Mutation (Stryker, scoped):** target the aggregate's INV-1 branch logic with
  `--mutate` on the new file range; add assertions only for user-visible mutants
  (per `AGENTS.md:86-92`).

## Contract Registry

The repo keeps load-bearing conventions in `AGENTS.md` and lessons in
`context/foundation/lessons.md` (no formal machine registry). Register these new
names there and in this domain folder:

- **Aggregate:** `BatchPlan` (root; owns INV-1).
- **Value object:** `SugarPlan` (`fermentationSugarKg`, `sweetnessSugarKg`,
  `source`).
- **Domain concepts:** _canonical sugar plan_, _manual sugar override_,
  _sugar provenance_ (`auto` | `manual`).
- **Domain errors:** `NegativeSugarAmountError`, `DryWineSweetnessError`,
  `SugarPlanInconsistentError`, `MissingCalculationInputsError`.
- **Repository contract:** `BatchPlanRepository` (`load`, `save`) with
  `SupabaseBatchPlanRepository` impl.
- **Schema addition:** `sugarDirective` on the batch input schema; provenance
  column on `batches` (name TBD — Open Questions).

---

# Assumptions & Open Questions

- **(Assumption)** FR-006 / `prd.md:83` mean arbitrary manual sugar overrides
  must remain possible; therefore a pure "server always overwrites" design is
  insufficient and provenance is required. If product decides overrides are _not_
  required, Phase 2 collapses to "server always recomputes" (no new column).
- **(Open)** Provenance representation: single `sugar_source` enum vs two
  per-field booleans (fermentation vs sweetness can differ). Recommend per-field
  provenance since the two are edited independently
  (`IngredientsSection.tsx:171-198`).
- **(Open)** Revise-with-stranded-override policy: **fail fast**
  (`SugarPlanInconsistentError`) vs **auto-revert to canonical**. Recommend
  fail-fast to honour the hard guardrail; needs product sign-off because it can
  surface an error where today there is silent acceptance.
- **(Open)** Whether to keep the exact-equality check tolerant to floating point
  (formula uses `/1000`, `Math.max`, `sugar-calculation.ts:47-51`) — use a small
  epsilon, mirroring `toBeCloseTo(…, 6)` in `sugar-pipeline.test.ts:264-265`.
- **(Limitation)** No `01-domain-distillation.md` exists; concept boundaries here
  were derived directly from PRD + code, not from a prior distillation.

---

# Executive Summary

The selected invariant is **INV-1 — the persisted sugar plan
(`fermentation_sugar_kg`, `sweetness_sugar_kg`) must be mathematically consistent
with each batch's own parameters and ingredients** (including the sub-rule that a
`dry` batch has zero sweetness sugar). It was chosen because it is at once the
product's #1 guardrail — the PRD states wrong math _"destroys user trust
immediately"_ (`prd.md:37`) and the test plan ranks it Risk #1/#4 — and its least
enforced: the calculation runs **only in client components** behind a manual
Calculate button (`IngredientsSection.tsx:126-142`), while the API persists any
non-negative number verbatim (`index.ts:29-33`, `batch.ts:19-20`) and the
database has no CHECK constraint (`…20260613140000….sql:6-7`); the existing
"roundtrip" integration test even certifies this passthrough
(`sugar-pipeline.test.ts:231-267`). The main weaknesses are a UI-only guardian,
no server recomputation, a client-only dry⇒0 reset, and unvalidated sugar
flowing downstream into process-plan generation (`process-plan-generation.ts:45`).
The proposed guardian is a **`BatchPlan` aggregate** owning a **`SugarPlan`**
value object that computes the canonical plan server-side (reusing the existing
`calculateSugar`), records deliberate manual overrides with explicit provenance to
honour the "always editable" requirement (`prd.md:83`), and fails fast with named
domain errors on any inconsistent plan. Architecturally this collapses a
scattered, bypassable rule into a single authoritative source at the trust
boundary, closes every current violation path (direct API writes, stale edits,
manual card edits, dry inconsistency), stabilises the downstream process plan, and
lands cleanly on the already-planned repository seam.
