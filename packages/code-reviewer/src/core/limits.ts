/**
 * Input-size bounds for a review. A single tuning point so the decline
 * short-circuit and the description trimming stay in sync.
 *
 * `MAX_DIFF_CHARS` drives the oversize-diff decline (see `declinedTooLongResult`
 * and `BaseReviewAgent.review`). `MAX_DESCRIPTION_CHARS` bounds the PR
 * description folded into the prompt.
 */
export const MAX_DIFF_CHARS = 50_000;
export const MAX_DESCRIPTION_CHARS = 3_000;
