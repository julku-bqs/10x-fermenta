---
change_id: test-plan-refresh-2026-07-11
title: Refresh test plan to add Playwright E2E coverage for risks #2, #3, #7
status: implemented
created: 2026-07-11
updated: 2026-07-11
archived_at: null
---

## Notes

Refresh (--refresh) of context/foundation/test-plan.md to add Playwright E2E coverage. E2E was previously "deliberately excluded"; user reversed this on 2026-07-11. Groundwork already exists (uncommitted): playwright.config.ts, tests/e2e/{AGENTS.md, auth.setup.ts, seed.spec.ts}, @playwright/test 1.61.1, npm run test:e2e. This change updates the PLAN DOCUMENT; actual specs are authored later via /10x-e2e, one risk at a time.

Scope: narrowed to 3 risks (E2E is expensive — no wide net). E2E asserts behavioral UI wiring, never pixels.

- Risk #2 (Validation warnings): unit proves WHICH warnings fire; E2E proves the warning IS displayed when the plan is inconsistent, Dismiss closes it, and it REAPPEARS after refresh (dismissal not persistent). Do not re-test which warnings fire in E2E.
- Risk #3 (Regenerate diary plan): after Regenerate, `user` entries are PRESERVED and `auto` entries are DELETED + REBUILT (completed reset to false). The test must set up and track two survival cases: (a) an entry the user ADDED, and (b) an `auto` entry the user MODIFIED — editing description/notes promotes auto→user so it survives (editing only date/completed does NOT promote → it gets wiped). Grounded in the regenerate_diary_entries RPC (regenerate.ts delegates to it); confirms expose-step-key ("preserve user edits to non-auto entries"). Verify correct date order (route re-fetches entry_date ASC, created_at ASC). Regenerate reads PERSISTED params → save first; the regenerate-specific dirty-guard (regenerate-dirty-guard) is status: proposed / NOT implemented (only a form-wide beforeunload guard exists), so there is NO disabled-when-dirty state to assert. entry_type is NOT rendered in the DOM → infer preserve/wipe via unique description markers + completed styling (line-through), not by reading the type. Do NOT assert specific generated step content (unit's job).
- Risk #7 (save/cancel/reload round-trip, extended): (a) sugar fields Calculate->form-state->save->reload preserves value; the unsaved-changes guard on Cancel is the browser's NATIVE beforeunload (no React modal; no ClientRouter, so Cancel is a hard nav) — fragile in Playwright, so assert the persistence consequence (dirty edit -> Cancel/reopen -> value not persisted), NOT the native dialog. (b) ingredient drag-reorder (newly mapped to #7) preserved after save+reload, reverted after cancel — reorder->save->reload has zero browser coverage today (ingredients-drag-reorder plan skipped E2E; impl-review caught a React-key reorder bug).

Dropped: Risk #1 E2E (excluded — formula stays unit); critical-path smoke / island-hydration (seed.spec.ts already covers create->reload->delete); Risk #6 page ownership (Phase 3 integration owns it).

Document edits: §2 extend Risk Response Guidance for #2/#3/#7 (generalize #7 wording to cover ingredient order); §3 add Phase 5 "E2E UI-wiring coverage" (risks #2,#3,#7; type e2e; specs via /10x-e2e); §4 flip e2e row to Playwright 1.61.1 + update browser grounding (checked 2026-07-11); §5 add "e2e on critical flows — CI on PR — required after Phase 5"; §6 insert 6.4 "Adding an e2e test" (ref tests/e2e/AGENTS.md, seed.spec.ts, auth.setup.ts; run npm run test:e2e) and move current 6.4 Per-rollout-phase notes to 6.5; §7 reframe (e2e included for behavioral wiring, pixel/visual regression stays negative space); §8 bump dates to 2026-07-11. Housekeeping: leave §3 Phase 3 "change opened" as-is (WIP, landing soon).

## Grounding note (2026-07-11 — see research.md)

All three risks were grounded against live code; findings, code refs (file:line), and the resolved beforeunload scope live in research.md. The risk bullets above state the target behavior to plan against.
