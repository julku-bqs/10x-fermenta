import type { ApiProvider, CallApiContextParams, ProviderResponse } from "promptfoo";

import { createReviewAgent } from "../../src/index.js";
import { creditsToUsd } from "../lib/cost.js";

interface ReviewProviderConfig {
  /** Concrete model id to pin. The eval never relies on the agent's "auto" default. */
  model?: string;
}

interface ReviewProviderOptions {
  id?: string;
  label?: string;
  config?: ReviewProviderConfig;
}

/**
 * promptfoo provider that runs the code-review agent on the fixture diff with a
 * pinned model, then maps the structured `ReviewResult` onto a
 * `ProviderResponse`: the full result as `output` (grader + asserts read it),
 * faithful token usage, USD cost (GitHub's official per-AI-credit rate; see
 * lib/cost.ts), and the derived verdict in metadata.
 *
 * The agent builds its own prompt via `buildReviewPrompt`, so the rendered
 * promptfoo prompt is intentionally ignored. Any error is caught and returned as
 * `{ error }` so one model's failure never aborts the rest of the matrix.
 */
export default class ReviewProvider implements ApiProvider {
  public readonly config: ReviewProviderConfig;
  public readonly label?: string;
  private readonly model: string;
  private readonly providerId: string;

  constructor(options: ReviewProviderOptions = {}) {
    this.config = options.config ?? {};
    this.model = this.config.model ?? "auto";
    this.providerId = `review-provider:${this.model}`;
    this.label = options.label ?? this.model;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const vars = context?.vars ?? {};
    const diff = typeof vars.diff === "string" ? vars.diff : String(vars.diff ?? "");
    const title = typeof vars.title === "string" ? vars.title : undefined;
    const description = typeof vars.description === "string" ? vars.description : undefined;

    try {
      const agent = createReviewAgent({ model: this.model });
      const result = await agent.review({ diff, title, description });
      return {
        output: JSON.stringify(result, null, 2),
        tokenUsage: {
          prompt: result.cost.tokensIn,
          completion: result.cost.tokensOut,
          total: result.cost.tokensIn + result.cost.tokensOut,
        },
        cost: creditsToUsd(result.cost.aiCredits),
        metadata: {
          model: result.cost.model,
          aiCredits: result.cost.aiCredits,
          verdict: result.verdict,
        },
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
