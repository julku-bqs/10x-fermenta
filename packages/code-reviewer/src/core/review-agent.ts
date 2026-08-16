import type { ReviewResult } from "../schemas/review.js";

/**
 * The backend-agnostic seam every review agent implements.
 *
 * Implementations own their own client/session lifecycle and cost accounting;
 * callers depend only on this interface, so a Copilot-backed agent can be
 * swapped or joined by other backends without touching the CLI or a future
 * eval provider.
 */
export interface ReviewAgent {
  /** Review a unified diff and return a structured, validated result. */
  review(diff: string): Promise<ReviewResult>;
}
