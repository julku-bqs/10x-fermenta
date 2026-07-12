# E2E UI-Wiring Coverage (Risk #3 + Risk #7) — Plan Brief

> Full plan: `context/changes/testing-e2e/plan.md`
> Research: `context/changes/testing-e2e/research.md`

## What & Why

Author three Playwright E2E specs proving browser-level UI wiring for the two remaining risks of **test-plan.md Phase 5**: diary Regenerate (#3) must preserve user entries while rebuilding auto ones, and editable batch state (#7) — sugar fields and drag-reorder ingredient order — must round-trip correctly through save/cancel/reload. Risk #2 is already shipped, so it's out of scope. These are UI-wiring risks that only exist in the rendered browser, which is exactly what E2E is for.

## Starting Point

The harness is fully wired (`playwright.config.ts`, `auth.setup.ts`, `storageState`) with two exemplar specs that define the required shape — API seed via `POST /api/batches` → `finally` DELETE cleanup → hydration gate. `POST /api/batches` auto-generates the diary plan at creation, and the ingredient drag-reorder React-key bug was already fixed via stable UUIDs, so both risks are E2E-authorable now.

## Desired End State

Three new committed specs (`diary-regenerate-preserve-rebuild`, `sugar-fields-roundtrip`, `ingredient-order-roundtrip`) pass green against the real app and each fails if its risk materializes (confirmed by a deliberate break). Three tiny accessibility edits (label association, toggle accessible name, diary list/listitem roles) let the specs use `getByRole`/`getByLabel`. `npm run test:e2e` runs the full suite green; lint/build/unit stay green.

## Key Decisions Made

| Decision                      | Choice                                                                                          | Why (1 sentence)                                                                             | Source   |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Resolve the a11y locator gaps | Fix a11y in source (`htmlFor`/`id` + state-reflecting `aria-label` + diary list/listitem roles) | Lets specs use the AGENTS.md-preferred role/label locators AND fixes real accessibility bugs | Plan     |
| Spec file layout              | Three files, one risk-facet each                                                                | Matches AGENTS.md one-test-per-file and research's recommended layout                        | Research |
| Risk #3 oracle depth          | All three DOM oracles + ascending date order                                                    | Covers the full risk statement including the promotion bridge and ordering                   | Plan     |
| Risk #3 "auto wiped" oracle   | Count-based: one completed before → zero completed after regenerate                             | Avoids re-locating a specific toggle; proves rebuild with `completed=false`                  | Plan     |
| Risk #3 ordering determinism  | Seed user entries with explicit `entry_date`s                                                   | Makes interleaved order predictable so the assertion proves real ordering                    | Plan     |
| Risk #7a coverage             | Both cards (seed non-dry): Calculate + manual input + Cancel-discard                            | Meets change.md's "both Calculate and manual input" and exercises the conditional card       | Plan     |
| Cancel assertion scope        | Assert persistence consequence, not the native `beforeunload` dialog                            | Native dialog is unreliable under Playwright (research Decision #3)                          | Research |
| Verification rigor            | Deliberate-break confirmation per spec, then restore (not committed)                            | AGENTS.md: "confirm with a deliberate break before trusting the test"                        | Plan     |

## Scope

**In scope:**

- Three minimal a11y source edits (`IngredientsSection.tsx`, `EntryRow.tsx`, `DiarySection.tsx`)
- `diary-regenerate-preserve-rebuild.spec.ts` (Risk #3)
- `sugar-fields-roundtrip.spec.ts` (Risk #7a)
- `ingredient-order-roundtrip.spec.ts` (Risk #7b)

**Out of scope:**

- Risk #2 (already shipped), the regenerate dirty-guard (unimplemented), the native `beforeunload` dialog, the sweetness→dry force-zero edge case
- Any unit/integration re-testing (which steps a plan generates; which validation rule fires; field-level sugar lifecycle)
- Service-account/admin writes; mouse-based drag

## Architecture / Approach

A11y fix first, then one spec per file. Every spec mirrors the exemplar: seed through the real API as the logged-in user, act in the browser, assert a DOM oracle that fails if the risk materializes, and clean up in a `finally`. Internal boundaries (auth/routing/Supabase) stay real; there are no external APIs to mock. Regenerate reads persisted params, so specs save before regenerating. Reorder uses the keyboard sensor for determinism.

## Phases at a Glance

| Phase                                 | What it delivers                                   | Key risk                                                         |
| ------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Accessibility fixes (source)       | Label association + toggle name + diary list roles | An edit subtly changes UI behavior or breaks an existing spec    |
| 2. Risk #3 — diary Regenerate         | Preserve/rebuild + ordering spec                   | Oracle relies on invisible `entry_type` instead of DOM signals   |
| 3. Risk #7a — sugar-fields round-trip | Calculate + manual + Cancel-discard spec           | Testing only Calculate→Save; missing the conditional second card |
| 4. Risk #7b — ingredient-order        | Keyboard reorder save/reload/cancel spec           | Drag flake from the 8px pointer activation distance              |

**Prerequisites:** Local dev env with `E2E_USERNAME` / `E2E_PASSWORD` in `.env`; `npm run dev` reachable at `:4321` (Playwright's `webServer` handles this).
**Estimated effort:** ~1–2 sessions — a quick a11y phase, then three specs authored per-risk (handed to `/10x-e2e`).

## Open Risks & Assumptions

- Assumes `POST /api/batches` reliably generates auto diary entries at creation (guarded by an explicit post-seed `GET .../diary` non-empty check in the Risk #3 spec).
- Assumes a fresh Playwright context has empty `localStorage` so `DiarySection` sorts ascending by default — the specs leave the Sort toggle untouched.
- Keyboard reorder assumed deterministic across the dnd-kit `KeyboardSensor`; if a spec flakes, that is the first suspect.

## Success Criteria (Summary)

- The full E2E suite (`npm run test:e2e`) passes green, including the three new specs.
- Each new spec has been shown to go red under a deliberate break, then green after restore — proving real signal.
- Test runs leave no residue (all seeded `E2E ... <timestamp>` batches are cleaned up).
