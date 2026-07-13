# Make batch-list load failures visible Implementation Plan

## Overview

The "My Batches" page silently swallows load failures: `src/pages/batches/index.astro`
(L10–16) destructures only `{ data }` and does `batches = data ?? []`, so a failed
Supabase query renders the **exact same empty state as a brand-new user** — a real
outage is invisible and unlogged.

This plan makes the failure visible by:

1. **Injecting the Supabase client onto `context.locals`** so the existing
   `GET /api/batches` handler's error path becomes injectable and unit-testable
   in-process (the "db access refactor for testability"), then covering it
   red→green.
2. **Wiring the page to that endpoint client-side** so a non-200 response renders
   a distinct error state (inline warning + Retry) instead of the empty state.

## Current State Analysis

- **The list page loads via SSR frontmatter**, querying Supabase directly and
  dropping `error` (`src/pages/batches/index.astro` L10–16). It does **not** use
  the `GET /api/batches` endpoint.
- **`GET /api/batches` already handles errors correctly** (`src/pages/api/batches/index.ts`
  L82–96: logs + returns 500 `Failed to fetch batches`; returns 500
  `Server configuration error` when the client/user is missing) — but the UI never
  calls it, and its error branch is untested.
- **`BatchListPage`** (`src/components/batches/BatchListPage.tsx`) is `client:only`,
  takes `batches: BatchListItem[]`, and shows "No batches yet" when
  `batches.length === 0` — indistinguishable from an error.
- **Test harness:** unit tests are co-located in `src/**/__tests__/`, pure, **no
  mocks** (`vitest.config.ts` excludes `src/__tests__/integration/**` and
  `tests/e2e/**`). The **integration harness spawns the real dev server in a
  separate process against real local Supabase** (`src/__tests__/integration/globalSetup.ts`)
  — it **cannot force a DB fault**, and the audit confirms no request param can
  poison the query. So the DB-error path is only reachable by an **in-process
  unit test**.
- **`astro:env/server` is imported only by `src/lib/supabase.ts` and
  `src/lib/config-status.ts`.** The batches route pulls it _only_ via its
  `createClient` import; removing that import makes the module `astro:env`-free and
  unit-importable.
- **`App.Locals`** (`src/env.d.ts`) currently exposes only `user`.
- **Middleware** (`src/middleware.ts`) already builds the request-scoped client and
  resolves `locals.user`; it just doesn't expose the client.

### Key Discoveries:

- `src/pages/api/batches/index.ts:82-96` — the correct error handling already
  exists on the endpoint; the fix is to make it **injectable + tested** and to
  **consume it from the page**.
- `src/env.d.ts:1-5` — `App.Locals` uses inline `import("@supabase/supabase-js").User`
  typing; mirror that for the client.
- `src/middleware.ts:7` — the client is already created here; expose it on `locals`.
- Existing e2e depends only on the `.astro`-rendered `My Batches` heading and the
  "New Batch" link (Playwright auto-waits), so client-side fetch does not break
  them (`tests/e2e/auth.setup.ts:33`, `tests/e2e/seed.spec.ts:26`).

## Desired End State

- Visiting `/batches` renders `My Batches`, then the island fetches `GET /api/batches`:
  - **success + rows** → the existing card/table list with count + layout toggle;
  - **success + empty** → the existing "No batches yet" state;
  - **failure (non-200 or network error)** → a distinct inline **warning** block
    ("We couldn't load your batches. Please try again.") with a **Try again**
    button that re-runs the fetch.
- `GET /api/batches` reads its client from `context.locals.supabase`; its error
  (500) and success (200) branches are pinned by an in-process unit test that
  injects a fake client. A null client is logged distinctly and returns 500.
- The SSR Supabase query is deleted from `index.astro` — the silent-swallow path
  no longer exists.

Verify: `npm run test` (handler test green), `npm run lint`, `npm run build`; plus
the manual UI checks in each phase.

## What We're NOT Doing

- **No repository layer.** Captured as future work in
  `context/changes/data-access-repository-layer/`. This change only injects the raw
  client onto `locals`.
- **Not migrating other endpoints** (diary, auth, batch `[id]`) off `createClient`.
- **Not narrowing `select("*")`** on the endpoint (over-fetch is acceptable for now).
- **No component or e2e tests** for the UI rendering — verified by review + manual.
- **No SSR self-fetch** and no shared SSR loader — the page consumes the HTTP
  endpoint client-side.

## Implementation Approach

Phase 1 establishes the injectable seam (`locals.supabase`) and the red→green unit
test on the endpoint — self-contained and shippable on its own. Phase 2 rewires the
UI to the endpoint and adds the visible error state. Phase 1 must land first because
Phase 2's error visibility relies on the endpoint's 200/500 contract.

## Critical Implementation Details

- **Remove `createClient` from the _whole_ batches route module, not just GET.**
  `GET` and `POST` share `src/pages/api/batches/index.ts`. If the import remains
  (e.g. POST left untouched), the module still pulls `astro:env/server` and the
  unit test fails to import. Both handlers must read `context.locals.supabase`.
- **Red-first mechanics.** Write the handler test before the refactor. Its initial
  failure is an **import error** (`astro:env/server` unresolved under vitest) plus
  the handler ignoring `locals.supabase`. The fix is to _remove the import_ and read
  `locals.supabase` — do **not** paper over the red by stubbing `astro:env` in the
  vitest config.
- **Middleware gating nuance (misconfig).** `/batches` is a protected route; when
  `locals.user` is null (which is the case when the client is unavailable), the
  middleware redirects `/batches` → `/auth/signin` before the island mounts. So the
  endpoint's 500-on-null-client is exercised mainly via direct API calls / the unit
  test, and the page-level error state is for API failures reachable by an
  authenticated user (a DB fault) — exactly the audited scenario.
- **`client:only` first paint.** `BatchListPage` has no SSR HTML, so the `loading`
  state is the first paint on the island — acceptable for this authenticated
  dashboard.

## Phase 1: Inject Supabase client into `locals` + testable API handler (red→green)

### Overview

Expose the request-scoped Supabase client on `context.locals`, have the batches
route consume it (dropping its `astro:env`-bound import), log a distinct message
when the client is unavailable, and pin the endpoint's error/success/misconfig
branches with an in-process unit test written test-first.

### Changes Required:

#### 1. `App.Locals` type

**File**: `src/env.d.ts`

**Intent**: Expose the request-scoped Supabase client (or null) to routes so
handlers stop importing `createClient` and become injectable/testable.

**Contract**: `App.Locals` gains
`supabase: import("@supabase/supabase-js").SupabaseClient | null` (mirroring the
existing inline-import style used for `user`).

#### 2. Middleware exposes the client

**File**: `src/middleware.ts`

**Intent**: The middleware already builds the client; assign it to
`context.locals.supabase` (in both the present and null cases) so routes read a
single injectable seam. No change to auth resolution or redirect behavior.

**Contract**: After `const supabase = createClient(context.request.headers, context.cookies)`,
set `context.locals.supabase = supabase`.

#### 3. Batches route reads `locals.supabase`

**File**: `src/pages/api/batches/index.ts`

**Intent**: Both `GET` and `POST` consume `context.locals.supabase` instead of
constructing their own client; removing the `@/lib/supabase` import makes this
module `astro:env`-free and unit-importable. Add a distinct server log when the
client is unavailable (the audit's "log the cause").

**Contract**:

- Remove `import { createClient } from "@/lib/supabase"`.
- In both handlers replace
  `const supabase = createClient(context.request.headers, context.cookies)` with
  `const supabase = context.locals.supabase`.
- `GET`: in the `!supabase || !context.locals.user` branch, `console.error(...)` a
  distinct message (e.g. "Failed to fetch batches: Supabase client unavailable")
  before returning `jsonError("Server configuration error", 500)`.
- `POST`: in its identical `!supabase || !context.locals.user` branch,
  `console.error(...)` a distinct message (e.g. "Failed to create batch: Supabase
  client unavailable") before returning `jsonError("Server configuration error", 500)`
  — mirroring GET so a missing client is never silent on either handler.
- Unchanged: the DB-error branch (`console.error("Failed to fetch batches:", error.message)`
  - 500 `Failed to fetch batches`), the success response `jsonOk(data)` (`{ data }`),
    and all other `POST` behavior (validation, diary generation, `jsonCreated`).

#### 4. Handler unit test (write FIRST — the red)

**File**: `src/pages/api/batches/__tests__/index.test.ts` (new)

**Intent**: Pin the `GET /api/batches` contract by injecting a fake
`context.locals.supabase`. Authored before the Phase-1 refactor so it starts red,
then goes green once the module is `astro:env`-free and reads `locals.supabase`.

**Contract**: Import `{ GET }` from `../index`. Provide two helpers and three cases:

```ts
// fake query builder resolving to a Supabase-shaped { data, error }
function fakeQuery(result: { data: unknown; error: unknown }) {
  return { from: () => ({ select: () => ({ order: () => Promise.resolve(result) }) }) };
}
// minimal APIContext with just what GET reads
function makeContext(supabase: unknown, user: unknown = { id: "u1" }) {
  return { locals: { supabase, user } } as unknown as import("astro").APIContext;
}
```

- data present → `GET` returns `status 200`, `await res.json()` deep-equals
  `{ data: [<row>] }`.
- error present (`{ data: null, error: { message: "boom" } }`) → `status 500`,
  body `{ error: "Failed to fetch batches" }`.
- `supabase: null` (user present) → `status 500`, body
  `{ error: "Server configuration error" }`.

Co-located under `src/pages/api/batches/__tests__/` — included by
`vitest.config.ts` (only `src/__tests__/integration/**` and `tests/e2e/**` are
excluded).

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new handler test: `npm run test`
- Linting (type-checked) passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Review confirms `src/pages/api/batches/index.ts` no longer imports
  `@/lib/supabase` and both handlers read `context.locals.supabase`.
- Happy-path endpoint still returns 200 with the user's batches via the existing
  integration smoke test when local Supabase is running:
  `npm run test:integration` (optional — requires `npx supabase start`).

**Implementation Note**: After Phase 1 passes automated verification, pause for
human confirmation of the manual checks before starting Phase 2.

---

## Phase 2: Wire the page to the endpoint + visible error state (UI)

### Overview

Convert `BatchListPage` from prop-driven to fetch-driven with a
loading/error/empty/list state machine and a distinct error block, and reduce
`index.astro` to a thin island host with no Supabase query.

### Changes Required:

#### 1. `BatchListPage` becomes fetch-driven

**File**: `src/components/batches/BatchListPage.tsx`

**Intent**: Fetch `GET /api/batches` on mount and render one of loading / error /
empty / list. A non-OK response or a network error renders the distinct error
state instead of the empty state. If the request is redirected to sign-in (session
lapsed mid-view — the protected route 302s), route there instead of showing the
error state. Preserve the existing layout toggle + count in
the ready state, and keep "+ New Batch" always available.

**Contract**: Drop the `batches` prop. Introduce a state machine and load effect;
map `!res.ok` and thrown errors to the error state:

```ts
type State = { status: "loading" } | { status: "error" } | { status: "ready"; batches: BatchListItem[] };

// on mount + on Retry:
async function load() {
  setState({ status: "loading" });
  try {
    const res = await fetch("/api/batches");
    // Session lapsed mid-view: the protected route 302s /api/batches → /auth/signin,
    // and fetch follows it. Route to sign-in rather than showing a (looping) load error.
    if (res.redirected) return void (window.location.href = res.url);
    if (!res.ok) return setState({ status: "error" });
    const body = (await res.json()) as { data: BatchListItem[] };
    setState({ status: "ready", batches: body.data ?? [] });
  } catch {
    setState({ status: "error" });
  }
}
```

Rendering:

- `loading` → a lightweight indicator (lucide `Loader2` with `animate-spin` + text).
- `error` → an inline block mirroring the empty-state block but with destructive
  styling (e.g. `border-destructive/50 bg-destructive/10 text-destructive`, dashed),
  the copy **"We couldn't load your batches. Please try again."**, and a **Try
  again** button wired to `load()` (reuse the `@/components/ui/button` variants for
  consistency).
- `ready` + empty → the existing "No batches yet" block (unchanged).
- `ready` + rows → the existing `BatchList` / `BatchTable` with the `LayoutToggle`
  (unchanged; `localStorage` layout logic unchanged).
- Header: always render the right-aligned "+ New Batch" link; render the left
  cluster (count + `LayoutToggle`) only in the `ready` state.

Note: the endpoint returns full rows (`select("*")`); the response is read as
`BatchListItem[]` (the list only consumes those fields).

#### 2. `index.astro` drops the SSR query

**File**: `src/pages/batches/index.astro`

**Intent**: The page no longer queries Supabase; it only hosts the self-fetching
island, deleting the silent-swallow SSR loader entirely.

**Contract**: Remove the `createClient` and `BatchListItem` imports, the `supabase`
const, the query, and the `batches` prop. Frontmatter keeps only the `AppLayout`
import and `BatchListPage` import. Body renders `<AppLayout title="My Batches">`,
the `<h1>My Batches</h1>`, and `<BatchListPage client:only="react" />` (no props).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Existing unit tests still pass: `npm run test`

#### Manual Verification:

- **Happy path**: signed-in user with batches → list renders; count is correct and
  the cards/table toggle works.
- **Empty**: user with no batches → "No batches yet" (distinct from the error state).
- **Error**: force a backend failure (e.g. `npx supabase stop`, or a DevTools
  network override returning 500 for `/api/batches`) → the island shows the inline
  warning + **Try again**; Retry re-fetches and recovers once the backend is healthy.
- **Loading**: with network throttling, a brief loading indicator appears then
  resolves.
- **Regression**: existing e2e stays green — `npm run test:e2e` (the `My Batches`
  heading, "New Batch" link, and post-delete list assertions are unaffected).

**Implementation Note**: After Phase 2 passes automated verification, pause for
human confirmation of the manual checks (especially the forced-error state) before
considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `src/pages/api/batches/__tests__/index.test.ts` — `GET` returns 200 with `{ data }`
  on success, 500 `Failed to fetch batches` on a query error, and 500
  `Server configuration error` on a null client, via an injected fake
  `locals.supabase`.

### Integration Tests:

- No new integration test — the real-server harness cannot force a DB fault. The
  existing smoke test (`GET /api/batches` → 200) continues to cover the happy path.

### Manual Testing Steps:

1. Sign in with batches present → verify list + count + toggle.
2. Sign in as a user with no batches → verify the empty state.
3. Stop Supabase (or override the API response to 500) → reload `/batches` → verify
   the inline warning + **Try again**; restart the backend and click Retry → verify
   recovery.
4. Throttle the network → verify the loading indicator.
5. Run `npm run test:e2e` → verify no regressions.

## Performance Considerations

One extra client round-trip on the list page (a brief loading state on first paint)
replaces the previous SSR data prop. Negligible for an authenticated dashboard; the
`select("*")` over-fetch is unchanged and acceptable.

## Migration Notes

No data or schema changes. `locals.supabase` is additive. Other endpoints keep
using `createClient` and are unaffected.

## References

- Seed audit: `context/changes/fail-visible-batch-list/audit.md`
- Companion future work: `context/changes/data-access-repository-layer/change.md`
- Endpoint with existing error handling: `src/pages/api/batches/index.ts:82-96`
- Middleware client creation: `src/middleware.ts:7`
- `App.Locals`: `src/env.d.ts:1-5`
- Empty-state block to mirror: `src/components/batches/BatchListPage.tsx:41-47`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Inject Supabase client into `locals` + testable API handler (red→green)

#### Automated

- [x] 1.1 Unit tests pass, including the new handler test: `npm run test` — f30c8b1
- [x] 1.2 Linting (type-checked) passes: `npm run lint` — f30c8b1
- [x] 1.3 Production build passes: `npm run build` — f30c8b1

#### Manual

- [x] 1.4 Review confirms `src/pages/api/batches/index.ts` no longer imports `@/lib/supabase` and both handlers read `context.locals.supabase`
- [x] 1.5 Happy-path endpoint still returns 200 via `npm run test:integration` (optional — requires local Supabase)

### Phase 2: Wire the page to the endpoint + visible error state (UI)

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 173bcec
- [x] 2.2 Production build passes: `npm run build` — 173bcec
- [x] 2.3 Existing unit tests still pass: `npm run test` — 173bcec

#### Manual

- [x] 2.4 Happy path: list renders with correct count and working cards/table toggle
- [x] 2.5 Empty: new user sees "No batches yet" (distinct from error)
- [x] 2.6 Error: forced backend failure shows the inline warning + Try again; Retry recovers
- [x] 2.7 Loading indicator appears briefly under network throttling
- [x] 2.8 Existing e2e stays green: `npm run test:e2e`
