import { CopilotClient, type AssistantMessageEvent } from "@github/copilot-sdk";

import { MAX_AI_CREDITS, SEND_AND_WAIT_TIMEOUT_MS } from "../../core/limits.js";
import { BaseReviewAgent, type ReviewInput } from "../../core/review-agent.js";
import { REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "../../prompts/review-prompt.js";
import { type ReviewCost, type ReviewResult } from "../../schemas/review.js";
import { parseReview } from "./parse.js";

export interface CopilotReviewAgentOptions {
  /** Model id to use. Defaults to `COPILOT_MODEL` env var, then `"auto"`. */
  model?: string;
  /** Override the reviewer's system prompt / rubric. */
  instructions?: string;
  /** AI-credit soft cap for this Copilot review session. */
  maxAiCredits?: number;
  /** Working directory used by the SDK's read tools. Defaults to `process.cwd()`. */
  workingDirectory?: string;
}

/**
 * A reusable code-review agent built on the GitHub Copilot SDK.
 *
 * Construct a `CopilotReviewAgent` (directly or via `createReviewAgent`) from
 * other code (CLI, CI job, server) and call {@link BaseReviewAgent.review} with
 * a {@link ReviewInput}. The SDK boots the bundled Copilot CLI as a JSON-RPC
 * server, runs the agent loop, and returns a structured, zod-validated review;
 * the base class attaches the derived verdict and owns the oversize decline.
 */
export class CopilotReviewAgent extends BaseReviewAgent {
  private readonly model: string;
  private readonly instructions: string;
  private readonly maxAiCredits: number;
  private readonly workingDirectory: string;

  constructor(options: CopilotReviewAgentOptions = {}) {
    super();
    this.model = options.model ?? process.env.COPILOT_MODEL ?? "auto";
    this.instructions = options.instructions ?? REVIEW_SYSTEM_PROMPT;
    this.maxAiCredits = options.maxAiCredits ?? MAX_AI_CREDITS;
    this.workingDirectory = options.workingDirectory ?? process.cwd();
  }

  /** Backend hook: review a diff and return the verdict-less result. */
  protected async runReview(input: ReviewInput): Promise<Omit<ReviewResult, "verdict">> {
    if (input.diff.trim().length === 0) {
      return {
        summary: "No changes to review (empty diff).",
        findings: [],
        nitpicks: [],
        cost: { tokensIn: 0, tokensOut: 0 },
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
        // Read-only review: the diff is supplied inline, and the reviewer may
        // inspect repository/context files via the built-in read tools. Cost is
        // bounded by the max-AI-credits session cap below.
        availableTools: ["view", "grep", "glob"],
        // `sessionLimits` is @experimental in @github/copilot-sdk v1.0.11; a
        // future SDK bump could change or remove this cost cap surface.
        sessionLimits: { maxAiCredits: this.maxAiCredits },
        workingDirectory: this.workingDirectory,
        // Safety fallback: auto-approve any (unexpected) tool request so the
        // agent never blocks waiting for input.
        onPermissionRequest: async () => ({ kind: "approve-once" }),
      });

      let nanoAiu = 0;
      let usageModel: string | undefined;
      const cost: ReviewCost = { tokensIn: 0, tokensOut: 0 };

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
      // Known SDK hang in tool loops (github/copilot-cli#2911): timeout is
      // ignored when wedged. If it bites, wrap in Promise.race with an external
      // timer.
      const finalMessage: AssistantMessageEvent | undefined = await session.sendAndWait(
        { prompt: buildReviewPrompt(input) },
        SEND_AND_WAIT_TIMEOUT_MS,
      );

      // The model that actually produced the review (resolved even if "auto"
      // was requested); prefer the message producer, fall back to usage.
      const actualModel = finalMessage?.data.model ?? usageModel;
      if (actualModel) {
        cost.model = actualModel;
      }
      // nano-AI units -> AI units (credits). Absent for providers that don't
      // report Copilot usage (e.g. BYOK), so only set it when we have data.
      if (nanoAiu > 0) {
        cost.aiCredits = nanoAiu / 1e9;
      }

      return { ...parseReview(finalMessage?.data.content ?? ""), cost };
    } finally {
      await client.stop();
    }
  }
}
