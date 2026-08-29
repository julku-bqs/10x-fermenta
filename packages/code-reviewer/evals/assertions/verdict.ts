import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";

import { ReviewResultSchema } from "../../src/index.js";

/**
 * The deterministic hard gate: on this seeded, deliberately-flawed diff a
 * competent review MUST fail the PR. Passes only when the code-derived verdict
 * is `decision: "blocked"` and `pass: false` (the model never emits the
 * verdict — it's derived from finding severities).
 *
 * A parse failure fails the assertion with a clear reason, so a structurally
 * broken response can never sneak past the gate.
 */
export function reviewActuallyFails(
  output: string | object,
  _context?: AssertionValueFunctionContext,
): GradingResult {
  let parsed: unknown;
  try {
    parsed = typeof output === "string" ? JSON.parse(output) : output;
  } catch (err) {
    return {
      pass: false,
      score: 0,
      reason: `Output is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = ReviewResultSchema.safeParse(parsed);
  if (!result.success) {
    return {
      pass: false,
      score: 0,
      reason: `Output is not a well-formed ReviewResult: ${result.error.message}`,
    };
  }

  const { decision, pass: verdictPass } = result.data.verdict;
  const blocks = decision === "blocked" && verdictPass === false;
  return {
    pass: blocks,
    score: blocks ? 1 : 0,
    reason: blocks
      ? "Review fails the PR (verdict.decision=blocked, verdict.pass=false)."
      : `Review did not fail the PR (verdict.decision=${decision}, verdict.pass=${String(verdictPass)}).`,
  };
}
