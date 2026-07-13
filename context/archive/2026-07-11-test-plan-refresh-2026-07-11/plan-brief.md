# Test-Plan Refresh — Add Playwright E2E Coverage — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-07-11/plan.md`
> Research: `context/changes/test-plan-refresh-2026-07-11/research.md`

## What & Why

Reverse the "e2e deliberately excluded" decision in `context/foundation/test-plan.md` and register a
**narrow** Playwright E2E layer for three risks' browser-level UI wiring (#2 validation-warning
display/dismiss, #3 diary-plan regenerate semantics, #7 save/cancel/reload round-trip incl. ingredient
drag-reorder). E2E is expensive, so this is a deliberately small net that asserts behavioral wiring —
never pixels. This change edits the **strategy document only**; specs come later via `/10x-e2e`.

## Starting Point

`test-plan.md` encodes the exclusion in three coordinated spots (§4 stack row, absent §5 gate, §7
negative-space bullet), lists a stale Vitest `3.2` (repo pins `4.1.10`), and has 4 rollout phases. The
Playwright groundwork already exists uncommitted on branch `e2e` (`playwright.config.ts`, `tests/e2e/*`,
dep + scripts). The doc is also already dirty with an unrelated `testing-access-control` Phase 3 hunk.

## Desired End State

The doc reads coherently as "e2e included for a narrow set of behavioral UI-wiring assertions" across
§2–§8, obeys every schema/parser constraint, and its §4/§6 references point at scaffolding that already
lives in git. Two clean commits exist: (1) scaffolding, then (2) docs. No spec code is added.

## Key Decisions Made

| Decision                     | Choice                                                              | Why (1 sentence)                                                                    | Source   |
| ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Risk #3 regenerate semantics | Assert preserve-`user` / delete+rebuild-`auto` (`completed` reset)  | Grounded against the `regenerate_diary_entries` RPC — original framing was inverted | Research |
| Risk #3 oracle               | DOM-only (description markers + `completed` styling), no DB asserts | `entry_type` is not rendered; keep the test black-box and reliable                  | Research |
| Batch seeding                | Logged-in user (UI / `POST /api/batches` under session)             | Avoid service-role/admin DB writes; mirror `seed.spec.ts`                           | Research |
| Risk #7a Cancel guard        | Assert persistence consequence, not the dialog                      | The guard is native `beforeunload` (no React modal) → fragile in Playwright         | Research |
| Risk #7 scope                | Generalize to include ingredient drag-reorder                       | Drag-reorder is newly mapped to #7 and has zero browser coverage today              | Research |
| Phase 5 §3 Status            | `not started` + `—`                                                 | Only accurate + parser-valid state; `/10x-e2e` advances it when specs land          | Plan     |
| Commit scope                 | Two ordered commits: scaffolding then docs                          | Doc references resolve in git history from day 0                                    | Plan     |
| Vitest version               | Correct `3.2` → `4.1.10` as §4 housekeeping                         | A freshness re-stamp shouldn't leave a known-stale version in the same section      | Plan     |

## Scope

**In scope:**

- Seven surgical edits to `test-plan.md` §2–§8 (guidance rows, Phase 5, e2e stack row + Vitest fix,
  e2e gate, 6.4 cookbook + renumber, §7 reframe, §8 dates).
- Committing the existing Playwright scaffolding as a standalone first commit.
- Advancing `change.md` status.

**Out of scope:**

- Authoring any E2E specs/oracles (that's `/10x-e2e`, one risk at a time).
- Any test/config code beyond committing what exists on disk.
- The `testing-access-control` Phase 3 hunk; committing `.github/copilot-instructions.md`.
- DB-level assertions, service-role seeding, pixel/visual regression, accessibility.

## Architecture / Approach

Documentation refresh, no code logic. Phase 1 is a pure git operation (scaffolding already authored);
Phase 2 makes coordinated table/prose edits where all e2e-related sections (§4 row, §5 gate, §7 bullet)
move together, then commits docs. The document carries only plan-level guidance (1–2 lines per risk);
detailed oracles stay in `research.md` and, later, the specs.

## Phases at a Glance

| Phase                                 | What it delivers                                    | Key risk                                                   |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| 1. Commit e2e scaffolding             | Playwright groundwork as a standalone first commit  | Sweeping in unrelated WIP (`copilot-instructions.md`)      |
| 2. Refresh test-plan.md + docs commit | §2–§8 edits un-excluding e2e; docs committed second | Disturbing the Phase 3 hunk; prettier reflow; parser vocab |

**Prerequisites:** `research.md` complete (done); scaffolding on disk (done); branch `e2e`.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- `test-plan.md` shares the Phase 3 WIP hunk; the docs commit will capture it unless `git add -p` is
  used — assumed acceptable (both statements true, "landing soon").
- The pre-commit prettier hook may reflow markdown tables; assumed near-idempotent since the file was
  previously prettified — normalize + review before committing.
- Phase 5 e2e specs stay unwritten until `/10x-e2e` runs; §4/§6 reference scaffolding that has only the
  `seed.spec.ts` example, not risk-specific specs, until then.

## Success Criteria (Summary)

- `test-plan.md` reads as "e2e included for narrow behavioral UI wiring" coherently across §2–§8, with
  no parser-vocab or schema violations and the true risk-#3 preserve/rebuild semantics.
- Two clean commits exist (scaffolding, then docs); the doc's scaffolding references resolve in git.
- No E2E spec code was added — specs remain a `/10x-e2e` follow-up.
