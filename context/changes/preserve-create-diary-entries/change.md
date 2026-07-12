---
change_id: preserve-create-diary-entries
title: Don't silently lose user-added diary entries on batch creation
status: new
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Seed: [`audit.md`](./audit.md) — the scoped app-layer finding (**F1**) for this
change. Read it first;

**One-line scope:** on `POST /api/batches`, user-added create-mode diary entries
are inserted _after_ the batch is committed; if that insert fails, the error is
swallowed (`console.error`) and the handler still returns `201` — the entries are
lost with no signal. 🔴 High severity, high priority.

**Not reproducible over HTTP** (no zod-valid payload the DB insert rejects), so a
**testability refactor is a prerequisite**: extract batch-create + plan
orchestration out of the handler behind a narrow injectable port
(`DiaryWriter`-style), have it return a discriminated result
(`{ batch, unsavedUserEntries }`) instead of swallowing, then **unit-test** the
failure branch. Doubles as the SRP fix for an overloaded handler.

**Design still open (decide in planning):** proposed = return 2xx + the unsaved
entries in the body so the UI can restore/retry (data never lost); alternatives =
atomic RPC or rollback-on-failure. Must avoid duplicate-batch on retry (batch is
already committed).

**Cross-layer hand-off:** _consuming_ the response body (prefill/retry the form)
is a UI concern → tracked in the `ui-error-surfacing` change. This change's
guarantee is minimal: the entries come back in the response.
