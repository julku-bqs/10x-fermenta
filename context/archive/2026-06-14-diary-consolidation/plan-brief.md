# Diary Entry Code Consolidation — Plan Brief

> Full plan: `context/changes/diary-consolidation/plan.md`

## What & Why

Consolidate ~340 lines of near-identical diary entry UI code into a single component, extract a shared schema to eliminate validation drift, and fix two bugs (notes rendering, date clearing) that naturally surface from the consolidation.

## Starting Point

`DiarySection.tsx` contains `TimelineEntry` and `LocalEntryRow` — two components with 95% identical rendering logic, differing only in prop types (`DiaryEntry` vs `LocalDiaryEntry`). The `LocalDiaryEntry` interface duplicates `CreateDiaryEntryInput`. Schema validation for diary entries is defined in two places (`diary-entry.ts` and inline in `batch.ts`) with `entry_date` optionality drift.

## Desired End State

A single `EntryRow` component in its own file renders diary entries for both create and edit modes. One `diaryEntryBaseSchema` is the source of truth for both endpoints. Clearing a date field restores today's date on blur. The notes container always renders, showing "No notes" when empty.

## Key Decisions Made

| Decision                    | Choice                                  | Why (1 sentence)                                                                |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `entry_date` in base schema | Optional with backend default to today  | Preserves both endpoint behaviors while fixing silent failure on empty date     |
| EntryRow prop type          | `CreateDiaryEntryInput` directly        | Matches the shared schema shape; eliminates need for a separate view-model type |
| Task #4 (error surfacing)   | Out of scope                            | Keep this a pure refactor + bug fix                                             |
| EntryRow file location      | New file `EntryRow.tsx`                 | Separation of concerns; DiarySection.tsx orchestrates, EntryRow renders         |
| Notes container behavior    | Always render (show "No notes" if null) | Correct behavior per TimelineEntry; LocalEntryRow was the buggy one             |

## Scope

**In scope:**

- Merge TimelineEntry + LocalEntryRow → EntryRow
- Extract diaryEntryBaseSchema, compose both schemas from it
- Remove LocalDiaryEntry type (use CreateDiaryEntryInput)
- Fix notes rendering bug (always show container)
- Fix entry_date: backend defaults to today, UI restores on blur

**Out of scope:**

- Surfacing diary generation failures (task #4)
- API contract or response shape changes
- Auto-generation logic changes
- New test infrastructure

## Architecture / Approach

Schema-first refactor: establish the shared base schema (Phase 1), extract the unified component using that type (Phase 2), then swap usage and delete dead code (Phase 3). Each phase is independently buildable and verifiable.

## Phases at a Glance

| Phase                    | What it delivers                                                         | Key risk                                                                       |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1. Extract Shared Schema | Single source of truth for diary entry validation + backend date default | Batch inline schema removal could miss a subtle validation difference          |
| 2. Extract EntryRow      | Unified component with bug fixes (notes, date blur)                      | Rendering parity with both originals — must not regress animations/transitions |
| 3. Wire Up & Cleanup     | Dead code removal, type migration                                        | External imports of `LocalDiaryEntry` could be missed                          |

**Prerequisites:** None — this is a standalone refactor
**Estimated effort:** ~1 session, 3 phases

## Open Risks & Assumptions

- Assumption: no external consumers import `LocalDiaryEntry` beyond DiarySection.tsx (will grep to verify)
- Assumption: DB column `entry_date` has no DEFAULT constraint — the backend code must provide the value

## Success Criteria (Summary)

- `npm run lint` and `npm run build` pass with zero diary-related warnings
- Manual verification: notes container renders "No notes" for null notes; clearing date restores today on blur
- Zero remaining references to `LocalDiaryEntry`, `TimelineEntry`, or `LocalEntryRow` in the codebase
