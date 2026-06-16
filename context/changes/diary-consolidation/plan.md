# Diary Entry Code Consolidation Implementation Plan

## Overview

Consolidate ~340 lines of near-identical diary entry UI code (`TimelineEntry` and `LocalEntryRow`) into a single `EntryRow` component, extract a shared diary entry base schema to eliminate drift between `diary-entry.ts` and `batch.ts`, remove the redundant `LocalDiaryEntry` type, fix the notes rendering bug in `LocalEntryRow`, and fix the `entry_date` clearing behavior across both standalone and batch creation flows.

## Current State Analysis

- `src/components/batches/diary/DiarySection.tsx` contains two components:
  - `TimelineEntry` (lines 281-446): renders API-backed diary entries in edit mode
  - `LocalEntryRow` (lines 450-616): renders unsaved local entries in create mode
- Both components are functionally identical aside from their entry prop type (`DiaryEntry` vs `LocalDiaryEntry`)
- `LocalDiaryEntry` (line 18-23) is a 4-field interface identical to `CreateDiaryEntryInput`
- Schema drift: `entry_date` is optional in `createDiaryEntrySchema` but required in the batch inline schema
- Notes rendering bug: `LocalEntryRow` incorrectly wraps the expand container with `{entry.notes && ...}` (line 595), meaning entries without notes never show the "No notes" placeholder — correct behavior is in `TimelineEntry` which always renders the container
- Date clearing bug: no onblur handler restores the default date when field is cleared (unlike `batch_date` in `BatchForm.tsx` lines 301-305)

### Key Discoveries:

- `formatDate` helper (line 31) is a local function in DiarySection.tsx — the new `EntryRow` file will need it extracted or co-located
- `batchInputClass` is imported from `../styles` — same import path works from the diary/ subdirectory
- The `onEdit` callback uses `Partial<Pick<..., "description" | "entry_date" | "notes">>` — the unified version should use `Partial<Pick<CreateDiaryEntryInput, "description" | "entry_date" | "notes">>`
- Backend standalone POST (line 57-63) spreads `result.data` directly without defaulting `entry_date` — if omitted, it inserts undefined which the DB rejects silently

## Desired End State

A single `EntryRow` component in its own file renders diary entries identically for both create and edit modes. A shared `diaryEntryBaseSchema` is the single source of truth for field validation. `entry_date` defaults to today on the backend when omitted, and the UI restores today's date on blur when cleared. The `LocalDiaryEntry` type is gone — `CreateDiaryEntryInput` is used everywhere.

**Verification:** `npm run lint` and `npm run build` pass. Manual test: create a batch with diary entries, edit existing entries, clear a date field and blur — date restores to today. Expand notes on an entry with no notes — shows "No notes" placeholder.

## What We're NOT Doing

- Task #4 (surfacing diary generation failures in batch POST response) — separate follow-up
- Changing the API contract or response shape
- Modifying the auto-generation logic in `process-plan-generation.ts`
- Touching the `regenerate` endpoint
- Changing the `DiaryEntry` database entity type

## Implementation Approach

Three phases: schema first (establishes the shared type), then component extraction (uses the type), then wiring and cleanup (removes old code). Each phase is independently verifiable.

## Phase 1: Extract Shared Diary Entry Schema

### Overview

Create a `diaryEntryBaseSchema` that both `createDiaryEntrySchema` and the batch inline schema compose from. Make `entry_date` optional in the base with a backend default. Fix the backend POST to default `entry_date` to today.

### Changes Required:

#### 1. Shared base schema

**File**: `src/lib/schemas/diary-entry.ts`

**Intent**: Introduce `diaryEntryBaseSchema` with the 4 common fields (`description`, `entry_date`, `notes`, `completed`). Make `entry_date` optional. Derive `createDiaryEntrySchema` from it (now identical to base). Keep `updateDiaryEntrySchema` as a partial variant. Export the base schema for batch.ts to import.

**Contract**: `diaryEntryBaseSchema` is a `z.object` with `description: z.string().min(1)`, `entry_date: z.iso.date().optional()`, `notes: z.string().nullable().optional()`, `completed: z.boolean().optional()`. `createDiaryEntrySchema` equals `diaryEntryBaseSchema`. Types re-exported unchanged.

> **Addendum (2026-06-16)**: `entry_date` uses `z.union([z.iso.date(), z.literal("")]).optional().transform(val => val === "" ? undefined : val)` to handle empty strings from HTML date inputs. Functionally equivalent for valid dates; silently normalizes empty inputs.

#### 2. Batch schema uses shared base

**File**: `src/lib/schemas/batch.ts`

**Intent**: Replace the inline `diary_entries` item schema with a reference to `diaryEntryBaseSchema` imported from `diary-entry.ts`. This eliminates the drift source.

**Contract**: `diary_entries` field becomes `z.array(diaryEntryBaseSchema).optional()`. Import added from `./diary-entry`.

#### 3. Backend defaults entry_date

**File**: `src/pages/api/batches/[id]/diary/index.ts`

**Intent**: In the POST handler, default `entry_date` to today's date if not provided by the client. This fixes the silent failure when date is omitted.

**Contract**: Before inserting, spread `entry_date: result.data.entry_date ?? new Date().toISOString().slice(0, 10)` into the insert object.

#### 4. Batch creation endpoint defaults entry_date

**File**: `src/pages/api/batches/index.ts`

**Intent**: In the batch creation POST handler, default `entry_date` to today's date if not provided. Same defensive pattern as the standalone diary POST.

**Contract**: At line 65, change `entry_date: entry.entry_date` to `entry_date: entry.entry_date ?? new Date().toISOString().slice(0, 10)`.

#### 4. Batch endpoint defaults entry_date

**File**: `src/pages/api/batches/index.ts`

**Intent**: In the batch creation handler's diary entry mapping (line 65), default `entry_date` to today when not provided. Same pattern as Change 3.

**Contract**: Change `entry_date: entry.entry_date` to `entry_date: entry.entry_date ?? new Date().toISOString().slice(0, 10)`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Existing diary creation flows still work (no type errors)

#### Manual Verification:

- Create a standalone diary entry without specifying a date — entry appears with today's date
- Create a batch with diary entries — dates are preserved correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Extract Unified EntryRow Component

### Overview

Create `src/components/batches/diary/EntryRow.tsx` with a single component that replaces both `TimelineEntry` and `LocalEntryRow`. Use `CreateDiaryEntryInput` as the entry prop type. Always render the notes expand container (correct behavior). Add onblur date restoration.

### Changes Required:

#### 1. New EntryRow component

**File**: `src/components/batches/diary/EntryRow.tsx`

**Intent**: Single component accepting `CreateDiaryEntryInput` as entry shape plus `isLast`, `onToggleComplete`, `onEdit`, `onDelete` callbacks. Renders the timeline UI with checkbox, clickable title, edit mode, and notes expand container. Notes container always renders — shows entry notes or italic "No notes" placeholder. The title/description button toggles the expand state for all entries; the "Show notes" button is a secondary affordance rendered only when notes are present. Date input has an onblur handler that restores today's date when cleared.

**Contract**: Props interface:
```typescript
interface EntryRowProps {
  entry: Required<CreateDiaryEntryInput>;
  isLast: boolean;
  onToggleComplete: () => void;
  onEdit: (updates: Partial<Pick<CreateDiaryEntryInput, "description" | "entry_date" | "notes">>) => void;
  onDelete: () => void;
}
```
Imports `cn` from `@/lib/utils`, icons from `lucide-react`, `batchInputClass` from `../styles`, `CreateDiaryEntryInput` from `@/lib/schemas/diary-entry`. Contains a co-located `formatDate` helper (moved from DiarySection.tsx).

#### 2. Date onblur behavior

**Intent**: When the date input loses focus and the value is empty, restore today's date. Matches the existing `batch_date` onblur pattern in `BatchForm.tsx` (lines 301-305).

**Contract**: `onBlur` handler on the date `<input>` that calls `setEditDate(new Date().toISOString().slice(0, 10))` when value is falsy.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Component renders correctly (verified in next phase when wired up)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire Up and Eliminate Duplicates

### Overview

Replace usage of `TimelineEntry` and `LocalEntryRow` in `DiarySection.tsx` with the new `EntryRow`. Remove the old components and the `LocalDiaryEntry` interface. Move `formatDate` to EntryRow.tsx (already done in Phase 2) and remove from DiarySection.

### Changes Required:

#### 1. Replace component usage in DiarySection

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Import `EntryRow` from `./EntryRow`. Replace `<TimelineEntry>` usage (lines 240-247) with `<EntryRow>` — map `DiaryEntry` to `CreateDiaryEntryInput` shape by picking `description`, `entry_date`, `notes`, `completed`. Replace `<LocalEntryRow>` usage (lines 256-269) with `<EntryRow>` — entries are already the right shape.

**Contract**: Both render sites use `<EntryRow entry={...} isLast={...} onToggleComplete={...} onEdit={...} onDelete={...} />`. The `DiaryEntry` → `CreateDiaryEntryInput` mapping is a simple pick of 4 fields inline.

#### 2. Remove dead code

**File**: `src/components/batches/diary/DiarySection.tsx`

**Intent**: Delete the `TimelineEntry` function (lines 281-446), the `LocalEntryRow` function (lines 448-616), the `LocalDiaryEntry` interface (lines 18-23), and the `formatDate` function (lines 31-40). Update the `onLocalEntriesChange` prop type to use `CreateDiaryEntryInput[]` instead of `LocalDiaryEntry[]`. Update all local state typing accordingly.

**Contract**: `LocalDiaryEntry` export is removed. `onLocalEntriesChange` accepts `CreateDiaryEntryInput[]`. Import `CreateDiaryEntryInput` from `@/lib/schemas/diary-entry`.

#### 3. Update any external imports of LocalDiaryEntry

**File**: Any files importing `LocalDiaryEntry` from `DiarySection.tsx`

**Intent**: Replace with `CreateDiaryEntryInput` from `@/lib/schemas/diary-entry`.

**Contract**: Grep for `LocalDiaryEntry` imports — update to `CreateDiaryEntryInput`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- No remaining references to `LocalDiaryEntry` or `TimelineEntry` or `LocalEntryRow`

#### Manual Verification:

- Edit mode: existing diary entries render with timeline, toggle complete, edit, delete, expand notes
- Create mode: local entries render identically, can be added/edited/deleted
- Notes container shows "No notes" in italic when notes field is null
- Clearing date field and blurring restores today's date
- No visual regressions in diary section

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No existing unit tests for these components — do not add new test infrastructure in this refactor

### Integration Tests:

- Lint + build pass (catches type errors, unused imports, missing exports)

### Manual Testing Steps:

1. Open a batch in edit mode — verify diary entries render with timeline dots, dates, descriptions
2. Click an entry to expand — verify "No notes" shows for entries without notes
3. Click Edit on an entry — change description, clear date, blur — date restores to today
4. Save the edit — verify changes persist
5. Toggle complete on an entry — verify visual state change
6. Delete an entry — verify removal
7. Create a new batch — add diary entries in the form, verify they appear
8. Clear a diary entry date in create mode, blur — date restores to today

## Performance Considerations

No performance impact — this is a code consolidation. The unified component renders identically to the two originals.

## References

- Source review: `context/changes/diary-consolidation/diary-consolidation.md`
- Batch date onblur pattern: `src/components/batches/BatchForm.tsx:301-305`
- Lesson (Windows line endings): `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract Shared Diary Entry Schema

#### Automated

- [x] 1.1 Lint passes after schema changes — 6a9a315
- [x] 1.2 Build passes after schema changes — 6a9a315

#### Manual

- [x] 1.3 Standalone diary entry creation without date defaults to today — 73a32fd
- [x] 1.4 Batch diary entries preserve specified dates — 73a32fd

### Phase 2: Extract Unified EntryRow Component

#### Automated

- [x] 2.1 Lint passes with new EntryRow component — c1de642
- [x] 2.2 Build passes with new EntryRow component — c1de642

#### Manual

- [x] 2.3 Component renders correctly when wired up — 73a32fd

### Phase 3: Wire Up and Eliminate Duplicates

#### Automated

- [x] 3.1 Lint passes after consolidation — 73a32fd
- [x] 3.2 Build passes after consolidation — 73a32fd
- [x] 3.3 No remaining references to LocalDiaryEntry, TimelineEntry, or LocalEntryRow — 73a32fd

#### Manual

- [x] 3.4 Edit mode diary entries render correctly — 73a32fd
- [x] 3.5 Notes expand shows "No notes" placeholder for null notes — 73a32fd
- [x] 3.6 Date onblur restores today when cleared — 73a32fd
- [x] 3.7 Create mode entries render and function correctly — 73a32fd
- [x] 3.8 No visual regressions in diary section — 73a32fd
