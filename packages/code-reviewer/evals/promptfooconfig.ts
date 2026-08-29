import type { TestSuiteConfig, EvaluateOptions } from "promptfoo";

/**
 * Code review evals — promptfoo harness (Phase 1 scaffold).
 *
 * Goal (fully wired in Phases 2–3): run the SAME review prompt across three
 * pinned models — gpt-5.3-codex, claude-sonnet-4.6, claude-haiku-4.5 — against
 * one comprehensive seeded diff, and report each model's USD cost, a
 * deterministic "review actually fails" hard gate, and per-criterion coverage
 * scored by a keyless Copilot-backed judge.
 *
 * This scaffold only proves the plumbing: it loads the captured ground-truth
 * fixture as a test var and validates. The `echo` provider is a placeholder —
 * the three real review providers, hard asserts, grader, rubrics, and the
 * derived coverage metric are added in later phases.
 */
const config: TestSuiteConfig & { evaluateOptions?: EvaluateOptions } = {
  description:
    "Code review evals: same prompt across three pinned models on one seeded, multi-flaw diff",
  prompts: ["{{diff}}"],
  providers: ["echo"],
  evaluateOptions: {
    maxConcurrency: 2,
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
