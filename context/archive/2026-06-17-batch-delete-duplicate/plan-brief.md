# Batch Delete & Duplicate — Plan Brief

> Full plan: `context/changes/batch-delete-duplicate/plan.md`

## What & Why

Add batch deletion (with confirmation dialog) and batch duplication (via pre-filled create form) to the batch detail page. These are the two missing batch management actions that complete the core CRUD workflow — currently a user can create, view, and edit batches but cannot delete or clone them.

## Starting Point

The batch detail page has a disabled "Delete Batch" button marked "Coming soon". No DELETE API endpoint exists for batches. No duplicate functionality exists. The database schema already supports cascade deletion (diary_entries FK has `ON DELETE CASCADE`, ingredients are embedded JSONB).

## Desired End State

Users can delete any batch via a confirmation dialog (batch + diary entries removed, redirect to list) and duplicate any batch by navigating to a pre-filled create form that carries over all parameters and ingredients but requires a fresh name and date.

## Key Decisions Made

| Decision                   | Choice                                                    | Why (1 sentence)                                                               |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Delete cascade behavior    | Hard cascade delete (batch + diary entries)               | Clean, no orphan data, acceptable for a personal tool with no undo requirement |
| Delete confirmation UX     | AlertDialog with batch name                               | Prevents accidental deletion, matches existing shadcn/ui patterns              |
| Post-delete navigation     | Redirect to /batches                                      | Clean flow — user sees remaining batches immediately                           |
| Duplicate approach         | Client-side pre-fill via `?from={batchId}` on create page | Reuses existing create flow, no new API endpoint needed                        |
| Duplicate data scope       | Copy params + ingredients, blank name/date, fresh diary   | Most useful — duplicates a recipe for a new batch run                          |
| Action placement           | Detail page only                                          | Follows S-05/S-06 roadmap split; list actions come in S-06                     |
| Data passing for duplicate | URL query parameter + server-side fetch                   | Secure (RLS), shareable, follows existing SSR pattern                          |

## Scope

**In scope:**

- DELETE API endpoint for batches
- Confirmation dialog component (shadcn/ui AlertDialog)
- Duplicate button navigating to pre-filled create form
- Extend create page to accept `?from={batchId}` query param

**Out of scope:**

- Batch list actions (S-06)
- Soft delete / undo
- Database migrations (none needed)
- Search/filter on batch list

## Architecture / Approach

Two lightweight additions following established patterns. Delete adds a `DELETE` export to the existing `/api/batches/[id]` route file and a new `DeleteBatchDialog` React island on the detail page. Duplicate extends `new.astro` to read `?from=` query param, fetch the source batch server-side, and pass stripped data as `initialData` to the existing `BatchForm`. No new API endpoints for duplicate — the existing POST `/api/batches` handles creation.

## Phases at a Glance

| Phase                           | What it delivers                          | Key risk                                                  |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| 1. Delete API + Confirmation UI | Working delete with confirmation dialog   | Low — follows existing diary entry DELETE pattern exactly |
| 2. Duplicate via Pre-fill       | Duplicate button + pre-filled create form | Low — reuses existing create flow with `initialData` prop |

**Prerequisites:** shadcn/ui AlertDialog component must be installed (check if already available)
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Assumes shadcn/ui AlertDialog is already installed; if not, `npx shadcn@latest add alert-dialog` is needed
- Assumes `BatchForm` handles `initialData` with blank name gracefully in create mode (validation will catch empty name on submit)

## Success Criteria (Summary)

- User can delete a batch from the detail page with confirmation, and batch + diary entries are permanently removed
- User can duplicate a batch from the detail page, landing on a pre-filled create form with fresh name/date fields
- Lint and build pass with no regressions
