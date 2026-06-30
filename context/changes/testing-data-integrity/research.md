---
date: 2026-06-26T22:56:00+02:00
researcher: Copilot
git_commit: e44fa9d4c30536abdec944f57564dc4ff3b0223d
branch: testing-data-integrity
repository: julku-bqs/10x-fermenta
topic: "Data integrity and interaction — code paths for risks #4, #5, #7"
tags: [research, testing, data-integrity, api-validation, sugar-lifecycle]
status: complete
last_updated: 2026-06-26
last_updated_by: Copilot
---

# Research: Data integrity and interaction (test-plan Phase 2)

**Date**: 2026-06-26T22:56:00+02:00
**Researcher**: Copilot
**Git Commit**: e44fa9d4c30536abdec944f57564dc4ff3b0223d
**Branch**: testing-data-integrity
**Repository**: julku-bqs/10x-fermenta

## Research Question

Ground the three risk response intents for test-plan Phase 2 in actual code paths:
- **Risk #4**: Ingredient → sugar aggregation → calculation → persisted fields pipeline
- **Risk #5**: API route input validation — zod schemas, error handling, malformed input rejection
- **Risk #7**: Sugar field save/cancel/reload lifecycle

## Summary

1. **Risk #4 (pipeline)**: The pipeline has 5 stages: ingredient array → aggregation in grams (`amount_liters × sugar_content_percent × 10`) → formula (subtract from ABV need) → division by 1000 to kg → persist via API. Two call sites exist for `calculateSugar()` — one in `IngredientsSection` (user-triggered) and one in `BatchForm` (for warnings). The integration seam is the `onBatchChange` callback that passes kg values from calculation to form state, then `parseFloat()` conversion on submit.

2. **Risk #5 (validation)**: All write routes use `safeParse()` with early return before any DB operation. Error shape is `{ error: "Validation failed", details: { "field.path": ["messages"] } }` with HTTP 400. The `updateBatchSchema` explicitly overrides `.default()` fields with `.optional()` to prevent Zod v4 from zeroing omitted fields. No partial writes are possible.

3. **Risk #7 (lifecycle)**: Sugar fields are stored as strings in React state, converted to numbers on save. Calculate updates form state only (no auto-save). Cancel is a navigation link (`/batches`) with `beforeunload` dirty guard — there is NO explicit "restore to last-saved" button. The `initialValues` snapshot is used for dirty detection only. Manual edits and calculated values are indistinguishable in form state.

## Detailed Findings

### Risk #4: Ingredient → Calculation Data Flow

#### Data Model

- **`src/types.ts:3-7`** — `Ingredient`: `{ name, amount_liters, sugar_content_percent: number | null }`
- **`src/types.ts:20-21`** — `Batch`: includes `fermentation_sugar_kg: number`, `sweetness_sugar_kg: number`
- **`src/lib/schemas/batch.ts:4-8`** — `ingredientSchema`: validates `sugar_content_percent` as `min(0).max(100).nullable().default(null)`

#### Sugar Aggregation (the critical conversion)

**`src/lib/services/sugar-calculation.ts:39-43`**:
```
total_ingredient_sugar_grams = SUM(amount_liters × sugar_content_percent × 10)
```
Factor 10 = "1% of 1 liter = 10 grams of sugar". Null `sugar_content_percent` treated as 0.

#### Calculation Formula

**`src/lib/services/sugar-calculation.ts:45-51`**:
```
sugar_needed_for_abv_grams = target_abv × 17 × target_volume_liters
fermentation_sugar_grams = MAX(0, sugar_needed_for_abv_grams - total_ingredient_sugar_grams)
fermentation_sugar_kg = fermentation_sugar_grams / 1000
sweetness_sugar_grams = SWEETNESS_MIDPOINTS[planned_sweetness] × target_volume_liters
sweetness_sugar_kg = sweetness_sugar_grams / 1000
```

Constant: `SUGAR_PER_ABV_GRAM_PER_LITER = 17` (line 6).

#### Call Sites

1. **`src/components/batches/IngredientsSection.tsx:126-136`** — user clicks "Calculate" button → `calculateSugar()` → emits `onBatchChange({ fermentation_sugar_kg, sweetness_sugar_kg })`
2. **`src/components/batches/BatchForm.tsx:58-63`** — `computeWarnings()` calls `calculateSugar()` for validation purposes (on blur, line 154)

#### Persistence Path

1. `IngredientsSection` emits via `onBatchChange` → `BatchForm` updates string state (lines 431-440)
2. `handleSubmit()` converts: `parseFloat(form.fermentation_sugar_kg) || 0` (line 170-171)
3. Client-side Zod validation: `createBatchSchema.safeParse(payload)` or `updateBatchSchema.safeParse(payload)` (lines 176-186)
4. `fetch()` POST/PUT to API (line 192-196)
5. Server validates again, then `supabase.from("batches").insert/update(...)` persists kg values

#### Unit Conversion Map

| Location | Direction | Formula |
|----------|-----------|---------|
| `sugar-calculation.ts:41` | ingredients → grams | `L × % × 10` |
| `sugar-calculation.ts:48` | grams → kg (storage) | `÷ 1000` |
| `sugar-calculation.ts:51` | grams → kg (storage) | `÷ 1000` |
| `batch-validation.ts:72,82` | kg → grams (validation) | `× 1000` |
| `batch-validation.ts:100` | kg → g/L (validation) | `× 1000 ÷ volume` |

**Test implication**: Integration test must verify the full chain — given ingredients with known sugar percentages + volumes, the final persisted `fermentation_sugar_kg` and `sweetness_sugar_kg` must match independently derived expected values (using the `× 10`, `× 17`, `÷ 1000` factors).

---

### Risk #5: API Input Validation

#### Routes With Zod Validation

| Route | Method | Schema | File:Line |
|-------|--------|--------|-----------|
| `/api/batches` | POST | `createBatchSchema` | `src/pages/api/batches/index.ts:21` |
| `/api/batches/[id]` | PUT | `updateBatchSchema` | `src/pages/api/batches/[id]/index.ts:46` |
| `/api/batches/[id]/diary` | POST | `createDiaryEntrySchema` | `src/pages/api/batches/[id]/diary/index.ts:51` |
| `/api/batches/[id]/diary/[entryId]` | PUT | `updateDiaryEntrySchema` | `src/pages/api/batches/[id]/diary/[entryId].ts:27` |
| `/api/auth/signin` | POST | `signInSchema` | `src/pages/api/auth/signin.ts:10` |
| `/api/auth/signup` | POST | `signUpSchema` | `src/pages/api/auth/signup.ts:10` |

#### Validation Pattern (consistent across all routes)

```typescript
const result = schema.safeParse(body);
if (!result.success) {
  return jsonValidationError(result.error); // Early return, no DB write
}
// Only validated data reaches DB
```

#### Error Response Shape

**`src/lib/api.ts:24-32`** — `jsonValidationError()`:
```json
{
  "error": "Validation failed",
  "details": { "field.path": ["error message 1", "error message 2"] }
}
```
HTTP status: **400**.

#### Key Schema Constraints (batch)

- `name`: `string().min(1)` — empty string rejected
- `target_volume_liters`: `number().positive().nullable()` — zero/negative rejected
- `target_abv`: `number().min(0).max(100).nullable()` — out-of-range rejected
- `fermentation_sugar_kg`: `number().min(0)` — negative rejected
- `sweetness_sugar_kg`: `number().min(0)` — negative rejected
- `ingredients[].sugar_content_percent`: `number().min(0).max(100).nullable()` — over 100 rejected
- `process_type`: `enum(["pulp", "juice"])` — other values rejected

#### updateBatchSchema Zod v4 Concern

**`src/lib/schemas/batch.ts:25-38`** — Comment documents that Zod v4's `.partial()` still applies `.default()`, which would silently zero sugar fields on PUT if omitted. Mitigated by explicit `.optional()` overrides without defaults.

#### Routes Without Zod Body Validation

- `GET /api/batches` — no body (correct)
- `GET /api/batches/[id]` — UUID regex check only
- `DELETE /api/batches/[id]` — UUID regex check only
- `POST /api/auth/signout` — no validation (no body expected)
- `POST /api/batches/[id]/diary/regenerate` — UUID regex only, no body

**Test implication**: Integration tests must prove that (a) malformed payloads on POST/PUT batch routes return 400 with structured `details` and (b) no DB row is created/modified. Must test edge cases: missing required fields, out-of-range numbers, wrong enum values, extra unknown fields.

---

### Risk #7: Sugar Field Save/Cancel/Reload Lifecycle

#### Form State Architecture

**`src/components/batches/BatchForm.tsx:28-49`**:
- `FormState` interface stores sugar as **strings** (`fermentation_sugar_kg: string`)
- `useState<FormState>` initialized from `initialData?.fermentation_sugar_kg.toString() ?? "0"`
- `initialValues` ref (lines 104-118) = snapshot at load time, used for dirty detection

#### Calculate → Form State (no auto-save)

**`src/components/batches/IngredientsSection.tsx:122-138`**:
1. User clicks "🧮 Calculate" button (line 200)
2. `calculateSugar()` called (line 126)
3. Result emitted via `onBatchChange({ fermentation_sugar_kg, sweetness_sugar_kg })` (lines 133-136)
4. `BatchForm` receives and updates string state (lines 431-440):
   ```tsx
   fermentation_sugar_kg: updates.fermentation_sugar_kg.toString()
   ```
5. **No save occurs** — user must explicitly click "Save Changes"

#### Manual Edit → Form State

**`src/components/batches/IngredientsSection.tsx:167-179`** (SugarCard component):
- User clicks the sugar badge to enter edit mode
- Types a number in the input field
- `onChange` calls `onBatchChange({ fermentation_sugar_kg: kg })` (line 172)
- Same path as Calculate — form state updated, no distinction stored

#### Save → DB → Response

**`src/components/batches/BatchForm.tsx:157-226`**:
1. `parseFloat(form.fermentation_sugar_kg) || 0` (line 170) — string → number
2. Zod validation (line 176-186)
3. `fetch()` to API (lines 190-196)
4. API validates + persists via Supabase
5. Response contains fresh `Batch` from DB
6. On success (line 214): `setInitialValues({ form: { ...form }, ingredients: [...ingredients] })`
7. `isDirtyRef.current = false` (line 215)

#### Reload (page navigation)

**`src/pages/batches/[id].astro:17-24`**:
- Astro server-side: `supabase.from("batches").select("*").eq("id", id).single()`
- Fresh `Batch` object passed as `initialData` prop to `BatchForm`
- Form re-initializes from DB values

#### Cancel Behavior

**`src/components/batches/BatchForm.tsx:262-265, 475-477`**:
- Cancel = `<a href="/batches">` — **plain navigation link**, not a form reset
- **No "restore last-saved"** button exists
- Dirty guard: `beforeunload` event (lines 128-137) shows browser confirmation if form is dirty
- If user confirms navigation: unsaved changes lost, page loads fresh from DB on next visit

#### Key Lifecycle States

```
[Page Load] → DB fetch → initialData → form state (strings) → initialValues snapshot
[Calculate]  → calculateSugar() → onBatchChange → form state updated (dirty=true)
[Manual Edit] → input onChange → onBatchChange → form state updated (dirty=true)
[Save]       → parseFloat → zod validate → API PUT → DB write → update initialValues (dirty=false)
[Cancel]     → navigate /batches (if dirty: browser confirm) → no state restore
[Reload]     → fresh DB fetch → new initialData → re-init form state
```

**Test implication**: Integration tests must verify:
1. **Save roundtrip**: value in form at save time === value returned from API === value on reload
2. **Cancel does NOT persist**: edit → cancel → reload shows last-saved value (not the edit)
3. **Manual edit save**: manually typed value persists correctly (not just calculated values)
4. The `parseFloat() || 0` conversion doesn't corrupt edge-case inputs (e.g., "0.001", leading zeros)

---

## Code References

- `src/lib/services/sugar-calculation.ts:36-59` — Core calculation with aggregation + kg conversion
- `src/lib/services/batch-validation.ts:72,82,100` — kg→grams back-conversion for validation
- `src/lib/schemas/batch.ts:4-38` — All Zod schemas (ingredient, createBatch, updateBatch)
- `src/lib/api.ts:17-32` — `jsonError()` and `jsonValidationError()` helpers
- `src/pages/api/batches/index.ts:8-80` — POST (create) + GET (list) routes
- `src/pages/api/batches/[id]/index.ts:8-83` — GET/PUT/DELETE single batch
- `src/components/batches/BatchForm.tsx:28-49` — FormState with string sugar fields
- `src/components/batches/BatchForm.tsx:157-226` — handleSubmit (save flow)
- `src/components/batches/BatchForm.tsx:104-137` — initialValues + dirty tracking
- `src/components/batches/IngredientsSection.tsx:122-138` — Calculate handler
- `src/components/batches/IngredientsSection.tsx:167-179` — Manual sugar edit (SugarCard)
- `src/pages/batches/[id].astro:17-24` — Server-side batch fetch for edit page

## Architecture Insights

1. **Dual validation**: Client validates with Zod before fetch, server validates again on receipt. Tests should target the server layer (source of truth for DB safety).
2. **String↔number boundary**: Form stores sugar as strings, `parseFloat() || 0` converts on submit. This is a subtle correctness seam — edge inputs like empty string, whitespace, or locale-formatted numbers could yield unexpected 0.
3. **No optimistic UI**: Save waits for API response before updating `initialValues`. This simplifies roundtrip testing — the response is the contract.
4. **Cancel = navigation, not reset**: There's no in-page undo. "Cancel restores last-saved values" is implemented by the fact that the next page load fetches fresh from DB.
5. **Calculation is pure**: `calculateSugar()` has no side effects, takes explicit inputs, returns explicit outputs. Ideal for unit testing in isolation + integration testing as part of the pipeline.

## Historical Context

- `context/changes/sugar-fields-refactoring/plan.md` — Moved sugar from JSONB pseudo-ingredients to batch-level columns. Documented the Zod v4 `.partial()` + `.default()` concern and the kg↔grams parity requirement.

## Open Questions

1. **`parseFloat() || 0` edge cases**: What happens with input "0.0" or "00.5"? These are valid but unusual — does the roundtrip preserve them or normalize? (Likely normalizes — DB stores numeric, API returns number, form re-initializes from `.toString()`.)
2. **Concurrent edits**: If two tabs edit the same batch, last-write-wins. Not in scope for Phase 2 but worth noting.
3. **Diary regenerate route**: `POST /api/batches/[id]/diary/regenerate` has no body validation — it doesn't accept a body, so this is correct but worth confirming no body-dependent logic exists.
