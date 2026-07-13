# Make batch-list load failures visible — Plan Brief

> Full plan: `context/changes/fail-visible-batch-list/plan.md`
> Seed audit: `context/changes/fail-visible-batch-list/audit.md`

## What & Why

The "My Batches" page silently swallows load failures: its SSR loader keeps only
`{ data }` and does `batches = data ?? []`, so a failed query renders the **same
empty state as a brand-new user** — a real outage is invisible and unlogged. We
make the failure visible and log its cause.

## Starting Point

`src/pages/batches/index.astro` queries Supabase directly in SSR frontmatter and
drops `error`. A correct `GET /api/batches` endpoint already exists (logs + 500 on
error) but the UI never calls it and its error branch is untested. `BatchListPage`
is a `client:only` island that shows "No batches yet" for an empty array.

## Desired End State

Visiting `/batches` renders the heading, then the island fetches `GET /api/batches`
and shows one of: the list (with count + card/table toggle), the "No batches yet"
empty state, or — on a non-200/network error — a distinct inline **warning**
("We couldn't load your batches. Please try again.") with a **Try again** button.
The endpoint reads its client from `context.locals.supabase`, logs a null client
distinctly, and has its 200/500 branches pinned by an in-process unit test. The
silent-swallow SSR query is deleted.

## Key Decisions Made

| Decision                | Choice                                                           | Why (1 sentence)                                                                                          | Source       |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| Page ↔ endpoint wiring  | Client-side fetch from the `client:only` island                  | Literally wires the existing endpoint, reuses its 200/500 handling, and deletes the swallowing SSR query  | Plan         |
| Data-access seam        | Inject the Supabase **client** onto `context.locals`             | Smallest, idiomatic (locals already holds `user`), makes the handler `astro:env`-free and unit-importable | Plan         |
| Repository pattern      | Deferred to a separate change                                    | Keep this change targeted; final shape + repo list belongs in its own research                            | Plan         |
| DB-error test layer     | In-process unit test of the `GET` handler (inject a fake client) | The HTTP integration harness (separate process, real Supabase) cannot force a DB fault                    | Plan / Audit |
| Error-state UX          | Inline warning block + "Try again" (re-fetch)                    | Honest + actionable, mirrors the existing empty-state block                                               | Plan         |
| Misconfig (null client) | Same error path, logged distinctly, returns 500                  | Consistent "fail visible" behavior; disambiguated in logs                                                 | Plan         |
| UI rendering coverage   | Verify by review + manual (no component/e2e test)                | Matches the audit and the "excludes e2e" boundary; no new harness                                         | Plan / Audit |

## Scope

**In scope:**

- Expose `context.locals.supabase` (type + middleware).
- `GET`/`POST` in `src/pages/api/batches/index.ts` read `locals.supabase`; drop the `createClient` import; log a null client distinctly.
- Red→green unit test on the `GET` handler (200 / 500-error / 500-null).
- `BatchListPage` fetch-driven with loading/error/empty/list + Retry.
- `index.astro` reduced to a thin island host.

**Out of scope:**

- Repository layer (→ `data-access-repository-layer` change).
- Migrating other endpoints off `createClient`; narrowing `select("*")`.
- Component or e2e tests for the UI rendering.

## Architecture / Approach

Middleware already builds the request-scoped client; it now stashes it on
`locals.supabase`. The batches route consumes that (becoming `astro:env`-free, so a
plain vitest test can inject a fake client and assert the 200/500 contract). The
page stops querying Supabase; the React island fetches `GET /api/batches` and maps
`ok → list/empty`, `!ok/throw → error`.

## Phases at a Glance

| Phase                               | What it delivers                                                             | Key risk                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Inject client + testable handler | `locals.supabase`, route refactor, red→green handler unit test               | Import must be fully removed from the route module (GET **and** POST) or `astro:env` breaks the test |
| 2. Wire page + visible error state  | Fetch-driven `BatchListPage` (loading/error/empty/list) + thin `index.astro` | Loading flash on first paint; must not regress existing e2e                                          |

**Prerequisites:** none (additive `locals` field; no schema/data changes).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- The endpoint's real-query error branch stays un-forceable in HTTP integration by
  design — covered at the unit level instead.
- A fully misconfigured server redirects `/batches` → `/auth/signin` at the
  middleware, so the page-level error state targets DB faults reachable by an
  authenticated user (the audited scenario); the null-client 500 is covered by the
  unit test.
- Existing e2e relies only on the `.astro` heading + the "New Batch" link
  (Playwright auto-waits), so client-side fetch should not regress them.

## Success Criteria (Summary)

- A load failure shows a distinct, logged error state with a working **Try again** —
  never the new-user empty state.
- New users still see "No batches yet"; users with batches still see their list.
- `npm run test` (incl. the new handler test), `npm run lint`, and `npm run build`
  all pass.
