# Code Review Evals (promptfoo)

A local [promptfoo](https://www.promptfoo.dev/) harness that runs this package's
review agent across three pinned models (`gpt-5.3-codex`, `claude-sonnet-4.6`,
`claude-haiku-4.5`) on one seeded, multi-flaw diff and reports each model's cost,
a deterministic "does the review fail the PR?" gate, and an LLM-judged coverage
score per review criterion. It's a developer tool for comparing models on
cost-to-value — not a CI gate.

**Full docs — prerequisites, how to run, and how to read the report — live in
the package README:** [`../README.md` → "Evals (promptfoo)"](../README.md#evals-promptfoo).

Quick start (from `packages/code-reviewer/`):

```bash
npm run eval        # run the comparison (consumes AI credits)
npm run eval:view   # open the HTML report
npm run test:eval   # offline helper unit tests (keyless, no credits)
```

Layout:

```
evals/
  promptfooconfig.ts     # providers (3 models) + defaultTest (hard asserts + grader + 5 rubrics) + derivedMetrics
  gen-schema.ts          # regenerates fixtures/review-result.schema.json from ReviewResultSchema
  fixtures/
    quick-export-multiflaw.diff   # committed ground-truth diff (from test/ai-cr-live-flaws — DO NOT MERGE)
    ground-truth.md               # flaw -> criterion ledger the rubrics key off
    review-result.schema.json     # JSON Schema for the is-json hard bar
  providers/
    review-provider.ts     # createReviewAgent -> review() -> ProviderResponse (USD cost)
    copilot-grader.ts      # keyless single-turn Copilot grader (score-only, non-gating)
  assertions/
    verdict.ts             # deterministic "review actually fails" hard gate
  rubrics/                 # per-criterion coverage rubrics (domain_integrity, correctness, ...)
  scoring/
    coverage.ts            # derived weighted_coverage aggregate
  lib/
    cost.ts                # USD_PER_AI_CREDIT + creditsToUsd()
  vitest.config.ts         # offline test:eval runner (harness-only, separate from src tests)
  tsconfig.json            # typecheck the harness (noEmit)
```
