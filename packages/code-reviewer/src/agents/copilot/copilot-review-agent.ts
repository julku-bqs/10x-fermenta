import { CopilotClient } from "@github/copilot-sdk";

import type { ReviewAgent } from "../../core/review-agent.js";
import { deriveVerdict } from "../../core/scoring.js";
import { REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "../../prompts/review-prompt.js";
import { type ReviewCost, type ReviewResult } from "../../schemas/review.js";
import { parseReview } from "./parse.js";

export interface CopilotReviewAgentOptions {
  /** Model id to use. Defaults to `COPILOT_MODEL` env var, then `"auto"`. */
  model?: string;
  /** Override the reviewer's system prompt / rubric. */
  instructions?: string;
}

/**
 * A reusable code-review agent built on the GitHub Copilot SDK.
 *
 * Construct a `CopilotReviewAgent` (directly or via `createReviewAgent`) from
 * other code (CLI, CI job, server) and call {@link CopilotReviewAgent.review}
 * with a diff. The SDK boots the bundled Copilot CLI as a JSON-RPC server, runs
 * the agent loop, and returns a structured, zod-validated {@link ReviewResult}.
 */
export class CopilotReviewAgent implements ReviewAgent {
  private readonly model: string;
  private readonly instructions: string;

  constructor(options: CopilotReviewAgentOptions = {}) {
    this.model = options.model ?? process.env.COPILOT_MODEL ?? "auto";
    this.instructions = options.instructions ?? REVIEW_SYSTEM_PROMPT;
  }

  /** Review a unified diff and return a structured, validated result. */
  async review(diff: string): Promise<ReviewResult> {
    if (diff.trim().length === 0) {
      return {
        summary: "No changes to review (empty diff).",
        findings: [],
        nitpicks: [],
        cost: { tokensIn: 0, tokensOut: 0 },
        verdict: deriveVerdict([]),
      };
    }

    const client = new CopilotClient();
    try {
      await client.start();
      const session = await client.createSession({
        model: this.model,
        // Reviewer rubric + JSON contract as the system message. Append mode
        // keeps the SDK's own foundation and guardrails in place.
        systemMessage: { mode: "append", content: this.instructions },
        // Streaming lets us collect per-call usage via `assistant.usage` events.
        streaming: true,
        // Read-only review: the diff is supplied inline, so the agent needs no
        // tools. An empty allowlist disables them. Per the SDK's agent loop a
        // turn only continues when the model requests a tool, so with none
        // available it produces its answer in a single turn (one LLM call).
        // The SDK has no native max-turns setting; this is the way to bound it.
        availableTools: [],
        // Safety fallback: auto-approve any (unexpected) tool request so the
        // agent never blocks waiting for input.
        onPermissionRequest: async () => ({ kind: "approve-once" }),
      });

      let content = "";
      let nanoAiu = 0;
      let usageModel: string | undefined;
      let messageModel: string | undefined;
      const cost: ReviewCost = { tokensIn: 0, tokensOut: 0 };

      session.on("assistant.message", (event) => {
        content += event.data.content;
        if (event.data.model) {
          messageModel = event.data.model;
        }
      });
      session.on("assistant.usage", (event) => {
        cost.tokensIn += event.data.inputTokens ?? 0;
        cost.tokensOut += event.data.outputTokens ?? 0;
        nanoAiu += event.data.copilotUsage?.totalNanoAiu ?? 0;
        if (event.data.model) {
          usageModel = event.data.model;
        }
      });

      // Resolves once the session is idle, so every `assistant.usage` event for
      // the turn has already been delivered to the handlers above.
      await session.sendAndWait({ prompt: buildReviewPrompt(diff) });

      // The model that actually produced the review (resolved even if "auto"
      // was requested); prefer the message producer, fall back to usage.
      const actualModel = messageModel ?? usageModel;
      if (actualModel) {
        cost.model = actualModel;
      }
      // nano-AI units -> AI units (credits). Absent for providers that don't
      // report Copilot usage (e.g. BYOK), so only set it when we have data.
      if (nanoAiu > 0) {
        cost.aiCredits = nanoAiu / 1e9;
      }

      const review = parseReview(content);
      return { ...review, cost, verdict: deriveVerdict(review.findings) };
    } finally {
      await client.stop();
    }
  }
}
