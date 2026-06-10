<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Batch CRUD & Parameters

- **Plan**: context/changes/batch-crud-and-params/plan.md
- **Scope**: Full plan (Phases 1–5 of 5)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | WARNING ⚠️ |
| Safety & Quality | WARNING ⚠️ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Ingredient management implemented despite explicit scope exclusion

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/lib/schemas/batch.ts, src/types.ts, src/components/batches/BatchForm.tsx
- **Detail**: The plan's "What We're NOT Doing" section explicitly states "No ingredient management (S-02 scope)" and "No sugar calculation or validation warnings (S-02 scope)". However, the implementation adds: `ingredientSchema` and `ingredients` array to batch schemas, `Ingredient`/`IngredientType` types, IngredientsList/IngredientsSection/IngredientCard components, sugar-calculation service, batch-validation service, and ValidationWarnings component. This is coherent feature work (likely S-02 delivered alongside S-01) but violates the plan's stated scope boundary.
- **Fix A ⭐ Recommended**: Accept as valid scope expansion from S-02 delivery
  - Strength: The work is clearly intentional (separate slice S-02 was delivered in parallel). The plan was written before S-02 was executed; ingredients are a natural extension.
  - Tradeoff: Plan document no longer reflects actual delivery scope.
  - Confidence: HIGH — commit history shows S-02 was separately tracked and merged.
  - Blind spot: Whether S-02 has its own plan that covers these files.
- **Fix B**: Document the scope expansion as a plan addendum
  - Strength: Maintains plan as accurate source of truth for future reference.
  - Tradeoff: Retroactive documentation effort for already-merged work.
  - Confidence: MEDIUM — the plan is already marked "implemented".
  - Blind spot: None significant.
- **Decision**: DISMISSED — false positive; ingredient code is from S-02's separate implementation, not S-01 scope creep

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/batches/[id].ts:12,33 and src/pages/batches/[id].astro:7
- **Detail**: The `id` parameter from `Astro.params` is passed directly to `.eq("id", id)` without validating UUID format. While Supabase won't produce SQL injection (parameterized queries), malformed IDs cause unnecessary DB round-trips and leak Postgres error details in the response.
- **Fix**: Add early UUID validation: `if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return jsonError("Invalid batch ID", 400);` in both API handlers. For the Astro page, return `Astro.redirect("/batches")` or a 404 response.
- **Decision**: FIXED

### F3 — Raw Supabase error messages leaked to HTTP responses

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/batches/index.ts:32, src/pages/api/batches/[id].ts
- **Detail**: `jsonError(error.message, 500)` returns raw Postgres/Supabase error messages to the client. These can contain table names, column names, constraint names, and other schema details useful to attackers.
- **Fix**: Replace with generic messages and log raw error server-side only (console.error).
- **Decision**: FIXED

### F4 — Duplicate eslint-disable comment

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/batches/[id].astro:14-15
- **Detail**: `// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment` appears on two consecutive lines. Only the second one takes effect.
- **Fix**: Remove the duplicate line.
- **Decision**: FIXED (addressed alongside F2)
