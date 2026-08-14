---
title: Domain Distillation
created: 2026-08-08
type: domain-distillation
---

# Fermenta — Domain Distillation

> A DDD domain map distilled from documentation and implementation. Output is a
> domain map, not code. Every significant claim is cited with `file:path:line`.
> Findings are labelled **[Fact]** (verified in source), **[Interpretation]**
> (reasoned from evidence), or **[Assumption]** (unverified inference).

---

## STEP 0 — Project Context

### Sources consulted

| Source                                            | Type                 | Used for                                              |
| ------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `context/foundation/prd.md`                       | Product requirements | Vision, personas, FRs, access control, non-goals      |
| `context/foundation/domain_knowledge.md`          | Domain research      | Winemaking rules, timelines, sugar/osmotic thresholds |
| `context/foundation/roadmap.md`                   | Delivery plan        | Slice history, north star, aggregate evolution        |
| `context/foundation/tech-stack.md`                | Architecture         | Stack rationale                                       |
| `context/foundation/lessons.md`                   | Engineering notes    | Hydration lesson (peripheral)                         |
| `context/foundation/shape-notes.md`               | Discovery notes      | OAuth/access-control intent                           |
| `context/foundation/test-plan.md`                 | QA strategy          | Provider/grounding notes (peripheral)                 |
| `src/types.ts`                                    | Code (domain types)  | Batch, Ingredient, DiaryEntry shapes                  |
| `src/lib/services/sugar-calculation.ts`           | Code (core logic)    | Sugar plan calculation                                |
| `src/lib/services/batch-validation.ts`            | Code (core logic)    | Plan-consistency rules                                |
| `src/lib/services/process-plan-generation.ts`     | Code (core logic)    | Process step templates                                |
| `src/lib/schemas/{batch,diary-entry,auth}.ts`     | Code (validation)    | Input invariants                                      |
| `src/pages/api/batches/**`                        | Code (application)   | Batch + diary orchestration                           |
| `src/components/batches/**`                       | Code (UI)            | Client calc/validation orchestration                  |
| `supabase/migrations/*.sql`                       | Code (persistence)   | Schema, RLS, triggers, RPC, aggregate evolution       |
| `src/middleware.ts`, `src/lib/supabase.ts`        | Code (auth)          | Access control                                        |
| `context/archive/2026-06-14-diary-consolidation/` | History              | Process-plan ↔ diary merge                            |

> **[Fact]** Requirements documentation is present and rich, so it is the
> primary input; source code is used to confirm/contradict it. This distillation
> is **not** operating under the "docs missing" limitation.

### Technology stack

**[Fact]** Astro 6 SSR + React 19 islands + Tailwind 4 + shadcn/ui, Supabase
(Auth + Postgres) accessed via `@supabase/ssr`, deployed to Cloudflare Workers;
TypeScript throughout; Zod for input validation; Vitest + Playwright + Stryker
for tests (`context/foundation/tech-stack.md:1-24`, `astro.config.mjs`).

### Repository structure & architectural layers

| Layer                        | Location                                   | Evidence                                                       |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| UI (pages)                   | `src/pages/**/*.astro`                     | `src/pages/batches/[id].astro:1-36`                            |
| UI (islands)                 | `src/components/**/*.tsx`                  | `src/components/batches/BatchForm.tsx`                         |
| API / application            | `src/pages/api/**/*.ts`                    | `src/pages/api/batches/index.ts:7-97`                          |
| Domain logic (services)      | `src/lib/services/*.ts`                    | `src/lib/services/sugar-calculation.ts`                        |
| Input contracts (schemas)    | `src/lib/schemas/*.ts`                     | `src/lib/schemas/batch.ts:10-38`                               |
| Domain types                 | `src/types.ts`                             | `src/types.ts:1-65`                                            |
| Persistence + RLS + triggers | `supabase/migrations/*.sql`                | `supabase/migrations/20260530213000_batch_schema_with_rls.sql` |
| Auth / access control        | `src/middleware.ts`, `src/lib/supabase.ts` | `src/middleware.ts:4-25`                                       |

> **[Interpretation]** Business logic is concentrated in three pure-function
> services under `src/lib/services/` and in three SQL objects (RLS policies, an
> ownership-promotion trigger, a regenerate RPC). There is no explicit "domain"
> layer or aggregate class — the domain model is implicit, spread across TS types,
> pure services, and database constraints.

---

## STEP 1 — Ubiquitous Language

Concepts extracted from documentation **and** implementation. Terminology is
taken verbatim from sources; nothing is invented.

| Concept                                   | Definition (from evidence)                                                                                                   | Source evidence                                                            | Code evidence                                                            | Status                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Batch**                                 | A planned wine fermentation: parameters, ingredients, yeast, sugar plan, and a process diary. The central object of the app. | "A user can create a batch, enter parameters and ingredients…" `prd.md:31` | `src/types.ts:9-25`; `batches` table `…20260530213000…:23-36`            | IMPLEMENTED                                                       |
| **Ingredient**                            | A named input with amount and sugar content per unit; user-provided.                                                         | FR-006 `prd.md:66`                                                         | `src/types.ts:3-7`; JSONB column `…20260605220000…:5`                    | IMPLEMENTED (as embedded value object)                            |
| **Yeast**                                 | Optional culture with an alcohol tolerance; drives consistency checks.                                                       | FR-005 `prd.md:65`                                                         | `yeast_name`, `yeast_alcohol_tolerance` on Batch `src/types.ts:18-19`    | PARTIALLY_IMPLEMENTED (not an entity; two scalar fields on Batch) |
| **Process Type**                          | `pulp` or `juice` — the two template families for plan generation.                                                           | FR-010 `prd.md:74`                                                         | enum `…20260530213000…:15`; `src/types.ts:13`                            | IMPLEMENTED                                                       |
| **Planned Sweetness**                     | Target residual sweetness: `dry`, `semi_dry`, `semi_sweet`, `sweet`.                                                         | FR-004 `prd.md:64`                                                         | enum `…20260530213000…:16`; `src/types.ts:1`                             | IMPLEMENTED                                                       |
| **Target ABV**                            | Target alcohol by volume; drives sugar demand and validation.                                                                | FR-004 `prd.md:64`                                                         | `target_abv` `src/types.ts:16`; `sugar-calculation.ts:45`                | IMPLEMENTED                                                       |
| **Target Volume**                         | Batch size in litres; scales sugar demand.                                                                                   | FR-004 `prd.md:64`                                                         | `target_volume_liters` `src/types.ts:15`                                 | IMPLEMENTED                                                       |
| **Sugar Plan / Sugar Calculation**        | Computes missing fermentation sugar and (for non-dry) sweetness sugar.                                                       | FR-008 `prd.md:70`; "Business Logic" `prd.md:87`                           | `calculateSugar()` `sugar-calculation.ts:36-59`                          | IMPLEMENTED                                                       |
| **Fermentation Sugar**                    | Sugar (kg) needed to hit target ABV beyond ingredient sugar.                                                                 | FR-008 `prd.md:70`                                                         | `fermentation_sugar_kg` `src/types.ts:20`; `…20260613140000…:6`          | IMPLEMENTED                                                       |
| **Sweetness Sugar**                       | Sugar (kg) added post-fermentation for residual sweetness.                                                                   | FR-006/008 `prd.md:66,70`                                                  | `sweetness_sugar_kg` `src/types.ts:21`; `sugar-calculation.ts:50-51`     | IMPLEMENTED                                                       |
| **Yeast Alcohol Tolerance**               | Max ABV a yeast can reach; boundary for consistency.                                                                         | FR-005 `prd.md:65`                                                         | `yeast_alcohol_tolerance` `src/types.ts:19`; `batch-validation.ts:37-55` | IMPLEMENTED                                                       |
| **Validation Warning / Plan Consistency** | Soft advisory when the plan is internally inconsistent. Never blocks.                                                        | FR-009 `prd.md:71`; Guardrails `prd.md:38`                                 | `validateBatch()` + 9 rules `batch-validation.ts:24-136`                 | IMPLEMENTED                                                       |
| **Process Plan / Process Steps**          | Generated, editable sequence of dated winemaking steps.                                                                      | FR-010/011 `prd.md:74-75`                                                  | `generateProcessPlan()` `process-plan-generation.ts:165-171`             | IMPLEMENTED (renamed → "diary" — see gaps)                        |
| **Diary Entry**                           | A single process step or user note: description, date, completed, type.                                                      | "structured process diary" `prd.md:22`                                     | `src/types.ts:39-49`; `diary_entries` `…20260614130000…:7-11`            | IMPLEMENTED                                                       |
| **Entry Type (auto / user)**              | Provenance of a diary entry: generated vs user-authored.                                                                     | (implicit in FR-010/011)                                                   | `entry_type` CHECK `…20260614130000…:10`; `src/types.ts:37`              | IMPLEMENTED                                                       |
| **Ownership Promotion**                   | Editing an auto entry's text promotes it to `user`, shielding it from regeneration.                                          | No supporting evidence found in docs                                       | trigger `promote_diary_entry_type()` `…20260614130000…:29-44`            | IMPLEMENTED (undocumented)                                        |
| **Regeneration**                          | Atomic replace of all `auto` diary entries from current parameters; keeps `user` entries.                                    | FR-010 (regeneration implied)                                              | RPC `regenerate_diary_entries()` `…20260614130000…:47-61`                | IMPLEMENTED                                                       |
| **Step Template**                         | Declarative rule: description, day-offset, and a condition predicate.                                                        | domain_knowledge §9-10 `domain_knowledge.md:295-347`                       | `STEP_TEMPLATES` `process-plan-generation.ts:51-154`                     | IMPLEMENTED                                                       |
| **Osmotic Stress / 25°Blg threshold**     | Safe upper starting sugar; above it, stagger additions.                                                                      | domain_knowledge §2 `domain_knowledge.md:64-107`                           | Static hint string only `process-plan-generation.ts:25`                  | PARTIALLY_IMPLEMENTED (advisory text, not computed)               |
| **Stabilization + Back-sweetening**       | Non-dry-only steps to stop refermentation then sweeten.                                                                      | domain_knowledge §5 `domain_knowledge.md:180-211`                          | `isNotDry` steps `process-plan-generation.ts:136-147`                    | IMPLEMENTED (as generated steps)                                  |
| **Cap Management / Pressing**             | Pulp-only maceration steps.                                                                                                  | domain_knowledge §3 `domain_knowledge.md:111-149`                          | `isPulp` steps `process-plan-generation.ts:76-93`                        | IMPLEMENTED                                                       |
| **User / Account**                        | Authenticated owner; flat model, sees only own batches.                                                                      | Access Control `prd.md:96-97`                                              | `auth.users` FK `…20260530213000…:25`; `middleware.ts:4-23`              | IMPLEMENTED (email+password only)                                 |
| **Wild Yeast**                            | Implicit risk when no yeast is specified.                                                                                    | US-01 acceptance `prd.md:51`                                               | warning rule `batch-validation.ts:25-27`                                 | IMPLEMENTED (advisory)                                            |
| **OAuth sign-in**                         | Alternative account creation method.                                                                                         | FR-001 `prd.md:59`; `shape-notes.md:52`                                    | none                                                                     | NOT_FOUND_IN_CODE                                                 |
| **Duplicate / Copy Batch**                | Clone parameters + ingredients into a new batch with a fresh diary.                                                          | roadmap S-05 `roadmap.md:130-137`                                          | `?from=` prefill `[id].astro:33`, `new.astro:7-28`                       | IMPLEMENTED (composed via create flow, not a dedicated endpoint)  |

---

## STEP 2 — Subdomain Classification

The PRD's vision names three capabilities "a notes file or spreadsheet cannot
deliver together": **sugar/alcohol calculation, plan validation, and process
plan generation** (`prd.md:87`). These three are therefore the competitive core.

| Subdomain                                       | Category       | Justification                                                                                                                               | Evidence                                          |
| ----------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Sugar Calculation**                           | **Core**       | The guardrail "wrong math destroys user trust immediately" (`prd.md:37`); north star is the calculation slice (`roadmap.md:22-24`).         | `sugar-calculation.ts:36-59`                      |
| **Plan Validation (consistency)**               | **Core**       | Second half of the differentiator: ABV-vs-tolerance and sweetness-won't-stop checks are unique value (`prd.md:71`).                         | `batch-validation.ts:24-136`                      |
| **Process Plan Generation**                     | **Core**       | Third named differentiator; parameter-driven, domain-researched templates (`prd.md:74`, `domain_knowledge.md`).                             | `process-plan-generation.ts:51-171`               |
| **Batch management (CRUD/params/duplicate)**    | **Supporting** | Necessary container for the core, but "straightforward CRUD with no complex logic" (`roadmap.md:89`).                                       | `src/pages/api/batches/index.ts`, `[id]/index.ts` |
| **Process Diary tracking (complete/edit/sort)** | **Supporting** | Enables the workflow but is note-keeping, not the differentiator; PRD even lets a diary entry substitute for "final result" (`prd.md:104`). | `DiarySection.tsx:77-149`                         |
| **Authentication & per-user isolation**         | **Generic**    | Delegated to Supabase Auth; "flat user model," no roles/sharing (`prd.md:96-97`). RLS is standard multi-tenant boilerplate.                 | `middleware.ts`, `…20260530213000…:64-81`         |

> **[Interpretation]** Calculation + Validation are so tightly coupled (validation
> consumes `CalculationResult`, `batch-validation.ts:22`) that they behave as a
> single **Sugar Planning** core module. Process Plan Generation is a second,
> loosely-coupled core module (it depends only on `process_type`,
> `planned_sweetness`, `fermentation_sugar_kg`, `process-plan-generation.ts:5`).

---

## STEP 3 — Aggregate Candidates & Invariants

Enforcement status is one of ENFORCED / DECLARED_ONLY / NOT_ENFORCED / UNKNOWN,
asserted only from evidence.

### Candidate A — **Batch** (aggregate root)

- **Responsibility:** own its parameters, embedded ingredients, yeast, sugar
  plan, and lifecycle; act as the consistency boundary for a single fermentation.
- **Boundary evidence:** ingredients are an embedded JSONB array on `batches`
  (`…20260605220000…:5`), and sugar amounts are scalar columns on `batches`
  (`…20260613140000…:6-7`) — i.e. no child entities, a classic aggregate shape.

| Invariant                                                                | Status                            | Evidence                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A batch belongs to exactly one user; a user reads/writes only their own. | **ENFORCED**                      | RLS policy `USING (auth.uid() = user_id)` `…20260530213000…:68-71`; protected routes `middleware.ts:4,19-23`                                                                                                               |
| `fermentation_sugar_kg >= 0` and `sweetness_sugar_kg >= 0`.              | **ENFORCED**                      | Zod `.min(0)` `batch.ts:19-20`; DB `NOT NULL DEFAULT 0` `…20260613140000…:6-7`                                                                                                                                             |
| Ingredient `sugar_content_percent ∈ [0,100]` or null.                    | **ENFORCED**                      | Zod `min(0).max(100).nullable()` `batch.ts:7`                                                                                                                                                                              |
| Fermentation sugar = `max(0, sugarNeededForABV − ingredientSugar)`.      | **NOT_ENFORCED (at persistence)** | Computed in pure fn `sugar-calculation.ts:47`, but the API persists the client-supplied column verbatim without recomputే `src/pages/api/batches/index.ts:29-33`; user may edit it freely `IngredientsSection.tsx:174-177` |
| `planned_sweetness = 'dry'` ⇒ `sweetness_sugar_kg = 0`.                  | **DECLARED_ONLY**                 | Reset only in the client on change `BatchForm.tsx:148-154`; no server/DB constraint — a `PUT` can violate it `api/batches/[id]/index.ts:46-52`                                                                             |
| Plan consistency warnings (ABV≤tolerance, etc.) surfaced.                | **DECLARED_ONLY**                 | Runs client-side on blur only `BatchForm.tsx:156-159`; never validated server-side or persisted                                                                                                                            |

### Candidate B — **Process Plan / Diary** (entries owned by a Batch)

- **Responsibility:** hold the generated + user-authored process steps for a
  batch, and protect user edits from regeneration.
- **Boundary evidence:** `diary_entries.batch_id … ON DELETE CASCADE`
  (`…20260530213000…:53`) ties lifecycle to the batch.

| Invariant                                                          | Status                   | Evidence                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Every diary entry belongs to a batch owned by the acting user.     | **ENFORCED**             | RLS `EXISTS (… b.user_id = auth.uid())` `…20260530213000…:78-81`; entryId scoped by `batch_id` `api/…/diary/[entryId].ts:36-37` |
| `entry_type ∈ {auto, user}`.                                       | **ENFORCED**             | CHECK constraint `…20260614130000…:10`                                                                                          |
| Regeneration deletes only `auto` entries; `user` entries survive.  | **ENFORCED**             | `DELETE … WHERE entry_type = 'auto'` in RPC `…20260614130000…:56`                                                               |
| Editing an `auto` entry's description/notes promotes it to `user`. | **ENFORCED**             | trigger `…20260614130000…:32-37`                                                                                                |
| Toggling `completed` / changing `entry_date` does **not** promote. | **ENFORCED (by design)** | trigger excludes those fields `…20260614130000…:25-37`                                                                          |
| Regenerate authorises the caller against batch ownership.          | **ENFORCED**             | `SECURITY DEFINER` fn re-checks `user_id = auth.uid()` `…20260614130000…:52-54`                                                 |

### Candidate C — **User / Account**

- **Responsibility:** identity + tenancy key. **[Interpretation]** Generic
  subdomain fully delegated to Supabase; not a modelling target for Fermenta.
- Invariant: password ≥ 6 chars — **ENFORCED** (`auth.ts:10`). No OAuth path — **UNKNOWN/absent** (`signin.ts:23`).

---

## STEP 4 — Model vs Code Discrepancy Report

> **[Fact]** This is the highest-value section: it shows where documented domain
> knowledge and the running code diverge.

| #   | Domain model says                                                                                                                                                   | Code does                                                                                                                                                                                    | Evidence                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Accounts support "email + password **or OAuth**" (FR-001).                                                                                                          | Only email+password is implemented; no OAuth provider call exists.                                                                                                                           | `prd.md:59,97` vs `auth.ts:3-11`, `signin.ts:23` (no `signInWithOAuth` in `src`)                                                   |
| 2   | For non-dry wines the app "auto-creates separate **entries** for `sugar_for_fermentation` and `sugar_for_sweetness`" as adjustable **ingredient entries** (FR-006). | Sugars are **scalar batch columns** (`fermentation_sugar_kg`, `sweetness_sugar_kg`), edited via dedicated Sugar cards — not ingredient rows.                                                 | `prd.md:66` vs `…20260613140000…:2-25`, `IngredientsSection.tsx:171-198`                                                           |
| 3   | Original model had a first-class **Ingredient entity** table with an `ingredient_type` enum (`user_input`/`fermentation_sugar`/`sweetness_sugar`).                  | Ingredients became an embedded **JSONB value-object array**; the table, trigger, and enum were dropped.                                                                                      | `…20260530213000…:38-49` vs `…20260605220000…:5-10`                                                                                |
| 4   | PRD/domain speak of a "**process plan**" / "process steps" distinct from a "**process diary**".                                                                     | The two were consolidated into one `diary_entries` table with `entry_type`; "Process Plan" is a generation function, "Process Diary" is the stored form.                                     | `prd.md:74` + `prd.md:22,104` vs `context/archive/2026-06-14-diary-consolidation/change.md`, `…20260614130000…:1-11`               |
| 5   | Ingredients have an "amount + sugar content **per unit**" (unit-agnostic; the pulp process even "crush[es] fruit", i.e. solids) (FR-006).                           | Amount is hard-coded to **litres** (`amount_liters`); the `unit` column from F-01 was dropped; sugar math assumes `L × % × 10 g`.                                                            | `prd.md:66` + `process-plan-generation.ts:24` vs `src/types.ts:3-7`, `…20260530213000…:45` (dropped), `sugar-calculation.ts:40-43` |
| 6   | No documented formula for how much sugar a sweetness level implies.                                                                                                 | Code encodes an **undocumented `SWEETNESS_MIDPOINTS` heuristic** (dry 0 / semi_dry 10 / semi_sweet 30 / sweet 60 g/L) for calculation, **and a separate `SWEETNESS_RANGES`** for validation. | No supporting evidence in docs vs `sugar-calculation.ts:5-17`, used at `:50` and `batch-validation.ts:98-108`                      |
| 7   | Detailed **osmotic-stress / staggered-sugar** rules (25–30°Blg) are a core research output.                                                                         | Surfaced only as a fixed hint string; never computed from volume/sugar, never validated.                                                                                                     | `domain_knowledge.md:64-107` vs `process-plan-generation.ts:25` (only), no rule in `batch-validation.ts`                           |
| 8   | Calculation "appears immediately" after entering parameters (Business Logic, `prd.md:93`).                                                                          | Warnings recompute on blur, but **sugar amounts require an explicit "Calculate" button**; the server never recomputes on save.                                                               | `prd.md:93` vs `IngredientsSection.tsx:126-142,199-207`; `api/batches/index.ts:29-33`                                              |
| 9   | "Sugar calculation must be mathematically **correct**" is the top guardrail (`prd.md:37`).                                                                          | The calculation lives only in a **client-side pure function**; the persisted `fermentation_sugar_kg` is free-text-editable and can diverge from ingredients+ABV with no server guard.        | `prd.md:37` vs `sugar-calculation.ts` (client-invoked) + `IngredientsSection.tsx:174-177`                                          |
| 10  | Validation warnings inform plan consistency (FR-009).                                                                                                               | Warnings are a **pure UI concern** — computed in the browser, never returned by the API nor stored.                                                                                          | `prd.md:71` vs `BatchForm.tsx:54-81,156-159` (no server call)                                                                      |

> **[Interpretation]** Discrepancies #8–#10 are largely _intentional_: the PRD
> insists the tool is advisory and "the user always retains control to proceed"
> (`prd.md:38`, `prd.md:80-83`). The risk is not that values are editable — it is
> that the Core invariant (correct sugar math) is defined once in a client module,
> is duplicated conceptually across UI call-sites, and is **never asserted at the
> persistence boundary**, so a bad client or a direct API call can store an
> internally-inconsistent plan silently.

---

## STEP 5 — Refactoring Priority Ranking

Ranked by **Business Value** (importance to the Core Domain) × **Risk** (how
weakly the concept is enforced/represented today).

| Rank   | Item                                                                                                                                                                                               | Business value                                                                                 | Risk                                                                                                                                                                 | Rationale & evidence                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **#1** | **Formalise the Batch aggregate as guardian of the sugar plan** — one server-side authority that (re)computes `calculateSugar`, records/derives warnings, and treats manual overrides as explicit. | **Highest** — this _is_ the trust guardrail (`prd.md:37`) and north star (`roadmap.md:22-24`). | **Highest** — invariant lives only client-side and is never enforced/recorded on write (gaps #8-#10; `sugar-calculation.ts` never called in `api/batches/index.ts`). | Consolidates the Core invariant at the consistency boundary without removing user control (store computed _and_ override values). |
| #2     | **Codify the sweetness scale as a named domain policy** (single source for `SWEETNESS_MIDPOINTS` vs `SWEETNESS_RANGES`) and document it.                                                           | High — drives both calc and validation of non-dry wines.                                       | Medium-High — two undocumented, subtly different scales (gap #6).                                                                                                    | Removes a silent inconsistency between calculation and its own validation rule.                                                   |
| #3     | **Model the osmotic-stress rule** (compute starting Blg, warn/stagger) instead of a static string.                                                                                                 | Medium — a differentiating safety insight already researched.                                  | Medium — well-documented in domain, absent in logic (gap #7).                                                                                                        | Turns dormant domain knowledge into an enforced advisory.                                                                         |
| #4     | **Reconcile Ingredient's `unit`** (litres-only vs "per unit" incl. solids).                                                                                                                        | Medium — affects correctness for pulp/fruit batches.                                           | Medium — model assumes litres; docs assume unit-agnostic (gap #5).                                                                                                   | Prevents wrong sugar math for non-liquid ingredients.                                                                             |
| #5     | **Resolve OAuth scope** (implement or strike from PRD).                                                                                                                                            | Low-Medium — generic subdomain.                                                                | Low — clear doc/code divergence (gap #1).                                                                                                                            | Cheap truth-in-documentation fix.                                                                                                 |

### #1 Refactoring Candidate — Batch aggregate owns the sugar plan (server-side)

**Why it wins the value × risk combination:**

- **Domain value:** The sugar calculation is the single most important thing this
  product does — the PRD makes "mathematically correct" sugar the make-or-break
  guardrail (`prd.md:37`) and the roadmap places the calculation slice as the
  north star that "validates the product's reason to exist" (`roadmap.md:22-24`).
- **Architectural risk reduced:** Today the Core invariant is a client-side pure
  function (`src/lib/services/sugar-calculation.ts`) that the API layer never
  invokes on write — `POST /api/batches` inserts the client-provided
  `fermentation_sugar_kg`/`sweetness_sugar_kg` verbatim
  (`src/pages/api/batches/index.ts:29-33`), and any user or client can set those
  columns arbitrarily (`IngredientsSection.tsx:174-177`). The plan-consistency
  rules likewise never run server-side (`BatchForm.tsx:156-159`). Elevating the
  Batch to a real aggregate that recomputes the derived sugar demand, stores both
  the computed value and any explicit override, and derives warnings at the write
  boundary would defend the highest-value invariant **without** violating the
  PRD's "user retains control" principle (keep overrides first-class and visible).

**[Assumption]** This refactor assumes the product still wants advisory (non-
blocking) behaviour; it recommends _recording_ consistency, not _rejecting_
inconsistent plans — consistent with `prd.md:38`.

---

## Evidence Rules Compliance

- Every table row and ranked item cites `file:path:line` for its claim.
- Where documentation asserts a concept absent from code, it is marked
  **NOT_FOUND_IN_CODE** (OAuth, STEP 1) or called out in STEP 4.
- Enforcement is stated only from constraints, triggers, RLS, or schema evidence;
  unverifiable claims are labelled **UNKNOWN** or **[Assumption]**.
- "No supporting evidence found" is used explicitly where docs are silent
  (Ownership Promotion, Sweetness scale).

---

## Executive Summary

Fermenta is a home-winemaking planner whose ubiquitous language centres on a
single **Batch** aggregate that carries parameters, embedded **Ingredients**, an
optional **Yeast**, a two-part **Sugar Plan** (fermentation + sweetness sugar),
and a **Process Diary** of generated and user-authored steps. Its core domain is
narrow and clear: **sugar calculation, plan-consistency validation, and process-
plan generation** — the three capabilities the PRD says a notes file cannot
combine — while authentication and per-user isolation are generic concerns
delegated to Supabase and enforced well through RLS, ownership triggers, and a
SECURITY DEFINER regenerate RPC. The most important **invariant** is that a
batch's fermentation sugar must correctly equal the ABV demand minus ingredient
sugar, because the PRD makes calculation correctness the trust-defining guardrail;
the strongest **aggregate candidate** is a fully-realised Batch that owns this
sugar plan. The most significant **model-vs-code discrepancies** are that this
core invariant is computed only in a client-side pure function and is never
recomputed or enforced when the API persists the batch, that the sweetness-to-
sugar mapping is an undocumented heuristic split across two different scales, and
that the documented osmotic-stress rules survive only as a static hint string;
smaller gaps include absent OAuth and the relocation of sugar "entries" from
ingredient rows to scalar columns. The **highest-priority refactor** is therefore
to formalise the Batch aggregate as the server-side guardian of its sugar plan —
recomputing and recording the calculation and its warnings at the write boundary
while preserving explicit user overrides. The **primary architectural insight** is
that Fermenta's competitive core logic is well-tested but lives entirely in
advisory client-side services, so the domain's single most valuable rule is
currently defended nowhere at the persistence boundary — closing that gap, without
sacrificing the product's deliberate "user stays in control" stance, is the
central modelling opportunity.
