/**
 * Input-size and session bounds for a review. A single tuning point so the
 * decline short-circuit, description trimming, and Copilot session caps stay
 * in sync.
 *
 * `MAX_DIFF_CHARS` drives the oversize-diff decline (see `declinedTooLongResult`
 * and `BaseReviewAgent.review`). Keep it finite so pathological multi-MB diffs
 * still decline before the first model call. `MAX_DESCRIPTION_CHARS` bounds the
 * PR description folded into the prompt.
 */
export const MAX_DIFF_CHARS = 1_000_000;
export const MAX_DESCRIPTION_CHARS = 3_000;

/** AI-credit soft cap for one Copilot review session. */
export const MAX_AI_CREDITS = 300;

/** Five-minute wait bound for the review session to become idle. */
export const SEND_AND_WAIT_TIMEOUT_MS = 300_000;
