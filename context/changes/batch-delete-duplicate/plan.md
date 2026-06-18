# Batch Delete & Duplicate Implementation Plan

## Overview

Add two batch management actions to the detail page: **delete** (with confirmation dialog) and **duplicate** (pre-fill the create form from an existing batch). This is roadmap slice S-05, a prerequisite for S-06 (batch list actions).

## Current State Analysis

- Batch detail page (`src/pages/batches/[id].astro`) has a **disabled** "Delete Batch" button with title "Coming soon" (line 31-38).
- No DELETE endpoint exists for batches — only for diary entries at `/api/batches/[id]/diary/[entryId]`.
- No duplicate functionality exists anywhere.
- `batches.ingredients` is a JSONB column (not a separate table) — deleting a batch row removes ingredients automatically.
- `diary_entries.batch_id` has `ON DELETE CASCADE` — diary entries are deleted automatically when the parent batch is removed.
- RLS policy on `batches` is `FOR ALL USING (auth.uid() = user_id)` — DELETE is already allowed.
- `BatchForm` accepts `initialData?: Batch` — supports pre-filling for both edit and create modes.
- Create page (`src/pages/batches/new.astro`) is a simple wrapper with no query-param handling.

### Key Discoveries:

- `supabase/migrations/20260605220000_ingredients_jsonb_on_batches.sql` — ingredients table was dropped and replaced with JSONB column on batches. No FK cascade to worry about.
- `supabase/migrations/20260530213000_batch_schema_with_rls.sql:53` — `diary_entries.batch_id` has `ON DELETE CASCADE`. No manual cleanup needed.
- `src/pages/api/batches/[id]/diary/[entryId].ts:48-67` — existing DELETE pattern: null guard → UUID validation → supabase `.delete()` → 204 response. Follow this pattern exactly.
- `src/lib/api.ts` — `jsonError()` and `jsonOk()` helpers already available.
- `src/components/batches/BatchForm.tsx:37-51` — form initializes from `initialData` prop. When `initialData` is provided with name/date cleared, the form starts blank for those fields while preserving all other parameters and ingredients.

## Desired End State

After this plan is complete:

1. A logged-in user can click "Delete Batch" on the batch detail page, see a confirmation dialog naming the batch, confirm, and be redirected to `/batches` with the batch (and its diary entries) permanently removed.
2. A logged-in user can click "Duplicate as New" on the batch detail page, be redirected to `/batches/new?from={batchId}`, and see the create form pre-filled with all parameters and ingredients from the original batch — but with name and date blank so the user must provide fresh values.
3. Unauthenticated requests to `DELETE /api/batches/[id]` return 500 (consistent with existing guard pattern).
4. Requests for a non-existent or other user's batch return 404 (RLS handles ownership).

**Verification**: Open a batch → click Delete → confirm → verify redirect to list and batch is gone. Open a batch → click Duplicate → verify create form is pre-filled (minus name/date) → submit → verify new batch created. Lint + build pass.

## What We're NOT Doing

- No batch list actions (delete/duplicate from list cards) — that's S-06
- No soft delete or undo functionality — cascade hard delete per user decision
- No migration — schema already supports all operations
- No new database-level changes
- No search/filter on batch list

## Implementation Approach

**Delete**: Add a `DELETE` export to the existing `/api/batches/[id]/index.ts` file, following the diary entry DELETE pattern. Replace the disabled button on the detail page with a React island containing an AlertDialog confirmation component (shadcn/ui).

**Duplicate**: Extend `new.astro` to read a `?from={batchId}` query parameter. When present, fetch the source batch server-side, blank out `name` and `batch_date`, and pass the full object as `initialData` to `BatchForm`. Add a "Duplicate as New" button on the detail page that navigates to this URL.

## Phase 1: Delete API + Confirmation UI

### Overview

Add the DELETE endpoint and replace the disabled button with a working confirmation dialog. After this phase, users can delete batches from the detail page.

### Changes Required:

#### 0. Install AlertDialog component

**Intent**: AlertDialog is not yet in the project. Install it before building the confirmation dialog.

**Contract**: Run `npx shadcn@latest add alert-dialog`. This creates `src/components/ui/alert-dialog.tsx` and adds the `@radix-ui/react-alert-dialog` dependency.

#### 1. Delete API endpoint

**File**: `src/pages/api/batches/[id]/index.ts`

**Intent**: Add a `DELETE` export that deletes a batch by ID. The database handles cascading diary entry deletion via `ON DELETE CASCADE`. Follow the exact same guard/validate/execute/respond pattern as the diary entry DELETE handler.

**Contract**: Export `const DELETE: APIRoute` — null supabase guard, UUID validation on `context.params.id`, `supabase.from("batches").delete().eq("id", id)`, return 204 on success, 500 on error. RLS enforces ownership.

#### 2. Delete confirmation dialog component

**File**: `src/components/batches/DeleteBatchDialog.tsx` (new)

**Intent**: A React component wrapping shadcn/ui AlertDialog that shows the batch name, warns about irreversibility, and calls `DELETE /api/batches/{id}` on confirm. On success, redirects to `/batches`.

**Contract**: Props `{ batchId: string; batchName: string }`. Uses `AlertDialog`, `AlertDialogTrigger` (the delete button), `AlertDialogContent`, `AlertDialogAction` (destructive), `AlertDialogCancel`. The trigger renders a destructive-styled button reading "Delete Batch". On confirm, sends DELETE fetch, then `window.location.href = "/batches"`.

#### 3. Wire dialog into detail page

**File**: `src/pages/batches/[id].astro`

**Intent**: Replace the disabled button block with the `DeleteBatchDialog` React island, passing `batchId` and `batchName`.

**Contract**: Remove lines 30-39 (disabled button div). Add `<DeleteBatchDialog client:load batchId={batch.id} batchName={batch.name} />` in the same location. Import the component.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Delete button is enabled and styled destructively on batch detail page
- Clicking delete shows confirmation dialog with batch name
- Canceling dialog closes it without side effects
- Confirming deletion removes batch, its diary entries, and redirects to `/batches`
- Deleting a batch that doesn't exist or belongs to another user returns 404
- Unauthenticated DELETE request returns 500

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Duplicate via Pre-fill

### Overview

Add the "Duplicate as New" button on the detail page and extend the create page to accept a `?from={batchId}` query parameter for pre-filling the form. After this phase, users can duplicate any batch as a starting point for a new one.

### Changes Required:

#### 1. Extend create page to support pre-fill

**File**: `src/pages/batches/new.astro`

**Intent**: When a `?from={batchId}` query parameter is present, fetch the source batch server-side and pass it as `initialData` to `BatchForm` with `name` and `batch_date` blanked out. If the source batch isn't found or the param is missing, render the normal empty create form.

**Contract**: Read `Astro.url.searchParams.get("from")`. If present and valid UUID, create supabase client, fetch batch by ID. Pass the full `Batch` object as `initialData` with `name` overridden to `""` and `batch_date` to `""` (don't strip fields — `id` and `user_id` are ignored in create mode since POST generates new ones). If fetch fails, fall through to normal create form (no error — graceful degradation). Title changes to "New Batch (from [source name])" when duplicating.

#### 2. Add duplicate button on detail page

**File**: `src/pages/batches/[id].astro`

**Intent**: Add a "Duplicate as New" button next to the delete dialog that navigates to `/batches/new?from={batchId}`.

**Contract**: An `<a>` element styled as a secondary/outline button with href `/batches/new?from={batch.id}`. Placed in the same footer area as the delete button. No React island needed — it's a simple link.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- "Duplicate as New" button is visible on batch detail page
- Clicking it navigates to `/batches/new?from={batchId}`
- Create form is pre-filled with all parameters, ingredients, and sugar values from the source batch
- Name field is blank, date field is blank — user must provide new values
- Submitting the pre-filled form creates a new batch with a fresh diary generated from the process plan
- Visiting `/batches/new` without `?from` still shows a normal empty create form
- If `?from` references a non-existent or another user's batch, the normal empty create form is shown (graceful fallback)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- No existing unit test infrastructure — skip for MVP scope.

### Integration Tests:

- No existing integration test infrastructure — skip for MVP scope.

### Manual Testing Steps:

1. Create a batch with full parameters, ingredients, and diary entries
2. Open batch detail → click "Delete Batch" → cancel → verify nothing changed
3. Click "Delete Batch" → confirm → verify redirect to `/batches`, batch removed from list
4. Open another batch → click "Duplicate as New" → verify pre-filled form
5. Clear and fill name + date → submit → verify new batch created with same parameters/ingredients
6. Verify the new batch has auto-generated diary entries (fresh, not copied)
7. Visit `/batches/new` directly → verify normal empty form
8. Visit `/batches/new?from=nonexistent-uuid` → verify normal empty form (no error)

## Performance Considerations

No performance concerns. DELETE is a single row operation with automatic cascade. Duplicate pre-fill is a single batch fetch on page load.

## References

- Roadmap slice: S-05 in `context/foundation/roadmap.md`
- Existing DELETE pattern: `src/pages/api/batches/[id]/diary/[entryId].ts:48-67`
- Cascade FK: `supabase/migrations/20260530213000_batch_schema_with_rls.sql:53`
- Ingredients migration: `supabase/migrations/20260605220000_ingredients_jsonb_on_batches.sql`
- BatchForm props: `src/components/batches/BatchForm.tsx:17-22`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Delete API + Confirmation UI

#### Automated

- [x] 1.1 Lint passes — aef79cb
- [x] 1.2 Build passes — aef79cb

#### Manual

- [x] 1.3 Delete button enabled and styled destructively on detail page — aef79cb
- [x] 1.4 Confirmation dialog shows batch name and warns about irreversibility — aef79cb
- [x] 1.5 Confirming deletion removes batch and diary entries, redirects to /batches — aef79cb
- [x] 1.6 Cancel closes dialog without side effects — aef79cb
- [x] 1.7 Non-existent or other-user batch returns 404 — aef79cb
- [x] 1.8 Unauthenticated DELETE returns error — aef79cb

### Phase 2: Duplicate via Pre-fill

#### Automated

- [x] 2.1 Lint passes — aef79cb
- [x] 2.2 Build passes — aef79cb

#### Manual

- [x] 2.3 Duplicate button visible on detail page and navigates correctly — aef79cb
- [x] 2.4 Create form pre-filled with parameters and ingredients from source batch — aef79cb
- [x] 2.5 Name and date fields are blank on pre-filled form — aef79cb
- [x] 2.6 Submitting pre-filled form creates new batch with fresh diary — aef79cb
- [x] 2.7 Graceful fallback to empty form when source batch not found — aef79cb
