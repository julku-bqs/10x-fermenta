# Process Plan Generation & Diary Editing — Implementation Plan Review

## DiaryEntry

Since no measurements are added yet (v2 scope), each diary entry should have also 'notes' field for 'free text' notes. It's visual representation should be under some 'expandable' component, potentially with scrollable area to avoid layout exhaustion.

## Date semantics

`batch_date` shouldn't be null. Batch form should be updated to fill the date by default to 'today'. If user didn't enter the batch date (or cleared it), today should be applied anyway. Migration for existing batches should update all existing NULL batch_dates to `updated_at`. Update the plan in all places that takes batch date NULL into consideration

DB migiration should also add some kind of UPDATE TRIGGER to a diary entry. Each update to entry description or notes should also change the type to 'user' (even if originally it was auto) to prevent future deletion during regeneration, if the entry was modified. Simply, when user edits the entry they are automatically the real owner of it.

## Generated Step Definitions

This section and all open questions will be answered in another review session specifically aout this topic

## Phase 0

Update proposed mockup alternatives with information about 'notes' place in the layout

## Phase 1: Schema Migration + Domain Logic

### Database migration
Also add a column for notes.

### Generation logic module
GenerationInput is incorrect. This must be flexible. GenerationInput should take all batch parameters (preferably bacth object), and most likely calculation result (if available). All these parameters might be useful to make decision about including entry or not.

### Step description constants
Don't need to group by any category. All these are flat per analysis. They are only conditions, so all identified categories are artificial in this case - not real

## Phase 3: UI Implementation
Similar concern: batchParams should get the batch itself and a calculation result if available

### Wire into BatchForm
Contract is incorrect. Basically create/edit modes are the same mode (or almost the same).
'Create mode' shouldn't limit adding diary entries. There will be simply no auto-generated entries yet, but user should be able to add their own - they should be collected locally, and once batch is created, they should be attached to it for persistance (one call to batch create with optional list of diary entries - another RPC should add them atomically, without performing a delete of 'auto'; alternatively some BFF layer could be implemented to handle batcg and diary entry add separately while accepting altogether in a one request)
