# M3 (+ M1 folded) — Server logging + DB-error classification (App layer)

> Scoped excerpt of the app-layer error-handling audit for the
> **server-error-logging** change. Parent triage: repo-root
> `error-handling-audit-app.md`.

- **Severity:** 🟡 Low **Priority:** Low **Decision:** ✅ In scope (standalone, non-blocking)
- **Layer:** Application (API handlers)

## Finding (M3) — missing/inconsistent logging

Only `src/pages/api/batches/index.ts` currently calls `console.error`. Every other
handler returns a generic `500` without logging the underlying Supabase error, so
the client sees a message but the cause is lost for ops/debugging.

Log-only error sites to sweep:

- `src/pages/api/batches/[id]/index.ts` — DELETE L74
- `src/pages/api/batches/[id]/diary/index.ts` — GET L26, POST L68
- `src/pages/api/batches/[id]/diary/[entryId].ts` — DELETE L62
- `src/pages/api/batches/[id]/diary/regenerate.ts` — rpc L37, fetch L49

**Standalone & non-blocking:** NOT a dependency of the other app-layer changes —
they log inline as needed and land independently; this is a later sweep.

## Finding (M1, folded in — log-only)

`if (error || !data) return 404` collapses genuine DB failures into "not found" at:

- `src/pages/api/batches/[id]/index.ts` — GET L21–23, PUT L54–56
- `src/pages/api/batches/[id]/diary/[entryId].ts` — PUT L41–43
- `src/pages/api/batches/[id]/diary/regenerate.ts` — batch fetch L24–26

- **Decision:** keeping **404 is acceptable** (imprecise but not harmful — and
  forward-compatible: when batches can be fetched by slug, a non-UUID string param
  is a legitimate "not found", not an error). We do **not** need to convert these
  to 500. The only defect worth fixing is that the real `error` is **discarded
  unlogged** → **add logging in the 404 branch.** Returning 500 for genuine infra
  errors is a stretch goal, not the point.
- Note: the earlier "invalid-UUID → 404" idea is _already the correct output_ (a
  non-existent batch → 404), so it is **not** a reproducible bug — it's expected.

## Direction

- Shared `logError(scope, error)` helper (alongside `src/lib/api.ts`); replace
  scattered `console.error`s.
- A **pure** `classifyDbError(error)` (`PGRST116` / `22P02`-family → not-found;
  else → server-error) — the one genuinely unit-testable unit here; it's exactly
  what an M1 refinement would consume.

## Reproduction

Ops-only, not user-facing.

## Cheapest test layer — Unit

**Unit** for `classifyDbError` (pure). Logging itself is low-value to unit-test
(log-spy) — verify by review.

## Open questions for planning

- [ ] Logging target on Cloudflare Workers — is `console.error` enough, or do we
      need structured logging / an external sink?
