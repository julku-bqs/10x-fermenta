# Ingredients, Sugar Calculation & Validation Warnings — Plan Brief

> Full plan: `context/changes/ingredients-calculation-validation/plan.md`

## What & Why

Add ingredient management, sugar calculation, and validation warnings to the batch detail page. This is the north-star slice — the first feature proving that combining correct calculation + consistency validation in one tool replaces the paper-form-and-mental-math workflow for home winemakers.

## Starting Point

Batch CRUD (S-01) is complete: users can create batches with parameters (volume, ABV, sweetness, process type) and yeast info. The `ingredients` table exists in the DB schema (F-01) with the right enum types but has zero rows and no API endpoints. The UI has a "More ingredients — coming soon" placeholder.

## Desired End State

A user on the batch detail page can add ingredients (name, amount in liters, sugar content %), click a Calculate button that computes fermentation/sweetness sugar needs, and see a real-time warnings banner flagging plan inconsistencies. Calculated sugar entries appear as regular editable ingredients. All changes persist immediately.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Conversion constant | 17 g/L per 1% ABV | Standard approximation; extracted as constant for future configurability |
| Ingredient amount unit | Liters (density ≈ 1 kg/L) | Matches home winemaking practice where both pulp and juice are measured in liters |
| Sweetness quantification | Ranges with midpoints (dry=0, semi_dry=10, semi_sweet=30, sweet=60 g/L) | User doesn't see numbers; calculation targets midpoint; out-of-range triggers warning |
| Calculation trigger | Explicit button click (server-side) | Keeps UX predictable; overwrites calculated entries; single source of truth on server |
| Validation trigger | Client-side, on every param/ingredient change | Instant feedback; pure function; no network needed since all data is in form state |
| Warning severity | Single level (amber) — no hierarchy | Simplicity; all warnings are advisory; user always retains control |
| Warning placement | Banner at top of batch form | Visible without scrolling; doesn't interfere with ingredient editing |
| Ingredient persistence | Immediate (per-action API calls) | No data loss on navigation; matches user expectation of saved state |
| Sugar entry appearance | No visual distinction from user ingredients | Transparency — user sees and edits all entries equally |
| Auto-creation timing | On first batch setup (if no values yet); overwrite only on explicit Calculate | Avoids losing user edits; explicit action for recalculation |
| Test runner | Vitest | Fast, native TypeScript, ecosystem match |
| Performance budget | ≤200ms for calculate endpoint | Good UX for button-triggered action |

## Scope

**In scope:**
- Ingredient CRUD (add, edit, remove) with immediate persistence
- Sugar calculation (fermentation + sweetness) via server endpoint
- 6 validation warning rules (client-side, real-time)
- Vitest setup + unit tests for calculation + validation
- Integration tests for API endpoints

**Out of scope:**
- Process plan generation (S-03)
- Ingredient/yeast reference database (v2)
- E2E tests
- Batch deletion
- Offline support

## Architecture / Approach

Server-side calculation endpoint (`POST /api/batches/{id}/calculate`) reads batch params + ingredients from DB, runs pure `calculateSugar()` function, upserts sugar entries. Client-side validation (`validateBatch()`) runs as a pure function in React state, triggered on every change. Ingredients have their own CRUD API (`/api/batches/{id}/ingredients`). All domain logic lives in `src/lib/services/` as testable pure functions.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Test Infrastructure & Calculation Logic | Vitest setup + tested sugar calculation module | Formula correctness — wrong math breaks trust |
| 2. Ingredient CRUD API & Types | Full ingredient API + calculate endpoint | Performance of calculate endpoint on Cloudflare |
| 3. Validation Engine | Client-side validation with 6 warning rules | Rule completeness — missing edge cases |
| 4. UI Components & Integration | Full UI: ingredient cards, calculate button, warnings banner | State management complexity between params + ingredients + warnings |

**Prerequisites:** S-01 complete (batch CRUD working), F-01 schema in place (ingredients table exists)
**Estimated effort:** ~3-4 sessions across 4 phases

## Open Risks & Assumptions

- Cloudflare Workers cold start may push calculate endpoint past 200ms — fallback is client-side extraction
- Assumption: density ≈ 1 kg/L is acceptable approximation for all ingredients (standard in home winemaking)
- Assumption: users won't have more than ~20 ingredients per batch (individual persist calls are fine)

## Success Criteria (Summary)

- Sugar calculation produces mathematically correct results (verified by 10+ unit tests)
- All 6 validation rules fire correctly (verified by unit tests)
- Full ingredient CRUD works with immediate persistence (verified manually)
- Calculate endpoint responds within 200ms (verified in manual testing)
