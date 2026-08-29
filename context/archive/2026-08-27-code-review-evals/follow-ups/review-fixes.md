# Review follow-ups — code-review-evals

Queued from `/10x-impl-review` triage. Items here are deferred design work, not
blocking fixes.

## FU-1 — Redesign grader scoring to avoid parsing JSON out of LLM prose

**Source finding:** F2 (impl-review.md) — "Grader JSON extraction is a greedy
first-`{`…last-`}` slice" (`packages/code-reviewer/evals/providers/copilot-grader.ts:154`).

**Decision on F2 itself:** Skipped/accepted. The greedy slice is a safe-degrading
fallback (`pass` stays `true`, never gates) behind a direct `JSON.parse` happy
path, and the live run parsed all 15 grader replies. The Copilot SDK exposes no
structured-output / JSON-mode option (`SessionConfigBase` has no
`responseFormat` / `json_schema`), so the fallback cannot be removed by
constraining the model at the source.

**Why revisit:** Having the grader emit a free-form JSON object and then salvaging
it from prose is the smell. The better fix is to change _what we ask the judge for_
so the score never depends on parsing a model-emitted JSON blob.

### Option A — Split prompts, compile JSON in code

Ask the judge in two single-purpose turns: one returns only a score, the other
only a one-sentence reason. Compile the `{ score, reason }` object in code.

- **Pro:** No JSON-from-LLM parsing; each reply is a single simple value.
- **Con:** Doubles grader calls (≤15 → ≤30 → cost/latency); a bare score still
  needs numeric extraction; two independent generations can yield a reason that
  doesn't match the score (incoherence).

### Option B — Deterministic metric from a findings count (recommended)

Enumerate the rubric's known flaws as discrete items. Ask the judge, per flaw,
whether the review-under-test correctly surfaced it (yes/no), validated against
the known flaw-ID set. Compute the score in code: `score = caught / total`
(optionally weighted, reusing the `WEIGHTS` philosophy in
`evals/scoring/coverage.ts`).

- **Pro:** Score is deterministic, interpretable, and explainable; the LLM only
  does fuzzy classification ("was flaw X mentioned?" — its strength); parsing
  collapses to a checkable list, not free-form JSON; aligns with the codebase's
  existing deterministic-scoring ethos (`coverage.ts`).
- **Con:** Slightly more prompt engineering to enumerate flaws as discrete
  checkable items; still parses a constrained list (but validatable against the
  known ID set).

**Recommendation:** Option B — "model classifies, code scores." It removes the
reliance on a well-formed model float, makes the metric auditable, and matches
`coverage.ts`. Option A is simpler conceptually but costs 2× calls and risks
score/reason incoherence.

**Suggested next step:** Promote to its own change via `/10x-new`
(e.g. `grader-deterministic-scoring`) when ready to pursue; scope it to the
grader provider and the scoring module only.
