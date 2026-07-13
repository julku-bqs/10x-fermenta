# M2 — Empty-list-on-error, batches SSR loader (App layer)

> Scoped excerpt of the app-layer error-handling audit for the
> **fail-visible-batch-list** change. Parent triage: repo-root
> `error-handling-audit-app.md`.

- **Severity:** 🟠 Medium **Priority:** Medium **Decision:** ✅ In scope
- **Layer:** Application (Astro SSR page frontmatter)

## Finding

**File:** `src/pages/batches/index.astro` L10–16.

The loader destructures only `{ data }` and does `batches = data ?? []`, dropping
`error`. A failed query renders the **same empty state as a brand-new user** — a
real outage is invisible and unlogged.

## Direction

Capture `error`; render a distinct **warning/error state** in the "My Batches"
empty area (e.g. "We couldn't load your batches — try again") rather than the
new-user empty state; log the cause.

## Reproduction

Not cleanly end-user reproducible — no request param can poison this query; it
needs a DB fault the no-mock integration harness cannot produce. Testable via a
**fake query builder** once the loader is extracted.

## Cheapest test layer — Unit

No component tests (the repo has none) and no e2e. Astro frontmatter is
effectively unit-untestable inline, so:

- Extract a pure loader into a `.ts` module returning a **discriminated result**:
  `{ status: "ok"; batches } | { status: "error" }` — unit-test both branches with
  a fake query builder that returns `{ data }` vs `{ error }`. This is the covered
  seam.
- Keep the `.astro` a thin caller; pass the status down as a prop.
- The warning-vs-new-user rendering in `BatchListPage` (distinguishing
  empty-because-error from empty-because-new) is **not** covered by an automated
  test — verify by review. (Revisit only if component testing is later adopted.)

> **Testability seam — PROPOSED (validate during research/planning).** Extracting
> the loader behind a fake-able query builder is the proposed seam; planning
> should confirm the exact shape.

## Open questions for planning

- [ ] Exact copy/UX for the error state in the empty "My Batches" area.
