---
date: 2026-06-21T23:09:27+02:00
researcher: Copilot
git_commit: 51f6ab46cff1616ecd5ac89a1799ec5806211e37
branch: testing-core-business-logic
repository: julku-bqs/10x-fermenta
topic: "Core business logic — audit existing tests and ground the formula/validation/generation services for Phase 1 rebuild"
tags: [research, codebase, sugar-calculation, batch-validation, process-plan-generation, unit-tests]
status: complete
last_updated: 2026-06-23
last_updated_by: Copilot
last_updated_note: "Added comprehensive missing-scenarios tables, test location inconsistency note, and property-based testing assessment"
---

# Research: Core Business Logic — Audit & Ground Truth for Phase 1

**Date**: 2026-06-21T23:09:27+02:00
**Researcher**: Copilot
**Git Commit**: 51f6ab46cff1616ecd5ac89a1799ec5806211e37
**Branch**: testing-core-business-logic
**Repository**: julku-bqs/10x-fermenta

## Research Question

What is the current state of the three core business logic services (sugar calculation, batch validation, process plan generation) — their formulas, thresholds, conditional logic, and day offsets — and what are the gaps, anti-patterns, and trust issues in the existing 4 test files that Phase 1 must address?

## Summary

The three services are well-structured and functionally correct. The **sugar calculation** uses a straightforward formula (17 g/L per ABV %, sweetness from midpoint tables). **Batch validation** implements 9 rules (3 from PRD + 6 additional). **Process plan generation** uses a template system with 17 step templates driven by condition functions.

Existing tests (4 files, AI-generated) cover many scenarios but have specific trust issues:
- **Sugar tests**: Moderate oracle risk (some tests reference exported constants); non-dry edge cases under-tested.
- **Validation tests**: Most rules bidirectionally tested but boundary testing is incomplete; test comments sometimes misleading.
- **Process plan tests**: Rely on step-count assertions and substring checks — no verification of specific day offsets or that conditional steps are correctly absent.
- **Schema tests**: Good patterns for boundary and serialization safety; can serve as a reference for conventions.

## Detailed Findings

### Sugar Calculation Service

**Location**: `src/lib/services/sugar-calculation.ts`

**Formula (the ground truth for test expected values):**

| Quantity | Formula | Line |
|----------|---------|------|
| Ingredient sugar (grams) | `Σ(amount_liters × sugar_content_percent × 10)` | 41 |
| Sugar needed for ABV (grams) | `target_abv × 17 × target_volume_liters` | 45 |
| Fermentation sugar (kg) | `max(0, sugar_for_ABV − ingredient_sugar) / 1000` | 47–48 |
| Sweetness sugar (kg) | `SWEETNESS_MIDPOINTS[level] × target_volume_liters / 1000` | 50–51 |

**Constants:**
- `SUGAR_PER_ABV_GRAM_PER_LITER = 17` (line 3)
- `SWEETNESS_MIDPOINTS`: dry=0, semi_dry=10, semi_sweet=30, sweet=60 g/L (lines 5–10)
- `SWEETNESS_RANGES`: dry=[0,0], semi_dry=[5,15], semi_sweet=[15,45], sweet=[45,80] g/L (lines 12–17)

**Edge cases handled**: null sugar_content (→ 0), negative fermentation sugar clamped to 0, zero volume/ABV.
**Edge cases NOT handled**: negative inputs, invalid sweetness level key, sugar_content > 100%.

**Known future improvements** (from `context/changes/sugar-calculation-improvements/change.md`): residual sugar subtraction, volume contribution from sugar, pulp extraction coefficient, tolerance cap. These are NOT in scope for Phase 1 — tests should validate current formula behavior, not future corrections.

### Batch Validation Service

**Location**: `src/lib/services/batch-validation.ts`

**9 rules implemented** (not just the 3 from PRD):

| # | ID | Condition (fires when) | Line |
|---|----|-----------------------|------|
| 1 | `no-yeast` | `!has_yeast` | 25–28 |
| 2 | `no-target-abv` | `target_abv === null` | 31–34 |
| 3 | `abv-exceeds-tolerance` | `target_abv > yeast_alcohol_tolerance` (both non-null) | 37–42 |
| 4 | `sweetness-wont-stop` | `planned_sweetness !== "dry" AND tolerance > target_abv` | 45–55 |
| 5 | `ingredient-sugar-exceeds-needed` | `total_ingredient_sugar_grams >= sugar_needed_for_abv_grams` | 58–67 |
| 6 | `total-sugar-insufficient` | `(ingredient + fermentation sugar) < sugar_needed_for_abv` | 70–76 |
| 7 | `total-sugar-exceeds-target` | Complex: excess total AND yeast can still consume it | 79–95 |
| 8 | `sweetness-out-of-range` | sweetness g/L outside `SWEETNESS_RANGES[level]` | 98–108 |
| 9 | `general-advisory` | `target_abv !== null` (always fires as informational) | 111–117 |

**Key threshold semantics**: Rules 3 & 4 use strict `>` comparison — equality (`ABV === tolerance`) does NOT fire either rule. Multiple rules can fire simultaneously.

**Inputs**: `ValidationInput` (lines 10–19) takes batch fields directly (fermentation_sugar_kg, sweetness_sugar_kg as columns, post-refactoring). Optional `CalculationResult` enables rules 5–8.

### Process Plan Generation Service

**Location**: `src/lib/services/process-plan-generation.ts`

**17 step templates** with 4 condition functions:
- `isJuice`: `process_type === "juice"` (line 42)
- `isPulp`: `process_type === "pulp"` (line 43)
- `hasFermentationSugar`: `fermentation_sugar_kg > 0` (line 45)
- `isNotDry`: `planned_sweetness !== "dry"` (line 47)

**Complete step matrix** (the ground truth for test assertions):

| Step | Day | Juice | Pulp | Sugar>0 | Non-dry |
|------|-----|-------|------|---------|---------|
| prepare_must_juice | 0 | ✓ | — | — | — |
| prepare_must_pulp | 0 | — | ✓ | — | — |
| add_fermentation_sugar | 0 | ✓ | ✓ | **required** | — |
| pitch_yeast | 0 | ✓ | ✓ | — | — |
| cap_management | 1 | — | ✓ | — | — |
| monitor_primary | 5 | ✓ | ✓ | — | — |
| press | 10 | — | ✓ | — | — |
| rack_secondary | 14 | ✓ | ✓ | — | — |
| monitor_secondary | 21 | ✓ | ✓ | — | — |
| confirm_complete | 28 | ✓ | ✓ | — | — |
| rack_off_lees | 35 | ✓ | ✓ | — | — |
| bulk_aging | 60 | ✓ | ✓ | — | — |
| aging_check_1 | 120 | ✓ | ✓ | — | — |
| aging_check_2 | 240 | ✓ | ✓ | — | — |
| stabilize | 330 | ✓ | ✓ | — | **required** |
| back_sweeten | 332 | ✓ | ✓ | — | **required** |
| bottling | 365 | ✓ | ✓ | — | — |

**Output shape**: `DiaryEntryDraft[]` with fields: `description` (string), `entry_date` (YYYY-MM-DD), `entry_type` ("auto").

**Date logic**: `addDays(batch_date, offsetDays)` — UTC-based, no timezone edge cases (lines 156–163).

### Existing Test Audit

#### `sugar-calculation.test.ts` (12 tests)

| Strength | Weakness |
|----------|----------|
| Covers dry + all 3 non-dry levels | Non-dry edge cases missing (e.g., sweet wine where ingredients exceed ABV) |
| Zero-volume and zero-ABV edge cases tested | Tests 4–6 reference `SWEETNESS_MIDPOINTS` directly (partial mirror) |
| Multiple-ingredient aggregation tested | No negative input tests |
| Expected values independently derivable | Meta-test (test 12) validates structure not formula |

**Verdict**: Mostly trustworthy. Rebuild needed for: (a) remove constant references from assertions, (b) add non-dry edge cases, (c) explicitly document derivation of each expected value.

#### `batch-validation.test.ts` (20 tests)

| Strength | Weakness |
|----------|----------|
| All 9 rules covered | Rule 5 lacks exact boundary test |
| Most rules tested bidirectionally | Rule 7 complex guards have incomplete path coverage |
| Multiple-simultaneous-warnings tested | Rule 8 missing upper boundary test |
| Null-guard tests present | Comment on line 177 contradicts its assertion |

**Verdict**: Good coverage structure but needs: (a) explicit boundary tests for rules 5, 7, 8, (b) fix misleading comment, (c) verify business-rule derivation (some expected values mirror formula constants).

#### `process-plan-generation.test.ts` (5 test groups + assertions)

| Strength | Weakness |
|----------|----------|
| Tests 5 template×sweetness combos | Missing: pulp×dry+sugar, juice×non-dry without sugar |
| Entry_date computation verified | No individual step offset validation |
| All entries have entry_type="auto" verified | Conditional steps not verified as ABSENT when condition is false |
| Includes step-count assertions | Relies on `.includes()` substring — no exact description validation |

**Verdict**: Weakest of the 4 files. Needs rebuild to: (a) test all 4 quadrants (juice×dry, juice×non-dry, pulp×dry, pulp×non-dry), (b) verify conditional steps are absent when they should be, (c) validate specific day offsets per step.

#### `batch.test.ts` (schema tests — reference only)

Good patterns for Phase 1 to follow:
- Boundary testing (min/max values)
- Default coercion verification
- Serialization safety via JSON round-trip
- Array element rejection

## Missing Test Scenarios (Comprehensive)

### Sugar Calculation — Missing Cases

| # | Scenario | Why it matters | Input sketch |
|---|----------|---------------|--------------|
| S1 | Non-dry wine where ingredient sugar exceeds ABV needs | Proves fermentation_sugar clamps to 0 even when sweetness_sugar > 0 (combination not tested) | sweet, 10L, 8% ABV, ingredients with 20% sugar × 10L → ingredient=2000g > needed=1360g; sweetness still = 60×10/1000 |
| S2 | Non-dry wine with multiple ingredients | Aggregation + sweetness combined; currently only dry tests have multi-ingredient | semi_dry, 20L, 12% ABV, 3 ingredients |
| S3 | Ingredient with 0% sugar_content (explicit zero, not null) | Verifies 0% treated same as null in sum | dry, 20L, 12% ABV, [{amount:5, sugar:0}] |
| S4 | Very high ABV (e.g. 20%) | Realistic max for fortified/ice wine; large sugar_needed value | dry, 20L, 20% ABV, no ingredients → 6.8 kg |
| S5 | Very small volume (0.5L) | Precision — proves no floating-point rounding issue at small scale | dry, 0.5L, 12% ABV → 0.102 kg |
| S6 | Large number of ingredients (10+) | Aggregation correctness at scale | dry, 20L, 12% ABV, 10 ingredients with varied sugar |
| S7 | All sweetness levels with same volume/ABV (parameterized) | Guarantees each midpoint produces correct sweetness_sugar independently of fermentation path | 20L, 12% ABV, no ingredients, all 4 levels → [0, 0.2, 0.6, 1.2] |
| S8 | Ingredient amount_liters = 0 (valid ingredient but contributes nothing) | Edge: valid ingredient that contributes 0 grams | dry, 20L, 12% ABV, [{amount:0, sugar:15}] |

### Batch Validation — Missing Cases

| # | Rule | Scenario | Why it matters |
|---|------|----------|---------------|
| V1 | #3 (abv-exceeds-tolerance) | ABV === tolerance (exact boundary) | Confirms strict `>` — must NOT fire at equality |
| V2 | #4 (sweetness-wont-stop) | tolerance === ABV with non-dry sweetness | Confirms strict `>` — must NOT fire at equality |
| V3 | #4 (sweetness-wont-stop) | All 3 non-dry levels fire (semi_dry, semi_sweet, sweet) | Currently only one non-dry level tested |
| V4 | #5 (ingredient-sugar-exceeds) | Exact boundary: ingredient sugar === sugar_needed | Does it fire at `>=`? Must test equality case |
| V5 | #7 (total-sugar-exceeds) | Guard path: ingredient sugar already exceeds needed (early return) | Verifies rule 7 skips when rule 5 already covers the case |
| V6 | #7 (total-sugar-exceeds) | Guard path: tolerance ≤ ABV (rule fires only when tolerance > ABV) | Boundary interaction between rules 7 and 3 |
| V7 | #7 (total-sugar-exceeds) | Exact boundary: total sugar === needed sugar | Does NOT fire (strict `>` required) |
| V8 | #8 (sweetness-out-of-range) | Upper boundary exceeded (e.g. semi_dry at 20 g/L > 15 max) | Only lower boundary currently tested |
| V9 | #8 (sweetness-out-of-range) | Exact boundary: sweetness g/L === min of range | Does it fire at boundary (strict `<`)? |
| V10 | #8 (sweetness-out-of-range) | Exact boundary: sweetness g/L === max of range | Does it fire at boundary (strict `>`)? |
| V11 | #2 (no-target-abv) | target_abv = 0 (falsy but not null) | Confirms rule does NOT fire for explicit zero |
| V12 | All rules | Realistic "happy path" batch with no warnings | Proves absence of false positives for a fully-valid batch |

### Process Plan Generation — Missing Cases

| # | Scenario | Why it matters |
|---|----------|---------------|
| P1 | juice × dry × no sugar | Baseline already tested ✓ (included for matrix completeness) |
| P2 | juice × dry × with sugar | Sugar step present, non-dry steps absent |
| P3 | juice × non-dry × no sugar | Stabilize + back_sweeten present, sugar step absent (tests independence of conditions) |
| P4 | juice × non-dry × with sugar | Full conditional: sugar + stabilize + back_sweeten |
| P5 | pulp × dry × no sugar | Pulp steps present, non-dry absent, sugar absent |
| P6 | pulp × dry × with sugar | Pulp + sugar, no non-dry steps |
| P7 | pulp × non-dry × no sugar | Pulp + non-dry steps, no sugar step |
| P8 | pulp × non-dry × with sugar | Maximum steps — all conditionals active |
| P9 | Negative assertion: juice has NO pulp steps | cap_management, press, prepare_must_pulp all absent |
| P10 | Negative assertion: pulp has NO juice steps | prepare_must_juice absent |
| P11 | Negative assertion: dry has NO non-dry steps | stabilize, back_sweeten absent |
| P12 | Negative assertion: sugar=0 has NO sugar step | add_fermentation_sugar absent |
| P13 | Day offset validation for each conditional step | cap_management=1, press=10, stabilize=330, back_sweeten=332 |
| P14 | Day offset validation for common steps | pitch_yeast=0, rack_secondary=14, confirm_complete=28, bottling=365 |
| P15 | Step ordering: all steps in ascending day order | Proves template array order produces chronological output |
| P16 | Boundary: fermentation_sugar_kg = 0 (exact zero) | Condition `> 0` must be false; sugar step absent |
| P17 | Boundary: fermentation_sugar_kg = 0.001 (tiny positive) | Condition `> 0` must be true; sugar step present |

## Test File Location

Current layout is inconsistent — 2 tests co-located, 1 in `__tests__/`:

```
src/lib/services/
├── sugar-calculation.test.ts          ← co-located
├── batch-validation.test.ts           ← co-located
└── __tests__/
    └── process-plan-generation.test.ts  ← subfolder
```

Vitest's default glob finds both patterns without config. **Decision**: standardize on `__tests__/` subfolder (user preference — cleaner separation of test and production code). Phase 1 moves the 2 co-located files into `__tests__/`.

## Test Pattern: Table-Driven Parameterized Tests

All three services are candidates for **table-driven parameterized tests** using Vitest's built-in `test.each` (or `it.each`). Pattern: define a table of `[scenario name, inputs, expected outputs]`; one assertion function runs for every row. Each row produces a **named test visible to the runner** (Vitest interpolates the first string argument as the test name).

### Which services / test suites apply

| Service | Applies? | Assertion shape (single logic per table) |
|---------|----------|------------------------------------------|
| Sugar calculation | **All scenarios** | `expect(result.fermentation_sugar_kg).toBeCloseTo(expected)` + sweetness_sugar_kg + total_ingredient_sugar_grams |
| Batch validation | **All scenarios per rule** — one table per rule ID | `expect(warnings.some(w => w.id === ruleId)).toBe(shouldFire)` |
| Process plan generation | **All quadrant scenarios (P1–P8)** + negative assertions (P9–P12) | `expectedPresent.forEach(key => expect(steps).toContain(key))` + `expectedAbsent.forEach(key => expect(steps).not.toContain(key))` |
| Process plan day offsets (P13–P15) | **Separate table** | `expect(stepByKey(key).entry_date).toBe(expectedDate)` |

### Vitest `test.each` supports named scenarios

Each table row's first element (or template literal) becomes the test name in the runner output. Example:

```typescript
it.each([
  ["dry wine, no ingredients, full sugar needed", { volume: 20, abv: 12, sweetness: "dry", ingredients: [] }, { ferm: 4.08, sweet: 0 }],
  ["sweet wine, 10L, ingredients exceed ABV",     { volume: 10, abv: 8, sweetness: "sweet", ingredients: [...] }, { ferm: 0, sweet: 0.6 }],
])("%s", (_name, input, expected) => {
  const result = calculateSugar(toCalcInput(input));
  expect(result.fermentation_sugar_kg).toBeCloseTo(expected.ferm, 4);
  expect(result.sweetness_sugar_kg).toBeCloseTo(expected.sweet, 4);
});
```

Runner output shows: `✓ dry wine, no ingredients, full sugar needed` / `✓ sweet wine, 10L, ingredients exceed ABV`.

### Relationship to missing-scenarios tables

The S1–S8, V1–V12, P1–P17 tables in this document are designed to map directly into `test.each` rows. Each row IS a scenario entry with a name, inputs, and expected output — ready to translate into code during `/10x-plan`.



## Code References

- `src/lib/services/sugar-calculation.ts:3` — SUGAR_PER_ABV constant (17 g/L per %)
- `src/lib/services/sugar-calculation.ts:5-17` — Sweetness midpoints and ranges
- `src/lib/services/sugar-calculation.ts:36-59` — calculateSugar function
- `src/lib/services/batch-validation.ts:37-42` — ABV exceeds tolerance rule
- `src/lib/services/batch-validation.ts:45-55` — Sweetness won't stop rule
- `src/lib/services/batch-validation.ts:111-117` — General advisory rule
- `src/lib/services/batch-validation.ts:131-136` — validateBatch entry point
- `src/lib/services/process-plan-generation.ts:41-47` — Condition functions
- `src/lib/services/process-plan-generation.ts:51-154` — STEP_TEMPLATES array
- `src/lib/services/process-plan-generation.ts:165-171` — generateProcessPlan function
- `src/types.ts:1` — SweetnessLevel type
- `src/types.ts:9-25` — Batch interface
- `src/lib/schemas/batch.ts:4-38` — Zod schemas (IngredientSchema, CreateBatchSchema, UpdateBatchSchema)
- `vitest.config.ts:1-13` — Test runner config (globals: true, alias @/ → ./src/)

## Architecture Insights

1. **Clean separation**: Each service is a pure function (no side effects, no DB calls). This makes unit testing straightforward — no mocks needed.
2. **Post-refactoring state**: Sugar fields are batch-level columns, not pseudo-ingredients. Tests can pass scalar values directly.
3. **Condition functions are testable**: Process plan uses named predicates (`isJuice`, `isPulp`, `hasFermentationSugar`, `isNotDry`) — tests can verify the condition matrix exhaustively.
4. **Validation depends on calculation**: Rules 5–8 require a `CalculationResult` parameter. Tests for these rules need to provide both `ValidationInput` and `CalculationResult`.
5. **Test conventions**: Vitest globals enabled (no imports needed for describe/it/expect). Path alias `@/` available.

## Historical Context (from prior changes)

- `context/changes/sugar-fields-refactoring/plan.md` — Documents migration from pseudo-ingredients to batch columns; confirms current service signatures are post-migration.
- `context/changes/sugar-calculation-improvements/change.md` — Lists 4 known formula gaps (residual sugar, volume correction, extraction coefficient, tolerance cap). These are OUT OF SCOPE for Phase 1 tests. Tests should validate current behavior.
- `context/foundation/domain_knowledge.md` — Day offset verification source: confirms 17 g/L per ABV%, stabilize before back-sweeten with 2-day gap (day 330/332), pulp-specific cap management and pressing.

## Resolved Questions

1. **Expected value style**: Test files define their own named constants grounded in domain knowledge (e.g., `const GRAMS_PER_ABV_PER_LITER = 17`, `const SWEETNESS_MIDPOINT_SEMI_DRY = 10`), never imported from production code. Expected values use those constants in inline arithmetic expressions (e.g., `12 * GRAMS_PER_ABV_PER_LITER * 20 / 1000`). If the domain constant changes, tests must be updated too — this is desired (forces conscious review).

2. **Rule 7 testing depth**: Test all guard paths (5–6 rows). The rule has 4 guards and complex interaction — full path coverage is required.

3. **Process plan step assertions**: Use description substring matching (e.g., `expect.stringContaining("Stabilize")`) because the step `key` is internal to `StepTemplate` and not exposed in `DiaryEntryDraft` output. A separate change (`context/changes/expose-step-key/`) has been opened to add the key to the output interface and DB table — once implemented, tests should migrate to key-based assertions.

4. **Existing test disposition**: Delete all existing test files and rewrite from scratch using table-driven `test.each` pattern. Converting to the new pattern requires rewriting regardless, and the missing-scenarios tables (S1–S8, V1–V12, P1–P17) already supersede all existing scenario coverage.
