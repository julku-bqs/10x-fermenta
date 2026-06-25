# Core Business Logic Tests — Audit & Rebuild Implementation Plan

## Overview

Delete all 4 existing untrusted AI-generated test files and rebuild from scratch as table-driven parameterized tests for the 3 core business logic services: sugar calculation, batch validation, and process plan generation. Establishes the canonical test patterns for this project (filling test-plan.md §6.1).

## Current State Analysis

- **4 test files exist** — AI-generated, inconsistently located, partially mirroring implementation
- **2 co-located**: `src/lib/services/sugar-calculation.test.ts`, `src/lib/services/batch-validation.test.ts`
- **1 in subfolder**: `src/lib/services/__tests__/process-plan-generation.test.ts`
- **1 schema test** (reference only, not rebuilt in this change): `src/lib/schemas/batch.test.ts`
- **All 3 services are pure functions** — no mocks, no DB, no side effects
- **Vitest configured**: globals: true, path alias `@/` → `./src/`

### Key Discoveries:

- Sugar calculation uses `17 g/L per ABV %` constant and `SWEETNESS_MIDPOINTS` table (research §Sugar Calculation)
- Batch validation has 9 rules (not 3 from PRD), rules 3 & 4 use strict `>` comparison (research §Batch Validation)
- Process plan has 17 step templates with 4 named condition functions (research §Process Plan)
- Existing tests have oracle risk (import production constants), missing boundary tests, and missing negative assertions

## Desired End State

Three test files in `src/lib/services/__tests__/`, using table-driven `test.each` pattern, covering every scenario from the research tables (S1–S8, V1–V12, P1–P17) plus rebuilt versions of all valid existing scenarios. All tests pass, expected values are derived from local domain constants (never imported from production), and the pattern is documented in test-plan.md §6.1.

**Verification**: `npx vitest run` exits 0 with all scenarios passing; `npm run lint` passes.

## What We're NOT Doing

- Not rewriting the schema file (`batch.test.ts`) — it uses good patterns; only relocated to `__tests__/`
- Not implementing integration tests (that's Phase 2 of the test plan)
- Not fixing known formula gaps (residual sugar, volume correction) — tests validate CURRENT behavior
- Not adding shared test utilities across files — each file is self-contained
- Not migrating to key-based assertions for process plan steps (pending `expose-step-key` change)
- Not wiring CI test gate (that's Phase 4 of the test plan)

## Implementation Approach

Four phases: Phase 0 handles all file relocations and infrastructure verification in a single sequential pass. Phases 1–3 then rewrite test content — one per service — and can be executed simultaneously by separate agents since they touch independent files with no shared state.

## Critical Implementation Details

**Research as ground truth for test scenarios**: Before writing any test file, the implementer MUST read `context/changes/testing-core-business-logic/research.md` in full. It contains:

- **Formulas and constants** (§Sugar Calculation Service) — the exact arithmetic for deriving expected values (17 g/L per ABV %, SWEETNESS_MIDPOINTS table, ingredient aggregation formula)
- **Rule thresholds and comparison operators** (§Batch Validation Service) — which rules use strict `>` vs `>=`, the 9-rule table with line references, and the `ValidationInput` shape
- **Step matrix and condition functions** (§Process Plan Generation Service) — the complete 17-step × 4-condition truth table, day offsets, and output shape (`DiaryEntryDraft[]`)
- **Missing-scenarios tables** (§Missing Test Scenarios) — S1–S8, V1–V12, P1–P17 with input sketches and "why it matters" rationale. These ARE the test rows — translate them directly into `test.each` entries.
- **Resolved questions** (§Resolved Questions) — expected-value style (local constants, inline arithmetic), assertion patterns (`stringContaining` for process plan), and test disposition (full rewrite).

Do NOT derive expected values by running the production code and capturing output. Derive them from the formulas documented in research, using local domain constants defined in the test file.

## Phase 0: File Relocations & Infrastructure Verification

### Overview

Move all test files to standardized `__tests__/` subfolder locations and verify vitest discovers them correctly. This phase MUST complete before Phases 1–3 begin (they depend on files being in their final locations).

### Changes Required:

#### 1. Create missing directories

**Intent**: Ensure `src/lib/schemas/__tests__/` exists for the schema test relocation.

**Contract**: `mkdir src/lib/schemas/__tests__/` (create directory; `src/lib/services/__tests__/` already exists)

#### 2. Relocate all test files

**File**: `src/lib/services/sugar-calculation.test.ts` → `src/lib/services/__tests__/sugar-calculation.test.ts`
**File**: `src/lib/services/batch-validation.test.ts` → `src/lib/services/__tests__/batch-validation.test.ts`
**File**: `src/lib/schemas/batch.test.ts` → `src/lib/schemas/__tests__/batch.test.ts`

**Intent**: Move all co-located test files into `__tests__/` subfolders using `git mv` to preserve history. Process plan test already in correct location — no move needed.

**Contract**: Three `git mv` commands, then a single commit for all relocations.

#### 3. Verify infrastructure

**Intent**: Confirm vitest discovers ALL test files (including `process-plan-generation.test.ts` which wasn't moved) at their new locations and the `@/` path alias resolves.

**Contract**: Run `npx vitest run` — all relocated tests must be found and executed (they may pass or fail; discovery is the gate, not correctness).

### Success Criteria:

#### Automated Verification:

- All test files exist in `__tests__/` subfolders (no test files remain co-located)
- `npx vitest run` discovers and executes all test files (exit code may be non-zero if tests fail, but no "file not found" or "module not found" errors)
- `git status` shows clean state (relocations committed)

---

## Phase 1: Sugar Calculation Tests

### Overview

Rebuild sugar calculation tests with complete coverage of all sweetness levels, ingredient edge cases, and precision scenarios. Table-driven with independently derived expected values.

### Behavior Under Test

Given a set of ingredients (with amount and sugar content), a target volume, a target ABV, and a sweetness level, `calculateSugar` must:

1. **Aggregate ingredient sugar correctly** — sum of `amount_liters × sugar_content_percent × 10` across all ingredients, treating null/zero sugar as 0 contribution
2. **Compute fermentation sugar** — `max(0, (target_abv × 17 × volume) − ingredient_sugar) / 1000` in kg; clamps to 0 when ingredients already exceed needs
3. **Compute sweetness sugar** — `SWEETNESS_MIDPOINTS[level] × volume / 1000` in kg; independent of fermentation path
4. **Handle edge inputs** — zero volume → all outputs 0; zero ABV → fermentation sugar 0; no ingredients → full sugar needed for ABV

### Changes Required:

#### 1. Rewrite sugar calculation test suite

**File**: `src/lib/services/__tests__/sugar-calculation.test.ts`

**Intent**: Replace all existing test content with a table-driven test suite covering the research scenarios S1–S8 plus the valid existing scenarios (dry baseline, zero-volume, zero-ABV, multi-ingredient). All expected values derived from local domain constants using inline arithmetic — never imported from production code.

**Contract**: 
- Import: `calculateSugar` from `@/lib/services/sugar-calculation`
- Local constants: `GRAMS_PER_ABV_PER_LITER = 17`, `MIDPOINT_DRY = 0`, `MIDPOINT_SEMI_DRY = 10`, `MIDPOINT_SEMI_SWEET = 30`, `MIDPOINT_SWEET = 60`
- One `describe("calculateSugar")` with a single `it.each` table covering all scenarios
- Each row: `[scenario_name, input, expected_output]`
- Assertions: `toBeCloseTo(expected, 4)` for kg values; exact match for grams
- Scenarios (minimum): dry baseline (20L, 12% ABV, no ingredients), all 4 sweetness levels (S7), zero volume, zero ABV, multi-ingredient, S1 (non-dry + ingredients exceed ABV), S2 (non-dry + multi-ingredient), S3 (0% sugar ingredient), S4 (20% ABV high), S5 (0.5L small volume), S6 (10+ ingredients), S8 (0 liters ingredient)

#### 2. Update test-plan.md §6.1 cookbook entry

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 placeholder ("TBD — see §3 Phase 1") with the canonical pattern for adding unit tests to business logic services — documenting the conventions established by this phase so future contributors know how to add tests.

**Contract**: Update the `### 6.1 Adding a unit test for business logic` section with:
- Location: `src/lib/services/__tests__/<service-name>.test.ts`
- Pattern: table-driven `test.each` with named scenarios
- Expected values: local domain constants with inline arithmetic (never import from production)
- Run command: `npx vitest run src/lib/services/__tests__/<file>`
- Reference test: point to sugar-calculation test as the canonical example

### Success Criteria:

#### Automated Verification:

- Tests pass: `npx vitest run src/lib/services/__tests__/sugar-calculation.test.ts`
- All scenarios from S1–S8 plus existing valid scenarios present as named test rows
- Lint passes: `npm run lint`
- No imports from production constants (no `SWEETNESS_MIDPOINTS` or `SUGAR_PER_ABV_GRAM_PER_LITER` in import statements)
- test-plan.md §6.1 updated with cookbook pattern (no longer reads "TBD")

---

## Phase 2: Batch Validation Tests

### Overview

Rebuild batch validation tests with explicit boundary testing for all 9 rules, bidirectional assertions (fires AND does not fire), and complete coverage of the research scenarios V1–V12.

### Behavior Under Test

Given a batch's parameters (yeast presence, target ABV, yeast tolerance, planned sweetness, sugar fields) and optionally a calculation result, `validateBatch` must:

1. **Fire each warning at the correct threshold and NOT fire below it** — rules use specific comparison operators (strict `>` for rules 3 & 4; `>=` for rule 5) where boundary behavior matters
2. **Support multiple simultaneous warnings** — rules are independent; a single batch can trigger several warnings at once
3. **Rule interactions** — rule 7 has guard paths that skip when rule 5 already covers the case, or when tolerance ≤ ABV; rule 4 only fires for non-dry sweetness
4. **Null safety** — rules involving ABV/tolerance gracefully handle null values without false positives
5. **General advisory** — rule 9 always fires when target_abv is non-null (informational, not a warning about a problem)

### Changes Required:

#### 1. Rewrite batch validation test suite

**File**: `src/lib/services/__tests__/batch-validation.test.ts`

**Intent**: Replace all existing test content with table-driven tests organized as one `describe` per rule ID. Each rule has a table covering "fires when it should" and "does NOT fire when it should not" (bidirectional). Boundary tests at exact threshold values. Plus a "happy path" test proving a valid batch produces only the advisory.

**Contract**:
- Import: `validateBatch` from `@/lib/services/batch-validation`, `calculateSugar` from `@/lib/services/sugar-calculation` (needed for rules 5–8)
- One `describe` block per rule ID (9 total): `no-yeast`, `no-target-abv`, `abv-exceeds-tolerance`, `sweetness-wont-stop`, `ingredient-sugar-exceeds-needed`, `total-sugar-insufficient`, `total-sugar-exceeds-target`, `sweetness-out-of-range`, `general-advisory`
- Each describe uses `it.each` with rows: `[scenario_name, input, should_fire: boolean]`
- Assertion pattern: `expect(warnings.some(w => w.id === ruleId)).toBe(shouldFire)`
- Boundary scenarios from research: V1 (ABV === tolerance, must NOT fire), V2 (tolerance === ABV non-dry, must NOT fire), V3 (all 3 non-dry levels), V4 (ingredient === needed, fires at `>=`), V5–V7 (rule 7 guard paths), V8–V10 (rule 8 boundaries), V11 (target_abv = 0 not null), V12 (happy path no warnings except advisory)
- Helper: factory function for `ValidationInput` with sensible defaults, override per scenario

### Success Criteria:

#### Automated Verification:

- Tests pass: `npx vitest run src/lib/services/__tests__/batch-validation.test.ts`
- All scenarios from V1–V12 plus existing valid scenarios present as named test rows
- Every rule tested bidirectionally (at least one "fires" and one "does not fire" row per rule)
- Lint passes: `npm run lint`

---

## Phase 3: Process Plan Generation Tests

### Overview

Rebuild process plan generation tests covering the full 2×2×2 matrix (juice/pulp × dry/non-dry × sugar/no-sugar), negative assertions proving conditional steps are absent when conditions are false, and day offset validation for every step.

### Behavior Under Test

Given a batch's process type, planned sweetness, fermentation sugar amount, and start date, `generateProcessPlan` must:

1. **Include only steps whose conditions are met** — juice steps for juice (NOT pulp steps), pulp steps for pulp (NOT juice steps), sugar step only when `fermentation_sugar_kg > 0`, stabilize + back_sweeten only when `planned_sweetness !== "dry"`
2. **Exclude conditional steps when conditions are false** — absence is as important as presence; a dry wine must NOT contain stabilize/back_sweeten
3. **Produce correct day offsets** — each step has a fixed offset from batch start date (e.g., cap_management=1, press=10, stabilize=330, back_sweeten=332, bottling=365)
4. **Maintain chronological order** — output array is sorted by entry_date ascending regardless of template definition order
5. **Output shape** — every entry has `entry_type: "auto"` and a description string identifying the step

### Changes Required:

#### 1. Rewrite process plan generation test suite

**File**: `src/lib/services/__tests__/process-plan-generation.test.ts`

**Intent**: This file already exists in the correct location. Replace all content with a comprehensive table-driven test suite covering the 8-quadrant matrix (P1–P8), negative assertions (P9–P12), day offset verification (P13–P14), and ordering (P15) plus boundary cases (P16–P17).

**Contract**:
- Import: `generateProcessPlan` from `@/lib/services/process-plan-generation`
- Three `describe` blocks:
  1. `"step presence/absence matrix"` — `it.each` with P1–P8 rows, each specifying `expectedPresent: string[]` and `expectedAbsent: string[]` (using `stringContaining` on descriptions)
  2. `"negative assertions"` — P9–P12 as explicit "X is NOT in output" tests
  3. `"day offsets and ordering"` — P13–P15 verifying exact dates from batch_date + offset; P16–P17 for fermentation_sugar boundary at 0 vs 0.001
- Assertion pattern for presence: `expect(steps.map(s => s.description)).toEqual(expect.arrayContaining([expect.stringContaining("...")])`
- Assertion pattern for absence: `expect(steps.map(s => s.description).join()).not.toContain("...")`
- Assertion pattern for dates: `expect(step.entry_date).toBe(expectedDate)` where expectedDate derived from `batch_date + offsetDays`
- All entries verified: `entry_type === "auto"`

### Success Criteria:

#### Automated Verification:

- Tests pass: `npx vitest run src/lib/services/__tests__/process-plan-generation.test.ts`
- All scenarios P1–P17 present as named test rows
- Full 2×2×2 matrix covered (8 combinations)
- Negative assertions prove conditional steps absent when conditions false
- Lint passes: `npm run lint`

---

## Testing Strategy

### Unit Tests:

- All tests are unit tests of pure functions — no mocks, no network, no DB
- Table-driven `test.each` pattern with named scenarios visible in runner output
- Expected values from local domain constants with inline arithmetic (oracle-independent)
- Boundary tests at exact thresholds where comparison operators matter

### What Makes These Tests Trustworthy:

- Expected values independently derived from domain knowledge (17 g/L, midpoint tables, day offsets)
- Bidirectional testing: proves thing fires AND does not fire
- Negative assertions: proves conditional output is absent, not just present
- No implementation mirroring: tests don't import production constants or snapshot current output

## Performance Considerations

None — all 3 services are pure CPU-bound functions with sub-millisecond execution. No performance concerns for the test suite.

## Migration Notes

- `git mv` for the 2 co-located test files preserves history
- Schema test (`batch.test.ts`) relocated to `src/lib/schemas/__tests__/` (content preserved)
- Process plan test file already in correct location — content rewrite only
- After all 3 phases complete, run full `npx vitest run` to confirm no regressions

## References

- Research: `context/changes/testing-core-business-logic/research.md`
- Test plan: `context/foundation/test-plan.md` (§3 Phase 1, §6.1)
- Domain knowledge: `context/foundation/domain_knowledge.md`
- Sugar calculation service: `src/lib/services/sugar-calculation.ts:36-59`
- Batch validation service: `src/lib/services/batch-validation.ts:25-136`
- Process plan generation service: `src/lib/services/process-plan-generation.ts:41-171`
- Vitest config: `vitest.config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: File Relocations & Infrastructure Verification

#### Automated

- [x] 0.1 All test files relocated to __tests__/ subfolders
- [x] 0.2 npx vitest run discovers and executes all relocated test files
- [x] 0.3 Relocations committed (git status clean)

### Phase 1: Sugar Calculation Tests

#### Automated

- [x] 1.1 Tests pass: npx vitest run src/lib/services/__tests__/sugar-calculation.test.ts
- [x] 1.2 All S1–S8 scenarios present as named test rows
- [x] 1.3 Lint passes: npm run lint
- [x] 1.4 No imports from production constants
- [x] 1.5 test-plan.md §6.1 updated with cookbook pattern

### Phase 2: Batch Validation Tests

#### Automated

- [x] 2.1 Tests pass: npx vitest run src/lib/services/__tests__/batch-validation.test.ts
- [x] 2.2 All V1–V12 scenarios present as named test rows
- [x] 2.3 Every rule tested bidirectionally
- [x] 2.4 Lint passes: npm run lint

### Phase 3: Process Plan Generation Tests

#### Automated

- [x] 3.1 Tests pass: npx vitest run src/lib/services/__tests__/process-plan-generation.test.ts — 67219bf
- [x] 3.2 All P1–P17 scenarios present as named test rows — 67219bf
- [x] 3.3 Full 2×2×2 matrix covered — 67219bf
- [x] 3.4 Negative assertions prove conditional steps absent — 67219bf
- [x] 3.5 Lint passes: npm run lint — 67219bf
