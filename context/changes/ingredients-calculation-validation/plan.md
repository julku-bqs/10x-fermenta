# Ingredients, Sugar Calculation & Validation Warnings — Implementation Plan

## Overview

Add ingredient management (CRUD), sugar calculation (server-side, triggered by button), and validation warnings (auto-fired on every change) to the batch detail page. This is the north-star slice: the first feature that proves the core product hypothesis — that combining correct calculation + consistency validation in one tool replaces the paper-form-and-mental-math workflow.

## Current State Analysis

- **Database**: `ingredients` table exists with `type` enum (`user_input`, `fermentation_sugar`, `sweetness_sugar`), `name`, `amount`, `unit`, `sugar_content_percent`, `sort_order`. RLS policies in place. No rows exist yet.
- **API**: Only batch CRUD (`/api/batches`, `/api/batches/[id]`). No ingredient endpoints.
- **UI**: `BatchForm.tsx` has a placeholder "More ingredients — coming soon". `IngredientsList.tsx` handles only yeast (stored on the `batches` table, not `ingredients` table). Batch detail page (`[id].astro`) renders `BatchForm` in edit mode.
- **Types**: `src/types.ts` has `Batch` and `BatchListItem`. No `Ingredient` type.
- **Tests**: No test infrastructure. No `vitest`, no test files.
- **Libs**: `lucide-react` available for icons. `zod` for validation. `@supabase/ssr` for DB access.

### Key Discoveries:

- `src/components/batches/BatchForm.tsx:288` — "More ingredients — coming soon" placeholder is the insertion point
- `supabase/migrations/20260530213000_batch_schema_with_rls.sql:17` — `ingredient_type` enum already defines the three types we need
- Ingredient table has `unit` column (text) — we'll default to "L" (liters) per user decision
- `src/lib/api.ts` — response helpers (`jsonOk`, `jsonCreated`, `jsonError`, `jsonValidationError`) are the pattern for new API routes
- Ingredients persist immediately (not batch-save) — needs own API endpoints

## Desired End State

A user on the batch detail page can:
1. Add ingredients (name + amount in liters + sugar content %) via inline editable cards
2. Click a "Calculate" button that computes fermentation sugar (and sweetness sugar for non-dry) and creates/overwrites those entries in the ingredient list
3. See a warnings banner at the top of the form that fires on every parameter/ingredient change and on save — listing any domain inconsistencies
4. Edit or remove any ingredient (including calculated sugar entries) — they appear as regular ingredients with no visual distinction

Verification: unit tests prove calculation correctness; integration tests prove API contract; manual test confirms full flow works end-to-end.

## What We're NOT Doing

- Process plan generation (S-03 — separate slice, parallel)
- Reference database / ingredient lookup (v2)
- Sweetness strategy selection (implicit from planned_sweetness)
- Offline support
- E2E tests (unit + integration only for MVP)
- Shared client/server calculation lib (server-only initially; extract if performance needs it)
- Batch deletion

## Implementation Approach

**Four phases**: (1) set up test infrastructure + calculation domain logic, (2) ingredient CRUD API + persistence, (3) validation engine, (4) UI components wiring everything together. The calculation logic is the highest-risk item (correctness guardrail), so we test-first it in Phase 1 before building the API surface.

## Critical Implementation Details

- **Conversion constant**: 17 g/L per 1% ABV. Extracted as a named constant for future configurability.
- **Ingredient sugar formula**: `total_sugar_grams = amount_liters × sugar_content_percent × 10` (since 1% of 1L = 10g).
- **Sweetness midpoints**: dry=0, semi_dry=10 g/L, semi_sweet=30 g/L, sweet=60 g/L. Ranges: semi_dry=[5,15], semi_sweet=[15,45], sweet=[45,80].
- **Calculate button behavior**: POST to `/api/batches/{id}/calculate`. Creates or overwrites `fermentation_sugar` and `sweetness_sugar` (if non-dry) ingredient entries. Sets `fermentation_sugar` amount to 0 if ingredient sugar already covers target ABV. Removes `sweetness_sugar` entry if sweetness is dry.
- **Validation runs client-side**: on every parameter change, ingredient change, and save — calls a shared validation function (pure TypeScript, no API call needed since all data is in form state). This differs from calculation which hits the server.
- **Performance budget**: Calculate endpoint ≤200ms response time.

---

## Phase 1: Test Infrastructure & Calculation Domain Logic

### Overview

Set up Vitest, define the sugar calculation module as a pure function, and prove correctness with comprehensive unit tests. This phase produces no UI — only the tested domain logic that Phase 2's API will consume.

### Changes Required:

#### 1. Vitest setup

**File**: `vitest.config.ts` (new)

**Intent**: Configure Vitest with TypeScript path aliases matching `tsconfig.json` so tests can import `@/lib/*`.

**Contract**: Export a Vitest config with `resolve.alias` mapping `@` → `./src`.

**File**: `package.json`

**Intent**: Add `vitest` dev dependency and `test` / `test:watch` scripts.

**Contract**: `devDependencies.vitest`, `scripts.test = "vitest run"`, `scripts["test:watch"] = "vitest"`.

#### 2. Sugar calculation module

**File**: `src/lib/services/sugar-calculation.ts` (new)

**Intent**: Pure function that computes fermentation sugar and sweetness sugar amounts given batch parameters and current ingredients. This is the single source of truth for the formula — the API endpoint calls this, and future shared-lib extraction (if needed for client-side) starts here.

**Contract**:

```typescript
export const SUGAR_PER_ABV_GRAM_PER_LITER = 17;

export const SWEETNESS_MIDPOINTS: Record<SweetnessLevel, number> = {
  dry: 0, semi_dry: 10, semi_sweet: 30, sweet: 60
};

export interface CalculationInput {
  target_volume_liters: number;
  target_abv: number;
  planned_sweetness: SweetnessLevel;
  ingredients: { amount: number; sugar_content_percent: number; type: IngredientType }[];
}

export interface CalculationResult {
  fermentation_sugar_grams: number;  // 0 if ingredient sugar already sufficient
  sweetness_sugar_grams: number;     // 0 if dry
  total_ingredient_sugar_grams: number;
  sugar_needed_for_abv_grams: number;
}

export function calculateSugar(input: CalculationInput): CalculationResult;
```

The function:
- Sums sugar from `user_input` ingredients only (excludes existing `fermentation_sugar`/`sweetness_sugar` entries to avoid double-counting)
- `sugar_needed_for_abv = target_abv × 17 × target_volume_liters`
- `fermentation_sugar = max(0, sugar_needed_for_abv - total_ingredient_sugar)`
- `sweetness_sugar = SWEETNESS_MIDPOINTS[planned_sweetness] × target_volume_liters` (residual sugar in grams for the full volume)
- Returns all intermediate values for transparency

#### 3. Calculation unit tests

**File**: `src/lib/services/sugar-calculation.test.ts` (new)

**Intent**: Exhaustive test coverage for the calculation function — dry wines, non-dry wines, edge cases (zero ingredients, excess sugar, zero volume, large values).

**Contract**: Test cases covering:
- Dry wine, no ingredients → full fermentation sugar needed
- Dry wine, partial ingredient sugar → correct deficit
- Dry wine, ingredient sugar exceeds target → fermentation_sugar = 0
- Non-dry wine → separate fermentation + sweetness amounts
- Non-dry wine switching to dry → sweetness = 0
- Rounding behavior / floating point handling

### Success Criteria:

#### Automated Verification:

- Vitest runs successfully: `npm run test`
- All calculation unit tests pass (minimum 10 test cases)
- Type checking passes: `npm run lint`

#### Manual Verification:

- Review test cases cover the domain scenarios from fermenta-details1.md

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Ingredient CRUD API & Types

### Overview

Build the API endpoints for ingredient management (`GET`, `POST`, `PUT`, `DELETE`) and the calculate endpoint. Add TypeScript types. Each ingredient change persists immediately.

### Changes Required:

#### 1. Ingredient types

**File**: `src/types.ts`

**Intent**: Add `Ingredient` interface and related types used by both API and UI.

**Contract**:

```typescript
export type IngredientType = "user_input" | "fermentation_sugar" | "sweetness_sugar";
export type SweetnessLevel = "dry" | "semi_dry" | "semi_sweet" | "sweet";

export interface Ingredient {
  id: string;
  batch_id: string;
  type: IngredientType;
  name: string;
  amount: number | null;
  unit: string | null;
  sugar_content_percent: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

#### 2. Ingredient validation schemas

**File**: `src/lib/schemas/ingredient.ts` (new)

**Intent**: Zod schemas for creating and updating ingredients, following the same pattern as `batch.ts`.

**Contract**: `createIngredientSchema` (name required, amount/unit/sugar_content_percent optional-nullable), `updateIngredientSchema` (partial). Type exports.

#### 3. Ingredient CRUD API

**File**: `src/pages/api/batches/[id]/ingredients/index.ts` (new)

**Intent**: GET (list ingredients for a batch) and POST (create ingredient) endpoints. Nested under batch ID to ensure ownership via RLS.

**Contract**: `GET /api/batches/{id}/ingredients` → `{ data: Ingredient[] }`. `POST /api/batches/{id}/ingredients` → `{ data: Ingredient }` (201). Validates batch ownership implicitly via RLS (query will return empty if not owner).

**File**: `src/pages/api/batches/[id]/ingredients/[ingredientId].ts` (new)

**Intent**: PUT (update) and DELETE (remove) single ingredient.

**Contract**: `PUT` → updated ingredient. `DELETE` → 204 no content. Both validate via Supabase RLS.

#### 4. Calculate endpoint

**File**: `src/pages/api/batches/[id]/calculate.ts` (new)

**Intent**: POST endpoint that reads batch params + current user_input ingredients, runs `calculateSugar()`, then upserts `fermentation_sugar` and `sweetness_sugar` entries (or removes sweetness_sugar if dry). Returns the updated ingredient list.

**Contract**: `POST /api/batches/{id}/calculate` → `{ data: Ingredient[] }`. No request body needed — reads all inputs from DB. Overwrites existing calculated entries. Removes `sweetness_sugar` if `planned_sweetness === 'dry'`.

#### 5. Integration tests

**File**: `src/pages/api/batches/[id]/calculate.test.ts` (new)

**Intent**: Test the calculate endpoint logic (can mock Supabase or test the service function with realistic inputs).

**Contract**: Tests verifying: correct upsert of sugar entries, removal of sweetness entry for dry, idempotent re-calculation, handling of missing params.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Test ingredient CRUD via curl/REST client against local Supabase
- Verify calculate endpoint returns correct sugar entries
- Verify ≤200ms response time for calculate endpoint

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Validation Engine

### Overview

Build the client-side validation function that evaluates all 6 warning rules and returns a list of active warnings. This runs synchronously in the browser on every relevant state change.

### Changes Required:

#### 1. Validation module

**File**: `src/lib/services/batch-validation.ts` (new)

**Intent**: Pure function that takes batch params + all ingredients (including calculated sugar entries) and returns a list of warnings. Designed to run client-side for instant feedback.

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
  ingredients: { amount: number | null; sugar_content_percent: number | null; type: IngredientType }[];
}

export function validateBatch(input: ValidationInput): ValidationWarning[];
```

Rules (all produce equal-severity amber warnings):
1. `target_abv > yeast_alcohol_tolerance` → "Target ABV exceeds yeast alcohol tolerance. The plan is inconsistent."
2. `planned_sweetness !== 'dry' && yeast_alcohol_tolerance > target_abv` → "Planned sweetness requires stopping fermentation. Yeast tolerance exceeds target ABV, so fermentation won't stop on its own."
3. Ingredient sugar (from user_input) ≥ sugar needed for target ABV → "Sugar from ingredients already exceeds what's needed for target ABV. No additional fermentation sugar is required."
4. Total sugar (user_input + fermentation_sugar) < sugar needed for ABV → "Total sugar (ingredients + added) is insufficient for target ABV."
5. `sweetness_sugar` amount outside range for selected sweetness level → "Sweetness sugar amount falls outside the expected range for the selected sweetness level."
6. General advisory (always shown when target params are filled): "Planned parameters are expected values, not guaranteed outcomes. Accuracy depends on your inputs."

Rules 1-5 only fire when the relevant inputs are non-null. Rule 6 fires when at least `target_abv` is filled.

#### 2. Validation unit tests

**File**: `src/lib/services/batch-validation.test.ts` (new)

**Intent**: Test each warning rule independently and in combination.

**Contract**: One test per rule (fires correctly, doesn't fire when condition not met), plus combination tests (multiple warnings active simultaneously).

### Success Criteria:

#### Automated Verification:

- All validation tests pass: `npm run test`
- Lint passes: `npm run lint`
- Type checking passes (validation types integrate with existing types)

#### Manual Verification:

- Review warning messages for clarity and correctness against PRD/fermenta-details1.md

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: UI Components & Integration

### Overview

Wire everything together in the batch form: ingredient list with inline editing, calculate button, warnings banner. Replace the "More ingredients — coming soon" placeholder with the full ingredient management UI.

### Changes Required:

#### 1. Ingredient card component

**File**: `src/components/batches/IngredientCard.tsx` (new)

**Intent**: Inline editable card for a single ingredient. Display mode shows name, amount, unit, sugar %. Edit mode shows input fields. Supports delete. Follows the existing yeast card pattern from `IngredientsList.tsx`.

**Contract**: Props: `ingredient: Ingredient`, `onSave: (updates) => Promise<void>`, `onDelete: () => Promise<void>`. Manages own edit/display state toggle internally.

#### 2. Refactored ingredients section

**File**: `src/components/batches/IngredientsSection.tsx` (new)

**Intent**: Container component that replaces the placeholder in BatchForm. Manages ingredient list state, handles CRUD API calls, shows the calculate button, and renders ingredient cards. Fetches ingredients on mount for the given batch.

**Contract**: Props: `batchId: string`, `batchParams: { target_volume_liters, target_abv, planned_sweetness, yeast_alcohol_tolerance }`, `onIngredientsChange: (ingredients: Ingredient[]) => void`. The `onIngredientsChange` callback notifies the parent (for validation recalculation).

Includes:
- "Add ingredient" button → creates new `user_input` ingredient via API
- Calculate button (calculator icon from lucide-react) → calls `/api/batches/{id}/calculate`, refreshes list
- Auto-calculates on first load if batch is new and has no sugar entries yet

#### 3. Warnings banner component

**File**: `src/components/batches/ValidationWarnings.tsx` (new)

**Intent**: Renders the list of active warnings at the top of the batch form. Amber-colored, dismissible per-session but re-fires on next change.

**Contract**: Props: `warnings: ValidationWarning[]`. Renders nothing if array is empty.

#### 4. BatchForm integration

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Replace the "More ingredients — coming soon" placeholder with `IngredientsSection`. Add `ValidationWarnings` banner at the top. Run `validateBatch()` on every parameter change and pass results to the banner. Wire `onIngredientsChange` to trigger revalidation.

**Contract**: 
- Import and render `ValidationWarnings` above the form grid
- Import and render `IngredientsSection` in place of the old placeholder (only in edit mode — ingredients need a persisted batch ID)
- Add `useEffect` / `useMemo` that calls `validateBatch()` whenever params or ingredients change
- In create mode, show a note: "Save the batch first to add ingredients"

#### 5. Batch detail page — fetch ingredients

**File**: `src/pages/batches/[id].astro`

**Intent**: Fetch ingredients alongside the batch and pass them as initial data to BatchForm (optional optimization — or let IngredientsSection fetch on mount via its own API call). Simpler approach: let IngredientsSection self-fetch.

**Contract**: No change needed if IngredientsSection fetches its own data. Keep existing pattern.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`
- All tests still pass: `npm run test`

#### Manual Verification:

- Can add an ingredient with name, amount (L), sugar content (%) — persists immediately
- Can edit an ingredient inline — changes persist
- Can delete an ingredient — removed from list and DB
- Calculate button creates `sugar_for_fermentation` entry (dry wine)
- Calculate button creates both `fermentation` + `sweetness` entries (non-dry wine)
- Changing sweetness from non-dry to dry and recalculating removes sweetness entry
- Warnings banner shows correct warnings for each rule
- Warnings update in real-time as parameters change
- Calculate endpoint responds within 200ms
- No regressions in batch create/edit flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Sugar calculation: 10+ cases covering dry/non-dry, edge cases, zero values
- Validation: 6 rules × (fires/doesn't fire) + combination scenarios
- Zod schemas: valid/invalid ingredient inputs

### Integration Tests:

- Calculate endpoint: correct upsert, removal, idempotency
- Ingredient CRUD: create, read, update, delete via API
- Response time assertion for calculate endpoint

### Manual Testing Steps:

1. Create a batch with target ABV 12%, volume 20L, dry, yeast tolerance 14%
2. Add grape juice ingredient: 15L, 20% sugar → observe no warnings
3. Click Calculate → `sugar_for_fermentation` entry appears with correct amount
4. Change target ABV to 16% (above tolerance) → warning appears immediately
5. Change sweetness to semi-sweet → recalculate → sweetness entry appears
6. Edit sweetness sugar amount to 0 → range warning appears
7. Delete an ingredient → warnings recalculate
8. Verify all from fermenta-details1.md scenarios

## Performance Considerations

- Calculate endpoint: single DB read (batch + ingredients), pure computation, single upsert. Should be well within 200ms.
- Validation runs client-side: pure function, no network call, instant.
- Ingredient list: individual persist calls. For typical batch (5-10 ingredients), no performance concern.
- If calculate endpoint exceeds 200ms in production (Cloudflare Workers cold start), extract calculation to shared lib and run client-side with server as fallback.

## Migration Notes

No schema migration needed — the `ingredients` table and `ingredient_type` enum already exist from F-01. This slice only populates data into existing tables.

## References

- Domain logic specification: `context/foundation/fermenta-details1.md`
- PRD functional requirements: FR-006, FR-008, FR-009
- Database schema: `supabase/migrations/20260530213000_batch_schema_with_rls.sql`
- Existing batch form: `src/components/batches/BatchForm.tsx`
- Existing API pattern: `src/pages/api/batches/index.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Infrastructure & Calculation Domain Logic

#### Automated

- [ ] 1.1 Vitest runs successfully: npm run test
- [ ] 1.2 All calculation unit tests pass (minimum 10 test cases)
- [ ] 1.3 Type checking passes: npm run lint

#### Manual

- [ ] 1.4 Review test cases cover domain scenarios from fermenta-details1.md

### Phase 2: Ingredient CRUD API & Types

#### Automated

- [ ] 2.1 All tests pass: npm run test
- [ ] 2.2 Lint passes: npm run lint
- [ ] 2.3 Build succeeds: npm run build

#### Manual

- [ ] 2.4 Test ingredient CRUD via curl against local Supabase
- [ ] 2.5 Verify calculate endpoint returns correct sugar entries
- [ ] 2.6 Verify ≤200ms response time for calculate endpoint

### Phase 3: Validation Engine

#### Automated

- [ ] 3.1 All validation tests pass: npm run test
- [ ] 3.2 Lint passes: npm run lint
- [ ] 3.3 Type checking passes

#### Manual

- [ ] 3.4 Review warning messages for clarity against PRD

### Phase 4: UI Components & Integration

#### Automated

- [ ] 4.1 Build succeeds: npm run build
- [ ] 4.2 Lint passes: npm run lint
- [ ] 4.3 All tests still pass: npm run test

#### Manual

- [ ] 4.4 Add/edit/delete ingredient persists immediately
- [ ] 4.5 Calculate button creates correct sugar entries (dry and non-dry)
- [ ] 4.6 Warnings banner shows and updates in real-time
- [ ] 4.7 Calculate endpoint responds within 200ms
- [ ] 4.8 No regressions in batch create/edit flow
