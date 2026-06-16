<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Sugar Fields Refactoring

- **Plan**: context/changes/sugar-fields-refactoring/plan.md
- **Mode**: Deep
- **Date**: 2026-06-13
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: [1 critical] [1 warning] [0 observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS (after fix) |

## Grounding

11/11 paths ✓, 5/5 symbols ✓, brief↔plan ✓

## Findings

### F1 — Phase 2 type-check criterion is unachievable

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria
- **Detail**: Phase 2 changed the shared `Ingredient` type in `src/types.ts` (removes `type`/`sort_order`), then claimed `npx tsc --noEmit` as success criterion. But `tsconfig.json` includes all files — BatchForm, IngredientsSection, IngredientCard, and all test files would have type errors until later phases completed. The "pause for manual confirmation" between phases was unachievable.
- **Fix A ⭐ Recommended**: Merge Phases 2, 3, 4 into a single "Application Code" phase
  - Strength: Reflects reality — shared type changes cascade and are naturally done atomically.
  - Tradeoff: Larger phase (fewer intermediate checkpoints).
  - Confidence: HIGH — this is how type refactors work in practice.
  - Blind spot: None significant.
- **Fix B**: Keep phases separate, move type-check to Phase 3 only
  - Strength: Preserves granular phases for organizational clarity.
  - Tradeoff: Phase 2 has no independent automated gate.
  - Confidence: MEDIUM — unclear what Phase 2's verification would be.
  - Blind spot: Implementer following plan literally will be confused by errors.
- **Decision**: FIXED via Fix A — merged into single "Application Code" phase

### F2 — updateBatchSchema needs explicit .extend() for sugar fields

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Zod validation schemas
- **Detail**: Plan said sugar fields should use `.default(0)` on `createBatchSchema` and "make these optional" on `updateBatchSchema`. The existing code documents this exact gotcha (batch.ts:23-25). Without explicit `.extend({})` override, PUT requests omitting sugar fields would silently reset them to 0.
- **Fix**: Add explicit note to Contract section referencing the existing pattern.
- **Decision**: FIXED — explicit `.extend()` requirement added to plan Contract section
