# F1 — Create-mode diary entries silently dropped (App layer)

> Scoped excerpt of the app-layer error-handling audit for the
> **preserve-create-diary-entries** change. Parent triage: repo-root
> `error-handling-audit-app.md`.

- **Severity:** 🔴 High **Priority:** High **Decision:** ✅ In scope
- **Layer:** Application (server-side API handler)

## Finding

**File:** `src/pages/api/batches/index.ts` — `POST`, user-entry insert L60–74.

On batch creation, user-added diary entries (typed in create mode) are inserted
**after** the batch is already committed. If that insert fails, `userDiaryError`
is only `console.error`-logged (L71–73) and the handler still returns `201` — the
batch exists but the user's entries are **gone with no signal**. Distinct from the
auto-generated entries, which are _intended_ to be droppable (non-blocking, the
user can regenerate).

**Why it likely ended up this way (design flaw, not just an oversight):** the
batch is inserted and committed at L29–33 _before_ the diary insert runs, so there
is no natural transaction boundary around "batch + its create-mode entries." The
swallow was the path of least resistance given that ordering.

## Design direction (to be decided in planning — ideas, not binding)

- Return a **2xx** whose body flags the failure and echoes the unsaved entries,
  e.g. `{ batch, unsavedUserEntries: [...] }`. The UI can then restore/prefill the
  entries on the now-existing batch and offer a retry — **data is never lost.**
  (Consuming that body is a **UI** concern; handed off to the `ui-error-surfacing`
  change. The app-side guarantee is minimal: _the entries come back in the
  response._)
- Alternatives to weigh: atomic create (batch + user entries in one RPC / Postgres
  function), or roll-back-batch-on-failure. Note the **duplicate risk**: because
  the batch is already committed, a naive client retry of the whole create would
  create a second batch — the chosen design must avoid that.

## Reproduction

**NOT reproducible over HTTP.** Verified against the actual schema — there is **no
zod-valid payload that the `diary_entries` insert rejects**:

- `description` is `text NOT NULL`, **no length cap / no CHECK**; zod already
  enforces `.min(1)`, so an empty description is rejected at validation (→ 400)
  _before_ the insert ever runs.
- `entry_date` (zod `iso.date()` / `""`→today) satisfies `date NOT NULL DEFAULT
CURRENT_DATE`; `entry_type` is hardcoded `"user"` (passes the CHECK); `batch_id`
  is the just-created batch (passes RLS).

So `userDiaryError` only fires on a **genuine infrastructure failure** (DB down /
connection dropped mid-request), which the no-mock integration harness cannot
produce (it runs against a real local Supabase over HTTP; admin client only for
setup/verification). This is _why_ a refactor is a prerequisite for testing it.

## Cheapest test layer — Unit (after the refactor)

Inject a `DiaryWriter` that fails on the user-entry insert and assert the response
still returns the batch **and** echoes `unsavedUserEntries`; a second test asserts
auto-entry failure stays non-blocking. No Supabase, no HTTP. (e2e is a non-starter
— a browser cannot force a DB fault.)

## Testability refactor (drives the change, doubles as the SRP fix)

`generateProcessPlan` is **already pure** (types-only imports — verified), so only
the _persistence_ needs a seam. Extract the create+plan orchestration out of the
handler and depend on a **narrow port**, not the whole client, e.g.:

```ts
interface DiaryWriter {
  insertEntries(rows: DiaryEntryInsert[]): Promise<{ error: DbError | null }>;
}
// service returns a discriminated result instead of swallowing:
type CreateResult = { batch: Batch; unsavedUserEntries: DiaryEntryDraft[] };
```

The handler becomes thin (validate → call service → map result to response). The
current handler violates SRP (auth + parse + validate + batch insert + auto-gen +
user-gen inline); this extraction is worth it independent of testing.

> **Testability seam — PROPOSED (validate during research/planning).** The
> narrow-port-over-repository shape is a proposal, not an accepted decision.
> Planning should confirm the exact seam (narrow port vs. thin repository vs.
> functional injection) and where the extracted service lives (`src/lib/services/`).

## Open questions for planning

- [ ] Which design: {2xx + `unsavedUserEntries` body, atomic RPC,
      rollback-on-failure} — and how to prevent duplicate-batch on retry?
- [ ] Confirm the `DiaryWriter`-style narrow port vs. a broader repository; where
      the extracted service lives.
