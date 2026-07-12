---
date: 2026-07-12T07:27:56+02:00
researcher: Julian Kujawski
git_commit: 4aa78f92535741d1c590f166cc088383e9e03d79
branch: e2e
repository: julku-bqs/10x-fermenta
topic: "E2E (Playwright) coverage for Risk #3 (diary Regenerate preserve/rebuild) and Risk #7 (sugar-field + ingredient-order save/cancel/reload round-trip) — Phase 5 of test-plan.md"
tags:
  [
    research,
    codebase,
    e2e,
    playwright,
    testing-e2e,
    diary-regenerate,
    sugar-fields,
    drag-reorder,
    batch-form,
    seed-cleanup,
  ]
status: complete
last_updated: 2026-07-12
last_updated_by: Julian Kujawski
---

# Research: E2E coverage for Risk #3 (diary Regenerate) and Risk #7 (sugar + ingredient round-trip)

**Date**: 2026-07-12T07:27:56+02:00
**Researcher**: Julian Kujawski
**Git Commit**: 4aa78f92535741d1c590f166cc088383e9e03d79
**Branch**: e2e
**Repository**: julku-bqs/10x-fermenta

## Research Question

Ground **Phase 5 of `context/foundation/test-plan.md` ("E2E UI-wiring coverage")** in live code so `/10x-plan` and `/10x-e2e` encode the TRUE behavior. Per `context/changes/testing-e2e/change.md`, Risk #2 (validation-warning display/dismiss/non-persistence) is **already shipped** as `tests/e2e/validation-warning-persistence.spec.ts`, so this change scopes to the **two remaining risks**:

- **Risk #3 — diary Regenerate preserve-and-rebuild.** Prove the browser wiring: user-added diary entries **survive**, auto-generated entries are **deleted and rebuilt**, and the list stays in **date order**. Unit still owns _which_ steps a plan generates. Anti-pattern to avoid: asserting a snapshot of current output.
- **Risk #7 — sugar-field + ingredient-order round-trip.** Prove the full save/cancel/reload round-trip: a drag-reorder of ingredients **survives save+reload** and is **reverted after Cancel**, and batch-level sugar fields round-trip from **both Calculate and manual input**. Integration owns the field-level lifecycle. Anti-pattern to avoid: testing only the Calculate→Save path.

Grounding focus (from `change.md`): DOM roles/labels, API seed/cleanup boundaries, and regenerate + round-trip semantics.

## Summary

Both risks are E2E-authorable now. This research **re-verified** the prior `test-plan-refresh-2026-07-11/research.md` findings (grounded at the older commit `a51cbb5`) against the current tree (`4aa78f9`) and locked down the concrete locators, the seed/cleanup contract, and two things the prior doc did not fully cover.

**What is confirmed unchanged (Risk #3):** `git log a51cbb5..HEAD` over `src/components/batches/diary/`, `src/pages/api/batches/`, and `supabase/migrations` returns **0 commits** — every diary/regenerate finding still holds.

**Two material updates vs prior research:**

1. **Risk #7b is now UNBLOCKED — the React-key reorder bug is FIXED.** `IngredientsSection` now assigns each ingredient a stable `crypto.randomUUID()` id on mount and keeps it in sync across add/delete/reorder, using it as **both** the React `key` and the dnd-kit sortable id (`IngredientsSection.tsx:90-93,104,110,151,225-226`). The prior research flagged reorder→save→reload as "never exercised in a browser" because of a caught React-key bug; that bug is resolved in current code, so the reorder round-trip is safe to assert.
2. **Risk #7a manual-sugar-input path grounded (new).** Sugar values can be typed directly into an "Amount (kg)" number input inside each sugar card (`IngredientsSection.tsx:38-66`), independent of Calculate. This is the code path the change.md explicitly requires and the prior research only covered Calculate. Manual edit flows `onChange → onBatchChange({fermentation_sugar_kg|sweetness_sugar_kg})` (`:54-56,171-173,185-187`) → dirty → PUT save, exactly like Calculate.

**Three locator gaps to hand `/10x-e2e` up front (all avoidable, but must be planned):**

- **Sugar "Amount (kg)" input is not label-associated.** The `<label>` at `IngredientsSection.tsx:48` has no `htmlFor` and the `<input>` (`:49`) has no `id`, so `getByLabel('Amount (kg)')` will not resolve. Use `getByRole('spinbutton')` **scoped to the expanded card**, or (per `tests/e2e/AGENTS.md`'s "ambiguous a11y attributes" clause) add/target a `data-testid`. Note other batch-param number inputs on the same page are also spinbuttons, so page-wide `getByRole('spinbutton')` is ambiguous — scoping is required.
- **Diary complete-toggle has no accessible name.** The checkbox is an unlabeled `<button>` (`EntryRow.tsx:54-65`). Risk #3's "auto entry wiped → completed resets to false" sub-oracle needs to click a _specific_ entry's toggle; locate the entry container by its unique description text first, then the button within — or fall back to `getByTestId`.
- **`entry_type` ('auto'/'user') is invisible in the DOM.** `EntryRow` receives only `{description, entry_date, notes, completed}` (`DiarySection.tsx:226-238`). The preserve/wipe oracle must be expressed purely as **description text** + **completed styling** (`line-through` at `EntryRow.tsx:133`), never the type. (Unchanged from prior research; still true.)

**Seed/cleanup boundary is settled.** Both new specs seed as the logged-in user via `POST /api/batches` (full zod schema below) and clean up via `DELETE /api/batches/{id}` in a `finally` — mirroring `validation-warning-persistence.spec.ts`. `POST /api/batches` **auto-generates the `auto` diary plan at creation** (`src/pages/api/batches/index.ts:44-56`), so a single POST yields a batch that already has auto entries for the Regenerate test. DELETE cascades to `diary_entries`.

## Detailed Findings

### E2E harness & the exemplar pattern every new spec must mirror

The harness is fully wired (`playwright.config.ts`): a `setup` project authenticates once and persists `storageState` to `tests/e2e/.auth/user.json`; the `chromium` project reuses it; `webServer` runs `npm run dev` at `http://localhost:4321`. Run with `npm run test:e2e` (or `:ui`). Requires `E2E_USERNAME` / `E2E_PASSWORD` in `.env`.

Two exemplars define the shape:

- **`tests/e2e/seed.spec.ts`** — UI-driven create→reload→delete. Shows the four inherited patterns (role locators, self-contained setup+cleanup, wait-for-state, risk-tied assertion) and two gotchas that recur: **two identical submit buttons** (top+bottom) → click `.last()`; **delete is a two-step alert dialog** → scope confirm with `getByRole('alertdialog')`.
- **`tests/e2e/validation-warning-persistence.spec.ts`** (Risk #2, the closest sibling) — **API seed via `page.request.post('/api/batches', {data:{...}})` → `finally` `page.request.delete('/api/batches/{id}')`**. Also demonstrates the **hydration gate**: before asserting client-driven state after reload, wait for `getByRole('button', { name: 'Save Changes' }).first()` to be **enabled** so a client-side persist can't flash-pass. Both new specs should copy this seed/cleanup + hydration-gate skeleton.

`tests/e2e/AGENTS.md` is the binding rules file: `getByRole`/`getByLabel`/`getByText` first, `getByTestId` only when a11y attributes are ambiguous; never CSS/XPath; never `waitForTimeout` (wait for `toBeVisible`/`waitForURL`/`waitForResponse`); one test per file with a provenance header; unique `Date.now()` suffixes; clean up what you create. It also notes: **Supabase/AI calls are server-side, so `page.route()` will not intercept them** — internal boundaries (auth/routing/DB) stay real.

### API seed / cleanup contract (the boundary both specs seed through)

**`POST /api/batches`** (`src/pages/api/batches/index.ts:8-80`; schema `src/lib/schemas/batch.ts:10-23`) — **primary seed lever**, returns **201** with `{ data: Batch }`. `createBatchSchema`:

```
name: string (min 1, required)
batch_date?: string ISO date (default today)
process_type: "pulp" | "juice"        (required — drives auto diary plan)
target_volume_liters?: number|null (positive)     // needed for Calculate
target_abv?: number|null (0–100)                  // needed for Calculate; > tolerance ⇒ warning
planned_sweetness?: "dry"|"semi_dry"|"semi_sweet"|"sweet" (default "dry")  // ≠ "dry" ⇒ Sweetness Sugar card renders
yeast_name?: string|null
yeast_alcohol_tolerance?: number|null (0–100)
fermentation_sugar_kg?: number ≥0 (default 0)
sweetness_sugar_kg?: number ≥0 (default 0)
ingredients?: [{ name: string(min1), amount_liters: number ≥0, sugar_content_percent?: number(0–100)|null }] (default [])
diary_entries?: [{ description: string(min1), entry_date?: string|"" , notes?: string|null, completed?: boolean }] (optional)
```

Critically, `POST` runs `generateProcessPlan()` and inserts the resulting steps as **`entry_type='auto'`** at creation time (`src/pages/api/batches/index.ts:44-56`). So one POST with a valid `process_type` seeds a batch that already has auto diary entries. _(Authoring guard: have the Risk #3 spec assert `GET /api/batches/{id}/diary` returns entries after the seed, so it fails loudly if the plan wasn't generated rather than silently testing an empty list.)_

- **`PUT /api/batches/{id}`** (`src/pages/api/batches/[id]/index.ts:28-59`) — `updateBatchSchema = createBatchSchema.partial()`; **200**. Use to pre-seed a specific ingredient order or sugar value before a reload assertion.
- **`DELETE /api/batches/{id}`** (`src/pages/api/batches/[id]/index.ts:61-83`) — **204**; cascades to `diary_entries`. Cleanup lever.
- **`GET /api/batches/{id}`** — **200** `{ data: Batch }` (includes `ingredients` JSONB in array order, both sugar columns) — lets a spec cross-check persisted state via API if the DOM oracle is insufficient.

**Diary endpoints** under `src/pages/api/batches/[id]/diary/`:

- `index.ts` **GET** (`:8-31`) list, ordered `entry_date ASC, created_at ASC`; **POST** (`:33-73`) create a **user** entry (`entry_type` hardcoded `'user'`, `:61`), **201**, body `{description, entry_date?, notes?, completed?}`.
- `[entryId].ts` **PUT** (`:8-46`) edit (**200**) — changing `description`/`notes` on an auto entry fires the DB promotion trigger; **DELETE** (`:48-67`) **204**.
- `regenerate.ts` **POST** (`:9-54`) — delegates to the `regenerate_diary_entries` RPC, then re-fetches ordered `entry_date ASC, created_at ASC`; **200** `{ data: DiaryEntry[] }`. Reads **persisted** batch params (fetches the batch row, `:22`), not form state — so the E2E must **save the form before regenerating** for changed params to matter. Accepts any/empty JSON body.

**Ownership/auth:** `src/middleware.ts` gates `/batches` and `/api/batches` and attaches `context.locals.user`; routes filter by `user.id`; RLS (`supabase/migrations/20260530213000_batch_schema_with_rls.sql:68-81`) scopes every row to `auth.uid() = user_id`. `page.request` inherits the `storageState` cookies, so seeds/cleanup run as the test user only — **no service account** (Decision #2 from prior research holds).

Types live in `src/types.ts`: `Batch` (`:9-25`), `Ingredient` (`:3-7`), `DiaryEntry` (`:39-49`), `DiaryEntryType` (`:37`), `SweetnessLevel` (`:1`), `ApiResponse` (`:65`). API helpers `src/lib/api.ts`: `jsonOk`/`jsonCreated`/`jsonValidationError`.

### Risk #3 — diary Regenerate (preserve user, delete+rebuild auto)

**Ground truth (RPC) — re-confirmed, no drift.** `supabase/migrations/20260614130000_diary_entries_process_plan.sql`:

- `regenerate_diary_entries(p_batch_id)` (`:47-61`): `DELETE ... WHERE entry_type='auto'` (`:56`) then re-inserts fresh auto rows with `completed=false` hardcoded (`:57-59`). **`user` rows are never touched.**
- `promote_diary_entry_type` trigger (`:29-44`): promotes `auto`→`user` **only** when `description` or `notes` changes (`:32-34`); explicitly **excludes** `entry_date` and `completed` (`:26-28`).

**Target behavior statement (use verbatim in the plan/spec):**

> Regenerate **preserves `user` entries** (both manually-added and former-auto entries whose description/notes the user edited) and **deletes + rebuilds `auto` entries**, resetting their `completed` flag to false. It does NOT remove user-added entries. The rebuilt list renders in ascending `entry_date` order.

**Regenerate button** (`DiarySection.tsx:202-212`): edit-mode only; label is **"Generate Plan"** when `entries.length === 0` else **"Regenerate"**; `disabled={regenerating}` only — **no dirty-guard, no confirm dialog, no reload** (`handleRegenerate` `:132-149` calls the API and `setEntries(...)` in place). Locator: `getByRole('button', { name: /Regenerate|Generate Plan/i })`.

**Dirty-guard is still NOT implemented.** `context/changes/regenerate-dirty-guard/change.md` is `status: proposed` (`:4`); `DiarySection` takes no `isDirty` prop (`:13` interface) and BatchForm passes none (`:458-477`). So the spec **saves first** (to persist params) but **cannot assert a disabled-when-dirty button** — that state does not exist yet. (A form-wide `beforeunload` guard exists, but the regenerate action isn't wired to it.)

**DOM-only oracle (entry_type invisible).** `EntryRow` renders only description/date/notes/completed (`DiarySection.tsx:226-238`); completed styling is `line-through` on the description `<p>` (`EntryRow.tsx:133`) plus the unlabeled toggle button's checked state (`:54-65`). Author the oracle from DOM signals only:

1. **User-added entry survives:** seed/add a diary entry with a unique description (`E2E user note <ts>`) → Save → Regenerate → assert `getByText('E2E user note <ts>')` still visible.
2. **User-edited auto entry survives (promotion):** edit an existing auto entry's **description** to a unique marker → Save → Regenerate → marker still visible (it was promoted to `user`).
3. **Auto entry wiped/rebuilt:** pick an auto entry by its known generated description, toggle it complete (line-through appears) → Regenerate → assert it is **back to not-completed** (regenerated auto entries have `completed=false`). _(Locator caveat: the toggle has no accessible name — scope by the entry's description text or use `getByTestId`.)_

**Ordering (optional assertion):** `DiarySection.tsx:20-31` client-sorts by `entry_date` then `created_at`, default `"asc"` from `localStorage["fermenta:diary-sort-order"]`; a fresh Playwright context has empty localStorage → deterministic ascending order matching the API. A `Sort` toggle (`:187-194`, `title="Sort ..."`) can flip it — leave it untouched to rely on the default.

**Seeding the Risk #3 batch (recommended):** `POST /api/batches` with a valid `process_type` (auto entries generated at creation, `index.ts:44-56`) → `POST /api/batches/{id}/diary` to add a unique **user** entry → (optionally `PUT` an auto entry's description to a marker to exercise promotion) → open `/batches/{id}` → Regenerate → assert oracle → `finally` DELETE.

### Risk #7a — sugar fields (Calculate AND manual input) round-trip; Cancel guard

**Two sugar cards** (`SugarCard`, `IngredientsSection.tsx:38-84`):

- **"Fermentation Sugar"** (icon 🍬) — always rendered (`:167-179`).
- **"Sweetness Sugar"** (icon 🍯) — rendered **only when `planned_sweetness !== "dry"`** (`:180-194`). To test it, seed `planned_sweetness: "semi_sweet"` (or any non-dry). Note: switching sweetness back to `"dry"` in the form force-zeros `sweetness_sugar_kg` (`BatchForm.tsx:152`).

**Collapsed card = a button showing the value:** `getByRole('button', { name: /Fermentation Sugar/ })`; the value badge renders `{parseFloat(amountKg.toFixed(3))} kg` (`:79-81`) — e.g. `3.5 kg`. Assert persistence by reading that badge text after reload.

**Expanded card = manual-input path (NEW grounding):** clicking the card toggles edit (`onToggleEdit`, `:175-178/:189-192`) and renders a number `<input>` labeled "Amount (kg)" (`:48-59`). Typing calls `onChange(parseFloat(...)||0)` (`:54-56`) → `onBatchChange({ fermentation_sugar_kg })` / `({ sweetness_sugar_kg })` (`:171-173/:185-187`) → merged into BatchForm state and dirty-flagged → PUT save persists. **Locator gap:** the "Amount (kg)" label is not associated with the input (`:48` no `htmlFor`, `:49` no `id`) → `getByLabel` fails; use `getByRole('spinbutton')` scoped to the expanded card or a `data-testid`. A "Done" button (`:62-64`) collapses the card.

**Calculate path:** `🧮 Calculate` button (`:195-203`), `disabled` unless `target_volume_liters && target_abv` (`canCalculate`, `:155/:198`). `handleCalculate` (`:122-138`) runs `calculateSugar(...)` and sets **both** sugar fields. So the Calculate seed must include `target_volume_liters` + `target_abv` (and ideally ingredients). Locator: `getByRole('button', { name: /Calculate/ })`.

**Save / reload:** `PUT /api/batches/{id}` in `BatchForm.handleSubmit` persists sugar columns and resets the dirty ref; SSR re-initializes the cards from `initialData` on reload, so the collapsed badge shows the persisted value. Save button in edit mode is **"Save Changes"** (two of them, top+bottom → `.first()`/`.last()`).

**Cancel = hard navigation, no restore.** Cancel is a plain `<a href="/batches">Cancel</a>` — **two** of them at `BatchForm.tsx:266-267` and `:485-486`. Locator: `getByRole('link', { name: 'Cancel' })` (role `link` disambiguates from the diary `Cancel` **buttons** in `EntryRow.tsx:106-107` / `DiarySection.tsx:357`). "Reverted after Cancel" means: edit a field (don't save) → Cancel → reopen the batch → the **last-saved** value shows (the unsaved edit was discarded).

**`beforeunload` dirty-guard — native only, assert with caution.** `BatchForm.tsx:131-141` adds a `beforeunload` handler that `preventDefault()`s only when `isDirtyRef.current` (dirtiness computed at `:125-129` by comparing `form`+`ingredients` JSON to `initialValues`). This triggers the browser's **native** "Leave site?" dialog — there is **no** custom React discard modal (the only `AlertDialog` in the area is the separate `DeleteBatchDialog`). No Astro `ClientRouter`/`ViewTransitions` exists, so Cancel is a full unload that _does_ trip the native dialog while dirty. **But** native `beforeunload` is unreliable under Playwright (auto-dismissed; `page.on('dialog')` doesn't fire reliably) → assert the **persistence consequence** (dirty edit → Cancel/reopen → value not persisted), treat the dialog itself as out-of-scope. (Decision #3 from prior research holds.)

### Risk #7b — ingredient drag-reorder (now unblocked; save/reload/cancel)

**React-key bug FIXED (the key drift).** `IngredientsSection` generates a stable `crypto.randomUUID()` per ingredient on mount (`:91-93`), keeps the id list in sync on delete (`:104`), add (`:110`), and reorder (`:151`), and uses it as **both** the React `key` and the dnd-kit `id` (`:225-226`). This resolves the reorder bug the `ingredients-drag-reorder` impl-review caught and makes reorder→save→reload safe to exercise in a browser for the first time.

**Drag handle locator.** `IngredientCard.tsx:134-146` — `<button aria-label={`Reorder ${displayName}`}>` (GripVertical icon), where `displayName = ingredient.name || "New ingredient"` (`:28`). Locator: `getByRole('button', { name: 'Reorder Apple juice' })`. The grip is **hidden while any card is in edit mode** (`!isDragDisabled`, `:134`; `isDragDisabled = editingIndex !== null`, `IngredientsSection.tsx:157`; `useSortable({ disabled })` `IngredientCard.tsx:33-36`) — so all reorder steps must run with **every card collapsed**.

**How to drag in Playwright.** Sensors at `IngredientsSection.tsx:158-162`: `PointerSensor` (activation `distance: 8`), `TouchSensor`, `KeyboardSensor` (with `sortableKeyboardCoordinates`). **Prefer keyboard reorder** (deterministic, no pixel math): focus the grip → `Space` (lift) → `ArrowDown`/`ArrowUp` (move) → `Space` (drop). Mouse `dragTo()` must exceed the 8px activation distance and is flakier.

**Order oracle (collapsed cards).** Each collapsed card exposes the grip button `Reorder {name}` (`:142`), a name span `{displayName}` (`:155`), and an `{amount_liters} L · {sugar_content_percent}%` badge (`:157-160`). Cleanest oracle: `page.getByRole('button', { name: /^Reorder / }).allTextContents()` returns the grip labels **in DOM order**, encoding the ingredient order — compare to expected. (Alternatively collect the name spans via `getByText`.)

**Persistence.** `handleDragEnd` `arrayMove(ingredients, oldIndex, newIndex)` → `onBatchChange` → `setIngredients` → `PUT` save (`IngredientsSection.tsx:140-153`; `BatchForm` merge). Order is JSONB array position on the batch row; SSR renders in saved order on reload. Save+reload → assert new order persisted; reorder→Cancel→reopen → assert **original** order.

**Test setup.** `"+ Add ingredient"` (`IngredientsSection.tsx` add flow) auto-opens an edit form with fields **Name** / **Amount (L)** (`IngredientCard.tsx:79`) / Sugar; a **Done** control collapses it. Seeding ≥2 named ingredients via `POST /api/batches` `ingredients: [...]` is simpler than UI adds and gives deterministic grip labels ("Reorder Apple juice", "Reorder Water").

## Code References

- `tests/e2e/seed.spec.ts` — exemplar (UI create→reload→delete); two-submit-button + delete-alertdialog gotchas.
- `tests/e2e/validation-warning-persistence.spec.ts:13-23,45-48` — API seed via POST + `finally` DELETE cleanup + hydration gate; the skeleton both new specs copy.
- `tests/e2e/AGENTS.md` — locator/wait/cleanup rules; server-side Supabase/AI ⇒ `page.route()` won't intercept.
- `tests/e2e/auth.setup.ts` — one-time sign-in → `storageState` at `tests/e2e/.auth/user.json` (needs `E2E_USERNAME`/`E2E_PASSWORD`).
- `playwright.config.ts` — setup + chromium(storageState) projects; `npm run dev` webServer at `:4321`.
- `src/pages/api/batches/index.ts:8-80` — `POST` create; **generates auto diary plan at `:44-56`**; schema `src/lib/schemas/batch.ts:10-23`.
- `src/pages/api/batches/[id]/index.ts:28-59,61-83` — `PUT` update / `DELETE` (204, cascades).
- `src/pages/api/batches/[id]/diary/index.ts:8-31,33-73` — diary GET / POST (user entry, `:61`).
- `src/pages/api/batches/[id]/diary/[entryId].ts:8-46,48-67` — diary PUT / DELETE.
- `src/pages/api/batches/[id]/diary/regenerate.ts:9-54` — POST regenerate; reads persisted params (`:22`), re-fetch ordered (`:42-47`).
- `supabase/migrations/20260614130000_diary_entries_process_plan.sql:47-61` — `regenerate_diary_entries` RPC (delete auto, reinsert `completed=false`).
- `supabase/migrations/20260614130000_diary_entries_process_plan.sql:29-44` — promotion trigger (description/notes only).
- `supabase/migrations/20260530213000_batch_schema_with_rls.sql:68-81` — batch + diary RLS (`auth.uid() = user_id`).
- `src/components/batches/diary/DiarySection.tsx:20-31,187-194,202-212,226-238` — client sort / Sort toggle / Regenerate button / EntryRow props (no `entry_type`).
- `src/components/batches/diary/EntryRow.tsx:54-65,133,141-150` — unlabeled complete-toggle / `line-through` styling / Edit button.
- `src/components/batches/IngredientsSection.tsx:38-84` — `SugarCard` (collapsed button `X kg`; expanded "Amount (kg)" input not label-associated).
- `src/components/batches/IngredientsSection.tsx:90-93,104,110,151,225-226` — stable-UUID React-key fix.
- `src/components/batches/IngredientsSection.tsx:122-138,155,167-203` — Calculate handler / `canCalculate` / sugar cards + Calculate button.
- `src/components/batches/IngredientsSection.tsx:140-153,157-162` — `handleDragEnd`/`arrayMove` / `isDragDisabled` + sensors.
- `src/components/batches/IngredientCard.tsx:33-36,134-146,148-160` — `useSortable(disabled)` / grip `aria-label="Reorder {name}"` / collapsed name span + `{L} · {%}` badge.
- `src/components/batches/BatchForm.tsx:125-141,152,266-267,485-486` — dirty ref + native `beforeunload` / sweetness→dry zeroing / two Cancel `<a>` links.
- `src/lib/services/batch-validation.ts:36-42` — `abv-exceeds-tolerance` (`target_abv > yeast_alcohol_tolerance`) ⇒ inconsistent plan (for seeds that must include/avoid warnings).
- `src/types.ts:1-49,65` — `SweetnessLevel`/`Ingredient`/`Batch`/`DiaryEntryType`/`DiaryEntry`/`ApiResponse`.

## Architecture Insights

- **SSR re-initializes island state on every full load.** `BatchForm`/`DiarySection`/`SugarCard` derive initial state from server props, so a real reload is the canonical "persisted truth" assertion point for every round-trip oracle (sugar value, ingredient order, warning reappearance).
- **Two persistence mechanisms behind two reload behaviors.** Sugar fields and ingredient order are batch-row state (JSONB `ingredients` + dedicated sugar columns) saved via `PUT /api/batches/{id}`; diary entries are their own table mutated by the regenerate RPC. The specs must seed/assert against the right mechanism.
- **`auto` vs `user` is a server-side lifecycle with no DOM projection.** The promotion trigger (keyed on description/notes) is the only bridge between "user touched it" and "it survives regenerate." Any Risk #3 oracle must be DOM-observable (text + completed styling).
- **dnd-kit exposes accessible drag affordances.** The grip `aria-label` + `KeyboardSensor` make reorder testable through role/keyboard interactions, keeping the spec on the getByRole-first rule and avoiding brittle pixel drags. The stable-UUID keys guarantee DOM↔ingredient mapping survives reorder.
- **Accessibility debt surfaces as locator gaps, not bugs.** The unassociated "Amount (kg)" label and the nameless complete-toggle are the two places where the getByRole/getByLabel-first rule can't reach cleanly; `AGENTS.md` sanctions a `getByTestId` fallback for exactly these ambiguous cases.

## Historical Context (from prior changes)

- `context/changes/test-plan-refresh-2026-07-11/research.md` — the prior grounding (commit `a51cbb5`) this doc re-verifies; Decisions #1–#3 (DOM-only Risk #3 oracle, logged-in-user seeding, native-`beforeunload` scope) remain locked inputs.
- `context/changes/regenerate-dirty-guard/change.md` — `status: proposed`, unimplemented; confirms the "disabled-when-dirty" Regenerate state cannot be asserted yet.
- `context/changes/ingredients-drag-reorder/` — added @dnd-kit reorder, **explicitly skipped E2E**, and impl-review caught a React-key bug — now fixed via stable UUIDs; justifies mapping reorder→save→reload into Risk #7 as genuinely-new browser coverage.
- `context/changes/sugar-fields-refactoring/` + `sugar-calculation-improvements/` — moved sugar to dedicated batch columns (`fermentation_sugar_kg`/`sweetness_sugar_kg`, migration `20260613140000`) and the Calculate flow; grounds the current field semantics the round-trip targets.
- `context/changes/expose-step-key/` + `diary-consolidation/` — the step-key preserve-user-edits intent and the auto/user diary model the RPC rebuilds; matches the verified regenerate behavior.
- `context/changes/ingredients-calculation-validation/` — source of the Risk #2 warning already covered by `validation-warning-persistence.spec.ts` (out of scope here, referenced for seed semantics).

## Related Research

- `context/changes/test-plan-refresh-2026-07-11/research.md` — prior E2E grounding for risks #2/#3/#7 (this doc is the implementation-focused re-grounding for #3/#7 at the current commit).

## Decisions (carried forward; no new open questions)

1. **Risk #3 oracle is DOM-only** — auto vs user distinguished by description text (unique markers for user-added/promoted; known generated text for auto) + completed styling; the "auto wiped" signal is `completed → false` after toggling one complete and regenerating. No DB assertions.
2. **All seeding runs as the logged-in user** via `POST /api/batches` under `storageState`; cleanup via `DELETE` in `finally`. No service-role/admin writes.
3. **`beforeunload` is native and out of Risk #7a's assertion scope** — assert the persistence consequence (dirty edit → Cancel/reopen → value not persisted), not the native dialog.

## Open Questions

- None blocking. Two authoring-time confirmations for `/10x-e2e`: (a) pick the scoping approach for the unlabeled "Amount (kg)" sugar input (scoped `spinbutton` vs a small `data-testid`); (b) pick the locator for the nameless diary complete-toggle (description-scoped vs `data-testid`). Both are covered by `AGENTS.md`'s ambiguity clause and don't require code changes — but adding two `data-testid`s would be the lowest-friction path if the plan prefers it.

## Recommended spec layout (input for /10x-plan → /10x-e2e)

- `tests/e2e/diary-regenerate-preserve-rebuild.spec.ts` — Risk #3.
- `tests/e2e/ingredient-order-roundtrip.spec.ts` — Risk #7b (drag-reorder save/reload/cancel).
- `tests/e2e/sugar-fields-roundtrip.spec.ts` — Risk #7a (Calculate **and** manual input; save/reload + Cancel-discard). _(Could merge #7a/#7b into one round-trip spec, but separate files keep one-risk-per-file per `AGENTS.md`.)_
