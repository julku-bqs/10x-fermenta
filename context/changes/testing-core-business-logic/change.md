---
change_id: testing-core-business-logic
title: Core business logic tests — audit and rebuild (Phase 1)
status: implementing
created: 2026-06-21
updated: 2026-06-25
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Core business logic (audit + rebuild)".
Risks covered: #1 (sugar calculation incorrect), #2 (validation rules fail to warn), #3 (process plan wrong/missing steps).
Test types planned: unit.

Risk response intent:
- Risk #1: Prove calculation output matches independently derived expected values for both dry and non-dry wines. Challenge: happy-path dry-wine test does not imply non-dry correctness. Avoid: oracle problem (assertions copied from implementation).
- Risk #2: Prove all three validation rules fire at correct boundaries AND do not fire below them. Challenge: testing warning existence is not testing the threshold. Avoid: implementation mirror.
- Risk #3: Prove both templates (pulp x juice) crossed with both sweetness modes (dry x non-dry) produce correct conditional steps. Challenge: template compiling does not mean output is correct. Avoid: snapshot of current output as assertion.

Existing test base is untrusted (4 AI-generated files in src/lib/). This phase must audit them against business rules, remove or rewrite tests that mirror implementation, and establish the canonical test patterns for this project.
