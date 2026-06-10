# Process Plan Generation & Diary Editing — Implementation Plan

## Overview

Implement S-03: auto-generate a process plan (winemaking diary entries) when a batch is created, based on batch parameters (process type, sweetness, fermentation sugar). Provide full CRUD for diary entries (add/edit/delete individually) and a "Regenerate Plan" button that atomically replaces auto-generated entries while preserving user-added ones.

## Current State Analysis

- **Database**: `diary_entries` table exists (F-01 migration) with columns: `id`, `batch_id`, `description`, `sort_order`, `created_at`, `updated_at`. RLS policy in place. Table is unused — no data.
- **API**: Batch CRUD at `/api/batches` and `/api/batches/[id]`. No diary endpoints.
- **UI**: `BatchForm.tsx:443-446` has a placeholder section: "Process diary — coming soon". The ingredient inline-edit pattern (IngredientCard) exists as a reference.
- **Types**: `src/types.ts` has `Batch`, `Ingredient`, `BatchListItem`. No `DiaryEntry` type.
- **Tests**: Vitest configured (from S-02). 57 unit tests for calculation/validation. Pattern: pure domain logic tested first.
- **Generation logic**: None exists. Templates and step definitions need to be created from scratch.

### Key Discoveries:

- `src/components/batches/BatchForm.tsx:443-446` — placeholder insertion point for diary section
- `src/lib/services/sugar-calculation.ts` — pattern for pure domain logic module (importable by API + UI)
- `src/pages/api/batches/index.ts:25-36` — batch creation endpoint where auto-generation hook goes
- `src/lib/api.ts` — response helpers (`jsonOk`, `jsonCreated`, `jsonError`, `jsonValidationError`)
- `supabase/migrations/20260530213000_batch_schema_with_rls.sql:51-58` — current diary_entries schema
- Ingredients save atomically with batch (JSONB); diary entries are independent (separate table, separate saves)

## Desired End State

A user creating a new batch sees auto-generated process diary entries immediately after creation. On the batch detail page, diary entries appear chronologically by date. The user can:
1. See all diary entries sorted by `entry_date` (chronologically)
2. Mark entries as "completed" via a visual toggle (icon/background, not a bare checkbox)
3. Edit any entry's description and date
4. Add new manual entries
5. Delete any entry (auto or user)
6. Click "Regenerate Plan" to atomically replace auto-generated entries (preserving user-added ones)
7. Entries save individually (add/edit/delete each triggers an immediate API call — not batch-atomic)

Verification: unit tests prove generation logic correctness (conditions, date offsets); manual E2E confirms full flow.

## What We're NOT Doing

- Measurements attached to diary entries (v2 scope — entry_type column future-proofs this)
- Localization/translation of step descriptions (v2 — but string constants are extractable)
- Fermentation-stop method prescription (user's choice — diary notes the timing, not the technique)
- Batch deletion (still out of scope)
- Offline support
- E2E/Playwright tests (unit + manual only for MVP)
- Auto-shifting diary dates when batch_date changes (dates are absolute, set once, user edits manually)
- Regenerate confirmation dialog (silently replaces auto entries; user entries always preserved)
- Malolactic fermentation steps (optional advanced technique, not standard for hobbyist persona)

## Implementation Approach

**Five phases**: (0) UI exploration with static mockups to pick the diary layout pattern, (1) schema migration + generation domain logic with unit tests, (2) API endpoints for CRUD + atomic regenerate RPC + batch creation hook, (3) UI implementation wiring the chosen layout to the API, (4) integration polish — process_type default, regenerate button, end-to-end verification.

Phase 0 is exploratory: build 2-3 static alternatives, pick the winner, delete the rest. This avoids committing to a UI pattern before seeing it with real content (diary entries contain more information than ingredients and will grow with measurements in v2).

## Critical Implementation Details

### Date semantics

Diary entry dates are **absolute** (`entry_date DATE`). On generation, they're computed as `batch_date + offset_days`. Once created, they never auto-update — if the user changes `batch_date`, existing diary dates remain unchanged. The user can always edit any entry's date manually.

If `batch_date` is null at creation time, generated entries get `entry_date = NULL` (the user fills dates manually later).

### Atomicity of regenerate

The "Regenerate Plan" operation must be atomic: DELETE all entries with `entry_type = 'auto'` for the batch AND INSERT new generated entries in a single transaction. A PostgreSQL function (`regenerate_diary_entries`) called via `supabase.rpc()` ensures this — if insert fails, delete rolls back.

---

## Generated Step Definitions

Steps are generated based on batch parameters. Format: `<description> (day offset) [conditions]`.

**Always generated (both process types):**

| # | Description | Day Offset | Conditions |
|---|---|---|---|
| 1 | Prepare must — sulfite, acidity correction, nutrients | 0 | always |
| 2 | Add fermentation sugar | 0 | fermentation_sugar_kg > 0 |
| 3 | Pitch yeast | 1 | always |
| 4 | Monitor primary fermentation — measure SG | 3 | always |
| 5 | Rack to secondary fermenter | 10 | always |
| 6 | Monitor secondary fermentation — measure SG | 14 | always |
| 7 | Confirm fermentation complete (2× same SG reading) | 25 | always |
| 8 | Rack off lees | 30 | always |
| 9 | Bulk aging — check sediment | 60 | always |
| 10 | Bottling | 90 | always |

**Pulp-specific (process_type = 'pulp'):**

| # | Description | Day Offset | Conditions |
|---|---|---|---|
| P1 | Prepare fruit — crush and destem | 0 | process_type = 'pulp' |
| P2 | Cap management — punch down 2–3× daily | 1 | process_type = 'pulp' |
| P3 | Press — separate wine from pomace | 7 | process_type = 'pulp' |

**Non-dry wine (planned_sweetness ≠ 'dry'):**

| # | Description | Day Offset | Conditions |
|---|---|---|---|
| S1 | Stabilize before sweetening (K-meta + K-sorbate) | 80 | sweetness ≠ 'dry' |
| S2 | Back-sweeten to target sweetness | 85 | sweetness ≠ 'dry' |

**Open questions for plan review:**
1. Should "Add fermentation sugar" (step 2) be split into staggered additions for high-ABV wines (e.g., >14% → add in 2 phases on day 0 and day 3)? Alternative: keep single step but add a validation warning about osmotic shock risk.
2. Step 8 originally included "+ add SO₂" — removed per user feedback (fermentation stop method is user's choice). Should the step description remain neutral ("Rack off lees") or hint at stabilization options without prescribing?
3. Are the day offsets reasonable starting points for the target persona? (e.g., day 10 for first rack, day 90 for bottling)

### Generation design pattern

**Recommended approach: Rule-based step builder** — a list of step definitions with conditions evaluated against batch parameters. Each step is a plain object `{ description, offsetDays, condition }` where `condition` is a predicate function `(batch) => boolean`.

```typescript
// Conceptual shape (not implementation code)
interface StepTemplate {
  key: string;               // unique ID for localization
  description: string;       // display text (extractable constant)
  offsetDays: number;
  condition: (params: GenerationInput) => boolean;
}
```

This approach is:
- **Simple**: flat list, no inheritance hierarchies or visitor complexity
- **Testable**: each condition is a pure function
- **Extensible**: adding a step = adding an entry to the array
- **Localizable**: `key` field enables future i18n lookup

Alternative patterns considered:
- Template Method: overkill for a flat list of conditional steps
- Strategy: appropriate if templates diverged significantly by process type, but conditions are simple predicates
- Visitor: no tree structure to traverse

---

## Phase 0: UI Exploration (Mockups)

### Overview

Build 2-3 static UI alternatives for the diary section using mock data. No API calls, no generation logic — just React components rendering hardcoded diary entries. Pick the winner based on information density, editability, and visual fit with the existing design system.

### Changes Required:

#### 1. Mockup alternatives

**File**: `src/components/batches/diary/DiaryMockupA.tsx` (card-based)

**Intent**: Card layout similar to IngredientCard — each entry is a card with date, description, and completed indicator. Tapping expands for editing. Tests whether the ingredient pattern scales to richer content.

**Contract**: React component accepting `entries: MockDiaryEntry[]` prop, rendering cards with date badge, description text, and a visual completed indicator (icon or background shift).

---

**File**: `src/components/batches/diary/DiaryMockupB.tsx` (compact list/table)

**Intent**: Dense table-like layout — one row per entry with date column, description column, and completed toggle. Tests whether a denser format works better for 10-15 entries.

**Contract**: React component accepting `entries: MockDiaryEntry[]` prop, rendering a compact list with inline date, description, and completed toggle.

---

**File**: `src/components/batches/diary/DiaryMockupC.tsx` (timeline)

**Intent**: Vertical timeline layout with date markers and entry descriptions alongside. Tests whether a chronological visual metaphor communicates the process flow better.

**Contract**: React component accepting `entries: MockDiaryEntry[]` prop, rendering a vertical timeline with date nodes and content.

---

**File**: `src/components/batches/diary/mockData.ts`

**Intent**: Shared mock data for all three alternatives — realistic diary entries covering both juice and pulp processes with completed/pending states.

**Contract**: Export `MOCK_DIARY_ENTRIES: MockDiaryEntry[]` with ~12 entries spanning 90 days.

---

**File**: `src/components/batches/BatchForm.tsx` (temporary modification)

**Intent**: Replace the "coming soon" placeholder with a temporary mockup switcher that renders all three alternatives for comparison.

**Contract**: Render all three mockups stacked or with a selector in the diary section slot. Temporary — will be replaced in Phase 3.

### Success Criteria:

#### Manual Verification:

- All three mockups render correctly on the batch detail page
- Each shows date, description, and completed state clearly
- Mock data represents realistic diary content (both short and long descriptions)
- Visual completed indicator is distinguishable from bare checkbox (no multi-select confusion)
- Layout works on mobile viewport (responsive)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 1: Schema Migration + Domain Logic

### Overview

Migrate the `diary_entries` table (add `entry_date`, `completed`, `entry_type`; drop `sort_order`). Create the generation logic as a pure domain module with comprehensive unit tests.

### Changes Required:

#### 1. Database migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_diary_entries_process_plan.sql`

**Intent**: Evolve the diary_entries schema to support process plan generation — add entry_date for chronological sorting, completed for visual tracking, entry_type to distinguish auto-generated from user-created entries, and drop the premature sort_order column.

**Contract**: Migration adds columns `entry_date DATE DEFAULT NULL`, `completed BOOLEAN NOT NULL DEFAULT false`, `entry_type TEXT NOT NULL DEFAULT 'user' CHECK (entry_type IN ('auto', 'user'))`. Drops column `sort_order`. Creates the `regenerate_diary_entries` PostgreSQL function for atomic regeneration.

The `regenerate_diary_entries` function signature:

```sql
CREATE OR REPLACE FUNCTION regenerate_diary_entries(
  p_batch_id uuid,
  p_entries jsonb
) RETURNS void AS $$
BEGIN
  DELETE FROM diary_entries WHERE batch_id = p_batch_id AND entry_type = 'auto';
  INSERT INTO diary_entries (batch_id, description, entry_date, entry_type, completed)
  SELECT p_batch_id, e->>'description', (e->>'entry_date')::date, 'auto', false
  FROM jsonb_array_elements(p_entries) AS e;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Add the DiaryEntry type to the shared types module for use by API and UI components.

**Contract**: Add `DiaryEntry` interface with fields: `id: string`, `batch_id: string`, `description: string`, `entry_date: string | null`, `completed: boolean`, `entry_type: 'auto' | 'user'`, `created_at: string`, `updated_at: string`. Add `DiaryEntryType` type alias.

#### 3. Generation logic module

**File**: `src/lib/services/process-plan-generation.ts`

**Intent**: Pure domain logic that takes batch parameters and returns a list of diary entry drafts. Uses the rule-based step builder pattern — a flat array of step templates with condition predicates.

**Contract**: Exports `generateProcessPlan(input: GenerationInput): DiaryEntryDraft[]` where `GenerationInput` includes `batch_date`, `process_type`, `planned_sweetness`, and `fermentation_sugar_kg`. Each `DiaryEntryDraft` has `description`, `entry_date` (computed from batch_date + offset, or null if batch_date is null), and `entry_type: 'auto'`. Also exports `STEP_TEMPLATES` constant array for testability and future localization.

#### 4. Step description constants

**File**: `src/lib/services/process-plan-generation.ts` (same file, constants section)

**Intent**: All step description strings defined as named constants at module top — extractable for future localization without changing logic.

**Contract**: Each step has a `key` (e.g., `STEP_PREPARE_MUST`) and `description` string. Grouped by category (always, pulp-specific, non-dry).

#### 5. Unit tests for generation logic

**File**: `src/lib/services/__tests__/process-plan-generation.test.ts`

**Intent**: Comprehensive unit tests proving generation correctness — step inclusion/exclusion based on conditions, date offset computation, edge cases (null batch_date, all conditions met, no conditions met).

**Contract**: Test cases covering:
- Juice + dry → 9 base steps (no fermentation sugar step, no sweetness steps)
- Juice + dry + fermentation_sugar > 0 → 10 steps (includes sugar step)
- Juice + semi_sweet → 12 steps (base + sugar + sweetness steps)
- Pulp + dry → 12 steps (base + 3 pulp steps)
- Pulp + sweet + fermentation_sugar > 0 → 15 steps (all conditions met)
- Null batch_date → all entry_date values are null
- Date computation: batch_date 2026-01-15 + offset 10 → entry_date 2026-01-25

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase-dev-apply_migration`
- Unit tests pass: `npm run test -- --run src/lib/services/__tests__/process-plan-generation.test.ts`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Verify diary_entries table in Supabase Studio has new columns and no sort_order
- Verify `regenerate_diary_entries` function exists in database

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Endpoints

### Overview

Create CRUD endpoints for diary entries, integrate auto-generation into batch creation, and expose the regenerate function.

### Changes Required:

#### 1. Zod schema for diary entries

**File**: `src/lib/schemas/diary-entry.ts`

**Intent**: Validation schemas for diary entry creation and update operations.

**Contract**: Exports `createDiaryEntrySchema` (requires `description: string`; optional `entry_date: ISO date | null`, `completed: boolean`) and `updateDiaryEntrySchema` (partial of create). All user-created entries get `entry_type: 'user'` server-side (not in schema — server sets it).

#### 2. Diary entries CRUD endpoint

**File**: `src/pages/api/batches/[id]/diary.ts`

**Intent**: RESTful endpoint for listing and creating diary entries for a specific batch.

**Contract**: `GET` returns all diary entries for the batch ordered by `entry_date ASC NULLS LAST, created_at ASC`. `POST` creates a new entry with `entry_type: 'user'`, validates with `createDiaryEntrySchema`. Both require authenticated user + batch ownership (RLS enforces).

#### 3. Single diary entry endpoint

**File**: `src/pages/api/batches/[id]/diary/[entryId].ts`

**Intent**: Update and delete operations for individual diary entries.

**Contract**: `PUT` updates entry fields (description, entry_date, completed) validated with `updateDiaryEntrySchema`. `DELETE` removes the entry. Both require authenticated user + batch ownership via RLS.

#### 4. Regenerate endpoint

**File**: `src/pages/api/batches/[id]/diary/regenerate.ts`

**Intent**: Atomic regeneration of auto-generated diary entries — calls the PostgreSQL function to delete old auto entries and insert new ones in a single transaction.

**Contract**: `POST` — reads current batch parameters, runs `generateProcessPlan()`, calls `supabase.rpc('regenerate_diary_entries', { p_batch_id, p_entries })`. Returns the new list of all diary entries for the batch. Requires authenticated user + batch ownership.

#### 5. Batch creation hook

**File**: `src/pages/api/batches/index.ts` (modify POST handler)

**Intent**: After successfully creating a batch, auto-generate diary entries server-side before returning the response.

**Contract**: After the batch insert succeeds, call `generateProcessPlan()` with the new batch's parameters, then bulk-insert the generated entries into `diary_entries` with `entry_type: 'auto'`. If diary insertion fails, log the error but still return the created batch (diary generation is non-blocking — user can regenerate manually).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- POST /api/batches creates batch AND diary entries appear in database
- GET /api/batches/[id]/diary returns entries sorted chronologically
- POST /api/batches/[id]/diary creates a user entry
- PUT /api/batches/[id]/diary/[entryId] updates description/date/completed
- DELETE /api/batches/[id]/diary/[entryId] removes entry
- POST /api/batches/[id]/diary/regenerate replaces auto entries, preserves user entries
- RLS prevents accessing another user's diary entries

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Implementation

### Overview

Build the diary section using the chosen mockup pattern (from Phase 0), wire it to the API endpoints, and implement add/edit/delete/complete/regenerate interactions.

### Changes Required:

#### 1. Diary section component

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Main container component for the diary section — fetches entries on mount, manages local state, and orchestrates CRUD operations via API calls.

**Contract**: Accepts `batchId: string` and `batchParams: { batch_date, process_type, planned_sweetness, fermentation_sugar_kg }` props. Fetches entries via GET on mount. Provides add/edit/delete/toggle-complete handlers that call the API immediately. Includes "Regenerate Plan" button that calls the regenerate endpoint.

#### 2. Diary entry display component

**File**: `src/components/batches/diary/DiaryEntry.tsx` (or similar based on chosen pattern)

**Intent**: Individual entry rendering — shows date, description, completed state; supports inline editing.

**Contract**: Based on the chosen mockup from Phase 0. Accepts a single `DiaryEntry` + callbacks for `onUpdate`, `onDelete`, `onToggleComplete`. Visual completed indicator per Phase 0 decision (icon/background, not bare checkbox).

#### 3. Add entry component

**File**: `src/components/batches/diary/AddEntryForm.tsx`

**Intent**: Inline form for adding new diary entries — minimal fields (description + optional date).

**Contract**: Form with description text input + date picker. On submit, calls POST endpoint and adds entry to local state on success.

#### 4. Wire into BatchForm

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Replace the Phase 0 mockup placeholder with the real DiarySection component in edit mode. In create mode, diary section is not shown (entries are generated server-side on creation).

**Contract**: In edit mode (`mode === 'edit'`), render `<DiarySection batchId={batch.id} batchParams={...} />` in the diary section slot. In create mode, show informational text: "Process diary will be generated after batch creation."

#### 5. Remove Phase 0 mockup artifacts

**Intent**: Clean up temporary mockup components and switcher from Phase 0 (delete unused alternatives, keep only the chosen pattern's code as reference for DiaryEntry component).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Create a new batch → diary entries appear immediately on batch detail page
- Entries display chronologically by date
- Click completed toggle → entry visual state changes, persists on reload
- Click entry to edit → modify description/date → save → persists
- Click add → fill form → new entry appears in correct chronological position
- Click delete → entry removed → persists
- Click "Regenerate Plan" → auto entries replaced with fresh generation, user entries preserved
- Responsive layout works on mobile viewport

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integration & Polish

### Overview

Process type default, edge cases, final polish, and end-to-end verification.

### Changes Required:

#### 1. Process type default to 'juice'

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Preselect 'juice' in the process_type dropdown for new batches instead of forcing user to choose. Remove the empty option in create mode.

**Contract**: Change initial form state for `process_type` from `""` to `"juice"` in create mode. Remove the empty `<option>` element.

#### 2. Edge case handling

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Handle edge cases — loading state, empty state (no entries), error state (API failure), and entries with null dates.

**Contract**: Show skeleton/loading while fetching. Show "No diary entries yet" with "Generate Plan" button for legacy batches without entries. Show error toast on API failure. Entries with null dates appear at the end of the list.

#### 3. Chronological ordering consistency

**File**: Multiple (API + UI)

**Intent**: Ensure consistent ordering — entries sorted by `entry_date ASC NULLS LAST, created_at ASC` both in the API response and in the UI state after local mutations.

**Contract**: API enforces ordering in query. UI re-sorts after add/edit to maintain chronological position.

### Success Criteria:

#### Automated Verification:

- All existing tests still pass: `npm run test -- --run`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- New batch creation defaults to 'juice' process type
- Creating batch with 'juice' + 'dry' → ~9 diary entries generated
- Creating batch with 'pulp' + 'semi_sweet' + sugar > 0 → ~15 entries generated
- Legacy batch (no diary entries) shows empty state with "Generate Plan" button
- Editing a batch's process_type does NOT auto-regenerate diary (user must click Regenerate)
- Diary entries display correctly with no date (null) — positioned at end
- API errors show user-friendly feedback (not raw error)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Generation logic: step inclusion/exclusion for all parameter combinations
- Date offset computation (batch_date + N days, null batch_date handling)
- Edge cases: all conditions true, no conditions true, boundary values
- Zod schema validation: valid/invalid inputs for diary entry create/update

### Manual Testing Steps:

1. Create a new batch (juice, dry, no yeast) → verify ~9 diary entries
2. Create a new batch (pulp, semi_sweet, with sugar) → verify ~15 entries with all conditional steps
3. Edit a diary entry description and date → reload → persists
4. Toggle completed on 3 entries → reload → state persists
5. Add a manual entry with a specific date → appears in correct chronological position
6. Delete an auto-generated entry → gone after reload
7. Click "Regenerate Plan" → auto entries replaced, manual entries preserved
8. Create batch with null batch_date → all diary entries have null dates
9. Mobile viewport → layout is usable

## Performance Considerations

- Diary entries per batch: typically 10-15 (bounded by template + user additions). No pagination needed.
- Individual save operations: one API call per user action. Acceptable latency for this volume.
- Regenerate: single RPC call (atomic DB function). No N+1 concerns.
- No client-side computation beyond date sorting of a small list.

## Migration Notes

- The `sort_order` column drop is safe — table has no production data (never used by any feature).
- Existing batches (created before S-03) will have zero diary entries. Empty state UI handles this gracefully.
- The `regenerate_diary_entries` PostgreSQL function uses `SECURITY DEFINER` to bypass RLS within the function — the API layer validates ownership before calling it.

## References

- PRD: `context/foundation/prd.md` — FR-010, FR-011, US-01
- Roadmap: `context/foundation/roadmap.md` — S-03
- Pattern reference: `src/lib/services/sugar-calculation.ts` (pure domain logic module)
- Pattern reference: `src/components/batches/IngredientCard.tsx` (inline-edit UI)
- Batch creation: `src/pages/api/batches/index.ts`
- Schema: `supabase/migrations/20260530213000_batch_schema_with_rls.sql:51-58`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: UI Exploration (Mockups)

#### Manual

- [ ] 0.1 Three mockup alternatives render correctly on batch detail page
- [ ] 0.2 Visual completed indicator distinguishable from multi-select checkbox
- [ ] 0.3 Layout works on mobile viewport
- [ ] 0.4 Winner selected and losers deleted

### Phase 1: Schema Migration + Domain Logic

#### Automated

- [ ] 1.1 Migration applies cleanly
- [ ] 1.2 Unit tests pass for generation logic
- [ ] 1.3 Type checking passes
- [ ] 1.4 Linting passes

#### Manual

- [ ] 1.5 diary_entries table has new columns and no sort_order
- [ ] 1.6 regenerate_diary_entries function exists in database

### Phase 2: API Endpoints

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes
- [ ] 2.3 Build succeeds

#### Manual

- [ ] 2.4 POST /api/batches creates batch AND diary entries
- [ ] 2.5 GET /api/batches/[id]/diary returns entries sorted chronologically
- [ ] 2.6 POST /api/batches/[id]/diary creates user entry
- [ ] 2.7 PUT /api/batches/[id]/diary/[entryId] updates entry
- [ ] 2.8 DELETE /api/batches/[id]/diary/[entryId] removes entry
- [ ] 2.9 POST /api/batches/[id]/diary/regenerate replaces auto, preserves user
- [ ] 2.10 RLS prevents cross-user access

### Phase 3: UI Implementation

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Build succeeds

#### Manual

- [ ] 3.4 New batch creation shows diary entries immediately
- [ ] 3.5 Completed toggle persists on reload
- [ ] 3.6 Edit entry description/date persists
- [ ] 3.7 Add manual entry appears in correct position
- [ ] 3.8 Delete entry persists
- [ ] 3.9 Regenerate replaces auto, preserves user entries
- [ ] 3.10 Responsive layout on mobile

### Phase 4: Integration & Polish

#### Automated

- [ ] 4.1 All existing tests still pass
- [ ] 4.2 Type checking passes
- [ ] 4.3 Linting passes
- [ ] 4.4 Build succeeds

#### Manual

- [ ] 4.5 Process type defaults to juice for new batches
- [ ] 4.6 Juice + dry batch → ~9 entries generated
- [ ] 4.7 Pulp + semi_sweet + sugar batch → ~15 entries generated
- [ ] 4.8 Legacy batch shows empty state with Generate button
- [ ] 4.9 Null batch_date → entries have null dates (positioned at end)
- [ ] 4.10 API errors show user-friendly feedback
