/**
 * Structured output schemas for the review agent.
 *
 * Field descriptions use `.describe()` (not code comments) so they survive into
 * a generated JSON Schema — if a native structured-output binding ever ships in
 * the SDK, the same schema can be handed to it directly.
 *
 * `ReviewSchema` validates the JSON the model returns. `ReviewResultSchema` is
 * that review plus `cost` (token/credit usage and the model used, which the SDK
 * provides — not the model). Extend these as the agent's needs grow.
 */
import { z } from "zod";

export const SeveritySchema = z.enum(["blocker", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingSchema = z.object({
  severity: SeveritySchema.describe("Impact level of the issue: blocker, high, medium, or low."),
  filePath: z.string().describe("File path as it appears in the diff."),
  lineNumber: z.coerce
    .string()
    .regex(/^\d+(-\d+)?$/, 'Use a single line like "42" or an inclusive range like "10-15".')
    .nullable()
    .describe('Affected location as a single line ("42") or an inclusive range ("10-15"); null if not line-specific.'),
  message: z.string().describe("What is wrong and how to fix it."),
});
export type Finding = z.infer<typeof FindingSchema>;

/** The review payload produced by the model. */
export const ReviewSchema = z.object({
  summary: z.string().describe("One or two sentences on the overall risk of this change."),
  findings: z.array(FindingSchema).describe("High-confidence, actionable issues; empty array if none."),
  nitpicks: z.array(z.string()).describe("Minor style or readability notes; empty array if none."),
});
export type Review = z.infer<typeof ReviewSchema>;

/**
 * Token/credit usage for a run, sourced from the SDK's `assistant.usage` events.
 */
export const ReviewCostSchema = z.object({
  model: z
    .string()
    .optional()
    .describe("The actual model that produced the review, resolved even when 'auto' was requested."),
  tokensIn: z.number().describe("Total input tokens consumed across the run."),
  tokensOut: z.number().describe("Total output tokens produced across the run."),
  aiCredits: z
    .number()
    .optional()
    .describe(
      "AI credits (AIC) consumed, derived from Copilot nano-AI units; absent when the provider does not report usage (e.g. BYOK). USD is not exposed by the SDK.",
    ),
});
export type ReviewCost = z.infer<typeof ReviewCostSchema>;

/** Full agent result: the model's review plus usage/cost. */
export const ReviewResultSchema = ReviewSchema.extend({
  cost: ReviewCostSchema.describe("Token and credit usage for the run, plus the model used."),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export { z };
