# Rubric — domain_integrity

The `<Output>` above is a JSON `ReviewResult` produced by a code-review agent
that reviewed one deliberately-flawed PR. Judge **only** the **domain_integrity**
criterion: whether the review's `findings` correctly identify the seeded
home-winemaking domain-math bugs below.

Seeded domain_integrity flaws the review should surface:

1. `computeTotalSugar` in `src/lib/services/export-metrics.ts` multiplies
   `kg × volume` with no kg→g conversion — dimensionally wrong (grams expected).
2. `estimateAbv` in `src/lib/services/export-metrics.ts` uses a bogus
   `sugarPerLiter / 10` formula (not a valid ABV estimate).
3. `classifyDryness` in `src/lib/services/export-metrics.ts` has **inverted**
   thresholds (`> 45 ? "dry" : "sweet"` — high residual sugar labelled "dry").
4. The call site in `src/pages/api/batches/quick-export.ts` calls
   `classifyDryness(sugarKg / volume)` — a unit bug feeding kg/L where g/L is
   expected.

Scoring — return a `score` in `[0, 1]`:

- **1.0** — all four domain_integrity flaws are clearly and correctly identified.
- **partial** — proportional to how many are correctly surfaced (a finding must
  name the real bug, not a vague nearby remark).
- **0.0** — none are identified.

Only credit findings that address domain_integrity. Do not reward generic or
speculative comments, and do not penalize the review for issues that belong to
other criteria (they are scored separately).
