/**
 * Derived coverage aggregate for the eval harness.
 *
 * promptfoo's per-test score is an arithmetic mean of assertion scores, which
 * lets a model hide a fully-missed criterion behind easy wins on the others.
 * `coverage` combines the five per-criterion judge scores into one directional
 * summary that penalizes uneven coverage more than a naive mean:
 *
 *   0.5 * (weighted harmonic mean) + 0.5 * (worst-criterion floor)
 *
 * The harmonic mean is dominated by the smallest terms (any low criterion drags
 * it down), and the min-criterion floor makes a single zeroed family sink the
 * aggregate outright. Weights emphasize the highest-risk families so missing
 * tenant isolation or a destructive migration costs more than missing a nitpick.
 *
 * This is a directional summary of one non-deterministic run (n=1), not a
 * statistical measure. It never affects pass/fail — it is a `derivedMetrics`
 * value, purely a comparison axis in the report.
 *
 * Kept free of any promptfoo import so it stays trivially unit-testable; the
 * `derivedMetrics` value is a `(namedScores, context) => number` function and
 * this signature is structurally assignable to it.
 */

/** The five review criteria, matching the `metric` names on the rubric asserts. */
export const CRITERIA = [
  "domain_integrity",
  "correctness",
  "input_contract",
  "security_isolation",
  "data_migration",
] as const;

export type CriterionKey = (typeof CRITERIA)[number];

/**
 * Tunable weights (documented defaults). Security isolation and data-migration
 * safety carry the most real-world risk on this diff, so they weigh heaviest;
 * domain integrity (the bulk of the seeded math bugs) is next; correctness and
 * input contracts round it out.
 */
export const WEIGHTS: Record<CriterionKey, number> = {
  security_isolation: 3,
  data_migration: 3,
  domain_integrity: 2,
  correctness: 1,
  input_contract: 1,
};

/** Small epsilon so a zeroed criterion never divides by zero in the harmonic mean. */
const EPSILON = 1e-9;

/**
 * Blend a weighted harmonic mean of the five criterion scores with the
 * worst-criterion floor. Unknown/missing criteria are treated as `0` (fully
 * missed); any extra named scores in the map (e.g. `verdict_blocked`) are
 * ignored. Returns a number in ~`[0, 1]`.
 */
export function coverage(scores: Record<string, number>, _context?: unknown): number {
  const wsum = CRITERIA.reduce((acc, k) => acc + WEIGHTS[k], 0);
  const denom = CRITERIA.reduce((acc, k) => acc + WEIGHTS[k] / ((scores[k] ?? 0) + EPSILON), 0);
  const harmonic = wsum / denom;
  const minCriterion = Math.min(...CRITERIA.map((k) => scores[k] ?? 0));
  return 0.5 * harmonic + 0.5 * minCriterion;
}
