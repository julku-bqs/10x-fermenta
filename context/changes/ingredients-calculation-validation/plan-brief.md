# Ingredients, Sugar Calculation & Validation Warnings — Plan Brief

> Full plan: `context/changes/ingredients-calculation-validation/plan.md`
> Plan review: `context/changes/ingredients-calculation-validation/reviews/human-review1.md`

## What & Why

Add ingredient management, sugar calculation, and validation warnings to the batch detail page. This is the north-star slice — the first feature proving that combining correct calculation + consistency validation in one tool replaces the paper-form-and-mental-math workflow for home winemakers.

## Starting Point

Batch CRUD (S-01) is complete: users can create batches with parameters (volume, ABV, sweetness, process type) and yeast info. The `ingredients` table exists from F-01 but will be replaced by a JSONB column on `batches` — ingredients are an embedded part of the batch aggregate, not a separate resource. No ingredient UI exists yet ("coming soon" placeholder).

## Desired End State

A user on the batch detail page can add ingredients (name, amount in liters, sugar content %), click a Calculate button that fills fermentation/sweetness sugar amounts in the form, and see a warnings banner (on blur) flagging plan inconsistencies. Sugar entries appear as regular ingredients (non-deletable, always at top). ALL changes save atomically with the Save button; Cancel discards everything.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Data model | JSONB `ingredients` column on `batches` table | Inherent atomicity (single row UPDATE), no transaction orchestration needed, batch is one aggregate |
| Calculation location | Client-side pure function (isomorphic shared module) | Single source of truth is the module, not the location; same code importable server-side for future native clients via thin API wrapper |
| Validation location | Client-side pure function on blur | Same isomorphic module pattern; instant feedback; advisory-only |
| Persistence model | All-at-once save (batch + ingredients together) | Clean cancel behavior; no orphaned state; atomic by nature of JSONB |
| Sugar unit | Kilograms (1L ≈ 1kg) | Consistent with liters (density approximation); fractions for sub-kg amounts |
| Ingredient amount | Always liters (no unit field) | Simplification for MVP; non-liquid ingredients (spices etc.) deferred to v2 |
| Sugar entry lifecycle | Non-deletable; derived from params | Fermentation sugar always present (0 if not needed); sweetness only for non-dry |
| Sugar entry ordering | sort_order -2 (fermentation), -1 (sweetness) | Always at top of list, below yeast |
| Warning severity | Single level (amber) | All advisory; user retains full control; app never blocks |
| Warning trigger | On field blur | Good UX without keystroke spam; sufficient latency tolerance |
| Yeast optionality | "Add yeast" button when empty; wild yeast warning | Yeast is optional; no yeast = specific warning about unpredictability |
| Missing params | Warn about absence, don't assume | "No target ABV" gets one warning instead of false ABV-related validations |
| Conversion constant | 17 g/L per 1% ABV (extractable) | Standard approximation; named constant for future configurability |
| Sweetness quantification | Ranges with midpoints (0/10/30/60 g/L) | User doesn't see numbers; out-of-range triggers warning |
| Test runner | Vitest | Fast, native TypeScript, ecosystem match |
| Calculate button | Near sugar entries, single button for both | Explicit action; overwrites form values; no auto-recalculate |

## Scope

**In scope:**
- Ingredient management (add, edit, remove user ingredients) in form state
- Sugar calculation (fermentation + sweetness) via client-side pure function
- 8 validation warning rules (client-side, on blur)
- JSONB schema migration (drop ingredients table, add column)
- Vitest setup + unit tests for calculation + validation
- Batch API extension to save/return nested ingredients
- beforeunload guard for unsaved changes

**Out of scope:**
- Process plan generation (S-03)
- Ingredient/yeast reference database (v2)
- E2E tests
- Batch deletion
- Ingredient unit selection (all liters; spices deferred to v2)
- Server-side validation (user has full control)
- Separate ingredient API endpoints (ingredients are part of batch aggregate)
- Thin API wrapper for non-JS clients (documented path for future mobile; not needed for web MVP)

## Architecture / Approach

Ingredients stored as JSONB array on the `batches` row. Single `PUT /api/batches/{id}` persists params + ingredients atomically. Calculation (`calculateSugar()`) and validation (`validateBatch()`) are pure TypeScript functions in `src/lib/services/` — the **single source of truth** for domain logic (isomorphic shared module pattern). Called client-side by React for instant UX. Same modules importable server-side for future non-JS clients (thin API wrapper) and S-03 diary generation. Bug fixes ship via deploy — no client update needed for web users.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Schema + Tests + Domain Logic | JSONB migration, Vitest, tested calculation + validation modules | Formula correctness — wrong math breaks trust |
| 2. API Extension | Batch PUT/GET with nested ingredients array | Zod schema complexity for nested validation |
| 3. UI Components & Integration | Full UI: ingredient cards, calculate button, warnings banner, form state management | State management complexity across params + ingredients + sugar lifecycle |

**Prerequisites:** S-01 complete (batch CRUD working), F-01 schema in place (will be migrated)
**Estimated effort:** ~3 sessions across 3 phases

## Open Risks & Assumptions

- Assumption: density ≈ 1 kg/L is acceptable for all ingredients (standard in home winemaking)
- Assumption: users won't have more than ~20 ingredients per batch (JSONB row size stays small)
- Risk: Form state management for dynamic ingredient list + sugar lifecycle could be complex — mitigated by well-defined rules (sugar non-deletable, auto-add/remove based on sweetness param)
- Risk: JSONB loses relational querying — accepted; GIN indexes cover realistic future needs

## Success Criteria (Summary)

- Sugar calculation produces mathematically correct results (verified by 10+ unit tests)
- All 8 validation rules fire correctly (verified by unit tests)
- Full ingredient management works with atomic save/cancel (verified manually)
- No data inconsistency possible (JSONB guarantees atomicity)
- Warnings are informative but not overwhelming (UI review)
