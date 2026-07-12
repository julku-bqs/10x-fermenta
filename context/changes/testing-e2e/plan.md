# E2E UI-Wiring Coverage (Risk #3 + Risk #7) Implementation Plan

## Overview

Author three Playwright E2E specs that prove browser-level UI wiring for the two remaining risks of **test-plan.md Phase 5 ("E2E UI-wiring coverage")**:

- **Risk #3 — diary Regenerate preserve-and-rebuild.** User-added diary entries survive Regenerate, user-edited (promoted) auto entries survive, untouched auto entries are wiped and rebuilt with `completed` reset to false, and the list renders in ascending date order.
- **Risk #7 — save/cancel/reload round-trip.** Batch-level sugar fields round-trip through both the Calculate path and the manual-input path (and revert after Cancel), and a drag-reorder of ingredients survives save+reload and reverts after Cancel.

Risk #2 (validation-warning display/dismiss/non-persistence) is already shipped as `tests/e2e/validation-warning-persistence.spec.ts` and is **out of scope** here.

A small set of **accessibility edits** precedes the specs so they use the AGENTS.md-preferred `getByRole`/`getByLabel` locators instead of `getByTestId` fallbacks: the sugar "Amount (kg)" input gets a `htmlFor`/`id` association, the diary complete-toggle button gets an accessible name, and the diary list gets `role="list"`/`role="listitem"` semantics so a single row's toggle can be scoped.

## Current State Analysis

- **The E2E harness is fully wired.** `playwright.config.ts` runs a `setup` project that authenticates once and persists `storageState` to `tests/e2e/.auth/user.json`, a `chromium` project that reuses it, and a `webServer` that runs `npm run dev` at `http://localhost:4321`. Run with `npm run test:e2e`. Requires `E2E_USERNAME` / `E2E_PASSWORD` in `.env`.
- **Two exemplars define the required shape.** `tests/e2e/seed.spec.ts` (UI create→reload→delete; role locators, self-contained setup+cleanup, wait-for-state) and `tests/e2e/validation-warning-persistence.spec.ts` (**API seed via `page.request.post('/api/batches')` → `finally` `page.request.delete('/api/batches/{id}')`**, plus a **hydration gate** — wait for `Save Changes` enabled before asserting client state). Both new round-trip specs copy this seed/cleanup + hydration-gate skeleton.
- **`tests/e2e/AGENTS.md` is binding:** `getByRole`/`getByLabel`/`getByText` first, `getByTestId` only for ambiguous a11y; never CSS/XPath; never `waitForTimeout`; one test per file with a provenance header; unique `Date.now()` suffixes; clean up what you create. Supabase/AI calls are server-side, so `page.route()` will not intercept them — internal boundaries (auth/routing/DB) stay real.
- **`POST /api/batches` auto-generates the `auto` diary plan at creation** (`src/pages/api/batches/index.ts:44-56`), so one POST with a valid `process_type` yields a batch that already has `auto` diary entries for the Regenerate test. `DELETE /api/batches/{id}` cascades to `diary_entries`.
- **Two accessibility locator gaps exist in source (verified at HEAD):**
  - The sugar "Amount (kg)" `<label>` has no `htmlFor` and its `<input>` has no `id` (`IngredientsSection.tsx:48-49`) → `getByLabel('Amount (kg)')` will not resolve.
  - The diary complete-toggle `<button>` (`EntryRow.tsx:54-65`) is icon-only with no accessible name → cannot be located or counted by role name.
- **Risk #7b (drag-reorder) is newly unblocked.** `IngredientsSection` assigns each ingredient a stable `crypto.randomUUID()` id used as both the React key and the dnd-kit sortable id (`IngredientsSection.tsx:90-93,104,110,151,225-226`), resolving the React-key drift bug the `ingredients-drag-reorder` impl-review caught. Reorder→save→reload is now safe to exercise in a browser.
- **Only one sugar card is ever expanded at a time.** `editingSugar` is a single enum `"fermentation" | "sweetness" | null` (`IngredientsSection.tsx:88,174,188`), so at most one "Amount (kg)" input is in the DOM at once → `getByLabel('Amount (kg)')` resolves uniquely after the a11y fix.

## Desired End State

Three new committed specs under `tests/e2e/` pass green against the real app and each fails if its risk materializes (confirmed by a deliberate break during authoring):

- `tests/e2e/diary-regenerate-preserve-rebuild.spec.ts` (Risk #3)
- `tests/e2e/sugar-fields-roundtrip.spec.ts` (Risk #7a)
- `tests/e2e/ingredient-order-roundtrip.spec.ts` (Risk #7b)

Plus three minimal, strictly-improving accessibility edits across `IngredientsSection.tsx`, `EntryRow.tsx`, and `DiarySection.tsx` (label association, toggle accessible name, and diary list/listitem roles). `npm run test:e2e` runs all specs (existing + new) green; `npm run lint`, `npm run build`, and `npm run test` remain green.

### Key Discoveries:

- API seed/cleanup contract: `POST /api/batches` returns **201** `{ data: Batch }` and generates auto diary entries; schema at `src/lib/schemas/batch.ts:10-23` (`process_type` required; `planned_sweetness` ≠ "dry" renders the Sweetness Sugar card; `target_volume_liters` + `target_abv` needed for Calculate). `DELETE` → **204**, cascades. (`src/pages/api/batches/index.ts:8-80`, `[id]/index.ts:61-83`)
- Diary endpoints: `POST /api/batches/{id}/diary` creates a **user** entry (`entry_type` hardcoded `'user'`) with body `{description, entry_date?, notes?, completed?}`; `regenerate.ts` POST reads **persisted** batch params (not form state) and re-fetches ordered `entry_date ASC, created_at ASC`. (`src/pages/api/batches/[id]/diary/index.ts:33-73`, `regenerate.ts:9-54`)
- Regenerate RPC ground truth: `DELETE ... WHERE entry_type='auto'` then re-insert with `completed=false`; `user` rows never touched. Promotion trigger flips `auto`→`user` only when `description`/`notes` change (excludes `entry_date`, `completed`). (`supabase/migrations/20260614130000_diary_entries_process_plan.sql:29-44,47-61`)
- Regenerate button label is `"Generate Plan"` when `entries.length === 0` else `"Regenerate"`; edit-mode only; no dirty-guard, no confirm, no reload (`DiarySection.tsx:132-149,202-212`). Locator: `getByRole('button', { name: /Regenerate|Generate Plan/i })`.
- Sugar collapsed card = a button showing `{parseFloat(amountKg.toFixed(3))} kg`; expanded card = the "Amount (kg)" input + a "Done" button. Calculate button disabled unless `target_volume_liters && target_abv`; `handleCalculate` sets **both** sugar fields. (`IngredientsSection.tsx:38-84,122-138,195-203`)
- Cancel is a plain `<a href="/batches">Cancel</a>` (role `link`, two of them) — hard navigation, no restore; `beforeunload` is native and unreliable under Playwright. Assert the **persistence consequence** (dirty edit → Cancel/reopen → value not persisted), not the native dialog. (`BatchForm.tsx:125-141,266-267,485-486`)
- Ingredient grip: `<button aria-label="Reorder {name}">` (`IngredientCard.tsx:134-146`); hidden while any card is in edit mode. Keyboard reorder (focus grip → `Space` → `ArrowUp`/`ArrowDown` → `Space`) is deterministic; `PointerSensor` needs an 8px activation distance. Order oracle: `getByRole('button', { name: /^Reorder / }).allTextContents()` in DOM order.

## What We're NOT Doing

- **Not** touching Risk #2 — `validation-warning-persistence.spec.ts` already covers it.
- **Not** asserting `entry_type` directly or making any DB/RPC assertions — Risk #3 oracle is DOM-observable only (description text + completed state + rendered dates).
- **Not** asserting the native `beforeunload` "Leave site?" dialog — out of scope per research Decision #3; we assert the persistence consequence instead.
- **Not** implementing the regenerate dirty-guard (`context/changes/regenerate-dirty-guard/` is `status: proposed`) — the specs save before regenerating and do not assert a disabled-when-dirty button.
- **Not** re-testing unit/integration concerns: unit owns _which_ steps a plan generates and _which_ validation rule fires; integration owns the field-level sugar lifecycle. These specs prove browser wiring only.
- **Not** adding a service account or admin writes — all seeding runs as the logged-in test user under `storageState` (RLS-scoped).
- **Not** covering the sweetness→dry force-zero edge case (integration-owned).
- **Not** using mouse `dragTo()` for reorder — keyboard reorder is the deterministic path.

## Implementation Approach

Ship the accessibility fix first (Phase 1) so Phases 2 and 3 can locate the sugar input and the diary toggle by role/label. Then author each spec in its own file, one risk-facet per file (Phases 2–4), each mirroring the `validation-warning-persistence.spec.ts` seed/cleanup + hydration-gate skeleton: seed through the real API, act in the browser, assert a DOM oracle that fails if the risk materializes, and clean up in a `finally`. Each spec is validated by a deliberate break during authoring before it is trusted.

## Critical Implementation Details

- **Sugar input a11y fix + unique id.** `SugarCard` renders for both the Fermentation and Sweetness cards, so a hardcoded `id` would risk duplicate-id HTML. Generate the id inside `SugarCard` (e.g. React `useId()`) and wire it to both `<label htmlFor>` and `<input id>`. Because only one card is expanded at a time, `getByLabel('Amount (kg)')` resolves uniquely at runtime.
- **Diary toggle accessible name should reflect state, not just exist.** A state-reflecting `aria-label` (e.g. "Mark as complete" when not completed, "Mark as incomplete" when completed) enables the count-based Risk #3 oracle: the number of completed entries = the count of toggles whose name marks them as already complete. This keeps the oracle on role-name locators and off CSS/`line-through` (which AGENTS.md forbids). **Match the full phrase** — because "complete" is a substring of "incomplete", locate and count with the full phrases (`name: 'Mark as complete'` / `name: 'Mark as incomplete'`, which don't cross-match) and never a bare `/complete/` regex (which would match both states and silently miscount).
- **Diary list roles make one row's toggle targetable.** With `role="list"`+`aria-label="Diary entries"` on the container and `role="listitem"` on each row (Phase 1 #3), complete one untouched auto entry via `getByRole('list', { name: /diary/i }).getByRole('listitem').filter({ hasNotText: /user-/ }).first().getByRole('button', { name: 'Mark as complete' })`. Use `hasNotText` (positive `hasText` can't negate) with an unanchored `/user-/` — the row's text content begins with the formatted date, so `^user-` never matches; safe because auto descriptions/notes are natural language that never contain `user-`.
- **Risk #3 untouched-auto oracle is count-based — but the toggled entry MUST be an untouched auto entry.** The count oracle is only valid if the one pre-Regenerate completed entry gets wiped: the two `user`-type markers (added + promoted) **survive Regenerate with their completed state intact** (`PUT {completed}` does not fire the promotion trigger — `DiarySection.tsx:77-92`), so a blind `.first()` toggle can land on a surviving user row and leave a stray completed entry, failing oracle (c) even when Regenerate worked. Adopt a **stable marker-prefix convention** to make the target unambiguous: give both user-owned markers a `user-` prefix (`user-added: E2E <ts>` and `user-promoted: E2E <ts>`). Then complete exactly one untouched auto entry via the list-scoped, `user-`-excluding selector (see the diary-list-roles detail above). After Regenerate, assert **zero** entries completed — no need to re-locate the specific toggle. This proves auto entries were rebuilt with `completed=false` while the `user-`-prefixed entries (seeded not-completed) are unaffected.
- **Risk #3 ordering must be made deterministic AND asserted concretely.** `DiarySection` client-sorts by `entry_date` then `created_at` (`sortEntries :26-31`, called `:179`) and a fresh Playwright context defaults to ascending order (`getSortOrder :20-24`) — so a generic "dates are non-decreasing" check can never fail. Instead, **pin the batch's `batch_date`** in the seed POST and give the user-added entry an `entry_date` **strictly before** it: auto entries are all at `batch_date + offset` (offset ≥ 0), so a strictly-earlier user entry is unambiguously first (the `entry_date` primary key decides — the `created_at` tiebreak, which would otherwise sort a _same-date_ user entry after the auto one, never engages). Assert the `user-added:` marker is the **first** diary listitem after Regenerate (`getByRole('list', { name: /diary/i }).getByRole('listitem').first()`); this fails if the date wasn't persisted/honored or the entry was dropped. Leave the Sort toggle untouched to rely on the default ascending order.
- **Regenerate reads persisted params — save before regenerating.** `regenerate.ts` fetches the batch row, not form state. Any param change the spec relies on must be persisted (via seed POST/PUT) before clicking Regenerate.
- **Phase 2 has two independent readiness signals — gate on both.** `Save Changes` enabling reflects only _form_ hydration (`useHydrated`, `BatchForm.tsx:103,123`); the diary list is fetched on a **separate** async round-trip that starts empty with `loading = true` (`DiarySection.tsx:38`, populated in the `:45-62` useEffect) and is **not** server-rendered by `[id].astro`. So after hydration, before toggling completion or clicking Regenerate, additionally wait for the seeded user-added marker to render **as a diary-list entry**: `await expect(page.getByText(<marker>)).toBeVisible()`. Target the rendered description label — the entry `<p>` at `EntryRow.tsx:130-135`, which `getByText` matches — **not** an `<input>` value: the add/edit-entry inputs (`DiarySection.tsx:315-336`, `EntryRow.tsx:85-92`) hold no seeded marker and `getByText` ignores form-control values, so the gate cannot be satisfied prematurely by an input and only turns green once the list has actually painted.
- **Two identical submit buttons + two Cancel links.** `Save Changes` appears top and bottom (`.first()`/`.last()`); `Cancel` is _also_ a top+bottom pair of `link`-role elements (both `<a href="/batches">`, `BatchForm.tsx:266-268` and `:485-487`) — the `link` role only disambiguates them from the diary Cancel _buttons_, so the two links still need `.first()`/`.last()` just like the submit buttons (a bare `getByRole('link', { name: 'Cancel' })` is a strict-mode violation). Note Cancel navigates to `/batches` (the list), not the detail — reopening the batch requires an explicit `page.goto('/batches/{id}')`. Follow `seed.spec.ts`'s guidance to click the bottom submit when a top validation banner may shift layout.
- **Grip is hidden in edit mode.** All reorder steps must run with every ingredient card collapsed (`isDragDisabled = editingIndex !== null`).
- **Cancel navigation must not depend on the native `beforeunload` dialog.** Clicking `Cancel` while the form is dirty trips the native "Leave site?" dialog (`BatchForm.tsx:131-141`), which Playwright auto-dismisses by default — canceling the navigation and hanging/flaking the step. For every Cancel-discard assertion (Phases 3 & 4), register a dialog handler that accepts (`page.on('dialog', d => d.accept())`) **and/or** re-open the batch via an explicit `page.goto('/batches/{id}')` before asserting the last-saved value, so the discard oracle never depends on the beforeunload navigation completing.

## Phase 1: Accessibility Fixes (Source)

### Overview

Add the missing accessibility associations so the specs can use `getByLabel`/`getByRole` — a label/id association, a state-reflecting toggle name, and diary list/listitem roles (three additive edits across `IngredientsSection.tsx`, `EntryRow.tsx`, and `DiarySection.tsx`). All three edits are minimal and strictly improve real accessibility (the repo already ships `eslint-plugin-jsx-a11y`).

### Changes Required:

#### 1. Sugar "Amount (kg)" input — associate label with input

**File**: `src/components/batches/IngredientsSection.tsx`

**Intent**: Give the SugarCard "Amount (kg)" number input an accessible name so `getByLabel('Amount (kg)')` resolves, fixing a genuine label-association a11y gap.

**Contract**: Inside `SugarCard` (`:38-84`), generate a unique id (React `useId()`), set `<label htmlFor={id}>` (`:48`) and `<input id={id}>` (`:49`). No behavior change; the number input still flows `onChange → onChange(parseFloat||0) → onBatchChange({fermentation_sugar_kg|sweetness_sugar_kg})`.

#### 2. Diary complete-toggle — add a state-reflecting accessible name

**File**: `src/components/batches/diary/EntryRow.tsx`

**Intent**: Give the icon-only complete-toggle button a state-reflecting accessible name so completed entries can be counted by role name; combined with the diary list roles in change #3, a specific row's toggle can also be targeted.

**Contract**: On the toggle `<button>` (`:54-65`), add an `aria-label` that reflects completion state (e.g. `entry.completed ? "Mark as incomplete" : "Mark as complete"`). No behavior change to `onToggleComplete`.

#### 3. Diary entries — expose list semantics for scoped locators

**File**: `src/components/batches/diary/DiarySection.tsx`, `src/components/batches/diary/EntryRow.tsx`

**Intent**: Give the diary list `role="list"`/`role="listitem"` + an accessible name so a spec can scope `getByRole('list', { name: 'Diary entries' }).getByRole('listitem')` — targeting one row's toggle without CSS/XPath and past the unrelated `<li>`s in `ValidationWarnings.tsx:29-31`.

**Contract**: Attribute-only — no DOM-structure or visual change. Edit-mode container `<div className="pl-1">` (`DiarySection.tsx:224`) → add `role="list"` + `aria-label="Diary entries"`. `EntryRow` root `<div className="relative flex gap-4">` (`EntryRow.tsx:52`) → add `role="listitem"` (already a direct child of the container, so list→listitem ownership is valid). Create-mode container `<div className="pl-1">` (`DiarySection.tsx:245`) → add `role="list"` (unnamed) so its rows aren't orphaned listitems. No behavior change.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Existing unit/integration tests pass: `npm run test`
- Existing E2E specs still pass: `npm run test:e2e` (seed + validation-warning specs unaffected)

#### Manual Verification:

- Expanding a sugar card shows the "Amount (kg)" input with no visual change; the diary toggle looks identical.
- In DevTools, the sugar input has an `id` matching the label's `htmlFor`, and the diary toggle exposes an accessible name that flips with completion state.
- The diary exposes a named list (`role="list"`, name "Diary entries") with `role="listitem"` rows in the a11y tree; no visual change.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Risk #3 — Diary Regenerate Preserve-and-Rebuild

### Overview

Prove the browser Regenerate wiring: user-added entries survive, user-edited (promoted) auto entries survive, untouched auto entries are wiped and rebuilt with `completed=false`, and a user entry with a chosen date renders in its correct position after rebuild. Anti-pattern to avoid: asserting a snapshot of current auto output, or asserting generic list monotonicity (the client always sorts).

### Changes Required:

#### 1. Risk #3 spec

**File**: `tests/e2e/diary-regenerate-preserve-rebuild.spec.ts` (new)

**Intent**: One test that seeds a batch with auto entries + user-influenced entries, clicks Regenerate in the browser, and asserts the four DOM oracles. Mirrors the `validation-warning-persistence.spec.ts` seed/cleanup + hydration-gate skeleton.

**Contract**: Provenance header linking to test-plan.md Risk #3 and `seed.spec.ts`. Setup (all as the logged-in user, unique `Date.now()` suffix):

1. `POST /api/batches` with a valid `process_type` **and an explicit `batch_date`** (pin it — don't rely on the today-default) → **201**; capture `id`. (Auto entries generated at `batch_date + offset`, offset ≥ 0.)
2. Authoring guard: `GET /api/batches/{id}/diary` returns a non-empty list (fails loudly if the plan didn't generate); **capture the list and pick one concrete auto entry to promote** (record its `id`/`description` for step 4).
3. `POST /api/batches/{id}/diary` to add a **user** entry with a `user-added:`-prefixed unique description marker (e.g. `user-added: E2E <ts>`) and an `entry_date` **strictly before the pinned `batch_date`** (the diary API intentionally does not guard entry dates against `batch_date`), so it sorts unambiguously earliest and oracle (d) has deterministic signal.
4. `PUT` the **captured auto entry's** (step 2) `description` to a `user-promoted:`-prefixed unique marker (e.g. `user-promoted: E2E <ts>`) — exercises the promotion trigger → becomes `user`. Both user-owned markers now share the `user-` prefix, so the completion step excludes them via `hasNotText: /user-/`.

Action + oracle (open `/batches/{id}` — the detail page renders `BatchForm mode="edit"` directly, no edit-mode click; **two-stage readiness gate**: first `Save Changes` enabled = form hydrated, **then** the seeded user-added marker visible as a rendered diary-list entry — `await expect(page.getByText(<user-added marker>)).toBeVisible()` — because the diary list loads on a separate async fetch after hydration and is not SSR'd):

- Toggle complete on exactly one **untouched auto** entry via a list-scoped, `user-`-excluding locator: `getByRole('list', { name: /diary/i }).getByRole('listitem').filter({ hasNotText: /user-/ }).first().getByRole('button', { name: 'Mark as complete' })`. This scopes past the unrelated `ValidationWarnings` `<li>`s, excludes both `user-added:`/`user-promoted:` rows (which survive Regenerate and would otherwise leave a stray completed entry), and clicks a real toggle. Exactly one entry is now completed.
- Click `getByRole('button', { name: /Regenerate|Generate Plan/i })`; wait for the list to settle (e.g. `waitForResponse` on the regenerate call or re-render of a known entry).
- Assert: (a) the `user-added:` marker is still visible; (b) the `user-promoted:` marker is still visible; (c) **zero** entries are completed (count of "Mark as incomplete"-named toggles is 0); (d) the `user-added:` marker is the **first** diary entry — `getByRole('list', { name: /diary/i }).getByRole('listitem').first()` contains `user-added:` — proving its strictly-earlier `entry_date` was persisted/honored and the entry wasn't dropped/reordered by Regenerate (not merely that the list is monotonically sorted, which the client always guarantees via `sortEntries`).

Cleanup: `finally` `DELETE /api/batches/{id}` → **204**.

### Success Criteria:

#### Automated Verification:

- Spec passes: `npm run test:e2e -- diary-regenerate-preserve-rebuild`
- Linting passes: `npm run lint`
- Full E2E suite still green: `npm run test:e2e`

#### Manual Verification:

- Deliberate break confirms real signal: temporarily make Regenerate also delete user entries (or invert one assertion) → the spec goes red on the corresponding oracle → restore, spec green again.
- The four oracles each map to a distinct facet of the risk (preserve added, preserve promoted, rebuild auto, ordering).

**Implementation Note**: After automated verification passes, pause for manual confirmation (including the deliberate-break result) before proceeding.

---

## Phase 3: Risk #7a — Sugar-Fields Round-Trip

### Overview

Prove the full sugar save/cancel/reload round-trip for **both** sugar cards, via **both** the Calculate path and the manual-input path, plus Cancel-discard. Anti-pattern to avoid: testing only the Calculate→Save path.

### Changes Required:

#### 1. Risk #7a spec

**File**: `tests/e2e/sugar-fields-roundtrip.spec.ts` (new)

**Intent**: One test that seeds a non-dry batch (so both sugar cards render), drives sugar values by Calculate and by manual input, saves, reloads, and asserts the persisted badge values; then edits and Cancels to assert the discard. Mirrors the seed/cleanup + hydration-gate skeleton.

**Contract**: Provenance header linking to test-plan.md Risk #7 and `seed.spec.ts`. Seed via `POST /api/batches` with `planned_sweetness: "semi_sweet"` (non-dry → Sweetness Sugar card renders), plus `target_volume_liters` + `target_abv` — these two alone enable Calculate (`canCalculate`, `IngredientsSection.tsx:155`); also seed at least one ingredient so the computed sugar is meaningful (ingredients feed the calculation but don't gate the button). Assertions:

- **Calculate path:** open `/batches/{id}` (edit mode; hydration gate), click `getByRole('button', { name: /Calculate/ })` → **capture** each sugar card's collapsed badge value (`X kg`); `Save Changes` (bottom); `page.reload()`; re-gate hydration; assert both badges show the **captured** values (SSR-reinitialized round-trip). Do not assert a hardcoded "non-zero" value — seed inputs so both fields are expected to compute > 0, but let the assertion compare captured-vs-reloaded so a legitimately-zero field can't cause a spurious fail.
- **Manual-input path:** expand a sugar card, type a distinct value into `getByLabel('Amount (kg)')`, "Done"; `Save Changes`; reload; assert the badge shows the manually-entered value.
- **Cancel-discard:** expand a card, type a new value (do **not** save), click `getByRole('link', { name: 'Cancel' }).last()` (accept the native beforeunload dialog via a registered handler), then re-open the batch with an explicit `page.goto('/batches/{id}')`; assert the badge shows the **last-saved** value (the unsaved edit was discarded). Do not depend on the Cancel link's own navigation completing.

Cleanup: `finally` `DELETE /api/batches/{id}`.

### Success Criteria:

#### Automated Verification:

- Spec passes: `npm run test:e2e -- sugar-fields-roundtrip`
- Linting passes: `npm run lint`
- Full E2E suite still green: `npm run test:e2e`

#### Manual Verification:

- Deliberate break confirms real signal: temporarily make the sugar PUT drop one field (or invert the reload assertion) → spec goes red → restore.
- Both cards, both input paths, and the Cancel-discard branch are each exercised (not just Calculate→Save).

**Implementation Note**: After automated verification passes, pause for manual confirmation (including the deliberate-break result) before proceeding.

---

## Phase 4: Risk #7b — Ingredient-Order Round-Trip

### Overview

Prove that a drag-reorder of ingredients survives save+reload and reverts after Cancel — genuinely-new browser coverage now that the stable-UUID key fix has landed. Uses keyboard-driven reordering for determinism.

### Changes Required:

#### 1. Risk #7b spec

**File**: `tests/e2e/ingredient-order-roundtrip.spec.ts` (new)

**Intent**: One test that seeds a batch with ≥2 named ingredients, reorders them via the keyboard sensor with all cards collapsed, saves, reloads, and asserts the new DOM order; then reorders again and Cancels to assert the original order is restored. Mirrors the seed/cleanup + hydration-gate skeleton.

**Contract**: Provenance header linking to test-plan.md Risk #7 and `seed.spec.ts`. Seed via `POST /api/batches` with `ingredients: [{name:"Apple juice",...},{name:"Water",...}]` (deterministic grip labels). Order oracle: `page.getByRole('button', { name: /^Reorder / }).allTextContents()` returns grip labels in DOM order. Assertions:

- **Reorder → save → reload:** with all cards collapsed, focus a grip (`getByRole('button', { name: 'Reorder Apple juice' })`), press `Space` (lift) → `ArrowDown` → `Space` (drop); confirm the oracle shows the swapped order; `Save Changes` (bottom); `page.reload()`; re-gate hydration; assert the oracle shows the persisted new order.
- **Reorder → Cancel → reopen:** reorder again (do **not** save), click `getByRole('link', { name: 'Cancel' }).last()` (accept the native beforeunload dialog via a registered handler), then re-open with an explicit `page.goto('/batches/{id}')`; assert the oracle shows the **original** saved order. Do not depend on the Cancel link's own navigation completing.

Cleanup: `finally` `DELETE /api/batches/{id}`.

### Success Criteria:

#### Automated Verification:

- Spec passes: `npm run test:e2e -- ingredient-order-roundtrip`
- Linting passes: `npm run lint`
- Full E2E suite still green: `npm run test:e2e`

#### Manual Verification:

- Deliberate break confirms real signal: temporarily skip the `arrayMove` persistence (or invert the reload assertion) → spec goes red → restore.
- Keyboard reorder is stable across repeated runs (no flake from the 8px pointer activation distance).

**Implementation Note**: After automated verification passes, pause for manual confirmation (including the deliberate-break result) before proceeding.

---

## Testing Strategy

### Unit Tests:

- None added — unit already owns _which_ diary steps a plan generates and _which_ validation rule fires (test-plan.md Phase 1).

### Integration Tests:

- None added — integration already owns the field-level sugar lifecycle (test-plan.md Phase 2).

### Manual Testing Steps:

1. Run `npm run test:e2e` — all specs (seed, validation-warning, and the three new ones) pass.
2. For each new spec, perform the deliberate break described in its Manual Verification and confirm it goes red, then restore.
3. Confirm no residue: after a run, `/batches` shows none of the `E2E ... <timestamp>` seeded batches (cleanup ran).

## Performance Considerations

- Each spec seeds via a single API POST and cleans up via DELETE — minimal DB load. Keyboard reorder avoids pixel-drag retries. No `waitForTimeout`; all waits are state-based.

## Migration Notes

- No schema or data migrations. The three source edits are additive accessibility attributes with no runtime behavior change.

## References

- Research: `context/changes/testing-e2e/research.md`
- Test plan (Phase 5, Risk Response Guidance): `context/foundation/test-plan.md`
- Change identity: `context/changes/testing-e2e/change.md`
- Exemplar (API seed + hydration gate): `tests/e2e/validation-warning-persistence.spec.ts`
- Exemplar (role locators + cleanup): `tests/e2e/seed.spec.ts`
- Binding rules: `tests/e2e/AGENTS.md`
- Regenerate RPC + promotion trigger: `supabase/migrations/20260614130000_diary_entries_process_plan.sql:29-61`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Accessibility Fixes (Source)

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 50251b9
- [x] 1.2 Build passes: `npm run build` — 50251b9
- [x] 1.3 Existing unit/integration tests pass: `npm run test` — 50251b9
- [x] 1.4 Existing E2E specs still pass: `npm run test:e2e` — 50251b9

#### Manual

- [x] 1.5 Sugar card + diary toggle show no visual change — 50251b9
- [x] 1.6 Sugar input `id` matches label `htmlFor`; toggle accessible name flips with completion state — 50251b9
- [x] 1.7 Diary exposes a named list (`role=list` "Diary entries") with `listitem` rows; no visual change — 50251b9

### Phase 2: Risk #3 — Diary Regenerate Preserve-and-Rebuild

#### Automated

- [x] 2.1 Spec passes: `npm run test:e2e -- diary-regenerate-preserve-rebuild` — 5cb0fee
- [x] 2.2 Linting passes: `npm run lint` — 5cb0fee
- [x] 2.3 Full E2E suite still green: `npm run test:e2e` — 5cb0fee

#### Manual

- [x] 2.4 Deliberate break confirms the spec goes red then green after restore — 5cb0fee
- [x] 2.5 The four oracles each map to a distinct facet of the risk — 5cb0fee

### Phase 3: Risk #7a — Sugar-Fields Round-Trip

#### Automated

- [x] 3.1 Spec passes: `npm run test:e2e -- sugar-fields-roundtrip` — ddd5c5b
- [x] 3.2 Linting passes: `npm run lint` — ddd5c5b
- [x] 3.3 Full E2E suite still green: `npm run test:e2e` — ddd5c5b

#### Manual

- [x] 3.4 Deliberate break confirms the spec goes red then green after restore — ddd5c5b
- [x] 3.5 Both cards, both input paths, and Cancel-discard are each exercised — ddd5c5b

### Phase 4: Risk #7b — Ingredient-Order Round-Trip

#### Automated

- [x] 4.1 Spec passes: `npm run test:e2e -- ingredient-order-roundtrip`
- [x] 4.2 Linting passes: `npm run lint`
- [x] 4.3 Full E2E suite still green: `npm run test:e2e`

#### Manual

- [x] 4.4 Deliberate break confirms the spec goes red then green after restore
- [x] 4.5 Keyboard reorder is stable across repeated runs
