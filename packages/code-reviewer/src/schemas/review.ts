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

/**
 * The five review criteria the model classifies each finding into. Chosen so the
 * agent spends its budget on what lint + Prettier + `tsc` cannot catch: the
 * domain math, the data contracts, and tenant isolation.
 */
export const CriterionKeySchema = z.enum([
  "correctness",
  "domain_integrity",
  "input_contract",
  "security_isolation",
  "data_migration",
]);
export type Criterion = z.infer<typeof CriterionKeySchema>;

export const FindingSchema = z.object({
  // Fault-tolerant: a model tagging slip (missing or misspelled key) coerces to
  // null instead of failing the whole parse, so the finding's severity survives
  // and `deriveVerdict` still gates on it.
  criterion: CriterionKeySchema.nullable()
    .catch(null)
    .describe("Which of the five review criteria this finding belongs to; null if untagged or unrecognized."),
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
  summary: z
    .string()
    .describe(
      "Three to four sentences: the overall risk of this change plus a short rationale referencing the criteria that drove the findings.",
    ),
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

/**
 * The gateable verdict the CI workflow keys off. Derived deterministically in
 * code from the findings' severities (see `deriveVerdict`) — never emitted by
 * the model. `declined` is reserved for the oversize-diff short-circuit and is
 * never produced by `deriveVerdict`.
 */
export const VerdictSchema = z.object({
  decision: z
    .enum(["approved", "flagged", "blocked", "declined"])
    .describe("Overall gate decision derived from the findings' severities."),
  pass: z.boolean().describe("The single boolean the CI job gates on; false only when decision is 'blocked'."),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** Full agent result: the model's review plus usage/cost and the derived verdict. */
export const ReviewResultSchema = ReviewSchema.extend({
  cost: ReviewCostSchema.describe("Token and credit usage for the run, plus the model used."),
  verdict: VerdictSchema.describe(
    "Gate verdict derived deterministically in code from the findings' severities (not emitted by the model).",
  ),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export { z };
