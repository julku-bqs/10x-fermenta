# Rubric — correctness

The `<Output>` above is a JSON `ReviewResult` produced by a code-review agent
that reviewed one deliberately-flawed PR. Judge **only** the **correctness**
criterion: whether the review's `findings` correctly identify the seeded logic
bugs below.

Seeded correctness flaws the review should surface:

1. `sumSugarReadings` in `src/lib/services/export-metrics.ts` has an off-by-one
   loop (`i <= readings.length`) that reads one past the end (`undefined` →
   `NaN` result).
2. `src/pages/api/batches/quick-export.ts` performs an unguarded division that
   can divide by zero (e.g. volume of `0`), producing `Infinity`/`NaN`.

Scoring — return a `score` in `[0, 1]`:

- **1.0** — both correctness flaws are clearly and correctly identified.
- **partial** — proportional to how many are correctly surfaced (a finding must
  name the real bug, not a vague nearby remark).
- **0.0** — neither is identified.

Only credit findings that address correctness. Do not reward generic or
speculative comments, and do not penalize the review for issues that belong to
other criteria (they are scored separately).
