---
change_id: data-access-repository-layer
title: Repository data-access layer for testable, swappable Supabase access
status: new
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Spun out of the `fail-visible-batch-list` planning conversation as deliberate
future work (ADR-style). That change stays targeted and only injects the raw
Supabase **client** onto `context.locals.supabase`; this change builds the
domain **repository** abstraction on top and rolls it out.

### Problem

Data access is hand-rolled with raw Supabase fluent chains
(`supabase.from(...).select(...)...`) scattered across API route handlers. Two
costs:

- **Unhappy-path tests need brittle fluent-chain fakes.** To force a DB error in
  a unit test you must emulate `from().select().order()` returning `{ error }` —
  a fluent mock that breaks whenever the query gains an `.eq()`/`.range()`. This
  is exactly the mock shape the repo otherwise avoids.
- **No reusable seam.** There's no first-class place for DTO mapping, error
  classification, or swapping the data source.

### Proposed pattern (to be validated in research)

A repository layer: a domain **interface** (e.g. `BatchRepository` with
`listBatches()`) plus a production `SupabaseBatchRepository` that wraps the
client. Handlers depend on the repository, not the raw client.

- **Production** uses the real Supabase-backed impl.
- **Unhappy paths** inject a **failing repository** — a clean one-method interface
  stub, no fluent chain — at the in-process unit/handler level.
- **Happy-path HTTP integration** stays as-is: it uses the real impl and never
  touches the seam.

### Findings / constraints (from the fail-visible-batch-list research)

- **`astro:env/server` is imported only by `src/lib/supabase.ts` and
  `src/lib/config-status.ts`.** A route handler becomes astro-free and
  unit-importable in plain vitest the moment it reads the client/repo from
  `context.locals` instead of importing `createClient`. Repository impls should
  take the client via constructor so the interface stays astro-free.
- **The HTTP integration harness cannot force a DB fault.** It spawns the real
  Astro dev server in a _separate process_ against real local Supabase and makes
  real HTTP requests (`src/__tests__/integration/globalSetup.ts`,
  `helpers.ts`). The test process cannot swap anything inside the server, and no
  request param can poison the query. So "inject a failing repository" is
  necessarily an **in-process unit/handler test**, not an HTTP integration test.
- **Prerequisite already delivered by `fail-visible-batch-list`:**
  `context.locals.supabase` (client injection via middleware) + the `App.Locals`
  type entry. This change layers repositories on top of that seam.

### Dovetail

The repository is the natural home for the `classifyDbError` + `logError`
helpers proposed in the `server-error-logging` change. Coordinate the two so the
logging sweep lands inside the repositories rather than in each handler.

### To be established during this change's research + implementation

- **Final shape:** repository returns a discriminated `Result`
  (`{ ok: true; ... } | { ok: false; error }`) vs throwing — pick one and apply
  consistently.
- **Exact repository list:** enumerate every data-access site (batches, diary,
  auth/user, …) and define the corresponding repositories.
- **Rollout:** migrate all identified handlers/pages off raw Supabase chains onto
  the repositories, and add unhappy-path unit coverage where it carries signal.
