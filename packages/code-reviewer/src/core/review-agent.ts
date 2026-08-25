import { MAX_DIFF_CHARS } from "./limits.js";
import { declinedTooLongResult, deriveVerdict } from "./scoring.js";
import type { ReviewResult } from "../schemas/review.js";

/** Everything a review needs: the diff plus optional PR context. */
export interface ReviewInput {
  /** The unified diff to review. */
  diff: string;
  /** Pull-request title, folded into the prompt when present. */
  title?: string;
  /** Pull-request description, trimmed and folded into the prompt when present. */
  description?: string;
}

/**
 * The backend-agnostic seam every review agent implements.
 *
 * Implementations own their own client/session lifecycle and cost accounting;
 * callers depend only on this interface, so a Copilot-backed agent can be
 * swapped or joined by other backends without touching the CLI or a future
 * eval provider.
 */
export interface ReviewAgent {
  /** Review a diff (plus optional PR context) and return a structured result. */
  review(input: ReviewInput): Promise<ReviewResult>;
}

/**
 * Template-method base that owns the two cross-cutting concerns every backend
 * must share, so a half-ready result is unrepresentable even when a concrete
 * agent is constructed directly:
 *
 * 1. Oversize diffs short-circuit to a deterministic `declined` result *before*
 *    any LLM call (no cost, no latency).
 * 2. The gate `verdict` is derived once, in code, from the findings' severities
 *    and attached to every result.
 *
 * Backends implement only {@link BaseReviewAgent.runReview}, returning the
 * verdict-less review; the verdict is never their concern.
 */
export abstract class BaseReviewAgent implements ReviewAgent {
  async review(input: ReviewInput): Promise<ReviewResult> {
    if (input.diff.length > MAX_DIFF_CHARS) {
      return declinedTooLongResult(input.diff.length);
    }
    const raw = await this.runReview(input);
    return { ...raw, verdict: deriveVerdict(raw.findings) };
  }

  /** Backend-specific review hook: produce the review without the verdict. */
  protected abstract runReview(input: ReviewInput): Promise<Omit<ReviewResult, "verdict">>;
}
