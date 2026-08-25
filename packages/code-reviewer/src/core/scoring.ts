/**
 * The pure severity→verdict state machine the CI workflow gates on, plus the
 * deterministic "decline to review" result for oversize diffs.
 *
 * Model = classifier, code = judge: the model only emits findings; the verdict
 * is derived here, once, from the findings' severities. This is the one piece
 * that truly needs a unit test.
 */
import { MAX_DIFF_CHARS } from "./limits.js";
import type { Finding, ReviewResult, Verdict } from "../schemas/review.js";

/**
 * Derive the gate verdict from the findings' severities.
 *
 * Start at `approved` (also the result for an empty list); short-circuit to
 * `blocked` on the first `blocker`/`high`; otherwise upgrade to `flagged` if any
 * `medium` is seen; else stay `approved`. `pass` is `false` only when `blocked`.
 * Never returns `declined` — that is reserved for the oversize decline.
 */
export function deriveVerdict(findings: Finding[]): Verdict {
  let decision: Verdict["decision"] = "approved";
  for (const f of findings) {
    if (f.severity === "blocker" || f.severity === "high") {
      decision = "blocked";
      break;
    }
    if (f.severity === "medium") decision = "flagged";
  }
  return { decision, pass: decision !== "blocked" };
}

/**
 * The deterministic result for a diff that exceeds `MAX_DIFF_CHARS`: no LLM call
 * is made. Forces a `declined`/`pass:true` verdict (a "not reviewed" outcome
 * that must never read as an approval), empty findings/nitpicks, and zeroed cost.
 */
export function declinedTooLongResult(diffLength: number): ReviewResult {
  return {
    summary:
      `Diff not reviewed: it is ${diffLength} characters, which exceeds the ${MAX_DIFF_CHARS}-character limit for ` +
      `automated review. Split the change into smaller pull requests to get an AI review of each.`,
    findings: [],
    nitpicks: [],
    cost: { tokensIn: 0, tokensOut: 0 },
    verdict: { decision: "declined", pass: true },
  };
}
