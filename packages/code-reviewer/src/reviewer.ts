import { CopilotClient } from "@github/copilot-sdk";

import { REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "./agent.js";

export interface CodeReviewerOptions {
  /** Model id to use. Defaults to `COPILOT_MODEL` env var, then `"auto"`. */
  model?: string;
  /** Override the reviewer's system prompt / rubric. */
  instructions?: string;
}

export interface ReviewResult {
  /** The review, as Markdown. */
  review: string;
  /** The model id that was requested for the session. */
  model: string;
}

/**
 * A reusable code-review agent built on the GitHub Copilot SDK.
 *
 * This is the integration surface: import `CodeReviewer` from other code
 * (CLI, CI job, server) and call {@link CodeReviewer.review} with a diff.
 * The SDK boots the bundled Copilot CLI as a JSON-RPC server, runs the agent
 * loop, and returns the assistant's message.
 */
export class CodeReviewer {
  private readonly model: string;
  private readonly instructions: string;

  constructor(options: CodeReviewerOptions = {}) {
    this.model = options.model ?? process.env.COPILOT_MODEL ?? "auto";
    this.instructions = options.instructions ?? REVIEW_SYSTEM_PROMPT;
  }

  /** Review a unified diff and return the assistant's Markdown response. */
  async review(diff: string): Promise<ReviewResult> {
    if (diff.trim().length === 0) {
      return { review: "✅ No changes to review (empty diff).", model: this.model };
    }

    const client = new CopilotClient();
    try {
      await client.start();
      const session = await client.createSession({
        model: this.model,
        // Auto-approve tool requests so the agent never blocks in CI. The
        // review flow passes the diff inline, so tools are rarely needed.
        onPermissionRequest: async () => ({ kind: "approve-once" }),
      });

      const response = await session.sendAndWait({
        prompt: buildReviewPrompt(diff, this.instructions),
      });

      return { review: response?.data.content ?? "", model: this.model };
    } finally {
      await client.stop();
    }
  }
}
