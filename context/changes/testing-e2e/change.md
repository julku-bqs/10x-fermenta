---
change_id: testing-e2e
title: "E2E UI-wiring coverage: diary regenerate + sugar/ingredient round-trip"
status: implemented
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Open a change folder for rollout Phase 5 of context/foundation/test-plan.md: "E2E UI-wiring coverage".
Risks in this phase: #2, #3, #7 — but #2 (validation-warning display/dismiss/non-persistence) is ALREADY covered by tests/e2e/validation-warning-persistence.spec.ts. Scope this change to the two remaining risks:

- #3 — diary Regenerate preserve-and-rebuild
- #7 — sugar-field + ingredient-order save/cancel/reload round-trip
  Test types planned: e2e (Playwright; harness already wired — playwright.config.ts, tests/e2e/auth.setup.ts, seed.spec.ts, AGENTS.md).
  Risk response intent (from test-plan.md §2 Risk Response Guidance):
- #3: prove the browser Regenerate wiring — user-added diary entries survive, auto-generated entries are deleted and rebuilt, and the list stays in correct date order; unit still owns which steps a plan generates. Anti-pattern to avoid: asserting a snapshot of current output.
- #7: prove the full save/cancel/reload round-trip — a drag-reorder of ingredients survives save+reload and is reverted after Cancel, and batch-level sugar fields round-trip from both Calculate and manual input; integration still owns the field-level lifecycle. Anti-pattern to avoid: testing only the Calculate->Save path.
  After creating the folder, follow the downstream continuation rule: suggest /10x-research next, scoped to grounding risks #3 and #7 for e2e (DOM roles/labels, API seed/cleanup boundaries, regenerate + round-trip semantics).
