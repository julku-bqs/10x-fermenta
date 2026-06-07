# Ingredients, Sugar Calculation & Validation Warnings — Implementation Plan

## Overview

Add ingredient management, sugar calculation, and validation warnings to the batch detail page — all operating on client-side form state with a single atomic save. This is the north-star slice: the first feature that proves the core product hypothesis — that combining correct calculation + consistency validation in one tool replaces the paper-form-and-mental-math workflow.

## Current State Analysis

- **Database**: `ingredients` table exists but will be replaced by a JSONB `ingredients` column on `batches`. The `ingredient_type` enum (`user_input`, `fermentation_sugar`, `sweetness_sugar`) remains useful for typing within the JSON structure.
- **API**: Batch CRUD (`/api/batches`, `/api/batches/[id]`). PUT endpoint will be extended to accept nested ingredients.
- **UI**: `BatchForm.tsx` has a placeholder "More ingredients — coming soon". `IngredientsList.tsx` handles only yeast (stored on the `batches` table). Batch detail page (`[id].astro`) renders `BatchForm` in edit mode.
- **Types**: `src/types.ts` has `Batch` and `BatchListItem`. No `Ingredient` type yet.
- **Tests**: No test infrastructure. No Vitest, no test files.
- **Libs**: `lucide-react` available for icons. `zod` for validation. `@supabase/ssr` for DB access.

### Key Discoveries:

- `src/components/batches/BatchForm.tsx:288` — "More ingredients — coming soon" placeholder is the insertion point
- Existing yeast card (`IngredientsList.tsx`) uses inline edit/display toggle pattern — reusable for ingredients
- `src/lib/api.ts` — response helpers (`jsonOk`, `jsonCreated`, `jsonError`, `jsonValidationError`) are the API pattern
- `src/lib/schemas/batch.ts` — Zod validation pattern to extend for ingredients

## Desired End State

A user on the batch detail page can:
1. Add ingredients (name + amount in liters + sugar content %) via inline editable cards
2. Click a "Calculate" button (near sugar entries) that computes fermentation sugar (always) and sweetness sugar (non-dry only) and fills those values in the form
3. See a warnings banner at the top of the form that fires on field blur — listing any domain inconsistencies
4. Edit any ingredient including sugar entries (amount is editable). User CANNOT delete sugar entries — their existence is derived from batch parameters (fermentation sugar always present once calculated with amount=0 if not needed; sweetness sugar present only for non-dry wines)
5. Delete user-added ingredients freely
6. Save all changes atomically (batch params + all ingredients) with a single Save button. Cancel discards everything.

Verification: unit tests prove calculation correctness; unit tests prove validation rules; manual test confirms full flow works end-to-end.

## What We're NOT Doing

- Process plan generation (S-03 — separate slice, parallel)
- Reference database / ingredient lookup (v2)
- Sweetness strategy selection (implicit from planned_sweetness)
- Offline support
- E2E tests (unit + integration only for MVP)
- Batch deletion
- Ingredient unit selection (all ingredients measured in liters; sugar measured in kg where 1L≈1kg. Non-liquid ingredients like spices deferred to v2 as separate concept)
- Server-side validation gate (user has full control; warnings are advisory only, never blocking)
- Separate ingredient API endpoints (ingredients save with the batch as one aggregate)
- Thin API wrapper for calculation/validation (documented path for future non-JS clients, not needed for web-only MVP)

## Implementation Approach

**Three phases**: (1) schema migration + test infrastructure + calculation/validation domain logic, (2) API extension (batch save with nested ingredients), (3) UI components wiring everything together. Calculation and validation are the highest-risk items (correctness guardrail), so we test-first them in Phase 1 before touching the API or UI.

## Critical Implementation Details

- **Domain logic architecture**: Calculation and validation modules in `src/lib/services/` are the **single source of truth** for domain logic (isomorphic shared module pattern). They are pure TypeScript functions with zero dependencies on React, DOM, or server runtime — importable by any execution context. For MVP (web-only), called client-side by React components. For future multi-client (native mobile), a thin API wrapper (`POST /api/batches/calculate` accepting form state in body) imports the same modules server-side. Bug fixes: change the module → deploy → all web users get it instantly; native clients call the API (always latest). This architecture satisfies: single source of truth, multi-client readiness, instant UX, and centralized bug fixes.
- **Data model**: Ingredients stored as JSONB array on the `batches` table. Single row UPDATE = inherent atomicity. No separate ingredients table needed for this feature.
- **Conversion constant**: 17 g/L per 1% ABV. Extracted as a named constant (`SUGAR_PER_ABV_GRAM_PER_LITER`) for future configurability.
- **Ingredient sugar formula**: `total_sugar_grams = amount_liters × sugar_content_percent × 10` (since 1% of 1L = 10g/L, and amount is in liters).
- **Sugar unit**: Sugar entries express amount in kilograms (1L ≈ 1kg). Fractions allowed (1.2 kg = 1200g).
- **Sweetness midpoints (g/L)**: dry=0, semi_dry=10, semi_sweet=30, sweet=60. Ranges for validation: semi_dry=[5,15], semi_sweet=[15,45], sweet=[45,80].
- **Calculate button**: Client-side only. Runs `calculateSugar()` on current form state. Overwrites fermentation_sugar and sweetness_sugar amounts in form. Does NOT persist — user must Save. Placed near the sugar entries (single button for both).
- **Sugar entry ordering**: Sugar entries always appear at top of ingredient list (below yeast). Enforced via `sort_order`: fermentation_sugar = -2, sweetness_sugar = -1, user ingredients start at 0+.
- **Sugar entry lifecycle**: `fermentation_sugar` always exists once batch is first set up (amount=0 if not needed). `sweetness_sugar` exists only when `planned_sweetness !== 'dry'`. Changing to dry removes sweetness entry from form state. Sugar entries cannot be deleted by user, only their amount is editable.
- **Auto-calculation on setup**: Sugar entries auto-created with calculated values when batch is first set up (new batch or user cleared values). Subsequent recalculations require explicit Calculate button click.
- **Validation trigger**: Client-side pure function, fires on field blur (not keystroke). All data comes from form state.
- **Yeast UX**: Yeast is optional. When not added, show "Add yeast" button instead of form. If no yeast, skip yeast-related validation rules but show warning: "No yeast specified — using wild yeast can give unpredictable results."
- **Missing params handling**: If target ABV is not provided, don't show ABV-related warnings. Instead show one advisory: "No target ABV specified — calculation results may be incomplete."
- **Warning severity**: Single level (amber). All warnings are advisory. App never blocks user actions.
- **Save behavior**: Single Save button persists batch params + full ingredients array atomically. Cancel discards all unsaved changes (form reverts to last-saved DB state). `beforeunload` prompt guards against accidental navigation.

---

## Phase 1: Schema Migration, Test Infrastructure & Domain Logic

### Overview

Migrate to JSONB ingredients storage, set up Vitest, define sugar calculation and validation modules as pure functions, and prove correctness with comprehensive unit tests. This phase produces no UI changes — only the tested domain logic and the data model that Phase 2 will consume.

### Changes Required:

#### 1. Database migration — JSONB ingredients

**File**: `supabase/migrations/YYYYMMDDHHmmss_ingredients_jsonb_on_batches.sql` (new)

**Intent**: Add an `ingredients` JSONB column to the `batches` table. Drop the separate `ingredients` table and the `ingredient_type` enum (no data exists; types live in application-level TypeScript only).

**Contract**:
```sql
ALTER TABLE batches ADD COLUMN ingredients jsonb NOT NULL DEFAULT '[]';
-- Drop ingredients table and all associated objects
DROP TRIGGER IF EXISTS handle_updated_at_ingredients ON ingredients;
DROP TABLE ingredients;
DROP TYPE ingredient_type;
-- (ingredients RLS policies and indexes dropped implicitly with table)
```

#### 2. Vitest setup

**File**: `vitest.config.ts` (new)

**Intent**: Configure Vitest with TypeScript path aliases matching `tsconfig.json` so tests can import `@/lib/*`.

**Contract**: Export a Vitest config with `resolve.alias` mapping `@` → `./src`.

**File**: `package.json`

**Intent**: Add `vitest` dev dependency and `test` / `test:watch` scripts.

**Contract**: `devDependencies.vitest`, `scripts.test = "vitest run"`, `scripts["test:watch"] = "vitest"`.

#### 3. Types update

**File**: `src/types.ts`

**Intent**: Add `Ingredient` interface, `IngredientType`, `SweetnessLevel` type exports. Update `Batch` interface to include `ingredients` field.

**Contract**:
```typescript
export type IngredientType = "user_input" | "fermentation_sugar" | "sweetness_sugar";
export type SweetnessLevel = "dry" | "semi_dry" | "semi_sweet" | "sweet";

export interface Ingredient {
  type: IngredientType;
  name: string;
  amount_liters: number;       // liters for ingredients, kg for sugar (1L≈1kg)
  sugar_content_percent: number | null;  // null for ingredients with no sugar info
  sort_order: number;          // -2 fermentation, -1 sweetness, 0+ user
}

// Update Batch interface to include:
// ingredients: Ingredient[];
```

#### 4. Sugar calculation module

**File**: `src/lib/services/sugar-calculation.ts` (new)

**Intent**: Pure function that computes fermentation sugar and sweetness sugar amounts given batch parameters and current user ingredients. Runs client-side — imported by React components. Also importable server-side by future features (S-03 diary generation).

**Contract**:
```typescript
export const SUGAR_PER_ABV_GRAM_PER_LITER = 17;

export const SWEETNESS_MIDPOINTS: Record<SweetnessLevel, number> = {
  dry: 0, semi_dry: 10, semi_sweet: 30, sweet: 60
};

export const SWEETNESS_RANGES: Record<SweetnessLevel, [number, number]> = {
  dry: [0, 0], semi_dry: [5, 15], semi_sweet: [15, 45], sweet: [45, 80]
};

export interface CalculationInput {
  target_volume_liters: number;
  target_abv: number;
  planned_sweetness: SweetnessLevel;
  ingredients: { amount_liters: number; sugar_content_percent: number | null; type: IngredientType }[];
}

export interface CalculationResult {
  fermentation_sugar_kg: number;     // 0 if ingredient sugar already sufficient
  sweetness_sugar_kg: number;        // 0 if dry
  total_ingredient_sugar_grams: number;
  sugar_needed_for_abv_grams: number;
}

export function calculateSugar(input: CalculationInput): CalculationResult;
```

The function:
- Sums sugar from `user_input` ingredients only: `sum(amount_liters × (sugar_content_percent ?? 0) × 10)` grams
- `sugar_needed_for_abv = target_abv × SUGAR_PER_ABV_GRAM_PER_LITER × target_volume_liters` grams
- `fermentation_sugar_grams = max(0, sugar_needed_for_abv - total_ingredient_sugar)`
- `fermentation_sugar_kg = fermentation_sugar_grams / 1000`
- `sweetness_sugar_grams = SWEETNESS_MIDPOINTS[planned_sweetness] × target_volume_liters`
- `sweetness_sugar_kg = sweetness_sugar_grams / 1000` (0 if dry)
- Returns all intermediate values for transparency

#### 5. Validation module

**File**: `src/lib/services/batch-validation.ts` (new)

**Intent**: Pure function that takes batch params + all ingredients and returns a list of active warnings. Runs client-side on blur.

**Contract**:
```typescript
export interface ValidationWarning {
  id: string;       // stable key for React rendering
  message: string;  // user-facing text
}

export interface ValidationInput {
  target_abv: number | null;
  target_volume_liters: number | null;
  planned_sweetness: SweetnessLevel;
  yeast_alcohol_tolerance: number | null;
  has_yeast: boolean;
  ingredients: Ingredient[];
}

export function validateBatch(input: ValidationInput): ValidationWarning[];
```

Warning rules (all single amber severity):
1. **No yeast** (`!has_yeast`) → "No yeast specified — using wild yeast can give unpredictable results."
2. **No target ABV** (`target_abv === null`) → "No target ABV specified — calculation results may be incomplete."
3. **ABV > yeast tolerance** (`target_abv > yeast_alcohol_tolerance`, only when both non-null) → "Target ABV exceeds yeast alcohol tolerance. The plan is inconsistent."
4. **Non-dry + tolerance > ABV** (`planned_sweetness !== 'dry' && yeast_alcohol_tolerance > target_abv`, only when both non-null) → "Planned sweetness requires stopping fermentation. Yeast tolerance exceeds target ABV, so fermentation won't stop on its own."
5. **Ingredient sugar exceeds target ABV** (sugar from user_input ≥ sugar_needed_for_abv, only when target_abv and volume non-null) → "Sugar from ingredients already exceeds what's needed for target ABV. No additional fermentation sugar is required."
6. **Total sugar insufficient** (user_input sugar + fermentation_sugar amount < sugar_needed_for_abv, when calculable) → "Total sugar (ingredients + added) is insufficient for target ABV."
7. **Sweetness sugar out of range** (sweetness_sugar amount outside SWEETNESS_RANGES for selected level, only for non-dry) → "Sweetness sugar amount falls outside the expected range for the selected sweetness level."
8. **General advisory** (fires when at least target_abv is filled) → "Planned parameters are expected values, not guaranteed outcomes. Accuracy depends on your inputs."

Rules only fire when their required inputs are non-null.

#### 6. Unit tests

**File**: `src/lib/services/sugar-calculation.test.ts` (new)

**Intent**: Exhaustive test coverage for the calculation function.

**Contract**: Test cases covering:
- Dry wine, no ingredients → full fermentation sugar needed
- Dry wine, partial ingredient sugar → correct deficit
- Dry wine, ingredient sugar exceeds target → fermentation_sugar_kg = 0
- Non-dry wine → separate fermentation + sweetness amounts
- Sweetness levels: each midpoint produces correct kg value
- Edge cases: zero volume, zero ABV, null sugar_content_percent ingredients
- Large values / precision verification

**File**: `src/lib/services/batch-validation.test.ts` (new)

**Intent**: Test each warning rule independently and in combination.

**Contract**: One test per rule (fires correctly, doesn't fire when condition not met), tests for missing params (null target_abv, no yeast), combination tests (multiple warnings active simultaneously).

### Success Criteria:

#### Automated Verification:

- [ ] Vitest runs successfully: `npm run test`
- [ ] All calculation unit tests pass (minimum 10 test cases)
- [ ] All validation unit tests pass (minimum 12 test cases)
- [ ] Lint passes: `npm run lint`

#### Manual Verification:

- [ ] Review test cases cover domain scenarios from fermenta-details1.md
- [ ] Migration applies cleanly against local Supabase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Extension — Batch Save with Nested Ingredients

### Overview

Extend the existing batch PUT endpoint to accept and persist a nested `ingredients` array. No separate ingredient endpoints needed — everything saves atomically with the batch. Extend the batch Zod schema to validate the ingredients array.

### Changes Required:

#### 1. Schema extension

**File**: `src/lib/schemas/batch.ts`

**Intent**: Add `ingredients` array field to the batch schemas. Each ingredient is validated: name required, amount_liters required (≥ 0), sugar_content_percent optional (nullable, 0-100 when present), type required, sort_order required.

**Contract**: Add `ingredientSchema` (Zod object for one ingredient) and extend `createBatchSchema`/`updateBatchSchema` with `ingredients: z.array(ingredientSchema).default([])`.

#### 2. Batch API update — PUT with ingredients

**File**: `src/pages/api/batches/[id].ts`

**Intent**: Modify the PUT handler to accept `ingredients` in the request body and persist it as the JSONB column value. The entire ingredients array is replaced atomically (single UPDATE on batches row).

**Contract**: PUT body may include `ingredients: Ingredient[]`. If present, the JSONB column is overwritten with the submitted array. If absent (partial update), ingredients are not touched. Response returns the full batch including ingredients.

#### 3. Batch API update — GET returns ingredients

**File**: `src/pages/api/batches/[id].ts`

**Intent**: Ensure GET response includes the `ingredients` array from the JSONB column.

**Contract**: Already happens naturally — `SELECT *` includes the new column. Ensure the `Batch` TypeScript type matches.

#### 4. Batch creation — POST initializes empty ingredients

**File**: `src/pages/api/batches/index.ts`

**Intent**: When creating a batch, initialize `ingredients` as `[]` (DB default handles this). Optionally accept ingredients in the POST body for batches created with pre-populated data.

**Contract**: POST may include `ingredients`. Default is `[]`.

#### 5. Batch detail page — pass ingredients to form

**File**: `src/pages/batches/[id].astro`

**Intent**: The fetched batch now includes `ingredients` from the DB. Pass it to BatchForm as part of `initialData`.

**Contract**: No code change needed — `data as Batch` already includes the new field since the Batch type is updated.

### Success Criteria:

#### Automated Verification:

- [ ] All tests pass: `npm run test`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

#### Manual Verification:

- [ ] PUT with ingredients array persists and returns correctly (curl test)
- [ ] GET returns ingredients in batch response
- [ ] PUT without ingredients field doesn't clear existing ingredients (partial update)
- [ ] Zod rejects malformed ingredients (missing name, negative amount)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Components & Integration

### Overview

Wire everything together in the batch form: ingredient list with inline editing, calculate button near sugar entries, warnings banner at the top. Replace the "More ingredients — coming soon" placeholder with the full ingredient management UI. All ingredient state lives in the form until Save.

### Changes Required:

#### 1. Ingredient card component

**File**: `src/components/batches/IngredientCard.tsx` (new)

**Intent**: Inline editable card for a single ingredient. Display mode shows name + amount (liters) + sugar %. Edit mode shows input fields. Supports delete for user_input type only. Sugar entries show amount as editable but no delete button. Follows the existing yeast card pattern.

**Contract**: Props: `ingredient: Ingredient`, `onChange: (updates: Partial<Ingredient>) => void`, `onDelete?: () => void` (undefined for sugar entries), `isEditing: boolean`, `onToggleEdit: () => void`.

#### 2. Ingredients section component

**File**: `src/components/batches/IngredientsSection.tsx` (new)

**Intent**: Container component managing the ingredient list in form state. Renders ingredient cards, the "Add ingredient" button, and the Calculate button. Sugar entries appear at the top (sort_order -2, -1). Calculate button is positioned near the sugar entries.

**Contract**: Props: `ingredients: Ingredient[]`, `onChange: (ingredients: Ingredient[]) => void`, `batchParams: { target_volume_liters, target_abv, planned_sweetness }`.

Behavior:
- "Add ingredient" button → appends new `user_input` entry to form state (name empty, amount 0, sort_order = max+1)
- Calculate button (🧮 icon) → runs `calculateSugar()` with current form state, updates/creates sugar entries in the ingredients array
- Sugar entries auto-created on initial batch setup (when array has no sugar entries and params are filled)
- Changing `planned_sweetness` to dry → removes sweetness_sugar from array
- Changing `planned_sweetness` to non-dry → adds sweetness_sugar if not present

#### 3. Yeast section update

**File**: `src/components/batches/IngredientsList.tsx` (or new `YeastSection.tsx`)

**Intent**: When no yeast data exists, show "Add yeast" button instead of the edit form. Yeast remains optional. Card pattern preserved.

**Contract**: If `yeastName` and `yeastTolerance` are both empty, show a button "🧪 Add yeast" that expands to the edit form on click. Existing editing behavior unchanged.

#### 4. Warnings banner component

**File**: `src/components/batches/ValidationWarnings.tsx` (new)

**Intent**: Renders active warnings at the top of the batch form. Amber-colored, compact, informative but not overwhelming. Collapsible if many warnings (show count + expand). Dismissible per-session but re-fires on next blur.

**Contract**: Props: `warnings: ValidationWarning[]`. Renders nothing if empty. Design: amber/warm border, small text, grouped list. If >3 warnings, show first 2 + "and N more" expandable.

#### 5. BatchForm integration

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Major refactor to support ingredients in form state. Replace "More ingredients — coming soon" with `IngredientsSection`. Add `ValidationWarnings` at top. Wire validation to fire on blur. Save button persists batch params + ingredients together. Cancel reverts to initialData. Add `beforeunload` guard for unsaved changes.

**Contract**:
- Form state extended: add `ingredients: Ingredient[]` to `FormState`
- Initialize ingredients from `initialData.ingredients ?? []`
- Render `ValidationWarnings` above the form grid — warnings computed via `validateBatch()` on blur
- Render `IngredientsSection` in the ingredients section, passing `ingredients` and `onChange` handler
- Save (handleSubmit) sends full payload including `ingredients` array to PUT endpoint
- Cancel (`href="/batches"`) — add dirty-check and `beforeunload` prompt
- In create mode: after batch is created, redirect to edit mode where ingredients become available (ingredients need a saved batch)

### Success Criteria:

#### Automated Verification:

- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] All tests still pass: `npm run test`

#### Manual Verification:

- [ ] Can add an ingredient with name, amount (L), sugar content (%) — appears in form
- [ ] Can edit an ingredient inline — form state updates
- [ ] Can delete a user ingredient — removed from form
- [ ] Cannot delete sugar entries — no delete button shown for them
- [ ] Sugar entries appear at top of list (below yeast)
- [ ] Calculate button fills fermentation sugar amount (dry wine)
- [ ] Calculate button fills both fermentation + sweetness sugar (non-dry wine)
- [ ] Changing sweetness to dry removes sweetness entry from form
- [ ] Changing sweetness to non-dry adds sweetness entry
- [ ] Warnings banner appears on blur with correct warnings for each rule
- [ ] No yeast → "wild yeast" warning shown
- [ ] No target ABV → "incomplete" warning shown
- [ ] Save persists all ingredients atomically
- [ ] Cancel discards all unsaved changes (ingredients revert)
- [ ] beforeunload prompt fires when form is dirty
- [ ] No regressions in batch create/edit flow
- [ ] Warning banner is informative but not overwhelming (collapsible if many)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Sugar calculation: 10+ cases covering dry/non-dry, edge cases, zero values, precision
- Validation: 8 rules × (fires/doesn't fire) + null-param handling + combination scenarios
- Zod schemas: valid/invalid ingredient arrays, edge cases

### Integration Tests:

- Batch PUT with ingredients: persists correctly, partial update doesn't clear ingredients
- Batch GET: returns ingredients in response
- Malformed ingredient data rejected by Zod

### Manual Testing Steps:

1. Create a new batch → see empty ingredients section, no warnings
2. Add yeast (name + tolerance) → yeast card shows
3. Add grape juice ingredient: 15L, 20% sugar
4. Click Calculate → fermentation sugar entry appears with correct kg amount
5. Change target ABV above yeast tolerance → ABV warning appears on blur
6. Change sweetness to semi-sweet → sweetness sugar entry auto-added, recalculate fills it
7. Edit sweetness sugar to out-of-range value → range warning on blur
8. Try to delete sugar entry → no delete button available
9. Remove yeast → "wild yeast" warning appears
10. Click Save → all data persists
11. Reload page → all ingredients and params preserved
12. Make changes then Cancel → form reverts to saved state

## Performance Considerations

- Calculation and validation both run client-side as pure functions — effectively instant (<1ms).
- Save is a single PUT with a JSON body — one DB UPDATE on one row. Well within acceptable latency.
- No separate ingredient API calls, no transaction orchestration, no race conditions.
- JSONB column adds negligible row size (5-15 ingredients × ~100 bytes = ~1-1.5KB per batch).

## Migration Notes

- **Migration required**: Add `ingredients jsonb DEFAULT '[]'` to `batches` table. Drop `ingredients` table (no data exists). Drop associated RLS policies, indexes, and triggers for the dropped table.
- **No data migration**: The `ingredients` table has never been populated (S-02 is the first feature to use it).
- **Enum dropped**: `ingredient_type` removed from DB — values live in application-level TypeScript only (`IngredientType` type).

## References

- Domain logic specification: `context/foundation/fermenta-details1.md`
- PRD functional requirements: FR-006, FR-008, FR-009
- Database schema: `supabase/migrations/20260530213000_batch_schema_with_rls.sql`
- Existing batch form: `src/components/batches/BatchForm.tsx`
- Existing API pattern: `src/pages/api/batches/index.ts`
- Plan review: `context/changes/ingredients-calculation-validation/reviews/human-review1.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema Migration, Test Infrastructure & Domain Logic

#### Automated

- [x] 1.1 Vitest runs successfully: npm run test — f47205b
- [x] 1.2 All calculation unit tests pass (minimum 10 test cases) — f47205b
- [x] 1.3 All validation unit tests pass (minimum 12 test cases) — f47205b
- [x] 1.4 Lint passes: npm run lint — f47205b

#### Manual

- [x] 1.5 Review test cases cover domain scenarios from fermenta-details1.md — f47205b
- [x] 1.6 Migration applies cleanly against local Supabase — f47205b

### Phase 2: API Extension — Batch Save with Nested Ingredients

#### Automated

- [x] 2.1 All tests pass: npm run test — 42a6405
- [x] 2.2 Lint passes: npm run lint — 42a6405
- [x] 2.3 Build succeeds: npm run build — 42a6405

#### Manual

- [x] 2.4 PUT with ingredients persists and returns correctly — 42a6405
- [x] 2.5 GET returns ingredients in batch response — 42a6405
- [x] 2.6 Partial PUT without ingredients doesn't clear them — 42a6405
- [x] 2.7 Zod rejects malformed ingredients — 42a6405

### Phase 3: UI Components & Integration

#### Automated

- [x] 3.1 Build succeeds: npm run build
- [x] 3.2 Lint passes: npm run lint
- [x] 3.3 All tests still pass: npm run test

#### Manual

- [x] 3.4 Can add an ingredient with name, amount (L), sugar content (%)
- [x] 3.5 Can edit an ingredient inline — form state updates
- [x] 3.6 Can delete a user ingredient — removed from form
- [x] 3.7 Cannot delete sugar entries — no delete button shown
- [x] 3.8 Sugar entries appear at top of list (below yeast)
- [x] 3.9 Calculate button fills fermentation sugar amount (dry wine)
- [x] 3.10 Calculate button fills both fermentation + sweetness sugar (non-dry)
- [x] 3.11 Changing sweetness to dry removes sweetness entry from form
- [x] 3.12 Changing sweetness to non-dry adds sweetness entry
- [x] 3.13 Warnings banner appears on blur with correct warnings for each rule
- [x] 3.14 No yeast → "wild yeast" warning shown
- [x] 3.15 No target ABV → "incomplete" warning shown
- [x] 3.16 Save persists all ingredients atomically
- [x] 3.17 Cancel discards all unsaved changes (ingredients revert)
- [x] 3.18 beforeunload prompt fires when form is dirty
- [x] 3.19 No regressions in batch create/edit flow
- [x] 3.20 Warning banner is informative but not overwhelming (collapsible if many)
