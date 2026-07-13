---
date: 2026-07-11T10:19:06+02:00
researcher: Julian Kujawski
git_commit: a51cbb5de20c1ef61e62bcd4fd7ae2e01a7abbe2
branch: e2e
repository: julku-bqs/10x-fermenta
topic: "E2E (Playwright) coverage for risks #2 (validation warnings), #3 (regenerate diary plan), #7 (save/cancel/reload + ingredient drag-reorder)"
tags: [research, codebase, e2e, playwright, test-plan, validation-warnings, diary-regenerate, drag-reorder, batch-form]
status: complete
last_updated: 2026-07-11
last_updated_by: Julian Kujawski
last_updated_note: "Resolved the three open questions — DOM-only oracle for Risk #3 (no DB assertions), logged-in-user seeding for Risk #2 (no service account), beforeunload scope confirmed."
---

# Research: E2E coverage for risks #2, #3, #7

**Date**: 2026-07-11T10:19:06+02:00
**Researcher**: Julian Kujawski
**Git Commit**: a51cbb5de20c1ef61e62bcd4fd7ae2e01a7abbe2
**Branch**: e2e
**Repository**: julku-bqs/10x-fermenta

## Research Question

The test-plan refresh (`context/foundation/test-plan.md`) adds Playwright E2E coverage for three risks that assert **behavioral UI wiring** (never pixels). Ground each risk in the live code so the downstream plan (`/10x-plan`) and the specs (`/10x-e2e`) encode the TRUE behavior:

- **Risk #2 (Validation warnings):** E2E proves the warning IS displayed when a plan is inconsistent, Dismiss closes it, and it REAPPEARS after refresh (dismissal is not persistent). Not which warnings fire (unit's job).
- **Risk #3 (Regenerate diary plan):** After Regenerate, what is removed vs preserved? Confirm against the `regenerate_diary_entries` RPC and align with `expose-step-key`'s stated intent to "preserve user edits to non-auto entries." Confirm date ordering and the save-first / dirty-guard assumption.
- **Risk #7 (save/cancel/reload, extended):** (a) sugar fields Calculate→form-state→save→reload preserves value + beforeunload dirty-guard on Cancel; (b) ingredient drag-reorder preserved after save+reload, reverted after cancel.

## Summary

All three risks are groundable and E2E-authorable. Research established the **target behavior** for each below, grounded in live code so the plan and specs encode the TRUE behavior:

1. **Risk #3 preserve/remove — verified against the RPC.** The RPC deletes and rebuilds **`auto`** entries and leaves **`user`** entries untouched. TRUE target behavior: regenerate **preserves user entries** and **wipes+rebuilds auto entries** (resetting `completed → false`), matching `expose-step-key`. `change.md`'s Risk #3 bullet states this behavior.
2. **Risk #3 dirty-guard is NOT implemented.** The `regenerate-dirty-guard` change is `status: proposed`, not in code. `DiarySection` has no `isDirty` prop; Regenerate is only `disabled={regenerating}`. The test still saves first (regenerate reads **persisted** params from the DB, so a dirty form's edits are silently ignored), but there is **no disabled-when-dirty state to assert** yet.
3. **`entry_type` ('auto'/'user') is invisible in the DOM.** No badge, label, or `data-*`. An E2E test cannot read an entry's type directly — it must infer preserve/wipe via **description text** and **completed styling** (line-through). Concrete oracle described under Risk #3.

Two secondary cautions:

- **Risk #2:** warnings only initialize in **edit mode from `initialData`** — the spec needs a **pre-existing inconsistent batch**. And any form **blur resets `warningsDismissed`**, so after Dismiss the assertion must be a **reload**, not a field interaction.
- **Risk #7a:** the native **`beforeunload` dialog is fragile to assert** in Playwright (auto-dismissed; `page.on('dialog')` is unreliable for beforeunload). Prefer asserting the **persistence signal** (dirty edit → navigate away → reload → value not persisted) and treat the dialog itself as a low-confidence / optional check.

## Detailed Findings

### Risk #2 — Validation warnings (display / dismiss / non-persistence)

**Where warnings come from.** `BatchForm` computes warnings only in edit mode from server-provided `initialData`:

- `BatchForm.tsx:82-97` — `useState<ValidationWarning[]>` initializer: `if (mode !== "edit" || !initialData) return []`, else `computeWarnings(...)`. **Create mode starts with zero warnings.** → the spec must open an **existing batch whose saved params are inconsistent** (e.g. target ABV above the selected yeast's alcohol tolerance). **Seed this batch as the logged-in user** (via the app's own create flow — UI or `POST /api/batches` under the `storageState` session), **never** via a service-role/admin DB write. See Decision #2.
- `ValidationWarnings.tsx` — presentational. Renders a list of warning messages and an optional Dismiss button; **no localStorage, no persistence.** Dismiss button at `ValidationWarnings.tsx:59-68` calls the optional `onDismiss` callback.

**Dismiss wiring.**

- `BatchForm.tsx:98` — `const [warningsDismissed, setWarningsDismissed] = useState(false)`.
- `BatchForm.tsx:247` — render guard: `{!warningsDismissed && warnings.length > 0 && <ValidationWarnings ... onDismiss={...} />}` (wrapper hides the block).
- `BatchForm.tsx:250-252` — `onDismiss={() => setWarningsDismissed(true)}`.

**Non-persistence (the core Risk #2 oracle).** On reload the page is SSR-rendered and `BatchForm` re-initializes `warnings` from `initialData` and `warningsDismissed` back to `false`, so the warning **reappears**. This is the assertion: display → Dismiss hides → **reload → warning visible again**.

**GOTCHA — blur resets dismissal.** `BatchForm.tsx:152-155` `handleBlur` sets `warningsDismissed = false` and recomputes warnings on ANY field blur. So after clicking Dismiss, **do not blur/interact with a form field** before asserting "hidden" — and use **reload** (not an edit) as the reappearance trigger. A stray blur would make the warning reappear immediately and confuse the oracle.

**Locators.** The dismiss control should be reachable via `getByRole('button', { name: /dismiss/i })`; warning text via `getByText(...)` / `getByRole('alert')` depending on the rendered element (verify the exact role/text in `ValidationWarnings.tsx` when authoring).

### Risk #3 — Regenerate diary plan (preserve vs wipe) — **framing corrected**

**Ground truth: the RPC.** `supabase/migrations/20260614130000_diary_entries_process_plan.sql`:

- **Regenerate** — `regenerate_diary_entries(p_batch_id)` at lines **47-61**: `DELETE FROM diary_entries WHERE batch_id = p_batch_id AND entry_type = 'auto';` then re-inserts a fresh set of `auto` entries (from the recomputed process plan) with `completed = false`. **`user` entries are never touched.**
- **Promotion** — trigger `promote_diary_entry_type` at lines **29-44**: an `auto` entry is promoted to `user` **only when `description` or `notes` changes** (the comment intentionally EXCLUDES `entry_date` and `completed`). So:
  - User **edits an auto entry's description/notes** → it becomes `user` → **survives** regenerate.
  - User only **toggles completed** or **changes the date** of an auto entry → stays `auto` → **wiped & rebuilt** (completed reset to false).
  - User **adds their own entry** → it is `user` → **survives** regenerate.

**Target behavior statement (use this in §2 and the spec):**

> Regenerate **preserves `user` entries** (both manually-added and former-auto entries the user edited) and **deletes + rebuilds `auto` entries**, resetting their `completed` flag to false. It does NOT remove user-added entries.

(Confirmed by the user on 2026-07-11.)

**Route + ordering.** `regenerate.ts` (the `POST .../diary/regenerate` handler) delegates to the RPC, then re-fetches entries ordered **`entry_date ASC, created_at ASC`** (regenerate.ts:46-47). Regenerate reads the batch's **persisted** params from the DB — it does not receive the dirty form's values — so the E2E must **save the form first** for changed params to take effect.

**UI does its OWN client sort.** `DiarySection.tsx:20-31` — `getSortOrder()` reads `localStorage["fermenta:diary-sort-order"]`, defaulting to `"asc"`; `sortEntries()` sorts by `entry_date` then `created_at`. A fresh Playwright context has empty localStorage → **deterministic ascending order that matches the API order.** There is a sort toggle (ArrowDownUp) that can flip it, so if the test asserts order, either rely on the default asc or explicitly control the toggle.

**Regenerate button.** `DiarySection.tsx:202-212` — rendered only in edit mode; label is `"Generate Plan"` when `entries.length === 0` else `"Regenerate"`; `disabled={regenerating}` only. **No confirmation dialog, no dirty-guard, no page reload** — `handleRegenerate` (~132-149) calls the API and `setEntries(...)` in place. Locator: `getByRole('button', { name: /Regenerate|Generate Plan/i })`.

**CORRECTION — dirty-guard unimplemented.** `regenerate-dirty-guard` is `status: proposed`. `DiarySection` takes no `isDirty` prop today. So the change.md assumption "Regenerate is gated on a saved (non-dirty) form — save first" describes a **future** guard. Currently, regenerating with a dirty form silently uses the old **persisted** params (the exact bug the guard will prevent). The test should still save first (so params are persisted), but it **cannot assert a disabled-when-dirty button** — that state does not exist yet.

Note the nuance: a **form-wide** dirty guard DOES exist — `isDirtyRef` + the `beforeunload` handler (`BatchForm.tsx:120-135`) prompt when any field, **including batch parameters**, is dirty on navigation. Batch parameters ARE dirty-guarded (via beforeunload); the **regenerate action** just isn't wired to that dirtiness. So the accurate statement is "regenerate ignores form dirtiness," not "the form has no dirty guard."

**TESTABILITY GAP — entry_type not in DOM.** `EntryRow` receives only `{ description, entry_date, notes, completed }` (`DiarySection.tsx:226-238`) — **no `entry_type`** badge/label/attribute. The test cannot read an entry's type. Author the oracle purely from DOM-observable signals:

1. **User-added entry preserved:** add a diary entry with a **unique description** (e.g. `E2E user note <timestamp>`) → Save → Regenerate → assert `getByText('E2E user note <timestamp>')` **still visible**.
2. **User-edited auto entry preserved (promotion):** edit an existing auto entry's **description** to a unique marker → Save → Regenerate → assert the marker **still visible** (it was promoted to `user`).
3. **Auto entry wiped/rebuilt:** pick an auto entry by its **known generated description**, toggle it complete (observe line-through / checked state) → Regenerate → assert that entry is **back to not-completed** (regenerated auto entries have `completed = false`). (Because the same descriptions are regenerated, the not-completed reset is the observable wipe signal.)

This DOM-only oracle is the accepted approach — auto vs user is distinguished purely by **description** (unique markers for user/promoted entries; known generated text for auto entries) plus **completed styling**. No DB-level assertions (see Decision #1).

Assert ordering (optional) via the rendered entry-date sequence being ascending under the default sort.

### Risk #7a — Sugar fields Calculate → save → reload; Cancel dirty-guard

**Sugar fields are form-state strings** driven by the Calculate action inside `IngredientsSection`, propagated up via `onBatchChange`:

- `BatchForm.tsx:427-442` — `onBatchChange` merges ingredient/param changes (including computed sugar fields) into form state and flips the dirty ref.
- Save = `PUT /api/batches/{id}` in `handleSubmit` (`BatchForm.tsx:157-227`); on success it resets `initialValues` and `isDirtyRef.current = false` (`~213-215`). → reload shows the persisted value.

**Cancel = navigation, not state restore.** `BatchForm.tsx:262-264` and `:475-477` — Cancel is a plain `<a href="/batches">`. There is no in-memory "restore". "Reverted after cancel" therefore means: change a field (don't save) → click Cancel → land on `/batches` → reopen the batch → the field shows the **last-saved** value (the unsaved edit was discarded).

**`beforeunload` dirty-guard — native browser dialog, assert with caution.** `BatchForm.tsx:127-137` — a `beforeunload` handler calls `e.preventDefault()` only when `isDirtyRef.current`. This triggers the **browser's own native "Leave site?" dialog** — there is NO custom message and NO React modal for unsaved changes. Verified:

- Codebase search for `unsaved|discard|are you sure|leave page|confirm navigation` → **zero matches**. No React "discard changes" dialog exists.
- No Astro `ClientRouter`/`ViewTransitions` anywhere in `src/` → the Cancel `<a href="/batches">` is a **hard navigation** (full unload), so while dirty it DOES trigger the native `beforeunload` dialog (not just reload/tab-close).
- The ONLY React `AlertDialog` in the batches area is `DeleteBatchDialog.tsx` (delete-batch confirmation) — a **separate flow**, not the unsaved-changes guard. Do not conflate the two: delete = React `alertdialog` (assertable via `getByRole('alertdialog')`, as seed.spec.ts does); cancel/unsaved-changes = native `beforeunload` (not a React component).

**Testability caution:** native `beforeunload` prompts are unreliable in Playwright — headless Chromium commonly suppresses them and Playwright auto-dismisses dialogs by default; `page.on('dialog')` does not reliably fire for `beforeunload`. Prefer asserting the **behavioral consequence** — dirty edit → Cancel/navigate away → reopen the batch → value NOT persisted (last-saved value shown) — and treat "the native confirm dialog appears" as out-of-scope / low-confidence. Document this so the spec author does not sink time into a flaky native-dialog assertion.

### Risk #7b — Ingredient drag-reorder (newly mapped to #7)

**Zero browser coverage today.** The `ingredients-drag-reorder` change explicitly **skipped E2E** ("purely client-side; existing batch save tests cover array persistence"), and impl-review caught a **React-key reorder bug** — so the reorder→save→reload path has never been exercised in a browser. This is the strongest new-signal item in the refresh.

**Drag handle has an accessible name.** `IngredientCard.tsx:135-146` — `<button aria-label="Reorder {displayName}">` (GripVertical icon). Locate via `getByRole('button', { name: /Reorder Apple juice/i })`. The handle is **hidden when `isDragDisabled`**.

**Order is JSONB array position on the batch.** Reorder path: `arrayMove(...)` in `IngredientsSection.tsx:140-153` (`handleDragEnd`) → `onBatchChange` → `setIngredients` (`BatchForm.tsx:429`) → PUT save (`BatchForm.tsx:190-195`). On reload, SSR renders ingredients in the saved array order.

**Collapsed card content (for asserting order).** Name in `<span class="font-medium">`, amount like `"10 L"`, optional sugar like `"15%"`. Assert order via `page.getByText(...)` sequence or by collecting the name spans' text with `allTextContents()` and comparing to the expected order.

**Sensors / how to drag in Playwright.** `IngredientsSection.tsx:158-162` — `PointerSensor` (activation `distance: 8`), `TouchSensor` (no delay), `KeyboardSensor` (arrow keys). Options for the spec, most→least robust for dnd-kit:

1. **Keyboard reorder (most reliable):** focus the grip button → `Space` to lift → `ArrowDown`/`ArrowUp` to move → `Space` to drop. Deterministic, no pixel math.
2. **Native mouse `dragTo()`** (or manual `mouse.move` in steps): must exceed the **8px** activation distance; can be flakier.

**Edit-mode guard.** `IngredientsSection.tsx:157` — `isDragDisabled = editingIndex !== null`; `useSortable({ disabled: isDragDisabled })` in `IngredientCard.tsx:35`; the grip is hidden while any card is being edited. So the reorder step must run with **all cards collapsed** (no card in edit mode).

**Adding an ingredient (test setup).** `IngredientsSection.tsx:271-273` — `"+ Add ingredient"` button auto-opens an edit form (fields Name / Amount (L) / Sugar content (%)); a `"Done"` control collapses it. A reorder test needs ≥2 collapsed ingredients.

**Cancel reverts reorder.** Reorder (don't save) → Cancel `<a href="/batches">` (beforeunload auto-handled by Playwright) → reopen batch → assert the **original saved order** (reorder discarded). Save+reload → assert the **new order** persisted.

## Code References

- `supabase/migrations/20260614130000_diary_entries_process_plan.sql:47-61` — `regenerate_diary_entries` RPC: deletes `entry_type='auto'`, reinserts fresh auto entries with `completed=false`. **Ground truth for Risk #3.**
- `supabase/migrations/20260614130000_diary_entries_process_plan.sql:29-44` — `promote_diary_entry_type` trigger: auto→user on `description`/`notes` change only (excludes `entry_date`, `completed`).
- `src/pages/api/batches/[id]/diary/regenerate.ts:46-47` — post-regenerate re-fetch ordered `entry_date ASC, created_at ASC`; reads persisted params.
- `src/components/batches/diary/DiarySection.tsx:20-31` — client sort (`localStorage["fermenta:diary-sort-order"]`, default `asc`).
- `src/components/batches/diary/DiarySection.tsx:202-212` — Regenerate button (edit-only, `disabled={regenerating}`, no dirty-guard, no confirm).
- `src/components/batches/diary/DiarySection.tsx:226-238` — `EntryRow` props: `description/entry_date/notes/completed` only — **no `entry_type` in DOM.**
- `src/components/batches/BatchForm.tsx:82-97` — warnings initialized edit-only from `initialData`.
- `src/components/batches/BatchForm.tsx:98,247,250-252` — `warningsDismissed` state + render guard + `onDismiss`.
- `src/components/batches/BatchForm.tsx:152-155` — `handleBlur` resets `warningsDismissed=false` and recomputes (blur gotcha).
- `src/components/batches/BatchForm.tsx:127-137` — `beforeunload` dirty-guard (fragile to assert).
- `src/components/batches/BatchForm.tsx:157-227` — `handleSubmit` PUT save; resets `initialValues` + `isDirtyRef=false` at ~213-215.
- `src/components/batches/BatchForm.tsx:262-264,475-477` — Cancel is `<a href="/batches">` (no restore).
- `src/components/batches/BatchForm.tsx:427-442` — `onBatchChange` merges sugar/ingredient changes into form state.
- `src/components/batches/ValidationWarnings.tsx:59-68` — Dismiss button; no persistence.
- `src/components/batches/IngredientCard.tsx:135-146` — drag handle `aria-label="Reorder {name}"`.
- `src/components/batches/IngredientCard.tsx:35` — `useSortable({ disabled: isDragDisabled })`.
- `src/components/batches/IngredientsSection.tsx:140-153` — `handleDragEnd` / `arrayMove`.
- `src/components/batches/IngredientsSection.tsx:157-162` — `isDragDisabled` guard + sensors (PointerSensor distance 8, Touch, Keyboard).
- `src/components/batches/IngredientsSection.tsx:271-273` — `"+ Add ingredient"` button.
- `src/pages/batches/[id].astro` — edit page: SSR fetch + `<BatchForm client:load mode="edit" initialData={batch} />`, Copy link, DeleteBatchDialog.
- `tests/e2e/seed.spec.ts` — exemplar spec (create→reload→delete) all new specs must mirror.
- `tests/e2e/auth.setup.ts` — one-time sign-in, storageState at `tests/e2e/.auth/user.json` (needs `E2E_USERNAME`/`E2E_PASSWORD`); redirects to `/batches` (heading "My Batches").
- `tests/e2e/AGENTS.md` — locator/wait rules (getByRole/getByLabel, no waitForTimeout, name test after risk).
- `playwright.config.ts` — projects (setup + chromium with storageState), `npm run test:e2e`.

## Architecture Insights

- **SSR re-initializes React island state on every full load.** Both the Risk #2 non-persistence oracle and the Risk #7 reload oracles rely on this: `BatchForm`/`DiarySection` derive their initial state from server props, so "reload" is a clean reset to persisted truth. This makes reload the canonical assertion point for "not persisted" / "persisted" behaviors.
- **Persistence lives in the JSONB batch params + the `diary_entries` table.** Ingredient order and sugar fields are batch-row state (saved via `PUT /api/batches/{id}`); diary entries are their own table mutated by the regenerate RPC. Two different persistence mechanisms behind two different reload behaviors.
- **`auto` vs `user` is a server-side lifecycle concept with no DOM projection.** The promotion trigger is the only bridge between "user touched it" and "it survives regenerate," and it keys on description/notes only. Any E2E oracle for Risk #3 must be expressed in terms the DOM can observe (text + completed styling), never the type.
- **dnd-kit exposes accessible drag affordances.** The grip's `aria-label` and the KeyboardSensor make the reorder testable through role/keyboard interactions, keeping the spec aligned with the getByRole-first locator rule and avoiding brittle pixel dragging.

## Historical Context (from prior changes)

- `context/changes/regenerate-dirty-guard/` — **status: proposed, not implemented.** Would disable Regenerate while the form is dirty (with a tooltip). Confirms the change.md "save first / gated" assumption is unshipped; the E2E can't assert the disabled state yet.
- `context/changes/expose-step-key/` — introduced the step key to **preserve user edits to non-auto entries**. Research confirms this matches the actual regenerate behavior (user entries preserved), grounding the Risk #3 oracle.
- `context/changes/ingredients-drag-reorder/` — added @dnd-kit reorder; **explicitly skipped E2E** and impl-review caught a **React-key reorder bug**. Justifies mapping reorder→save→reload into Risk #7 as genuinely uncovered browser behavior.
- `context/changes/diary-consolidation/` — background on the auto/user diary entry model and the process-plan generation the RPC rebuilds.

## Related Research

- None prior for this change. This is the first `research.md` under `context/changes/test-plan-refresh-2026-07-11/`.

## Decisions (open questions resolved 2026-07-11)

No open questions remain — the following are locked inputs for `/10x-plan`:

1. **Risk #3 oracle is DOM-only — no DB assertions.** The test distinguishes auto vs user entries purely by **description** (unique markers for user-added and user-promoted entries; known generated text for auto entries) plus **completed styling**. The "auto wiped" signal is the `completed → false` reset after toggling one complete and regenerating. No admin/DB-level checks — that certainty is left to integration tests, not E2E.
2. **Risk #2 (and any) batch seeding runs as the logged-in user — no service account.** Create the pre-existing inconsistent batch through the app's own create flow (UI, or `POST /api/batches` using the `storageState` session), whichever is more reliable / easier to implement. Do **not** use a service-role key or admin DB writes for any test setup; keep the authenticated-user context end-to-end (mirrors `seed.spec.ts`).
3. **beforeunload scope.** The unsaved-changes guard is the browser's **native** `beforeunload` (no React discard modal; no ClientRouter, so Cancel is a hard nav that triggers it while dirty). Native beforeunload is fragile/suppressed under Playwright, so Risk #7a asserts the **persistence consequence** (dirty edit → Cancel/reopen → value not persisted), NOT the native dialog. The React `DeleteBatchDialog` is a separate, assertable flow but is out of Risk #7a scope.
