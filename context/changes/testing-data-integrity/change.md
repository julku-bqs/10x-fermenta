---
change_id: testing-data-integrity
title: Data integrity and interaction tests (test-plan Phase 2)
status: planned
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Data integrity and interaction".
Risks covered: #4 (ingredient→calculation data flow), #5 (API input validation), #7 (sugar field save/cancel/reload lifecycle).
Test types planned: unit + integration.

Risk response intent:

Risk #4: Prove ingredient sugar aggregation matches independently derived expected totals through the full pipeline (ingredients → aggregation → calculation → persisted fields); challenge "if the formula unit test passes, the full pipeline is correct"; avoid testing only the formula in isolation.
Risk #5: Prove routes reject malformed input with structured errors and do NOT write to DB; challenge "if zod is imported, validation is working"; avoid happy-path-only testing.
Risk #7: Prove save→reload roundtrip matches input and cancel restores last-saved values; challenge "if the field is bound to the form, save/cancel just works"; avoid testing only Calculate→Save without manual-edit→Save or edit→Cancel paths.
