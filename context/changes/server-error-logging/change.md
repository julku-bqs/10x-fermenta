---
change_id: server-error-logging
title: Consistent server-side error logging + DB-error classification
status: new
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Seed: [`audit.md`](./audit.md) — the scoped app-layer findings (**M3**, with
**M1** folded in as log-only) for this change. Read it first;

**One-line scope:** only `src/pages/api/batches/index.ts` currently logs; other
handlers return a generic `500` with the cause lost for ops. Introduce a shared
`logError` helper and a pure `classifyDbError` unit, and sweep the log-only sites.
🟡 Low severity, low priority.

**Standalone & non-blocking:** this is **NOT a dependency** of the
`preserve-create-diary-entries` or `fail-visible-batch-list` changes — they log
inline as needed and land independently. This change is a later cleanup sweep.

**M1 folded in (log-only):** `error || !data → 404` masking stays as **404**
(acceptable, and forward-compatible with future slug lookups) — the only fix is to
**log the discarded error** in the 404 branch. Converting to 500 is a stretch
goal, not the point.
