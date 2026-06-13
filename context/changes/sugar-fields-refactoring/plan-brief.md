# Sugar Fields Refactoring — Plan Brief

> Full plan: `context/changes/sugar-fields-refactoring/plan.md`

## What & Why

Move `fermentation_sugar_kg` and `sweetness_sugar_kg` from being pseudo-ingredient entries (with a discriminated `IngredientType`) in the JSONB ingredients array to dedicated numeric columns on the `batches` table. This eliminates the conflation of calculated results with user data and removes branching logic throughout types, services, and UI components.

## Starting Point

The `batches` table has an `ingredients jsonb` column storing three types of entries: actual user ingredients (`user_input`) and two calculated sugar entries (`fermentation_sugar`, `sweetness_sugar`). The `IngredientType` discriminant and `sort_order` field exist solely to support this mixed-type array. Every component that touches ingredients branches on type.

## Desired End State

Sugar values are first-class batch columns (`fermentation_sugar_kg`, `sweetness_sugar_kg`). The ingredients array contains only plain user entries (`{ name, amount_liters, sugar_content_percent }`). `IngredientType` and `sort_order` no longer exist. The UI is visually identical — sugar cards still appear above user ingredients, Calculate still works, manual editing still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Column nullability | `NOT NULL DEFAULT 0` | Mirrors the current contract where sugar entries always exist with amount 0 until calculated. |
| Migration strategy | Single migration (add + backfill + strip) | Simpler than two-step; acceptable for a dev project with no rollback concern. |
| `type` field on Ingredient | Remove entirely | All remaining ingredients are user entries; the discriminant has no purpose. |
| `sort_order` field | Remove | Was designed for a separate table; JSONB array position is the implicit order. Drag-and-drop will be a separate change. |
| UI behavior | No change — same cards, same Calculate flow | The refactoring is purely structural; users see no difference. |
| `amount_liters` naming | Keep as-is | With sugar entries gone, all ingredients are genuinely in liters — name is now accurate. |

## Scope

**In scope:**
- Database migration (add columns, backfill, strip JSONB)
- TypeScript types simplification
- Zod schema updates
- Sugar calculation service refactor
- Batch validation service refactor
- UI component adaptation (BatchForm, IngredientsSection, IngredientCard)
- All test updates

**Out of scope:**
- Drag-and-drop ingredient reordering (follow-up)
- New UI patterns or layout changes
- Batch list/table view changes
- Auth, routing, or API structure changes

## Architecture / Approach

Bottom-up refactor: migration → types/schemas/services → UI → tests. The migration backfills data so existing batches remain correct. Services switch from searching the ingredients array by type to reading batch-level numeric fields directly. The UI manages sugar as separate form state (like `target_abv`) while rendering identical cards.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database Migration | New columns, backfilled data, cleaned JSONB | Backfill SQL must handle empty arrays / missing entries gracefully |
| 2. Application Code | Types, services, UI, and tests — all updated atomically | Large phase; shared type changes cascade across 10 files |

**Prerequisites:** Local Supabase running (`npx supabase start` in WSL)
**Estimated effort:** ~2 sessions across 2 phases

## Open Risks & Assumptions

- Assumes no other in-flight changes touch the ingredients JSONB structure
- Validation rule parity depends on correct unit conversion (kg ↔ grams) in the new direct-field approach

## Success Criteria (Summary)

- All existing tests pass with updated assertions (no behavior regression)
- Batch create/edit form is visually and functionally identical to before
- Data model is cleaner: no mixed-type arrays, no discriminant, no misused field names
