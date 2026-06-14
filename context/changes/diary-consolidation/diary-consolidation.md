# Follow-up: Diary Entry Code Consolidation

From implementation review of `process-plan-generation`, 2026-06-14.

## Problem

DiarySection.tsx contains two near-identical components (`TimelineEntry` and `LocalEntryRow`, ~170 lines each) with a 95% overlap. Schemas are also duplicated across files with subtle drifts.

## Tasks

### 1. Merge `TimelineEntry` and `LocalEntryRow` into a single `EntryRow` component

- Accept a unified entry shape (description, entry_date, notes, completed) + callbacks
- The `id`, `entry_type`, `created_at` fields from `DiaryEntry` are never used in rendering
- Fix the notes rendering bug: `TimelineEntry` renders an expand container even when notes is null (should match `LocalEntryRow` which skips it)

### 2. Extract shared diary entry schema

- Create a `diaryEntryBaseSchema` in `src/lib/schemas/diary-entry.ts`
- Compose `createDiaryEntrySchema` and the inline batch schema from it
- Decide: should `entry_date` always be required (batch context provides it), or keep standalone create as optional-with-server-default?

### 3. Eliminate `LocalDiaryEntry` type

- Use `CreateDiaryEntryInput` (from diary-entry.ts) or a shared type
- Remove the independent interface from DiarySection.tsx

### 4. (Optional) Surface diary generation failures in batch POST response

- Currently silent. Consider adding a `warnings` field to the 201 response, or returning diary entries in the batch response body so the client can detect missing entries.

## Scope

This is a pure refactor — no new features, no API contract changes (except optional #4).
