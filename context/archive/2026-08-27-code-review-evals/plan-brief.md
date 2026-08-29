# Code Review Evals (promptfoo) — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

Stand up a first, local **promptfoo** eval harness inside `packages/code-reviewer/` that runs the **same** review prompt across **three pinned models** (`gpt-5.3-codex`, `claude-sonnet-4.6`, `claude-haiku-4.5`) on **one deliberately-flawed diff**, and reports each model's **USD cost**, whether the review **actually fails the PR**, and **how well it catches the seeded bugs**. The goal is model **cost-to-value comparison** for the review agent — a developer-run bench, not a CI gate.

## Starting Point

The package was already refactored to be eval-ready: a side-effect-free barrel exports `createReviewAgent({ model, instructions }) → review() → ReviewResult`, the prompt is a reusable constant, `ReviewResult` carries token/credit cost, and `deriveVerdict` gives a code-derived pass/fail gate. What's missing is the harness itself — no promptfoo config, provider, fixture, or dataset — which the README explicitly deferred.

## Desired End State

`npm run eval` (with Copilot auth) compares the three models on the seeded diff and shows, per model: real USD cost, a **hard pass/fail gate** (the review flags the PR as `blocked` and the output is valid JSON), **five per-criterion LLM-judge scores** plus a derived **`weighted_coverage`** aggregate. `npm run eval:view` opens an HTML report where weaker models visibly score lower on coverage while still clearing the gate.

## Key Decisions Made

| Decision             | Choice                                                                                 | Why (1 sentence)                                                               | Source          |
| -------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------- |
| Toolkit              | promptfoo (latest at impl time)                                                        | Node/TS-native, loads custom TS providers, YAML config — best stack fit        | Research        |
| Harness location     | Inside `packages/code-reviewer/evals/`                                                 | The package is walled off from the app build; evals must respect that boundary | Research        |
| Dataset              | One comprehensive multi-flaw diff (all 5 criteria)                                     | Matches the request; a single strong case is enough for a first config         | Research + Plan |
| Fixture strategy     | Static committed `.diff` (captured from `test/ai-cr-live-flaws@14d639b`)               | Reproducible/offline, independent of the DO-NOT-MERGE branch                   | Plan            |
| "Review fails" check | In-eval deterministic assertion (`verdict.decision === blocked`)                       | Runs against the real model, beside cost & rubric in one report                | Plan            |
| Pass/fail semantics  | Split: hard verdict/`is-json` bar for all; rubric quality graded                       | The diff must block (hard bar); finding quality is the graded comparison axis  | Plan            |
| Judge granularity    | 5 per-criterion `llm-rubric` + derived aggregate                                       | Per-criterion visibility plus one meaningful overall number                    | Plan            |
| Aggregate metric     | Weighted harmonic mean + min-floor via `derivedMetrics`                                | Penalizes uneven coverage more than a naive mean; doesn't touch pass/fail      | Plan            |
| Grader               | Copilot-backed custom grader, distinct pinned strong model (default `claude-opus-4.8`) | Keyless (reuses Copilot auth), avoids a model grading itself                   | Research + Plan |
| Failure handling     | Provider returns an error cell and the run continues                                   | One model's failure shouldn't waste the whole paid run                         | Plan            |
| Concurrency          | `maxConcurrency: 2`, all models pinned (never `auto`)                                  | Each review boots a subprocess + live call; pinning keeps runs comparable      | Research        |

## Scope

**In scope:** promptfoo devDependency + `eval` scripts; `evals/` harness (config, review provider, Copilot grader, deterministic verdict assertion, per-criterion rubrics, derived-aggregate scoring, USD cost helper); committed diff fixture + ground-truth ledger; offline unit tests for pure helpers; README rewrite.

**Out of scope:** CI gating / `.github` wiring; prompt A/B matrix; multi-case corpus or per-criterion diff slicing; any change to `src/**`, the CLI, or the CI action; merging/depending on the live-flaws branch at runtime.

## Architecture / Approach

A custom TS **review provider** (loaded natively by promptfoo via `file://`) imports `createReviewAgent` from the package source, pins each model, feeds the fixture diff, and maps `ReviewResult` → `{ output, tokenUsage, cost, metadata }` with cost converted to USD via a single `USD_PER_AI_CREDIT` constant. Three providers = three models on the same prompt. `defaultTest` carries hard assertions (`is-json` schema + a `verdict` javascript gate) and five non-gating `llm-rubric` checks graded by a keyless **Copilot-backed grader**; a `derivedMetrics` function computes the `weighted_coverage` aggregate. `maxConcurrency: 2`.

## Phases at a Glance

| Phase                              | What it delivers                                                                     | Key risk                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1. Scaffold + fixture              | promptfoo devDep, `evals/` tree, committed diff fixture + ledger, valid stub config  | Node/promptfoo version floor; capturing the diff faithfully                                 |
| 2. Provider + 3 models + fail-gate | Runnable 3-model USD cost comparison with the deterministic "review fails" hard gate | tsx resolving `../../src` imports; correct `ReviewResult`→`ProviderResponse` + cost mapping |
| 3. Grader + rubric + aggregate     | Keyless Copilot grader, 5 per-criterion scores, `weighted_coverage`                  | Grader JSON discipline; keeping rubrics non-gating (split); grader model availability       |
| 4. Docs & ergonomics               | README usage/reading guide replacing the deferred stub                               | Docs drifting from the actual report columns                                                |

**Prerequisites:** Copilot auth (subscription or token) and credits; Node ≥ promptfoo's `engines.node` (repo `.nvmrc` = Node 24 ✓); the `test/ai-cr-live-flaws` branch reachable once to capture the fixture.
**Estimated effort:** ~2–3 focused sessions across the four phases (Phase 2 and 3 are the substance).

## Open Risks & Assumptions

- The default grader model (`claude-opus-4.8`) must be in the developer's Copilot entitlement; the plan makes it a single overridable constant if not.
- Live evals are non-deterministic and consume credits; comparisons should be read as directional, and re-runs benefit from promptfoo's grader cache.
- promptfoo's current release requires a recent Node; verify the resolved version's `engines.node` at install time.
- The fixture is a snapshot — if the seeded diff changes, the fixture, ledger, and rubrics must be re-synced.

## Success Criteria (Summary)

- One command compares the three models on the seeded diff, showing real USD cost per model.
- Every model must clear the hard gate (review flags the PR as blocked, valid structured output); a model that doesn't is a visible red failure.
- Per-criterion judge scores and a `weighted_coverage` aggregate let you see which model catches which bug class — weaker models score lower without breaking the run.
