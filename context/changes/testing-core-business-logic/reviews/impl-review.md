<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Core Business Logic Tests — Audit & Rebuild

- **Plan**: context/changes/testing-core-business-logic/plan.md
- **Scope**: All Phases (0–3)
- **Date**: 2025-06-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Batch validation tests use production calculateSugar as oracle

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/__tests__/batch-validation.test.ts:27-35
- **Detail**: `calcResultFor()` helper calls production `calculateSugar()` to generate `CalculationResult` inputs for `validateBatch`. Initially flagged as oracle coupling but on reevaluation: `validateBatch` is the subject under test, and using `calculateSugar` to build realistic inputs is a legitimate pattern (equivalent to using `JSON.parse()` to build fixture data). No silent validation skip risk detected — all rule 5–8 tests have non-null `target_abv`.
- **Decision**: DISMISSED — not a real issue after reevaluation

### F2 — Batch validation "multiple warnings" test uses permissive assertion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/__tests__/batch-validation.test.ts:367
- **Detail**: `toBeGreaterThanOrEqual(4)` allows unexpected extra warnings to pass silently. The test already asserts 4 specific warning IDs, so a strict `.toBe(4)` catches regressions.
- **Fix**: Replaced `.toBeGreaterThanOrEqual(4)` with `.toBe(4)`.
- **Decision**: FIXED — 41c3453

### F3 — Process plan tests mirror production date logic

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/__tests__/process-plan-generation.test.ts:62-69
- **Detail**: `addDaysToDate()` helper replicated production date-offset calculation. Expected dates were computed at runtime rather than being fixed ISO strings, weakening oracle independence.
- **Fix**: Replaced with pre-computed `EXPECTED_DATES` lookup using hardcoded ISO date strings. Removed unused `OFFSETS` constant and `addDaysToDate()` helper.
- **Decision**: FIXED — 41c3453
