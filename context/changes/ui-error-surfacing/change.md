---
change_id: ui-error-surfacing
title: Surface swallowed API errors in the UI (client mutations throwing into void)
status: new
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Seed for this change is the UI-layer error-handling audit that lives alongside
this file: [`error-handling-audit-ui.md`](./error-handling-audit-ui.md). Read it
first — it is the source of truth for scope, findings, and reproduction evidence.

**One-line scope:** the API/server returns correct error responses; the **client**
swallows them (no user feedback, often not even a console-handled path). Root
cause confirmed as the UI layer.

Headline finding (🔴 High): `src/components/batches/diary/DiarySection.tsx` —
`handleEdit` / `handleDelete` / `handleAdd` `throw` on `!res.ok` but are invoked
via `void`, producing unhandled rejections with silent data loss. Reproduced via
`playwright-cli` (validation-400, offline-transport, and a two-tab concurrency
probe where a stale row stays on the list). Correct counterexamples in the same
file: `handleToggleComplete`, `handleRegenerate`.

Companion audit for the _other_ layer (server-side swallowing) stays in the repo
root as `error-handling-audit-app.md` and is being handled separately — **out of
scope for this change**.
