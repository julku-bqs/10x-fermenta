# Process Plan Generation & Diary Editing — Plan Brief

> Full plan: `context/changes/process-plan-generation/plan.md`

## What & Why

Implement auto-generated winemaking process diary entries on batch creation, with full CRUD and a regenerate button. This is the final vertical slice (S-03) completing the core planning flow — giving users a structured process plan they can follow, edit, and mark as done, replacing scattered paper notes.

## Starting Point

The `diary_entries` table exists (created in F-01) but is completely unused — no API, no UI, no generation logic. The table has `id`, `batch_id`, `description`, `sort_order`, `created_at`, `updated_at`. The batch detail page has a placeholder "Process diary — coming soon". The inline-edit pattern from IngredientCard and the pure domain logic pattern from sugar-calculation.ts are the established references.

## Desired End State

After batch creation, the user immediately sees a chronological list of auto-generated winemaking process steps (11-16 entries depending on parameters). They can mark steps complete (visual toggle), edit descriptions and dates, add manual entries, delete any entry, and regenerate the plan if they change their process. The diary lives below the ingredients section on the batch detail page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Date handling | Absolute dates, set once on generation | Simplest UX — no surprising date shifts when batch_date changes; user edits manually if needed. | Plan |
| batch_date | Never null (default today, backfill existing) | Guarantees generated diary entries always receive a computed date; simplifies logic. | Review |
| Storage model | Separate diary_entries table (not JSONB) | Diary entries have independent lifecycle from batch, and v2 measurements need a relational parent. | Plan |
| Schema changes | Add entry_date + completed + entry_type + notes; DROP sort_order | Chronological sorting by date replaces premature sort_order; entry_type enables regenerate; notes for free-text. | Plan + Review |
| Ownership promotion | DB trigger promotes auto→user on description/notes edit | Prevents regeneration from deleting entries the user customized; no API-level logic needed. | Review |
| Auto-generation trigger | On batch creation (server-side, before response) | Entries must exist immediately on first view; no manual trigger needed for new batches. | Plan |
| Regenerate behavior | Silently replace auto entries (preserve user/promoted entries) | Atomic via PostgreSQL function; user entries and edited entries are never touched. | Plan |
| Create mode diary | User can add entries locally, persisted with batch creation | No artificial limitation — user may want to plan ahead before batch exists in DB. | Review |
| Entry save model | Each operation saves immediately in edit mode | Diary is independent from batch form state; cancelling batch edits doesn't revert diary. | Plan |
| Process type default | Preselect 'juice' in UI (schema unchanged) | Sensible simplification — juice is the common case; user can still pick pulp. | Plan |
| Generation pattern | Rule-based step builder (flat array + condition predicates) | Simple, testable, extensible — no need for template method or visitor for a flat list. | Plan |
| GenerationInput | Full Batch object + optional calculation result | Flexible — any batch parameter or calculation result can be used in conditions without signature changes. | Review |
| UI approach | Phase 0 mockup exploration before committing | Diary entries are richer than ingredients; need to see real content before picking a layout. | Plan |
| Completed indicator | Icon/background shift (not bare checkbox) | Bare checkbox implies multi-select; visual toggle communicates "done" more clearly. | Plan |
| Sort direction toggle | Client-side only, localStorage-persisted | MVP: 10-15 entries, instant UX on toggle, no pagination needed. Extend to server-side `?sort=` param if entry count grows or multiple consumers emerge. | Plan Review |
| Notes field | Expandable section with scrollable area | Avoids layout exhaustion from long notes; clean collapsed view for entries without notes. | Review |

## Scope

**In scope:**
- Schema migration (new columns incl. notes, drop sort_order, RPC function, ownership promotion trigger)
- batch_date NOT NULL enforcement with backfill migration
- Generation logic with conditional steps based on batch params + calculation result
- CRUD API endpoints (list, create, update, delete) with notes field
- Regenerate endpoint (atomic via PostgreSQL function, respects promoted entries)
- Auto-generation hook in batch creation + optional user diary entries in create payload
- Diary UI section with edit/add/delete/complete + expandable notes
- Process type default to 'juice' + batch_date default to today in form
- Unit tests for generation logic

**Out of scope:**
- Measurements attached to entries (v2)
- Localization (v2 — but constants are extractable)
- Auto-shifting dates on batch_date change
- E2E/Playwright tests
- Batch deletion
- Offline support

## Architecture / Approach

```
BatchForm.tsx → DiarySection.tsx → API endpoints → diary_entries table
                                         ↕
                    generateProcessPlan() (pure domain logic)
                                         ↕
                    regenerate_diary_entries() (PostgreSQL function)
```

Generation logic lives in `src/lib/services/process-plan-generation.ts` as a pure function (same pattern as sugar calculation). The API layer at `src/pages/api/batches/[id]/diary/` handles CRUD. A PostgreSQL function ensures atomic regeneration. The UI section renders inside BatchForm (edit mode only).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 0. UI Exploration | 3 static mockup alternatives → pick winner | Wrong layout choice leads to rework; mitigated by exploring before committing |
| 1. Schema + Logic | Migration + generation module + unit tests | Step conditions/offsets may need adjustment (flagged as open questions for review) |
| 2. API Endpoints | Full CRUD + regenerate + batch creation hook | Atomicity of regenerate (mitigated by PostgreSQL function) |
| 3. UI Implementation | Working diary section wired to API | Integration complexity of independent-save model |
| 4. Polish | Process type default, edge cases, E2E verification | Legacy batches (no entries) need graceful empty state |

**Prerequisites:** S-01 complete (batches exist), diary_entries table exists (F-01)
**Estimated effort:** ~4-5 sessions across 5 phases

## Open Risks & Assumptions

- Phase 0 UI exploration adds a phase but reduces rework risk — if time-pressured, could skip and go with card-based pattern directly
- `SECURITY DEFINER` on the RPC function bypasses RLS — API layer must validate batch ownership before calling

## Success Criteria (Summary)

- Creating a batch auto-generates sensible process diary entries visible immediately
- User can manage diary entries independently (add/edit/delete/complete) without affecting batch state
- Regenerating the plan atomically replaces auto entries while preserving user-added entries
