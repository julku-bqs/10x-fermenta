# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-20

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   \<area\>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`.
Top churn directories (30d): `src/components/batches/` (28), `src/pages/api/` (16), `src/lib/services/` (11), `src/pages/batches/` (9), `src/lib/schemas/` (7).

Test-base profile: **sparse** — vitest configured, 4 test files in `src/lib/` only. Existing tests are untrusted (AI-generated without a plan, inconsistently located, may test implementation instead of business rules). Phase 1 audits and rebuilds them.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|-------------------------------|
| 1 | Sugar calculation produces incorrect results for a non-trivial input combination (wrong fermentation sugar, wrong sweetness sugar, wrong total) | High | High | PRD §Guardrails "wrong math destroys user trust"; interview Q1, Q3; hot-spot `src/lib/services/` (11 commits/30d) |
| 2 | Validation rules fail to warn when plan is physically inconsistent (ABV > yeast tolerance undetected, sweetness/tolerance interaction missed) | High | High | PRD §FR-009 (three validation rules); interview Q1, Q3; hot-spot `src/lib/services/` |
| 3 | Process plan generation produces wrong or missing steps for non-dry wines (no fermentation stop, no sweetness correction step, wrong template selection) | High | Medium | PRD §FR-010 (two templates with conditional steps); interview Q1, Q3; hot-spot `src/lib/services/` |
| 4 | Sugar calculation receives incorrect aggregated input from ingredients — unit conversion error (kg vs grams) or incomplete summation — formula is correct but inputs are wrong | Medium | High | `sugar-fields-refactoring` change: "validation rule parity depends on correct unit conversion (kg↔grams)"; documented gap: residual sugar not subtracted from sweetness target; interview Q3; hot-spot `src/lib/services/` |
| 5 | API route accepts malformed or out-of-range input and writes corrupt batch state (missing or incomplete zod validation) | High | Medium | AGENTS.md "API route handlers must validate input with zod schemas"; hot-spot `src/pages/api/` (16 commits/30d) |
| 6 | Authenticated user accesses or modifies another user's batch via crafted API request (IDOR — ownership check absent at API layer) | High | Low | PRD §Access Control "one user's data never visible to another"; AGENTS.md "Always enable RLS" |
| 7 | Sugar field values don't round-trip correctly through save/cancel/reload lifecycle — saved value differs from what was in the input at save time, or Cancel restores wrong values | Medium | Medium | Interview Q3; `sugar-fields-refactoring` (sugar fields are batch-level columns, editable by both Calculate and manual input); PRD §FR-006 |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Given known inputs (volume, ABV, sweetness, ingredients with sugar content), calculation output matches independently derived expected values from the formula spec — for both dry and non-dry wines | "Happy-path dry-wine test implies non-dry is also correct" | The actual formula, edge cases (zero ingredients, max ABV, boundary sweetness levels), source of truth for expected values | Unit test | Assertion copied from current implementation output (oracle problem); testing only the dry-wine path |
| #2 | Warning fires when conditions are met AND does not fire when conditions are not met (both directions tested for all three rules) | "Testing that a warning appears implies it fires at the right threshold" | Threshold logic, interaction between ABV/tolerance/sweetness parameters, all three validation rules (ABV > tolerance, sweetness + tolerance > ABV, advisory) | Unit test | Testing only that warning exists without testing the boundary where it flips; implementation mirror |
| #3 | Generated plan for non-dry wine contains fermentation-stop + sweetness-correction steps; plan for dry wine omits them; steps reference correct parameters; both pulp and juice templates produce valid plans | "If the template compiles, the output is correct" | Template structure, parameter-driven conditional logic, both process types (pulp × juice) crossed with both sweetness modes (dry × non-dry) | Unit test | Snapshot of current output as assertion; testing only one template × sweetness combination |
| #4 | Given ingredients with known sugar content per unit, the total sugar aggregated for the formula matches an independently calculated expected total — AND batch-level sugar fields match the formula's output (end-to-end from ingredient data → aggregation → calculation → persisted fields) | "If the formula unit test passes, the full pipeline is correct" — aggregation and unit conversion are separate from the formula | How ingredients are read, what units each field uses (%, liters, kg, grams), where conversion happens, the documented kg↔grams parity concern from sugar-fields-refactoring | Unit test (aggregation) + integration test (full pipeline) | Testing only the formula in isolation without verifying the data flow into it |
| #5 | Route rejects input that violates the zod schema with a structured error response and does NOT write to the database; valid input succeeds | "If zod is imported, validation is working" — the schema might not cover all fields or might be applied to the wrong handler argument | Which routes have schemas, whether the schema is applied to the request body/params, error response shape, what happens to requests with extra/missing fields | Integration test | Testing only that the endpoint returns 200 on valid input (happy-path-only) |
| #6 | User A cannot read, update, or delete User B's batch even by crafting a direct API request with User B's batch ID | "Supabase RLS handles it" — only true if the API always uses user-scoped client, never service-role | Which Supabase client each API route uses (user JWT vs service-role), whether any route manually filters by user_id, whether any route bypasses RLS | Integration test | Testing only that auth middleware rejects unauthenticated requests (not the same as ownership checks) |
| #7 | After save, reloaded sugar fields match exactly what was in the input at save time; after cancel, fields match the last-saved values — regardless of whether the values came from Calculate or manual input | "If the field is bound to the form, save/cancel just works" — batch-level sugar fields have a non-trivial lifecycle (initial 0 → calculated → manually edited) | How sugar fields flow through form state → API → database → form reload, the save/cancel form lifecycle for batch-level fields | Integration test | Testing only the Calculate→Save path without the manual-edit→Save or edit→Cancel paths |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|-----------|-----------------|---------------|------------|--------|---------------|
| 1 | Core business logic (audit + rebuild) | Audit existing untrusted tests and rebuild trusted unit tests proving calculation, validation, and process plan correctness from business rules | #1, #2, #3 | unit | complete | context/changes/testing-core-business-logic/ |
| 2 | Data integrity and interaction | Prove ingredient→calculation data flow, API input validation, and sugar field save/cancel/reload lifecycle preserve correct data | #4, #5, #7 | unit + integration | researched | context/changes/testing-data-integrity/ |
| 3 | Access control verification | Prove one user cannot reach another's data through any API surface | #6 | integration | not started | — |
| 4 | Quality gates wiring | Lock the floor: CI runs lint + typecheck + full test suite on every PR | cross-cutting | gates | not started | — |

## 4. Stack

The classic test base for this project. No AI-native tools are included
because the project's risks are fully addressable with classic deterministic
tests at the unit and integration layers.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| Unit + integration | Vitest | 3.2 | Configured in `vitest.config.ts`; path alias `@/` mapped |
| API mocking | none yet — see Phase 2 | — | Evaluate need during Phase 2 research; may not be required if integration tests hit the real service layer |
| e2e | none — deliberately excluded | — | Not justified under cost × signal for current risk map; all top risks are testable at unit/integration |
| Accessibility | none — deliberately excluded | — | UI presentation layer is negative space (interview Q5) |

**Stack grounding tools (current session):**
- Docs: none — no Context7 or framework docs MCP available in current session; checked: 2026-06-20
- Search: none — no Exa.ai or web search MCP available; checked: 2026-06-20
- Runtime/browser: none — no Playwright MCP available; not needed for current risk map; checked: 2026-06-20
- Provider/platform: Supabase MCP (dev + prod) — available for schema queries and migration validation; GitHub MCP — available for CI/issues; checked: 2026-06-20

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| Lint (ESLint) | local (pre-commit hook) + CI | required (already wired) | Syntax, type-checked lint rules |
| Typecheck (tsc) | CI | required (already wired) | Type drift |
| Unit + integration tests | local + CI | required after §3 Phase 1 | Logic regressions in calculation, validation, process plan |
| Full test suite on PR | CI on PR | required after §3 Phase 4 | All regressions caught before merge |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test for business logic

**Location**: `src/lib/services/__tests__/<service-name>.test.ts`

**Naming**: `<service-name>.test.ts` — mirrors the production file name.

**Pattern**: Table-driven parameterized tests using Vitest `it.each`:

```typescript
import { describe, expect, it } from "vitest";
import { myFunction } from "@/lib/services/my-service";

// Local domain constants — never imported from production code.
const MY_DOMAIN_CONSTANT = 17;

type Scenario = [string, Input, Expected];

const scenarios: Scenario[] = [
  ["scenario name", { ...input }, { ...expected }],
  // Derive expected values from local constants + inline arithmetic
];

describe("myFunction", () => {
  it.each(scenarios)("%s", (_name, input, expected) => {
    const result = myFunction(input);
    expect(result.field).toBeCloseTo(expected.field, 4);
  });
});
```

**Rules**:
- Never import production constants (e.g., `SWEETNESS_MIDPOINTS`). Define local equivalents.
- Expected values use inline arithmetic from domain knowledge, not captured output.
- Use `toBeCloseTo(value, 4)` for floating-point kg values; exact `toBe` for integer grams.
- Each scenario row has a descriptive name visible in runner output.
- Boundary tests use explicit threshold values where comparison operators matter.

**Run command**: `npx vitest run src/lib/services/__tests__/<file>.test.ts`

**Reference test**: `src/lib/services/__tests__/sugar-calculation.test.ts` (18 scenarios, S1–S8 coverage).

### 6.2 Adding an integration test for API routes

TBD — see §3 Phase 2 for API validation and data-flow test patterns.

### 6.3 Adding an integration test for data access / ownership

TBD — see §3 Phase 3 for access-control verification patterns.

### 6.4 Per-rollout-phase notes

(Filled in as phases ship.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **UI presentation layer** — user's explicit exclusion; risks are in business logic, not rendering. Re-evaluate if visual regressions start shipping. (Source: interview Q5.)
- **Infrastructure (Cloudflare, Supabase platform, GitHub)** — external dependencies; testing them is the vendor's job. Re-evaluate if a platform-specific failure causes a user-facing incident. (Source: interview Q5.)
- **Local development tooling and AI tools** — not user-facing; test budget has zero ROI here. (Source: interview Q5.)
- **e2e browser tests** — not justified under cost × signal for current risks; all top risks are testable at unit/integration. Re-evaluate if a risk surfaces that requires full browser + auth + cookie crossing. (Source: cost × signal analysis.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-20
- Stack versions last verified: 2026-06-20
- AI-native tool references last verified: n/a (no AI-native tools in stack)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
