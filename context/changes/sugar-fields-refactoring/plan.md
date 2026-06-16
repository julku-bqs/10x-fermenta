# Sugar Fields Refactoring Implementation Plan

## Overview

Move `fermentation_sugar_kg` and `sweetness_sugar_kg` from pseudo-ingredient entries in the JSONB `ingredients` array to dedicated numeric columns on the `batches` table. Remove `IngredientType` and `sort_order` from the `Ingredient` interface, simplifying ingredients to plain user entries (name, amount_liters, sugar_content_percent). The UI remains visually identical — sugar values still render as editable cards above user ingredients.

## Current State Analysis

The `batches` table stores an `ingredients jsonb` column containing an array with three types of entries discriminated by `IngredientType`:
- `"user_input"` — actual user-entered ingredients (juice, honey, etc.) with amount in liters
- `"fermentation_sugar"` — calculated sugar needed for fermentation, stored in kg (misusing `amount_liters`)
- `"sweetness_sugar"` — calculated sugar for residual sweetness, stored in kg

The calculation service (`sugar-calculation.ts`) already computes `fermentation_sugar_kg` and `sweetness_sugar_kg` as scalar values. The UI then stuffs these back into the ingredients array as fake entries. The validation service fishes them back out via `ingredients.find(i => i.type === "fermentation_sugar")`.

This design conflates calculated results with user data, forces the `IngredientType` discriminant to exist, and requires branching logic in every component that touches ingredients.

### Key Discoveries:

- `calculateSugar()` at `src/lib/services/sugar-calculation.ts:37` returns `{ fermentation_sugar_kg, sweetness_sugar_kg }` — already scalar
- `BatchForm.tsx:46-68` auto-creates sugar pseudo-ingredients on init
- `IngredientsSection.tsx:67-76` writes calculation results back into ingredient entries
- `batch-validation.ts:22-25` helper `fermentationSugarGrams()` searches ingredients by type
- `batch-validation.ts:111` Rule 8 searches for `sweetness_sugar` ingredient
- `IngredientCard.tsx:23-28` has branching for kg vs L display based on type
- Migration `20260605220000` already dropped the separate table in favor of JSONB — this continues that simplification

## Desired End State

- `batches` table has `fermentation_sugar_kg NUMERIC NOT NULL DEFAULT 0` and `sweetness_sugar_kg NUMERIC NOT NULL DEFAULT 0` columns
- `ingredients` JSONB array contains only simple objects: `{ name, amount_liters, sugar_content_percent }`
- `IngredientType` type no longer exists; `sort_order` field removed from `Ingredient`
- `Batch` TypeScript interface includes `fermentation_sugar_kg: number` and `sweetness_sugar_kg: number`
- Validation service reads sugar from batch-level fields, not from ingredients array
- UI displays sugar cards above user ingredients (visually unchanged) but backed by batch-level state
- All tests pass, lint clean, build succeeds

### Verification:

- `npm run build` passes
- `npm run lint` passes
- `npx vitest run` passes (all test files updated)
- Manual: batch create/edit form looks and behaves identically to before

## What We're NOT Doing

- No drag-and-drop ingredient reordering (separate follow-up change)
- No new UI patterns or layout changes
- No changes to batch list/table views beyond removing stale type references
- No changes to auth, routing, or API structure
- No rename of `amount_liters` field

## Implementation Approach

Bottom-up refactor: schema migration first, then all application code (types, services, UI, tests) in one phase. The migration handles data backfill so existing batches remain correct. Shared type changes cascade across services, UI, and tests — these are done atomically since `tsc` checks the entire project.

## Phase 1: Database Migration

### Overview

Add new columns to `batches`, backfill values from existing JSONB ingredient entries, then strip sugar entries and `sort_order` from the JSONB array.

### Changes Required:

#### 1. New migration file

**File**: `supabase/migrations/YYYYMMDDHHmmss_sugar_fields_to_batch_columns.sql`

**Intent**: Add `fermentation_sugar_kg` and `sweetness_sugar_kg` as numeric columns on `batches`. Backfill from existing JSONB data. Clean up the ingredients array by removing sugar-type entries and the `sort_order` key from all remaining entries.

**Contract**: Single migration that:
1. `ALTER TABLE batches ADD COLUMN fermentation_sugar_kg NUMERIC NOT NULL DEFAULT 0`
2. `ALTER TABLE batches ADD COLUMN sweetness_sugar_kg NUMERIC NOT NULL DEFAULT 0`
3. `UPDATE batches` — extract sugar values from ingredients JSONB entries by type, write to new columns
4. `UPDATE batches` — remove entries where `type` = `fermentation_sugar` or `sweetness_sugar` from the JSONB array, then strip `type` and `sort_order` keys from remaining entries

```sql
-- Backfill fermentation sugar
UPDATE batches SET fermentation_sugar_kg = COALESCE(
  (SELECT (elem->>'amount_liters')::numeric
   FROM jsonb_array_elements(ingredients) AS elem
   WHERE elem->>'type' = 'fermentation_sugar'
   LIMIT 1),
  0
);

-- Backfill sweetness sugar
UPDATE batches SET sweetness_sugar_kg = COALESCE(
  (SELECT (elem->>'amount_liters')::numeric
   FROM jsonb_array_elements(ingredients) AS elem
   WHERE elem->>'type' = 'sweetness_sugar'
   LIMIT 1),
  0
);

-- Strip sugar entries and remove type/sort_order keys from remaining
UPDATE batches SET ingredients = (
  SELECT COALESCE(jsonb_agg(
    elem - 'type' - 'sort_order'
  ), '[]'::jsonb)
  FROM jsonb_array_elements(ingredients) AS elem
  WHERE elem->>'type' = 'user_input'
);
```

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on local Supabase: `supabase-dev-apply_migration`
- Existing batch rows retain correct sugar values in new columns
- Ingredients JSONB no longer contains sugar entries or `type`/`sort_order` keys

#### Manual Verification:

- Query a batch in Supabase Studio and confirm new columns + cleaned ingredients

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Application Code

### Overview

Update all TypeScript code atomically: types, Zod schemas, services, UI components, and tests. Shared type changes (`Ingredient` losing `type`/`sort_order`) cascade across the entire codebase, so these must be done together for `tsc --noEmit` to pass.

### Changes Required:

#### 1. Type definitions

**File**: `src/types.ts`

**Intent**: Remove `IngredientType`, remove `type` and `sort_order` from `Ingredient`, add `fermentation_sugar_kg` and `sweetness_sugar_kg` to `Batch` interface.

**Contract**: `Ingredient` becomes `{ name: string; amount_liters: number; sugar_content_percent: number | null }`. `Batch` gains `fermentation_sugar_kg: number` and `sweetness_sugar_kg: number`. `BatchListItem` unchanged (doesn't include ingredients or sugar fields). `SweetnessLevel` unchanged.

#### 2. Zod validation schemas

**File**: `src/lib/schemas/batch.ts`

**Intent**: Update `ingredientSchema` to remove `type` and `sort_order`. Add `fermentation_sugar_kg` and `sweetness_sugar_kg` to `createBatchSchema` and `updateBatchSchema`.

**Contract**: `ingredientSchema` validates `{ name: string, amount_liters: number, sugar_content_percent: number|null }`. Both batch schemas gain `fermentation_sugar_kg: z.number().min(0).default(0)` and `sweetness_sugar_kg: z.number().min(0).default(0)`. The `updateBatchSchema` must explicitly override these in `.extend({})` with `.optional()` — same pattern as the existing `ingredients` fix (see comment at batch.ts:23-25). Zod v4 applies `.default(0)` even through `.partial()`, which would silently zero out sugar fields on any PUT that omits them.

#### 3. Sugar calculation service

**File**: `src/lib/services/sugar-calculation.ts`

**Intent**: Simplify `CalculationInput` — ingredients no longer have a `type` field. All ingredients passed in are user ingredients (the filtering by `type === "user_input"` is no longer needed).

**Contract**: `CalculationInput.ingredients` becomes `{ amount_liters: number; sugar_content_percent: number | null }[]`. Remove import of `IngredientType`. The `calculateSugar()` function sums ALL ingredients (no type filter). Return type unchanged.

#### 4. Batch validation service

**File**: `src/lib/services/batch-validation.ts`

**Intent**: Change `ValidationInput` to accept `fermentation_sugar_kg` and `sweetness_sugar_kg` as direct numeric fields instead of searching ingredients by type. Remove the `fermentationSugarGrams()` helper.

**Contract**: `ValidationInput` gains `fermentation_sugar_kg: number` and `sweetness_sugar_kg: number`. `ingredients` field type changes to the simplified `Ingredient[]` (no `type`/`sort_order`). Rules 6, 7 read `input.fermentation_sugar_kg * 1000` directly. Rule 8 reads `input.sweetness_sugar_kg * 1000 / volume` directly (no ingredient search).

#### 5. BatchForm state management

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Store `fermentation_sugar_kg` and `sweetness_sugar_kg` as separate form state fields (like `target_abv`). Remove auto-creation of sugar pseudo-ingredients. Pass sugar values to `IngredientsSection` as props. Include sugar fields in the submit payload.

**Contract**: `FormState` gains `fermentation_sugar_kg: string` and `sweetness_sugar_kg: string` (string for input binding, parsed to number on submit). Remove all logic that auto-creates/filters sugar entries in the ingredients array (lines 50-67 current). `IngredientsSection` receives `fermentationSugarKg`/`sweetnessSugarKg` props + setters. The `handleSweetnessChange` function resets `sweetness_sugar_kg` to "0" when switching to dry (instead of filtering ingredients). The `computeWarnings` function passes sugar values directly to `validateBatch`.

#### 6. IngredientsSection refactored

**File**: `src/components/batches/IngredientsSection.tsx`

**Intent**: Accept sugar values as props instead of fishing them from the ingredients array. The Calculate button updates sugar props (not ingredients). User ingredients are rendered without type discrimination.

**Contract**: Props gain `fermentationSugarKg: number`, `sweetnessSugarKg: number`, `onSugarChange: (fermentation: number, sweetness: number) => void`, and `plannedSweetness: SweetnessLevel`. Remove `sugarEntries`/`userEntries` filtering. Render sugar cards from props (always show fermentation; show sweetness only when not dry). `handleCalculate()` calls `onSugarChange(result.fermentation_sugar_kg, result.sweetness_sugar_kg)`. `handleAddIngredient()` simplified — no `sort_order`, no `type`.

#### 7. IngredientCard simplified

**File**: `src/components/batches/IngredientCard.tsx`

**Intent**: Remove all type-based branching. The component now only renders user ingredients (name + amount_liters + sugar_content_percent). Sugar cards will be rendered by a new simpler inline component in `IngredientsSection` or a separate `SugarCard` component.

**Contract**: Props become `{ ingredient: Ingredient; onChange; onDelete; isEditing; onToggleEdit }` — no branching on `type`. Remove `SUGAR_ICONS`, `SUGAR_DISPLAY_NAMES`, `formatAmount` branching, `amountLabel` branching. Always show name field, amount in L, sugar content %. A new small `SugarCard` component (or inline JSX in `IngredientsSection`) handles the sugar display — props: `label: string`, `icon: string`, `amountKg: number`, `onChange: (kg: number) => void`, `isEditing`, `onToggleEdit`.

#### 8. Schema tests

**File**: `src/lib/schemas/batch.test.ts`

**Intent**: Update test cases to use the simplified ingredient shape (no `type`, no `sort_order`). Add tests for the new `fermentation_sugar_kg` and `sweetness_sugar_kg` fields on batch schemas.

**Contract**: Remove tests for `fermentation_sugar`/`sweetness_sugar` type acceptance and `invalid ingredient type` rejection. Ingredient test payloads become `{ name, amount_liters, sugar_content_percent }`. Add tests validating sugar fields on create/update schemas (defaults to 0, rejects negative, optional on update).

#### 9. Sugar calculation tests

**File**: `src/lib/services/sugar-calculation.test.ts`

**Intent**: Update ingredient payloads in tests to remove `type` and `sort_order` fields. Test 12 (non-user_input types don't count) becomes obsolete — remove it.

**Contract**: All test ingredient objects become `{ amount_liters, sugar_content_percent }`. Remove Test 12 entirely. All other tests remain logically equivalent.

#### 10. Batch validation tests

**File**: `src/lib/services/batch-validation.test.ts`

**Intent**: Update `ValidationInput` base fixture and all test overrides to use `fermentation_sugar_kg`/`sweetness_sugar_kg` as direct fields. Remove ingredient entries of type `fermentation_sugar`/`sweetness_sugar`.

**Contract**: The `base` fixture gains `fermentation_sugar_kg: 0` and `sweetness_sugar_kg: 0`. Rules 6/7/8 tests pass sugar via these fields instead of ingredient entries. Ingredient arrays in tests contain only simplified user objects (no `type`/`sort_order`).

### Success Criteria:

#### Automated Verification:

- TypeScript type-checks pass: `npx tsc --noEmit`
- All tests pass: `npx vitest run`
- No lint errors: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Create a new batch — sugar cards appear, Calculate populates them, ingredients add/edit works
- Edit an existing batch — sugar values load from batch-level fields, ingredients show correctly
- Switching sweetness to/from "dry" shows/hides sweetness sugar card
- Overall form layout visually unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- Schema validation: ingredient shape, sugar field defaults, rejection of invalid values
- Sugar calculation: all existing scenarios with simplified ingredient objects
- Batch validation: all 9 rules with sugar values as direct inputs

### Integration Tests:

- API endpoint round-trip: create batch with ingredients + sugar fields, GET returns correct shape
- Migration: existing data backfilled correctly (verified manually on local Supabase)

### Manual Testing Steps:

1. Create a new batch — verify sugar cards appear and Calculate fills them
2. Edit an existing batch (migrated data) — verify sugar values loaded from columns
3. Toggle sweetness dry ↔ non-dry — verify sweetness card appears/disappears
4. Manually edit sugar kg values — verify they persist on save
5. Check that no regression in validation warnings

## Performance Considerations

No performance impact — replacing array searches with direct column reads is strictly faster. JSONB array becomes smaller (fewer entries, fewer keys per entry).

## Migration Notes

- Existing batches with sugar entries in JSONB: values are backfilled to new columns, then entries are stripped
- Batches that never had sugar calculated: columns default to 0 (matches previous behavior of `amount_liters: 0`)
- No rollback path needed for a dev project, but the migration is additive-then-destructive within one transaction

## References

- Current sugar calculation service: `src/lib/services/sugar-calculation.ts`
- Current validation service: `src/lib/services/batch-validation.ts`
- Previous JSONB migration: `supabase/migrations/20260605220000_ingredients_jsonb_on_batches.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Migration

#### Automated

- [x] 1.1 Migration applies cleanly on local Supabase — e4b24b1
- [x] 1.2 Existing batch rows retain correct sugar values in new columns — e4b24b1
- [x] 1.3 Ingredients JSONB no longer contains sugar entries or type/sort_order keys — e4b24b1

#### Manual

- [x] 1.4 Query a batch in Supabase Studio and confirm new columns + cleaned ingredients — e4b24b1

### Phase 2: Application Code

#### Automated

- [x] 2.1 TypeScript type-checks pass — bc664cf
- [x] 2.2 All tests pass — bc664cf
- [x] 2.3 No lint errors — bc664cf
- [x] 2.4 Build succeeds — bc664cf

#### Manual

- [x] 2.5 Create a new batch — sugar cards appear, Calculate populates them — bc664cf
- [x] 2.6 Edit an existing batch — sugar values load correctly — bc664cf
- [x] 2.7 Sweetness dry/non-dry toggle shows/hides sweetness card — bc664cf
- [x] 2.8 Overall form layout visually unchanged — bc664cf
