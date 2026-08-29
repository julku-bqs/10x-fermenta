---
change_id: grader-deterministic-scoring
title: "Deterministic grader scoring: model classifies, code scores"
status: new
created: 2026-08-29
updated: 2026-08-29
archived_at: null
---

## Notes

Seeded from the code-review-evals review follow-up (FU-1 in
`context/changes/code-review-evals/follow-ups/review-fixes.md`). Scope: the
grader provider and the scoring module only.

**Source finding:** F2 (code-review-evals impl-review) — the grader's JSON
extraction is a greedy first-`{`…last-`}` slice
(`packages/code-reviewer/evals/providers/copilot-grader.ts`). F2 was accepted
as-is: the slice is a safe-degrading fallback (`pass` stays `true`, never gates)
behind a direct `JSON.parse`, and the Copilot SDK exposes no structured-output /
JSON-mode option to remove it at the source.

**Why this change:** Having the grader emit a free-form JSON object and then
salvaging it from prose is the smell. The fix is to change _what we ask the
judge for_ so the score never depends on parsing a model-emitted JSON blob.

**Approach — deterministic metric from a findings count ("model classifies, code
scores"):** Enumerate the rubric's known flaws as discrete items. Ask the judge,
per flaw, whether the review-under-test correctly surfaced it (yes/no), validated
against the known flaw-ID set. Compute the score in code:
`score = caught / total` (optionally weighted, reusing the `WEIGHTS` philosophy
in `evals/scoring/coverage.ts`).

- **Pro:** Score is deterministic, interpretable, and explainable; the LLM only
  does fuzzy classification ("was flaw X mentioned?" — its strength); parsing
  collapses to a checkable list, not free-form JSON; aligns with the codebase's
  existing deterministic-scoring ethos (`coverage.ts`).
- **Con:** Slightly more prompt engineering to enumerate flaws as discrete
  checkable items; still parses a constrained list (but validatable against the
  known ID set).
