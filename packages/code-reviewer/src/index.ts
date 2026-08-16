/**
 * Public API for `@10x-fermenta/code-reviewer`.
 *
 * This barrel is intentionally side-effect-free — no shebang, no top-level
 * execution — so libraries and a future promptfoo eval provider can import the
 * agent and its schemas without running the CLI. The executable entry point
 * lives in `./cli.ts`.
 */

// The backend-agnostic seam and the factory that selects an implementation.
export type { ReviewAgent } from "./core/review-agent.js";
export { createReviewAgent, type ReviewAgentConfig } from "./agents/factory.js";

// The single concrete implementation (Copilot SDK).
export { CopilotReviewAgent, type CopilotReviewAgentOptions } from "./agents/copilot/copilot-review-agent.js";

// Structured-output contracts. `z` is deliberately NOT re-exported to keep the
// zod instance out of the package's public surface.
export {
  SeveritySchema,
  type Severity,
  FindingSchema,
  type Finding,
  ReviewSchema,
  type Review,
  ReviewCostSchema,
  type ReviewCost,
  ReviewResultSchema,
  type ReviewResult,
} from "./schemas/review.js";

// Prompts (rubric + user-turn builder) for reuse and evals.
export { REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "./prompts/review-prompt.js";

// Diff resolution helper.
export { getDiff, type DiffSource } from "./git.js";
