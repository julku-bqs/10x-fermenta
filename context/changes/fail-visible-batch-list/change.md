---
change_id: fail-visible-batch-list
title: Make batch-list load failures visible instead of an empty state
status: new
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Seed: [`audit.md`](./audit.md) — the scoped app-layer finding (**M2**) for this
change. Read it first;

**One-line scope:** the "My Batches" SSR loader
(`src/pages/batches/index.astro` L10–16) destructures only `{ data }` and does
`batches = data ?? []`, so a failed query renders the **same empty state as a
brand-new user** — a real outage is invisible and unlogged. 🟠 Medium, narrow scope.

**Direction:** capture `error`; render a distinct warning/error state in the empty
"My Batches" area; log the cause.

**Testability:** extract the loader into a pure `.ts` module returning a
discriminated result (`{ status: "ok"; batches } | { status: "error" }`) and
**unit-test** both branches with a fake query builder. The repo has **no component
test harness**, so the warning-vs-new-user rendering is verified by review, not an
automated test.
