import type { ReviewAgent } from "../core/review-agent.js";
import { CopilotReviewAgent } from "./copilot/copilot-review-agent.js";

export interface ReviewAgentConfig {
  /** Which backend to use. Defaults to `"copilot"` (the only implementation today). */
  provider?: "copilot";
  /** Model id to use. Defaults to `COPILOT_MODEL` env var, then `"auto"`. */
  model?: string;
  /** Override the reviewer's system prompt / rubric. */
  instructions?: string;
}

/**
 * Select and construct a {@link ReviewAgent} implementation by name so future
 * backends slot in without touching callers.
 */
export function createReviewAgent(config: ReviewAgentConfig = {}): ReviewAgent {
  const { provider = "copilot", model, instructions } = config;

  if (provider === "copilot") {
    return new CopilotReviewAgent({ model, instructions });
  }

  throw new Error(`Unknown review agent provider: ${String(provider)}`);
}
