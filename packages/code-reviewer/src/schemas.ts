/**
 * Zod schema scaffold.
 *
 * This is the home for this package's schemas. Nothing is defined yet — when the
 * agent moves from a Markdown review to a structured, validated result (see the
 * "Extending the agent" section in the README), define the review-output model
 * here, for example:
 *
 *   export const ReviewFinding = z.object({
 *     severity: z.enum(["blocker", "high", "medium", "low"]),
 *     file: z.string(),
 *     message: z.string(),
 *   });
 *
 * Import `z` from this module (rather than directly from "zod") so the whole
 * package shares a single, consistent zod entry point.
 */
export { z } from "zod";
