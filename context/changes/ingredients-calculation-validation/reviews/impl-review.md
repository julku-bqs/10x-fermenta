<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ingredients, Sugar Calculation & Validation

- **Plan**: context/changes/ingredients-calculation-validation/plan.md
- **Scope**: Full Plan (Phases 1–3)
- **Date**: 2026-06-10
- **Verdict**: APPROVED
- **Findings**: 0 critical | 1 warning | 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Division by zero in sweetness-out-of-range validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/batch-validation.ts:113
- **Detail**: The null-check on line 110 guards against `null` volume but not zero. If called with `target_volume_liters: 0`, line 113 divides by zero yielding `Infinity`. Mitigated by Zod schema requiring `.positive()`, but the validation module is decoupled from the schema.
- **Fix**: Add `!input.target_volume_liters` to the guard (covers null, 0, and negative).
- **Decision**: FIXED

### F2 — Migration drops table without asserting emptiness

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260605220000_ingredients_jsonb_on_batches.sql:9
- **Detail**: `DROP TABLE ingredients` has no pre-condition check that the table is empty. Migration already ran successfully — pattern note for future migrations.
- **Fix**: For future migrations, wrap destructive ops in a DO block asserting emptiness.
- **Decision**: SKIPPED

### F3 — inputClass constant duplicated across 3 files

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/batches/IngredientCard.tsx, BatchForm.tsx, IngredientsList.tsx
- **Detail**: The same `inputClass` Tailwind string was defined identically in three batch components. Drift risk if one is updated but not others.
- **Fix**: Extracted to `src/components/batches/styles.ts` as `batchInputClass`, imported by all three.
- **Decision**: FIXED
