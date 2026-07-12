# Error Handling Audit — UI Layer

> **Purpose:** Catalog places where a **correct API response reaches the client
> and the UI swallows it** — the failure is not served to the user, and/or not
> even surfaced to the console — so the user is left with no signal (or a
> misleading one) that something failed. This is a living audit and a seed for a
> dedicated 10x change.
>
> **Companion document:** `error-handling-audit-app.md` covers the _other_ layer —
> where server-side application code drops/misclassifies/fails-to-log errors
> before they ever become a response. Findings are split by layer so the two can
> be remediated independently.
>
> **Status:** Draft — gathering context. Not yet actionable as a plan.
> **Last updated:** 2026-07-12
> **Scope of this pass:** `src/` client components (React islands). Server code is
> in the App document.

## Layer boundary (how findings were assigned here)

A finding belongs in **this** (UI) document when the **API/server did its job
correctly** — returned an accurate, well-formed error response (or a network
failure occurred client-side) — and the **client** then failed to route that
outcome to the user. The defining trait: **the information is lost in the
browser, after a valid response (or a legitimate fetch rejection) is available.**

Confirmed for the High finding below: in every reproduction the server returned
a correct, actionable response (`400` with field details, `404` not-found) or the
request legitimately failed at the transport layer. Nothing was wrong
server-side — the loss was purely client-side. (The API-side behaviors those
responses came from are tracked separately in the App document, e.g. M1.)

## How to read this

- **Severity** reflects user-facing impact, not effort to fix.
  - 🔴 **High** — silent data loss or a failure the user believes succeeded.
  - ⚪ **Intentional** — by-design behavior; recorded so we don't "fix" it blindly.
- **Locations** use `path:line` as of the last-updated date. Re-verify before editing.

---

## 🔴 High — client mutations throw into `void` (silent data loss)

**File:** `src/components/batches/diary/DiarySection.tsx`

Three `async` handlers `throw` on a failed response, but each is invoked through
the `void` operator, so the rejection becomes an **unhandled promise rejection**
with **no user feedback** and no UI recovery. The handlers _correctly detect_ the
failure (`if (!res.ok) throw …`) — the response is good — but the throw is
discarded at the call site, so the server's error never reaches the user.

| Handler        | Throws at                             | Invoked (swallowed) at                                          | Effect on failure                                                       |
| -------------- | ------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `handleEdit`   | L94–106 (`"Failed to update entry"`)  | L236 `onEdit={(updates) => void handleEdit(entry.id, updates)}` | Editor closes as if saved; value silently reverts (perceived data loss) |
| `handleDelete` | L108–115 (`"Failed to delete entry"`) | L237 `onDelete={() => void handleDelete(entry.id)}`             | Row stays; no error shown                                               |
| `handleAdd`    | L117–130 (`"Failed to add entry"`)    | L265 `onAdd={(entry) => void handleAdd(entry)}`                 | Entry never appears; no error shown                                     |

**Why edit is worst:** `EntryRow.handleSave` (`src/components/batches/diary/EntryRow.tsx`
L33–42) closes the editor immediately. The row only re-renders the new value when
parent `entries` state updates, which happens **only on success** (`DiarySection.tsx`
L105). On failure the editor closes and the row reverts to the old prop value with
no signal.

**Inconsistency (reference for the fix — and proof this is UI, not API):** the
other two handlers in the same file, hitting the same kind of endpoints, **do**
handle errors correctly:

- `handleToggleComplete` (L77–92) — optimistic update + rollback.
- `handleRegenerate` (L132–149) — `try/catch` + `setError(...)`.

Same backend, same response semantics — only the client handling differs. If the
API were the culprit, the correctly-behaving handlers would fail too.

**Direction (not final):** give edit/delete/add the same treatment — surface a
user-visible error (toast/inline) and/or roll back optimistic state (or refetch).
Decide on a consistent error-surface primitive for the diary section.

### ✅ Reproduced (2026-07-12, via `playwright-cli` against local dev server, no DB tampering)

Two independent triggers were confirmed end-to-end in the browser:

**Trigger A — validation 400 (pure app logic, no infra fault).**
Preconditions: signed-in user on a batch **edit** page with ≥1 diary entry.
Steps: click **Edit** on an entry → clear the description → click **Save**.

- `EntryRow.handleSave` sends `description: ""` with **no client-side guard**
  (unlike `AddEntryForm`, which guards `if (!desc.trim()) return`).
- Server responds `400` (correctly): `{"error":"Validation failed","details":{"description":["Description is required"]}}`
  (`updateDiaryEntrySchema` keeps `description.min(1)` even when `.partial()`).
- Observed: **uncaught** `Error: Failed to update entry at handleEdit
(DiarySection.tsx:84)`; the inline editor **closed as if saved**; the row
  **silently reverted** to the old text; **no error shown to the user**. The
  well-formed `400` body (with the exact field message the UI would need) was
  discarded.

**Trigger B — network/transport failure (the concurrency/offline angle).**
Preconditions: same edit page; browser set **offline**.
Steps: open an entry editor → click **✕ Delete**.

- `DELETE …/diary/{id}` fails `net::ERR_INTERNET_DISCONNECTED` (legitimate
  client-side transport failure — request never reached the server).
- Observed: **uncaught** `TypeError: Failed to fetch at handleDelete
(DiarySection.tsx:89) → onDelete (DiarySection.tsx:271)`; entry **remained**
  in the list (count unchanged 0/11); **no error shown to the user**.

Same class of failure applies to `handleAdd` (POST) on a transport error, and to
`handleEdit`/`handleDelete` under **concurrency** (see the two-tab probe below).

Repro environment note: local Supabase has email confirmation disabled, so a
fresh sign-up yields an active session immediately (no `.single()`/admin access
or direct DB writes were used to reproduce).

### 🔬 Two-tab concurrency probe (2026-07-12, `playwright-cli`, two tabs on the same batch)

Question investigated: _"Open the same batch in 2 tabs and delete the same entry
from both — what happens?"_ The answer splits by which operation the second tab
performs.

**Case 1 — delete + delete (same entry): ACCEPTED. Idempotent, no error.**

- Tab 0 deletes entry X → `204`, removed from tab 0's list.
- Tab 1 (stale) deletes the same entry X → **also `204 No Content`, 0 console errors.**
- The idempotent DELETE endpoint behavior is **accepted** (tracked in the App
  document under ⚪ Intentional). **Not a UI finding** — nothing was swallowed.

**Case 2 — delete (tab 0) + edit (tab 1) same entry: IS the swallowed error (worse).**

- Tab 0 deletes entry `e9faa36e` (Pitch yeast) → `204`.
- Tab 1 (stale) edits that entry with a **valid** new description → `PUT` →
  **`404 Not Found`** `{"error":"Diary entry not found"}` (a correct response;
  the server-side `error || !data → 404` behavior itself is App-doc M1).
- Observed: **uncaught** `Error: Failed to update entry` (`DiarySection.tsx:84`);
  editor **closed as if saved**; **no error shown**.
- **UI end state (the key question): the STALE value STAYED on the list.** The
  entry remained visible showing its old text ("Pitch yeast"); the typed edit
  ("edited in tab 2") was discarded. It did **not** disappear from the list.
  Mechanism: `handleEdit` throws _before_ `setEntries` (L105), so React `entries`
  state is untouched — the entry object keeps its old value — while
  `EntryRow.handleSave` already called `setEditing(false)`, closing the editor.
  The row re-renders with the stale prop value and stays put. The entry only
  vanishes on a **full reload/refetch**, where the server (source of truth)
  reports it deleted. So the user sees a stale, still-present row that silently
  becomes a _disappearing_ row after refresh — data-loss perception strictly
  worse than Case 1.

**Takeaway for remediation:** the swallowed-error fix (surface a user-visible
error + roll back / refetch on `!res.ok`) covers Case 2. Case 1 needs no change.

---

## ⚪ Intentional / not bugs (recorded so we don't "fix" blindly)

- **Masonry CSS "silently ignored"** — `src/components/batches/BatchList.tsx`
  L73. `grid-template-rows:masonry` works in Firefox, is silently ignored
  elsewhere. Documented, cosmetic, cross-browser — not an error-handling defect.

---

## Cross-cutting patterns (UI layer)

1. **`void asyncFn()` on the client** discards rejections → no feedback. Audit
   **every** `void handleX()` call site for a handled failure path, not just the
   diary section.
2. **No shared client error-surface primitive** — correct handlers
   (`handleToggleComplete`, `handleRegenerate`) each roll their own `setError` /
   rollback; the broken ones do nothing. A reusable mutation wrapper (surface +
   rollback/refetch) would make the correct path the default.

---

## Context to add (placeholders for the next pass)

<!-- Extend below with product/ops context before turning this into a change. -->

- [ ] Do we want user-facing error surfaces standardized (toast vs inline)?
- [ ] On a failed mutation, prefer **optimistic rollback** or **refetch** to
      reconcile with server truth (esp. the Case 2 stale-row scenario)?
- [ ] Should unhandled promise rejections be caught globally (e.g. a
      `window.onunhandledrejection` reporter) as a safety net?
- [ ] Any additional UI `void`-swallow sites discovered outside the diary section.

## Remediation seed (rough, non-binding)

- Standardize a client mutation-error surface for the diary section and reuse it.
- Wrap the three unguarded handlers (`handleEdit`/`handleDelete`/`handleAdd`) in
  `try/catch` that surfaces the error and rolls back / refetches, mirroring
  `handleToggleComplete` and `handleRegenerate`.
- Sweep all `void handleX()` call sites app-wide for missing failure paths.
