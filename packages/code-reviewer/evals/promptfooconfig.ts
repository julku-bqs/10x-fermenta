import { readFileSync } from "node:fs";

import type { UnifiedConfig } from "promptfoo";

import { coverage } from "./scoring/coverage.js";

/**
 * Read a per-criterion rubric from `./rubrics/<criterion>.md` and inline it as
 * the `llm-rubric` assertion `value`. promptfoo's `file://` assertion loader
 * only supports `.json`/`.yaml`/`.yml`/`.txt` (not `.md`), so the rubric text
 * lives on disk for readability but is passed to promptfoo as a plain string.
 */
function readRubric(criterion: string): string {
  return readFileSync(new URL(`./rubrics/${criterion}.md`, import.meta.url), "utf8");
}

/**
 * Code review evals — promptfoo harness.
 *
 * Runs the SAME review prompt (`REVIEW_SYSTEM_PROMPT`, owned by the agent)
 * across three pinned models against one comprehensive, deliberately-flawed
 * diff, and reports each model's USD cost, a deterministic "review actually
 * fails" hard gate, and how well each model identifies the seeded bugs.
 *
 * Split gate:
 * - HARD bars (fail the cell): `is-json` (output is a well-formed ReviewResult)
 *   and `verdict_blocked` (the review blocks the PR — decision=blocked,
 *   pass=false). Every model must clear these.
 * - GRADED axis (non-gating): five per-criterion `llm-rubric` scores graded by
 *   a keyless Copilot-backed judge, plus a derived `weighted_coverage`
 *   aggregate. A weaker model shows a lower score, not a red failure — that
 *   lower score IS the comparison signal.
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
  // Each review boots a Copilot CLI subprocess + one live LLM call, and each of
  // the five rubrics fires a grader call; keep parallelism low.
  evaluateOptions: {
    maxConcurrency: 2,
  },
  // Non-arithmetic aggregate over the five per-criterion judge scores: a
  // weighted harmonic mean blended with the worst-family floor (see
  // scoring/coverage.ts). promptfoo's function form — passing the real function
  // (a `file://` string in `value` would be parsed as a mathjs expression, not a
  // module path). Never affects pass/fail; it is a report-only comparison axis.
  derivedMetrics: [{ name: "weighted_coverage", value: coverage }],
  defaultTest: {
    // The Copilot-backed grader judges every `llm-rubric` below — keyless
    // (reuses Copilot auth), pinned to a strong model DISTINCT from the three
    // under test, and ALWAYS returns pass:true so the rubric is score-only.
    options: {
      provider: "file://./providers/copilot-grader.ts",
    },
    assert: [
      // Structural hard bar: output is a well-formed ReviewResult.
      { type: "is-json", value: "file://./fixtures/review-result.schema.json" },
      // Deterministic hard bar: the review actually fails the PR.
      {
        type: "javascript",
        value: "file://./assertions/verdict.ts:reviewActuallyFails",
        metric: "verdict_blocked",
      },
      // Graded axis (NON-GATING): five per-criterion coverage rubrics. The
      // non-gating guarantee is the grader always returning pass:true;
      // `threshold: 0` is harmless belt-and-suspenders (promptfoo ANDs the
      // grader's pass with `score >= threshold`), not the mechanism.
      {
        type: "llm-rubric",
        value: readRubric("domain_integrity"),
        metric: "domain_integrity",
        threshold: 0,
      },
      {
        type: "llm-rubric",
        value: readRubric("correctness"),
        metric: "correctness",
        threshold: 0,
      },
      {
        type: "llm-rubric",
        value: readRubric("input_contract"),
        metric: "input_contract",
        threshold: 0,
      },
      {
        type: "llm-rubric",
        value: readRubric("security_isolation"),
        metric: "security_isolation",
        threshold: 0,
      },
      {
        type: "llm-rubric",
        value: readRubric("data_migration"),
        metric: "data_migration",
        threshold: 0,
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
