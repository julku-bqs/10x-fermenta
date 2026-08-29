import type { UnifiedConfig } from "promptfoo";

/**
 * Code review evals — promptfoo harness.
 *
 * Runs the SAME review prompt (`REVIEW_SYSTEM_PROMPT`, owned by the agent)
 * across three pinned models against one comprehensive, deliberately-flawed
 * diff, and reports each model's USD cost plus a deterministic "review actually
 * fails" hard gate.
 *
 * Split gate:
 * - HARD bars (fail the cell): `is-json` (output is a well-formed ReviewResult)
 *   and `verdict_blocked` (the review blocks the PR — decision=blocked,
 *   pass=false). Every model must clear these.
 * - GRADED axis (non-gating, added in Phase 3): per-criterion `llm-rubric`
 *   scores + a derived `weighted_coverage` aggregate.
 *
 * Model pinning is mandatory — the eval never relies on the agent's "auto"
 * default, or runs are non-comparable across executions.
 */
const config: Partial<UnifiedConfig> = {
  description:
    "Code review evals: same prompt across three pinned models on one seeded, multi-flaw diff",
  // The provider ignores the rendered prompt (the agent builds its own via
  // buildReviewPrompt); this passthrough only satisfies promptfoo's need for a prompt.
  prompts: ["{{diff}}"],
  providers: [
    {
      id: "file://./providers/review-provider.ts",
      label: "gpt-5.3-codex",
      config: { model: "gpt-5.3-codex" },
    },
    {
      id: "file://./providers/review-provider.ts",
      label: "claude-sonnet-4.6",
      config: { model: "claude-sonnet-4.6" },
    },
    {
      id: "file://./providers/review-provider.ts",
      label: "claude-haiku-4.5",
      config: { model: "claude-haiku-4.5" },
    },
  ],
  // Each review boots a Copilot CLI subprocess + one live LLM call; keep parallelism low.
  evaluateOptions: {
    maxConcurrency: 2,
  },
  defaultTest: {
    assert: [
      // Structural hard bar: output is a well-formed ReviewResult.
      { type: "is-json", value: "file://./fixtures/review-result.schema.json" },
      // Deterministic hard bar: the review actually fails the PR.
      {
        type: "javascript",
        value: "file://./assertions/verdict.ts:reviewActuallyFails",
        metric: "verdict_blocked",
      },
    ],
  },
  tests: [
    {
      description: "quick-export multi-flaw diff (spans all five review criteria)",
      vars: {
        diff: "file://./fixtures/quick-export-multiflaw.diff",
      },
    },
  ],
};

export default config;
