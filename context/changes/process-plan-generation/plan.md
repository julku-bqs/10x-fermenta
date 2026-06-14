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
1. See all diary entries sorted by `entry_date` — default ASC (chronological), with a sort toggle button/icon next to the section heading to switch between ASC and DESC
2. Mark entries as "completed" via a visual toggle (icon/background, not a bare checkbox)
3. Edit any entry's description, date, and notes
4. Expand an entry to see/edit free-text notes (expandable area with scrollable content to avoid layout exhaustion)
5. Add new manual entries
6. Delete any entry (auto or user)
7. Click "Regenerate Plan" to atomically replace auto-generated entries (preserving user-modified and user-created ones)
8. Entries save individually (add/edit/delete each triggers an immediate API call — not batch-atomic)
9. In create mode, user can add manual diary entries locally; they are persisted atomically after batch creation

Verification: unit tests prove generation logic correctness (conditions, date offsets); manual E2E confirms full flow.

## What We're NOT Doing

- Measurements attached to diary entries (v2 scope — entry_type column future-proofs this)
- Localization/translation of step descriptions (v2 — but string constants are extractable)
- Fermentation-stop method prescription (user's choice — diary notes the timing, not the technique)
- Batch deletion (still out of scope)
- Offline support
- E2E/Playwright tests (unit + manual only for MVP)
- Auto-shifting diary dates when batch_date changes (dates are absolute, set once, user edits manually)
- Regenerate confirmation dialog (silently replaces auto entries; user/promoted entries always preserved)
- Malolactic fermentation steps (optional advanced technique, not standard for hobbyist persona)
- Sulfite/SO₂ steps in default generation (per-recipe decision — not universally performed; user adds manually if needed)
- Pectic enzyme as a separate step (per-recipe decision — user adds at their preferred timing if needed)
- Degassing as a default step (natural off-gassing during 12-month bulk aging is sufficient)
- Measurement-driven staggered sugar additions (v2 — requires real Blg measurement data; MVP uses single step with guidance hint)
- Fruit wine vs grape wine distinction (same template works; differences handled by existing conditions)

## Prerequisites

- **`sugar-fields-refactoring`** — Move `fermentation_sugar_kg` and `sweetness_sugar_kg` from the ingredients JSONB array to batch-level columns (similar to yeast). This simplifies the sugar step condition to `batch.fermentation_sugar_kg > 0` and removes the need for ingredient type lookups throughout the application. Must land before S-03 implementation begins.

## Implementation Approach

**Five phases**: (0) UI exploration with static mockups to pick the diary layout pattern, (1) schema migration + generation domain logic with unit tests, (2) API endpoints for CRUD + atomic regenerate RPC + batch creation hook, (3) UI implementation wiring the chosen layout to the API, (4) integration polish — process_type default, regenerate button, end-to-end verification.

Phase 0 is exploratory: build 2-3 static alternatives, pick the winner, delete the rest. This avoids committing to a UI pattern before seeing it with real content (diary entries contain more information than ingredients and will grow with measurements in v2).

## Critical Implementation Details

### Date semantics

Diary entry dates are **absolute** (`entry_date DATE`). On generation, they're computed as `batch_date + offset_days`. Once created, they never auto-update — if the user changes `batch_date`, existing diary dates remain unchanged. The user can always edit any entry's date manually.

`batch_date` is **never null**. The batch form defaults to today's date on creation. If the user clears it, today is applied anyway (enforced at the schema/API level). A data migration backfills existing NULL `batch_date` values with `created_at`. This guarantees generated diary entries always receive a computed date.

### Entry ownership promotion

When a user edits a diary entry's `description` or `notes`, the entry's `entry_type` is automatically promoted from `'auto'` to `'user'` via a database UPDATE trigger. This prevents future regeneration from deleting entries the user has customized. The trigger fires on UPDATE to `description` or `notes` columns — if the new value differs from the old value and `entry_type = 'auto'`, it sets `entry_type = 'user'`.

### Atomicity of regenerate

The "Regenerate Plan" operation must be atomic: DELETE all entries with `entry_type = 'auto'` for the batch AND INSERT new generated entries in a single transaction. A PostgreSQL function (`regenerate_diary_entries`) called via `supabase.rpc()` ensures this — if insert fails, delete rolls back. Note: entries whose `entry_type` was promoted to `'user'` by the ownership trigger are never deleted.

---

## Generated Step Definitions

**Guiding principle**: The generated plan includes only steps that are **universally performed** in home winemaking regardless of specific recipe. The tool doesn't make wine for the user — it helps them work faster with what they already know. Optional/recipe-specific steps (sulfite, pectic enzyme, fining, MLF, etc.) are the user's responsibility to add manually.

Steps are generated based on batch parameters. Format: `<description> (day offset) [conditions]`. All steps are a flat list — conditions determine inclusion; categories are not structural. Steps 1a/1b are mutually exclusive (only one appears per batch).

| # | Description | Day Offset | Conditions |
|---|---|---|---|
| 1a | Prepare must — pour juice into fermenter, add nutrients | 0 | process_type = 'juice' |
| 1b | Prepare must — crush fruit, destem, add to fermenter, add nutrients | 0 | process_type = 'pulp' |
| 2 | Add fermentation sugar (if above 25°Blg — split into portions) | 0 | batch.fermentation_sugar_kg > 0 |
| 3 | Pitch yeast | 0 | always |
| 4 | Begin cap management — punch down 2–3× daily until pressing | 1 | process_type = 'pulp' |
| 5 | Monitor primary fermentation | 5 | always |
| 6 | Press — separate wine from pomace | 10 | process_type = 'pulp' |
| 7 | Rack to secondary fermenter | 14 | always |
| 8 | Monitor secondary fermentation | 21 | always |
| 9 | Confirm fermentation complete (2× same reading) | 28 | always |
| 10 | Rack off lees — transfer to clean vessel | 35 | always |
| 11 | Bulk aging — check clarity, rack if needed | 60 | always |
| 12 | Aging check — taste, check clarity | 120 | always |
| 13 | Aging check — taste, assess readiness | 240 | always |
| 14 | Stabilize wine | 330 | planned_sweetness ≠ 'dry' |
| 15 | Back-sweeten to target sweetness | 332 | planned_sweetness ≠ 'dry' |
| 16 | Bottling | 365 | always |

**Domain decisions (resolved):**
1. **No sulfite in default steps** — generated plan includes only steps that are universally performed regardless of recipe. Sulfite is a per-recipe decision; users add it as a manual entry if their process requires it.
2. **Pectic enzyme excluded** — same principle: not universally performed. Users who use pectic enzyme add it as a manual entry at their preferred timing (at crush or post-fermentation for clarity correction).
3. **Single sugar step with guidance** — description hints at splitting for high-Blg musts (>25°Blg, the verified osmotic stress threshold per MoreWineMaking and peer-reviewed literature). A measurement-driven split into separate day 0 / day N steps is deferred to v2 when real measurement data is available.
4. **Yeast pitched on Day 0** — safe common default; users who sulfite or use pectic enzyme adjust the date to Day 1 per their recipe.
5. **Cap management starts Day 1** — cap forms ~1–2 days after pitching once fermentation generates CO₂; "until pressing" in description marks the end.
6. **Monitoring steps are non-prescriptive** — do not specify what instrument or parameter to measure.
7. **Stabilize + back-sweeten are separate steps** — 2-day gap per standard guidance (stabilizers need 24–48h to distribute before adding sugar to prevent refermentation).
8. **Bottling at Day 365 (1 year)** — conservative safe default for home wines with proper bulk aging; simple/fruit wines may be ready sooner — user adjusts date as needed.
9. **Degassing excluded** — natural off-gassing during 12-month bulk aging is sufficient; after a year with regular rackings, residual CO₂ is negligible.

### Generation design pattern

**Recommended approach: Rule-based step builder** — a list of step definitions with conditions evaluated against batch parameters. Each step is a plain object `{ description, offsetDays, condition }` where `condition` is a predicate function `(batch) => boolean`.

```typescript
// Conceptual shape (not implementation code)
interface StepTemplate {
  key: string;               // unique ID for localization
  description: string;       // display text (extractable constant)
  offsetDays: number;
  condition: (input: GenerationInput) => boolean;
}

// GenerationInput wraps the full batch + optional calculation result
interface GenerationInput {
  batch: Batch;
  calculationResult?: SugarCalculationResult;
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

**Intent**: Card layout similar to IngredientCard — each entry is a card with date, description, and completed indicator. Tapping expands to reveal notes area. Tests whether the ingredient pattern scales to richer content.

**Contract**: React component accepting `entries: MockDiaryEntry[]` prop, rendering cards with date badge, description text, visual completed indicator (icon or background shift), and an expandable notes section (collapsible, with scrollable area for long notes).

---

**File**: `src/components/batches/diary/DiaryMockupB.tsx` (compact list/table)

**Intent**: Dense table-like layout — one row per entry with date column, description column, and completed toggle. Notes visible on expansion/hover. Tests whether a denser format works better for 11-16 entries.

**Contract**: React component accepting `entries: MockDiaryEntry[]` prop, rendering a compact list with inline date, description, completed toggle, and an expandable row for notes.

---

**File**: `src/components/batches/diary/DiaryMockupC.tsx` (timeline)

**Intent**: Vertical timeline layout with date markers and entry descriptions alongside. Notes shown in expandable section below each entry. Tests whether a chronological visual metaphor communicates the process flow better.

**Contract**: React component accepting `entries: MockDiaryEntry[]` prop, rendering a vertical timeline with date nodes, content, and expandable notes.

---

**File**: `src/components/batches/diary/mockData.ts`

**Intent**: Shared mock data for all three alternatives — realistic diary entries covering both juice and pulp processes with completed/pending states.

**Contract**: Export `MOCK_DIARY_ENTRIES: MockDiaryEntry[]` with ~12 entries spanning 90 days. Each entry includes description, entry_date, completed state, and optional notes (some entries with notes, some without — to test expandable area behavior).

---

**File**: `src/components/batches/BatchForm.tsx` (temporary modification)

**Intent**: Replace the "coming soon" placeholder with a temporary mockup switcher that renders all three alternatives for comparison.

**Contract**: Render all three mockups stacked or with a selector in the diary section slot. Temporary — will be replaced in Phase 3.

### Success Criteria:

#### Manual Verification:

- All three mockups render correctly on the batch detail page
- Each shows date, description, and completed state clearly
- Notes section is expandable/collapsible with scrollable area for long text
- Mock data represents realistic diary content (both short and long descriptions, some with notes)
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

**Intent**: Evolve the diary_entries schema to support process plan generation — add entry_date for chronological sorting, completed for visual tracking, entry_type to distinguish auto-generated from user-created entries, notes for free-text annotations, and drop the premature sort_order column. Add an UPDATE trigger that promotes entry_type from 'auto' to 'user' when description or notes are modified. Also enforce batch_date NOT NULL with a backfill migration.

**Contract**: Migration:
1. Adds columns `entry_date DATE NOT NULL`, `completed BOOLEAN NOT NULL DEFAULT false`, `entry_type TEXT NOT NULL DEFAULT 'user' CHECK (entry_type IN ('auto', 'user'))`, `notes TEXT DEFAULT NULL`.
2. Drops column `sort_order`.
3. Backfills existing batches: `UPDATE batches SET batch_date = created_at::date WHERE batch_date IS NULL`.
4. Alters batches: `ALTER TABLE batches ALTER COLUMN batch_date SET NOT NULL, ALTER COLUMN batch_date SET DEFAULT CURRENT_DATE`.
5. Creates the ownership promotion trigger:

```sql
CREATE OR REPLACE FUNCTION promote_diary_entry_type()
RETURNS trigger AS $$
BEGIN
  IF OLD.entry_type = 'auto' AND (
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.notes IS DISTINCT FROM OLD.notes
  ) THEN
    NEW.entry_type := 'user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promote_diary_entry_type
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION promote_diary_entry_type();
```

6. Creates the `regenerate_diary_entries` PostgreSQL function:

```sql
CREATE OR REPLACE FUNCTION regenerate_diary_entries(
  p_batch_id uuid,
  p_entries jsonb
) RETURNS void AS $$
BEGIN
  DELETE FROM diary_entries WHERE batch_id = p_batch_id AND entry_type = 'auto';
  INSERT INTO diary_entries (batch_id, description, entry_date, entry_type, completed, notes)
  SELECT p_batch_id, e->>'description', (e->>'entry_date')::date, 'auto', false, e->>'notes'
  FROM jsonb_array_elements(p_entries) AS e;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Add the DiaryEntry type to the shared types module for use by API and UI components.

**Contract**: Add `DiaryEntry` interface with fields: `id: string`, `batch_id: string`, `description: string`, `notes: string | null`, `entry_date: string`, `completed: boolean`, `entry_type: 'auto' | 'user'`, `created_at: string`, `updated_at: string`. Add `DiaryEntryType` type alias. Update `Batch` interface: change `batch_date` from `string | null` to `string` (never null). Add `BatchParams` interface — the form-facing DTO containing all user-editable batch fields (everything from `Batch` except `id`, `user_id`, `created_at`, `updated_at`):

```typescript
export interface BatchParams {
  name: string;
  batch_date: string;
  process_type: "pulp" | "juice" | "";
  target_volume_liters: number | null;
  target_abv: number | null;
  planned_sweetness: SweetnessLevel;
  yeast_name: string | null;
  yeast_alcohol_tolerance: number | null;
  fermentation_sugar_kg: number;
  sweetness_sugar_kg: number;
  ingredients: Ingredient[];
}
```

`BatchParams` is constructable from form state (create mode) and derivable from a `Batch` response (edit mode). It serves as the prop contract for form child components (DiarySection, IngredientsSection) that need batch context without server-only fields.

#### 3. Generation logic module

**File**: `src/lib/services/process-plan-generation.ts`

**Intent**: Pure domain logic that takes batch parameters and returns a list of diary entry drafts. Uses the rule-based step builder pattern — a flat array of step templates with condition predicates.

**Contract**: Exports `generateProcessPlan(input: GenerationInput): DiaryEntryDraft[]` where `GenerationInput` accepts the full `Batch` object plus an optional calculation result (sugar calculation output, if available). The function uses whichever batch fields and calculation results are relevant for step conditions — keeping the input flexible for future condition additions without signature changes. Each `DiaryEntryDraft` has `description`, `entry_date` (computed from `batch_date + offset`), and `entry_type: 'auto'`. Also exports `STEP_TEMPLATES` constant array for testability and future localization.

Key implementation details:
- Steps 1a/1b are **mutually exclusive** — condition predicates are complementary (`process_type = 'juice'` vs `process_type = 'pulp'`)
- The sugar step condition checks `batch.fermentation_sugar_kg > 0` (a batch-level field after sugar-fields-refactoring lands). This covers both calculated and manually-entered sugar amounts directly without ingredient array lookups
- Day 0 steps (prepare must, sugar, pitch yeast) all share the same date — multiple entries on same day is valid. Cap management starts Day 1 (cap forms after fermentation begins).

#### 4. Step description constants

**File**: `src/lib/services/process-plan-generation.ts` (same file, constants section)

**Intent**: All step description strings defined as named constants at module top — extractable for future localization without changing logic.

**Contract**: Each step template has a `key` (e.g., `STEP_PREPARE_MUST`) and `description` string. Defined as a flat array — no artificial grouping by category (conditions are just predicates on the same flat list).

#### 5. Unit tests for generation logic

**File**: `src/lib/services/__tests__/process-plan-generation.test.ts`

**Intent**: Comprehensive unit tests proving generation correctness — step inclusion/exclusion based on conditions, date offset computation, edge cases (null batch_date, all conditions met, no conditions met).

**Contract**: Test cases covering:
- Juice + dry (no added sugar) → 11 steps (all "always" steps with juice variant of step 1)
- Juice + dry + fermentation_sugar_kg > 0 → 12 steps (adds sugar step)
- Juice + semi_sweet + fermentation_sugar_kg > 0 → 14 steps (adds sugar + stabilize + back-sweeten)
- Pulp + dry (no added sugar) → 13 steps (all "always" steps with pulp variant + cap management + press)
- Pulp + sweet + fermentation_sugar_kg > 0 → 16 steps (all conditions met)
- Date computation: batch_date 2026-01-15 + offset 14 → entry_date 2026-01-29
- All generated entries have entry_type 'auto'
- Mutually exclusive steps: juice batch never gets pulp steps and vice versa for step 1a/1b

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase-dev-apply_migration`
- Unit tests pass: `npm run test -- --run src/lib/services/__tests__/process-plan-generation.test.ts`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Verify diary_entries table has new columns (entry_date, completed, entry_type, notes) and no sort_order
- Verify `regenerate_diary_entries` function exists in database
- Verify `promote_diary_entry_type` trigger exists on diary_entries
- Verify batches.batch_date is NOT NULL with default CURRENT_DATE
- Verify existing NULL batch_dates were backfilled

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Endpoints

### Overview

Create CRUD endpoints for diary entries, integrate auto-generation into batch creation, and expose the regenerate function.

### Changes Required:

#### 0. Route restructuring prerequisite

**File**: Rename `src/pages/api/batches/[id].ts` → `src/pages/api/batches/[id]/index.ts`

**Intent**: Astro's file-based routing cannot have both a file `[id].ts` and a directory `[id]/` at the same level. Moving the existing batch endpoint into a directory enables nested diary routes.

**Contract**: Move the file, verify the route still works (`GET /api/batches/:id` and `PUT /api/batches/:id` behave identically). No logic changes — pure file relocation.

#### 1. Zod schema for diary entries

**File**: `src/lib/schemas/diary-entry.ts`

**Intent**: Validation schemas for diary entry creation and update operations.

**Contract**: Exports `createDiaryEntrySchema` (requires `description: string`; optional `entry_date: ISO date`, `notes: string | null`, `completed: boolean`) and `updateDiaryEntrySchema` (partial of create). All user-created entries get `entry_type: 'user'` server-side (not in schema — server sets it). Note: entry_type promotion on edit is handled by the DB trigger, not the API.

#### 1b. Extend batch creation schema with diary_entries

**File**: `src/lib/schemas/batch.ts`

**Intent**: Allow the batch creation payload to include optional user-added diary entries (from create mode).

**Contract**: Add an optional `diary_entries` field to `createBatchSchema`:
```typescript
diary_entries: z.array(z.object({
  description: z.string().min(1),
  entry_date: z.string().date(),
  notes: z.string().nullable().optional(),
})).optional(),
```
This prevents Zod from stripping the field during validation. The handler reads `result.data.diary_entries` and passes them to the diary insertion logic.

#### 2. Diary entries CRUD endpoint

**File**: `src/pages/api/batches/[id]/diary.ts`

**Intent**: RESTful endpoint for listing and creating diary entries for a specific batch.

**Contract**: `GET` returns all diary entries for the batch ordered by `entry_date ASC, created_at ASC`. `POST` creates a new entry with `entry_type: 'user'`, validates with `createDiaryEntrySchema`. Both require authenticated user + batch ownership (RLS enforces).

#### 3. Single diary entry endpoint

**File**: `src/pages/api/batches/[id]/diary/[entryId].ts`

**Intent**: Update and delete operations for individual diary entries.

**Contract**: `PUT` updates entry fields (description, entry_date, notes, completed) validated with `updateDiaryEntrySchema`. Note: updating description or notes triggers the DB ownership promotion trigger automatically. `DELETE` removes the entry. Both require authenticated user + batch ownership via RLS.

#### 4. Regenerate endpoint

**File**: `src/pages/api/batches/[id]/diary/regenerate.ts`

**Intent**: Atomic regeneration of auto-generated diary entries — calls the PostgreSQL function to delete old auto entries and insert new ones in a single transaction.

**Contract**: `POST` — reads current batch parameters, runs `generateProcessPlan()`, calls `supabase.rpc('regenerate_diary_entries', { p_batch_id, p_entries })`. Returns the new list of all diary entries for the batch. Requires authenticated user + batch ownership.

#### 5. Batch creation hook

**File**: `src/pages/api/batches/index.ts` (modify POST handler)

**Intent**: After successfully creating a batch, auto-generate diary entries server-side before returning the response. Also accept optional user-added diary entries from the create form and persist them atomically.

**Contract**: The POST body gains an optional `diary_entries: { description, entry_date, notes? }[]` field (user-added entries from create mode). After the batch insert succeeds:
1. Call `generateProcessPlan()` with the new batch, bulk-insert generated entries with `entry_type: 'auto'`.
2. If user-added diary entries are present in the request, bulk-insert them with `entry_type: 'user'`.
Both inserts happen via an RPC or sequential inserts within the same request. If diary insertion fails, log the error but still return the created batch (diary generation is non-blocking — user can regenerate manually).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- POST /api/batches creates batch AND diary entries appear in database
- POST /api/batches with diary_entries in body persists user entries alongside generated ones
- GET /api/batches/[id]/diary returns entries sorted chronologically
- POST /api/batches/[id]/diary creates a user entry
- PUT /api/batches/[id]/diary/[entryId] updates description/date/notes/completed
- PUT updating description on auto entry promotes entry_type to 'user' (trigger fires)
- DELETE /api/batches/[id]/diary/[entryId] removes entry
- POST /api/batches/[id]/diary/regenerate replaces auto entries, preserves user/promoted entries
- RLS prevents accessing another user's diary entries

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Implementation

### Overview

Build the diary section using the chosen mockup pattern (from Phase 0), wire it to the API endpoints, and implement add/edit/delete/complete/regenerate interactions.

### Changes Required:

#### 1. Diary section component

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Main container component for the diary section — fetches entries on mount (edit mode), manages local state, and orchestrates CRUD operations via API calls. In create mode, manages entries locally until batch is saved.

**Contract**: Accepts `batchParams: BatchParams` (the form-facing DTO — available in both create and edit modes) and optional `calculationResult` (sugar calculation output) props, plus a `mode: 'create' | 'edit'` prop and `batchId: string | null` (null in create mode, used for API calls in edit mode). In edit mode: fetches entries via GET on mount, provides add/edit/delete/toggle-complete handlers that call the API immediately. In create mode: manages entries in local state, exposes them to the parent form for inclusion in the batch creation request. Includes "Regenerate Plan" button (edit mode only) that calls the regenerate endpoint. Section heading includes a sort direction toggle (button/icon) — **client-side only** (no API change). Sort state `'asc' | 'desc'` defaults to `'asc'`, persisted in `localStorage` key `fermenta:diary-sort-order` (matching the existing `BatchListPage` layout preference pattern). Entries are re-sorted in-memory via `Array.sort()` on `entry_date` before rendering.

#### 2. Diary entry display component

**File**: `src/components/batches/diary/DiaryEntry.tsx` (or similar based on chosen pattern)

**Intent**: Individual entry rendering — shows date, description, completed state, and expandable notes; supports inline editing.

**Contract**: Based on the chosen mockup from Phase 0. Accepts a single `DiaryEntry` + callbacks for `onUpdate`, `onDelete`, `onToggleComplete`. Visual completed indicator per Phase 0 decision (icon/background, not bare checkbox). Notes section is expandable/collapsible with scrollable area for long content.

#### 3. Add entry component

**File**: `src/components/batches/diary/AddEntryForm.tsx`

**Intent**: Inline form for adding new diary entries — fields for description, optional date, and optional notes.

**Contract**: Form with description text input + date picker + optional notes textarea. On submit in edit mode, calls POST endpoint and adds entry to local state on success. In create mode, adds to local state only (persisted on batch creation).

#### 4. Wire into BatchForm

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Replace the Phase 0 mockup placeholder with the real DiarySection component. Both create and edit modes show the diary section — in create mode entries are managed locally and submitted with the batch.

**Contract**: Render `<DiarySection batchParams={batchParams} batchId={batch?.id ?? null} calculationResult={calcResult} mode={mode} />` in the diary section slot. `batchParams` is constructed once in BatchForm from form state (same object passed to IngredientsSection after Phase 3.5 refactoring). In create mode, DiarySection collects user-added entries locally and exposes them via a callback/ref so the form includes them in the POST request body. In edit mode, DiarySection fetches from API and operates independently.

#### 5. Remove Phase 0 mockup artifacts

**Intent**: Clean up temporary mockup components and switcher from Phase 0 (delete unused alternatives, keep only the chosen pattern's code as reference for DiaryEntry component).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Create a new batch → diary entries appear immediately on batch detail page
- In create mode, user can add manual diary entries before saving
- Manual entries from create mode persist after batch creation
- Entries display sorted by date (ASC default)
- Sort toggle switches between ASC/DESC, entries re-order accordingly
- Click completed toggle → entry visual state changes, persists on reload
- Click entry to edit → modify description/date/notes → save → persists
- Editing description or notes on auto entry promotes it to user type (verify via regenerate: it survives)
- Notes section expands/collapses correctly with scrollable area
- Click add → fill form → new entry appears in correct chronological position
- Click delete → entry removed → persists
- Click "Regenerate Plan" → auto entries replaced with fresh generation, user/promoted entries preserved
- Responsive layout works on mobile viewport

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3.5: IngredientsSection Props Refactoring

### Overview

Refactor IngredientsSection to use the same `BatchParams` DTO that DiarySection uses. This is a mechanical interface change — no logic changes inside the component. Ensures both form child sections share a consistent prop contract.

### Changes Required:

#### 1. Update IngredientsSection props

**File**: `src/components/batches/IngredientsSection.tsx`

**Intent**: Replace the ad-hoc prop interface with the shared `BatchParams` DTO + a single partial-update callback.

**Contract**: Remove the local `BatchParams` interface definition. Replace props:
- Remove: `ingredients`, `onChange`, `batchParams` (local type), `fermentationSugarKg`, `sweetnessSugarKg`, `onSugarChange`
- Add: `batchParams: BatchParams` (from `@/types`), `onBatchChange: (updates: Partial<BatchParams>) => void`

IngredientsSection reads what it needs from `batchParams` (ingredients, sugar values, volume, abv, sweetness) and calls `onBatchChange({ ingredients: [...] })` or `onBatchChange({ fermentation_sugar_kg: x, sweetness_sugar_kg: y })` to propagate changes. Internal logic (calculate, add, edit, delete) is unchanged.

#### 2. Update BatchForm prop passing

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Construct `batchParams` once and pass to both IngredientsSection and DiarySection.

**Contract**: Build a `batchParams: BatchParams` object from form state (with `parseFloat` conversions for numeric fields). Pass to both child sections. Replace the current per-field prop construction with the single object. Handle `onBatchChange` by merging updates into form state (reversing the parseFloat — converting numbers back to strings for controlled inputs).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- All existing tests still pass: `npm run test -- --run`

#### Manual Verification:

- Sugar calculation still works (Calculate button produces correct values)
- Manual sugar editing still works (edit fermentation/sweetness sugar cards)
- Ingredient add/edit/delete still works
- DiarySection still receives correct params for generation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integration & Polish

### Overview

Process type default, edge cases, final polish, and end-to-end verification.

### Changes Required:

#### 1. Process type default to 'juice' and batch_date default to today

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Preselect 'juice' in the process_type dropdown and default batch_date to today for new batches. Remove the empty process_type option in create mode. Ensure batch_date is never cleared (if user empties it, re-apply today).

**Contract**: Change initial form state for `process_type` from `""` to `"juice"` and `batch_date` to today's ISO date in create mode. Remove the empty `<option>` element for process_type. On blur of batch_date, if empty, reset to today.

#### 2. Edge case handling

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Handle edge cases — loading state, empty state (no entries), error state (API failure).

**Contract**: Show skeleton/loading while fetching. Show "No diary entries yet" with "Generate Plan" button for legacy batches without entries. Show error toast on API failure.

#### 3. Ordering consistency and sort toggle

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Ensure consistent ordering after mutations and provide user-controlled sort direction.

**Contract**: Sort is **client-side only** — the API always returns entries in `entry_date ASC, created_at ASC` order. The UI manages a `sortOrder: 'asc' | 'desc'` state (default `'asc'`), persisted in `localStorage` under key `fermenta:diary-sort-order` (same pattern as `BatchListPage`'s layout preference). After add/edit mutations, the UI re-sorts the local entry list before rendering. The sort toggle button/icon sits next to the "Process Diary" heading and visually communicates the active direction (e.g., ArrowUpDown icon or similar from lucide-react). No API or database changes needed — 10-15 entries per batch makes client-side sort trivially fast.

#### 4. Completed toggle on local entries in create mode

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Allow users to mark local diary entries (added during batch creation) as completed before the batch is saved. Ensures create-mode entries have the same toggle capability as edit-mode entries.

**Contract**: Add a `completed: boolean` field to `LocalDiaryEntry`. The `LocalEntryRow` component renders the same clickable dot/circle toggle as `TimelineEntry`. Toggling flips the local state. On batch submission, entries with `completed: true` are included in the `diary_entries` payload (the API schema already accepts optional `completed`). No API or database changes needed.

### Success Criteria:

#### Automated Verification:

- All existing tests still pass: `npm run test -- --run`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- New batch creation defaults to 'juice' process type
- Batch form defaults batch_date to today (cannot be null)
- Creating batch with 'juice' + 'dry' (no sugar) → ~11 diary entries generated
- Creating batch with 'pulp' + 'semi_sweet' + sugar > 0 → ~16 entries generated
- Legacy batch (no diary entries) shows empty state with "Generate Plan" button
- Editing a batch's process_type does NOT auto-regenerate diary (user must click Regenerate)
- Sort toggle persists across page reloads (localStorage)
- API errors show user-friendly feedback (not raw error)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Generation logic: step inclusion/exclusion for all parameter combinations
- Date offset computation (batch_date + N days)
- Edge cases: all conditions true, no conditions true, boundary values
- Zod schema validation: valid/invalid inputs for diary entry create/update

### Manual Testing Steps:

1. Create a new batch (juice, dry, no sugar) → verify ~11 diary entries
2. Create a new batch (pulp, semi_sweet, with sugar) → verify ~16 entries with all conditional steps
3. Add manual entries during batch creation → they persist after save
4. Edit a diary entry description and date → reload → persists
5. Edit an auto entry's description → verify entry_type promoted to 'user'
6. Toggle completed on 3 entries → reload → state persists
7. Add a manual entry with a specific date → appears in correct chronological position
8. Edit notes on an entry → expand → verify scrollable area for long text
9. Delete an auto-generated entry → gone after reload
10. Click "Regenerate Plan" → auto entries replaced, user/promoted entries preserved
11. Mobile viewport → layout is usable

## Performance Considerations

- Diary entries per batch: typically 11-16 (bounded by template + user additions). No pagination needed.
- Individual save operations: one API call per user action. Acceptable latency for this volume.
- Regenerate: single RPC call (atomic DB function). No N+1 concerns.
- No client-side computation beyond date sorting of a small list.

## Migration Notes

- The `sort_order` column drop is safe — table has no production data (never used by any feature).
- Existing batches with NULL `batch_date` are backfilled with `created_at::date` — safe since these batches were created recently during development.
- `batch_date` becomes NOT NULL with DEFAULT CURRENT_DATE — all future batches always have a date.
- Existing batches (created before S-03) will have zero diary entries. Empty state UI handles this gracefully.
- The `regenerate_diary_entries` PostgreSQL function uses `SECURITY DEFINER` to bypass RLS within the function — the API layer validates ownership before calling it.
- The ownership promotion trigger ensures user-modified auto entries survive regeneration without any API-level logic.

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

- [x] 0.1 Three mockup alternatives render correctly on batch detail page
- [x] 0.2 Notes section expandable/collapsible with scrollable area
- [x] 0.3 Visual completed indicator distinguishable from multi-select checkbox
- [x] 0.4 Layout works on mobile viewport
- [x] 0.5 Winner selected and losers deleted — **Winner: Timeline (C).** Losers (A, B, D) deleted. Remaining Phase 0 artifacts: `DiaryMockupSwitcher.tsx`, `DiaryMockupC.tsx`, `mockData.ts` — kept for Phase 3 reference, removed in Phase 3 step 5.

### Phase 1: Schema Migration + Domain Logic

#### Automated

- [x] 1.1 Migration applies cleanly — 6967e3b
- [x] 1.2 Unit tests pass for generation logic — 6967e3b
- [x] 1.3 Type checking passes — 6967e3b
- [x] 1.4 Linting passes — 6967e3b

#### Manual

- [x] 1.5 diary_entries table has new columns (entry_date, completed, entry_type, notes) and no sort_order — 6967e3b
- [x] 1.6 regenerate_diary_entries function exists in database — 6967e3b
- [x] 1.7 promote_diary_entry_type trigger exists on diary_entries — 6967e3b
- [x] 1.8 batches.batch_date is NOT NULL with default CURRENT_DATE — 6967e3b
- [x] 1.9 Existing NULL batch_dates were backfilled — 6967e3b

### Phase 2: API Endpoints

#### Automated

- [x] 2.0 Route restructuring: `[id].ts` → `[id]/index.ts` (existing batch endpoint still works) — 88cba2a
- [x] 2.1 Type checking passes — 88cba2a
- [x] 2.2 Linting passes — 88cba2a
- [x] 2.3 Build succeeds — 88cba2a

#### Manual

- [x] 2.4 POST /api/batches creates batch AND diary entries — 88cba2a
- [x] 2.5 GET /api/batches/[id]/diary returns entries sorted chronologically — 88cba2a
- [x] 2.6 POST /api/batches/[id]/diary creates user entry — 88cba2a
- [x] 2.7 PUT /api/batches/[id]/diary/[entryId] updates entry (description, date, notes, completed) — 88cba2a
- [x] 2.8 DELETE /api/batches/[id]/diary/[entryId] removes entry — 88cba2a
- [x] 2.9 POST /api/batches/[id]/diary/regenerate replaces auto, preserves user/promoted — 88cba2a
- [x] 2.10 RLS prevents cross-user access — 88cba2a
- [x] 2.11 Editing auto entry description/notes triggers ownership promotion — 88cba2a

### Phase 3: UI Implementation

#### Automated

- [x] 3.1 Type checking passes — 539ac81
- [x] 3.2 Linting passes — 539ac81
- [x] 3.3 Build succeeds — 539ac81

#### Manual

- [x] 3.4 New batch creation shows diary entries immediately — 539ac81
- [x] 3.5 Sort toggle switches between ASC/DESC, entries re-order — 539ac81
- [x] 3.6 Manual entries addable during batch creation (persist after save) — 539ac81
- [x] 3.6 Completed toggle persists on reload — 539ac81
- [x] 3.7 Edit entry description/date/notes persists — 539ac81
- [x] 3.8 Editing auto entry promotes to user type (survives regenerate) — 539ac81
- [x] 3.9 Notes section expandable with scrollable area — 539ac81
- [x] 3.10 Add manual entry appears in correct position — 539ac81
- [x] 3.11 Delete entry persists — 539ac81
- [x] 3.12 Regenerate replaces auto, preserves user/promoted entries — 539ac81
- [x] 3.13 Responsive layout on mobile — 539ac81

### Phase 3.5: IngredientsSection Props Refactoring

#### Automated

- [x] 3.5.1 Type checking passes — 4095958
- [x] 3.5.2 Linting passes — 4095958
- [x] 3.5.3 Build succeeds — 4095958
- [x] 3.5.4 All existing tests still pass — 4095958

#### Manual

- [x] 3.5.5 Sugar calculation still works (Calculate button) — 4095958
- [x] 3.5.6 Manual sugar editing still works — 4095958
- [x] 3.5.7 Ingredient add/edit/delete still works — 4095958
- [x] 3.5.8 DiarySection still receives correct params — 4095958

### Phase 4: Integration & Polish

#### Automated

- [x] 4.1 All existing tests still pass — f591261
- [x] 4.2 Type checking passes — f591261
- [x] 4.3 Linting passes — f591261
- [x] 4.4 Build succeeds — f591261

#### Manual

- [x] 4.5 Process type defaults to juice for new batches — f591261
- [x] 4.6 Batch form defaults batch_date to today — f591261
- [x] 4.7 Juice + dry batch (no sugar) → ~11 entries generated — f591261
- [x] 4.8 Pulp + semi_sweet + sugar batch → ~16 entries generated — f591261
- [x] 4.9 Legacy batch shows empty state with Generate button — f591261
- [x] 4.10 Sort toggle persists across page reloads (localStorage) — f591261
- [x] 4.11 API errors show user-friendly feedback — f591261
- [x] 4.12 Completed toggle works on local entries in create mode — f591261
