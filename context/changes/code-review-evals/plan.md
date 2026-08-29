# Code Review Evals (promptfoo) Implementation Plan

## Overview

Introduce a first, local **promptfoo** eval harness inside `packages/code-reviewer/` that runs the **same** review prompt (`REVIEW_SYSTEM_PROMPT`) across **three pinned models** — `gpt-5.3-codex`, `claude-sonnet-4.6`, `claude-haiku-4.5` — against **one comprehensive, deliberately-flawed diff**, and reports each model's **cost (in USD)**, whether the review **actually fails the PR** (deterministic gate), and **how well it identifies the seeded bugs** (LLM-as-a-judge, per criterion + a derived aggregate). This is a developer-run tool for comparing models on cost-to-value — **not** a CI gate.

## Current State Analysis

`@packages/code-reviewer` was refactored (archive `2026-08-15-code-reviewer`) to be eval-ready by design. Verified against the code:

- **Import seam is ready and side-effect-free** (`src/index.ts:1-46`): exports `createReviewAgent({ provider, model, instructions })` (`src/agents/factory.ts:14-24`) whose `review(input) => Promise<ReviewResult>` is the single seam (`src/core/review-agent.ts:26-29`).
- **Same prompt, varied model**: `CopilotReviewAgent` defaults `instructions` to `REVIEW_SYSTEM_PROMPT` and takes `model` per-instance (`src/agents/copilot/copilot-review-agent.ts:28-31`). Pinning three models = three factory calls with the same instructions.
- **Structured output + cost already present**: `ReviewResult` = `Review` (`summary`, `findings[]`, `nitpicks[]`) + `cost` (`tokensIn`, `tokensOut`, optional `aiCredits`, resolved `model`) + `verdict` (`decision`, `pass`) (`src/schemas/review.ts:66-112`). `cost.aiCredits` is derived from the SDK's `assistant.usage` nano-AI units (`copilot-review-agent.ts:99-107`).
- **Deterministic gate is pure and code-derived**: `deriveVerdict` maps severities → `approved`/`flagged`/`blocked` (`src/core/scoring.ts:20-30`); the model never emits the verdict. The seeded diff (below) contains blocker/high issues, so a competent review yields `decision: "blocked"`, `pass: false`.
- **Standalone package boundary**: `packages/code-reviewer` keeps its own `package.json`/`node_modules` and is walled off from the Astro/Cloudflare build. The harness must live **inside** the package.
- **Per-review cost model**: each `review()` boots a Copilot CLI subprocess + one live LLM call (`availableTools: []` forces a single turn), then `client.stop()` in `finally` (`copilot-review-agent.ts:56-125`). Runs must throttle concurrency and pin models (default is `"auto"`, non-deterministic).
- **No harness exists yet**: no promptfoo config, provider, fixture, or dataset. The README's "Evals (promptfoo)" section (`README.md:153-155`) explicitly defers wiring "out of scope for this package" — this change closes that gap.

**Ground-truth dataset** — branch `test/ai-cr-live-flaws` (commit `14d639b`, ⚠️ testing only, DO NOT MERGE), one PR "feat(batches): add quick-export endpoint with export metrics" (3 files / 83 insertions), seeding flaws across all five criteria:

| File                                                      | Seeded flaws → criterion                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/services/export-metrics.ts`                      | `computeTotalSugar = kg × volume` (no kg→g) → **domain_integrity**; `estimateAbv` bogus `sugarPerLiter/10` → **domain_integrity**; `classifyDryness` **inverted** (`>45 ? "dry" : "sweet"`) → **domain_integrity**; `sumSugarReadings` off-by-one `i <= length` (NaN) → **correctness**                                                                                              |
| `src/pages/api/batches/quick-export.ts`                   | hardcoded `EXPORT_API_KEY` + `console.log` leaking it → **security_isolation**; no zod validation, `as ExportRequest` cast → **input_contract**; `.or(\`id.eq.${body.batchId}\`)`interpolated + no owner filter → **security_isolation** (IDOR/injection);`classifyDryness(sugarKg/volume)` unit bug at call site → **domain_integrity**; unguarded divide-by-zero → **correctness** |
| `supabase/migrations/20260825220000_export_audit_log.sql` | new table, **no RLS**, persists `api_key text not null` → **data_migration** (+security); unconditional `update batches set updated_at = now()` → **data_migration** (destructive); `add column export_status text not null` (no default, populated table) → **data_migration**; `drop column diary_entries.notes` → **data_migration** (destructive)                                |

## Desired End State

Running `npm run eval` from `packages/code-reviewer/` (with Copilot auth) produces a promptfoo report comparing the three models on the one seeded diff, where for each model the report shows:

- **Cost in USD** (derived from `aiCredits` at GitHub's official $0.01/credit rate), plus token usage.
- A **pass/fail deterministic gate**: the review "actually fails" the PR (`verdict.decision === "blocked"`, `verdict.pass === false`) and the output is structurally valid (`is-json`). These are **hard bars** every model must clear.
- **Five per-criterion LLM-judge scores** (`domain_integrity`, `correctness`, `input_contract`, `security_isolation`, `data_migration`) graded by a **Copilot-backed grader** (no OpenAI key), plus a **derived `weighted_coverage` aggregate** that penalizes uneven coverage more than a naive mean. These are the **graded comparison axis** (non-gating).

Verification: `npm run eval` exits successfully with all three models clearing the hard bars; `npm run eval:view` opens an HTML report showing the cost column, per-criterion scores, the `weighted_coverage` column, and (for weaker models) visibly lower coverage while still blocking. Harness helper logic (cost conversion, verdict-assertion parsing, coverage aggregate) is covered by offline unit tests via a dedicated `npm run test:eval` (separate from the package's `src`-only `npm test`).

### Key Discoveries:

- promptfoo custom TS providers load **natively** (tsx, no build step) via `file://` paths relative to the config; import types from `promptfoo` (`ApiProvider`, `ProviderResponse`). — verified against current docs.
- Grader override is keyless-friendly: `defaultTest.options.provider: file://./providers/copilot-grader.ts` makes every `llm-rubric` use a custom Copilot-backed grader. A custom grader returns a `ProviderResponse` whose `output` is JSON `{ pass, score, reason }`; here it **always sets `pass: true`** so the rubric is score-only (non-gating), because promptfoo resolves an `llm-rubric` as `pass = (grader.pass ?? true) && score >= threshold` — an AND, so `threshold: 0` alone cannot neutralize a grader `pass: false`.
- promptfoo's per-test score is a **weighted arithmetic mean** of assertion scores; `assert-set` is also arithmetic-mean only. A **`derivedMetrics` JS function** over named scores is the idiomatic way to compute a non-arithmetic aggregate (weighted harmonic mean / min-floor) **without** affecting pass/fail — matching the split gate.
- `maxConcurrency` lives in `evaluateOptions`; grader calls share the same pool. Each of the 5 `llm-rubric` asserts fires its own grader call (5 grader calls × 3 models), cached by default on repeat runs.
- `cost.aiCredits` is absent for BYOK/unreported usage; the provider must tolerate `undefined` (treat as 0 USD, not a crash).
- The current promptfoo release requires **Node ≥ 22.22.0**; the repo's `.nvmrc` is Node 24, so the dev environment satisfies it.

## What We're NOT Doing

- **Not** gating CI on the eval, and **not** wiring it into `.github/` — this is a local, manual developer tool.
- **Not** running an A/B prompt matrix — the prompt is fixed; the **model** is the varied axis.
- **Not** building a multi-case corpus now — exactly **one** comprehensive diff (the plan does not slice it into per-criterion single-flaw diffs).
- **Not** modifying `packages/code-reviewer/src/**` production code, the CLI, or the CI action. The harness is additive and lives in `packages/code-reviewer/evals/`.
- **Not** merging or depending on the live-flaws branch at runtime — the diff is captured as a committed fixture.
- **Not** inventing a dollar figure: the SDK exposes AI credits (not native USD), so USD is derived by the single documented `USD_PER_AI_CREDIT` constant set to GitHub's official $0.01/credit rate — a precise linear conversion of the reported credits, not a guess (re-check the rate if GitHub's pricing changes).

## Implementation Approach

Additive harness under `packages/code-reviewer/evals/`, built in four phases that each leave the package in a verifiable state. Phase 1 scaffolds and captures the fixture. Phase 2 delivers a **runnable three-model cost comparison with the deterministic fail-gate** (no judge yet) — already useful. Phase 3 layers on the Copilot-backed LLM-judge (per-criterion + derived aggregate). Phase 4 documents. Provider/grader/assertion/scoring code is plain TS loaded by promptfoo via `file://`; pure helpers get offline unit tests run via a dedicated `npm run test:eval` (isolated from the package's `src`-only `npm test`) so both stay fast and keyless.

Target harness layout:

```
packages/code-reviewer/evals/
  promptfooconfig.ts          # providers (3 models) + defaultTest (asserts, grader) + derivedMetrics + evaluateOptions
  tsconfig.json               # typecheck the harness TS (extends package tsconfig, noEmit)
  vitest.config.ts            # offline unit-test runner for the harness (npm run test:eval), separate from the src suite
  fixtures/
    quick-export-multiflaw.diff   # captured ground-truth diff (committed)
    ground-truth.md               # flaw ledger: seeded bug -> criterion
    review-result.schema.json     # JSON Schema for is-json (generated from ReviewResultSchema)
  providers/
    review-provider.ts        # createReviewAgent -> review() -> ProviderResponse
    copilot-grader.ts         # single-turn Copilot chat grader (keyless), returns {pass,score,reason}
  assertions/
    verdict.ts                # deterministic "review actually fails" hard gate
  scoring/
    coverage.ts               # derived weighted-harmonic-mean + min-floor aggregate
  lib/
    cost.ts                   # USD_PER_AI_CREDIT + creditsToUsd()
  rubrics/                    # per-criterion rubric text (or inline in YAML)
```

## Critical Implementation Details

- **Model pinning is mandatory.** Every provider must set a concrete `config.model`; never rely on the agent's `"auto"` default, or runs are non-comparable across executions.
- **Concurrency + subprocess pressure.** Keep `evaluateOptions.maxConcurrency: 2`. Each review boots a Copilot CLI subprocess and each `llm-rubric` fires a grader call; higher parallelism contends for subprocess/model capacity and burns credits faster.
- **Split-gate wiring is load-bearing.** The deterministic `verdict` + `is-json` assertions are **hard** (they fail the test for a non-compliant model). The five `llm-rubric` asserts must be **non-gating** so a weaker model shows a lower score instead of a red failure — that lower score _is_ the comparison signal. **The non-gating guarantee comes from the grader itself: it always returns `pass: true` and varies only `score`.** promptfoo resolves an `llm-rubric` as `pass = (grader.pass ?? true) && score >= threshold` (logical AND), so a grader that emitted `pass: false` would turn the cell red regardless of `threshold: 0`; `threshold: 0` is kept as harmless belt-and-suspenders, **not** the mechanism. The `weighted_coverage` derived metric never affects pass/fail.
- **Grader must not reuse a model under test as its judge** — use a distinct, pinned strong model to avoid self-grading bias; the grader instructs the model to emit only the `{ pass, score, reason }` JSON.

## Phase 1: Scaffold the harness and capture the fixture

### Overview

Add promptfoo as a local devDependency, create the `evals/` structure, capture the ground-truth diff as a committed fixture with a flaw ledger, and land a minimal config that validates.

### Changes Required:

#### 1. Package manifest + scripts

**File**: `packages/code-reviewer/package.json`

**Intent**: Add promptfoo as a devDependency and expose run scripts, so developers run the eval with one command from the package.

**Contract**: Install the **latest** promptfoo at implementation time (`npm install -D promptfoo@latest` — do **not** pin a version in this plan; record the resolved version in the README in Phase 4 and confirm the local Node satisfies promptfoo's `engines.node`). Add scripts `"eval": "promptfoo eval -c evals/promptfooconfig.ts"`, `"eval:view": "promptfoo view"`, and `"test:eval": "vitest run -c evals/vitest.config.ts"` (runs the harness's offline unit tests, separate from the package's existing `"test": "vitest run"` src suite). Keep existing scripts untouched.

#### 2. Harness directory + typecheck config

**File**: `packages/code-reviewer/evals/tsconfig.json` (+ `.gitignore` entry)

**Intent**: Create the `evals/` tree and a dedicated tsconfig so the harness TS can be typechecked independently of the package build (which only compiles `src/**`).

**Contract**: `evals/tsconfig.json` reuses the package's compiler options (NodeNext, strict) but **overrides the emit-oriented settings the base pins for `src/`**: set `noEmit: true` and `rootDir: ".."` — i.e. the **package root**, so `rootDir` contains **both** `evals/` and the `../../src` files the provider imports (`import … from "../../src/index.js"`). Do **not** use `rootDir: "."` (that resolves to `evals/` and re-triggers `TS6059: '…/src/index.ts' is not under rootDir '…/evals'` the moment the provider imports `src`), and do **not** simply omit `rootDir` (the base's `rootDir: "src"` is inherited through `extends`, which also fails `TS6059` for eval files). Both were verified to fail against the package's tsc; `rootDir: ".."` typechecks clean. Also neutralize the inherited emit options (`declaration: false`, `sourceMap: false`, and drop/override `outDir`). `include: ["**/*.ts"]` (relative to `evals/`, so only harness files are include-matched; `src` enters as an imported dependency). Add promptfoo's output/cache artifacts (e.g. `.promptfoo/`, `output.*`) to the package `.gitignore`.

#### 3. Ground-truth fixture + ledger

**File**: `packages/code-reviewer/evals/fixtures/quick-export-multiflaw.diff`, `packages/code-reviewer/evals/fixtures/ground-truth.md`

**Intent**: Capture the seeded diff as a committed, reproducible fixture (independent of the DO-NOT-MERGE branch) and record the authoritative flaw→criterion ledger that the rubrics and manual review key off.

**Contract**: Capture with `git diff main...test/ai-cr-live-flaws` → `quick-export-multiflaw.diff` (unified diff, ~83 insertions across the 3 files). `ground-truth.md` enumerates each seeded flaw mapped to its criterion (lift the table from `research.md`) plus a one-line note that the source branch is testing-only.

#### 4. Minimal config stub

**File**: `packages/code-reviewer/evals/promptfooconfig.ts`

**Intent**: A minimal, valid config so tooling resolves before providers/asserts are added in Phase 2.

**Contract**: A TypeScript config module that default-exports a typed promptfoo config object (import the config type from `promptfoo`): top-level `description`, a placeholder `prompts` entry, `evaluateOptions.maxConcurrency: 2`, and one `tests` entry whose `vars.diff` loads the fixture via `file://./fixtures/quick-export-multiflaw.diff`. Provider list may be empty/placeholder until Phase 2.

**Config-check gate (defined once here, reused by SC 1.3 / 2.3 / 3.3):** the automated config check is `npx promptfoo validate -c evals/promptfooconfig.ts`. promptfoo loads TS configs via `tsx` **without** JSON round-tripping, so the **function-valued** `derivedMetrics` added in Phase 3 survives at _eval_ time — but `validate`'s Zod pass on a function-typed field is **unverified** and may warn or non-zero-exit. **At the start of Phase 1, run `validate` once and confirm it exits 0.** If it does not, switch **all three** config-check criteria (1.3 / 2.3 / 3.3) to a load-smoke gate that actually imports the config module — `npx promptfoo eval -c evals/promptfooconfig.ts --help` (resolves + loads the config) — and use that same command uniformly in every phase.

### Success Criteria:

#### Automated Verification:

- Dependencies install cleanly: `npm install` in `packages/code-reviewer/`
- promptfoo binary resolves: `npx promptfoo --version`
- Config loads (config-check gate — see Phase 1 §4): `npx promptfoo validate -c evals/promptfooconfig.ts` (fallback `npx promptfoo eval -c evals/promptfooconfig.ts --help` if `validate` rejects the function-valued config)
- Fixture exists and is non-empty (contains the three seeded files)
- Harness typechecks: `npx tsc --noEmit -p evals/tsconfig.json`

#### Manual Verification:

- Resolved promptfoo version recorded and local Node satisfies its `engines.node` (repo `.nvmrc` = Node 24)
- `ground-truth.md` ledger matches the captured diff (every seeded flaw listed with the right criterion)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Review provider, three models, and the deterministic fail-gate

### Overview

Wire the custom review provider (mapping `ReviewResult` → promptfoo `ProviderResponse` with USD cost), pin the three models, and add the deterministic hard gate that proves the review actually fails the PR. This phase yields a runnable three-model cost comparison with the fail-gate — before any LLM-judge.

### Changes Required:

#### 1. Cost mapping helper

**File**: `packages/code-reviewer/evals/lib/cost.ts`

**Intent**: Convert SDK AI credits to USD through a single named constant so a pricing change is a one-line edit.

**Contract**: Export `USD_PER_AI_CREDIT = 0.01` — GitHub's **official AI-credit rate** ($0.01 per AI credit, the same rate GitHub bills for overage; per the Copilot billing docs, https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing) — and `creditsToUsd(aiCredits: number | undefined): number` returning `(aiCredits ?? 0) * USD_PER_AI_CREDIT`. Document the rate + source in a code comment so a future pricing change is a one-line edit. No hardcoded `0.01` anywhere else.

#### 2. Custom review provider

**File**: `packages/code-reviewer/evals/providers/review-provider.ts`

**Intent**: Adapt the review agent to promptfoo: for each test case, run the pinned model on the fixture diff and return the structured result + faithful token usage + USD cost, catching errors so one model's failure doesn't abort the matrix.

**Contract**: Default-export a class implementing promptfoo's `ApiProvider`: `id()` returns a per-model id/label; `callApi(prompt, context)` reads `context.vars.diff` (and optional `title`/`description`), calls `createReviewAgent({ model: this.config.model }).review({ diff, title, description })`, and returns a `ProviderResponse`. Import the agent from the package source (`../../src/index.js`, tsx-resolved). The provider **ignores** the rendered `prompt` — the agent builds its own via `buildReviewPrompt`. Mapping:

```ts
return {
  output: JSON.stringify(result, null, 2), // full ReviewResult (grader + asserts read this)
  tokenUsage: {
    prompt: result.cost.tokensIn,
    completion: result.cost.tokensOut,
    total: result.cost.tokensIn + result.cost.tokensOut,
  },
  cost: creditsToUsd(result.cost.aiCredits), // USD via GitHub's official $0.01/AI-credit rate; wired to promptfoo's cost
  metadata: { model: result.cost.model, aiCredits: result.cost.aiCredits, verdict: result.verdict },
};
// on throw: return { error: err instanceof Error ? err.message : String(err) };
```

#### 3. Deterministic "review actually fails" assertion

**File**: `packages/code-reviewer/evals/assertions/verdict.ts`

**Intent**: The hard gate — every model must flag this diff as blocking. This is the requested static check that the review fails.

**Contract**: Export a function `(output: string, context) => GradingResult` that parses `output` as `ReviewResult` and returns `{ pass, score, reason }` where `pass = verdict.decision === "blocked" && verdict.pass === false` (score `1`/`0`), tagged `metric: verdict_blocked`. A parse failure returns `pass: false` with a clear reason. This is a **hard** assertion (its failure fails the test).

#### 4. Structural schema for `is-json`

**File**: `packages/code-reviewer/evals/fixtures/review-result.schema.json`

**Intent**: Assert the provider output is a well-formed `ReviewResult`, independent of finding quality.

**Contract**: A JSON Schema for `ReviewResult` (required `summary:string`, `findings:array`, `nitpicks:array`, `verdict:{decision enum, pass:boolean}`, `cost:{tokensIn:number, tokensOut:number}`). May be generated once from `ReviewResultSchema` via zod's `toJSONSchema` (the schemas use `.describe()` for exactly this).

#### 5. Wire providers + hard asserts in config

**File**: `packages/code-reviewer/evals/promptfooconfig.ts`

**Intent**: Run the same prompt on the three pinned models with the deterministic hard gate.

**Contract**: `providers:` = three entries, each `id: file://./providers/review-provider.ts` with a distinct `label` and `config.model` ∈ {`gpt-5.3-codex`, `claude-sonnet-4.6`, `claude-haiku-4.5`}. `defaultTest.assert:` = `is-json` (with `value: file://./fixtures/review-result.schema.json`) + `javascript` (`value: file://./assertions/verdict.ts:<fn>`, `metric: verdict_blocked`). Keep `evaluateOptions.maxConcurrency: 2`. The single test supplies `vars.diff` (+ optional `title`) from the fixture.

#### 6. Offline unit tests for pure helpers

**File**: `packages/code-reviewer/evals/lib/cost.test.ts`, `packages/code-reviewer/evals/assertions/verdict.test.ts`, `packages/code-reviewer/evals/vitest.config.ts`

**Intent**: Keep harness helper logic correct and regression-safe without any live call or key.

**Contract**: `cost.test.ts` asserts `creditsToUsd` (including `undefined → 0`). `verdict.test.ts` feeds fixture `ReviewResult` JSON (a blocked one and a non-blocked one) and asserts the classification. A dedicated `evals/vitest.config.ts` (its `include` scoped to the harness's `*.test.ts` files) runs these via the new `npm run test:eval` script, isolated from the package's `src`-only `npm test`, so the eval tests are actually discovered and executed.

### Success Criteria:

#### Automated Verification:

- Harness typechecks: `npx tsc --noEmit -p evals/tsconfig.json`
- Helper unit tests pass: `npm run test:eval` (covers `cost` conversion and `verdict` assertion parsing)
- Config still loads with three providers (config-check gate — Phase 1 §4): `npx promptfoo validate -c evals/promptfooconfig.ts`
- No `0.01` literal outside `cost.ts`: `git grep -n "0.01" evals/ | grep -v cost.ts` returns nothing

#### Manual Verification:

- `npm run eval` (with Copilot auth) completes and shows three model cells with structured `ReviewResult` output
- The report's cost column shows real USD per model and token usage is populated
- The `verdict` hard gate passes for models that correctly block the diff (the review "actually fails")
- A deliberately unavailable/erroring model shows an error cell without aborting the other two

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Copilot-backed grader, per-criterion rubric, and derived aggregate

### Overview

Add the LLM-as-a-judge: a keyless Copilot-backed grader, five per-criterion `llm-rubric` checks (non-gating), and a derived `weighted_coverage` aggregate that meaningfully summarizes finding quality per model.

### Changes Required:

#### 1. Copilot-backed grader provider

**File**: `packages/code-reviewer/evals/providers/copilot-grader.ts`

**Intent**: A generic, single-turn Copilot chat grader that reuses the existing Copilot auth (no OpenAI key) and returns promptfoo's grader verdict shape.

**Contract**: Default-export an `ApiProvider` whose `callApi(prompt, context)` runs one `CopilotClient` turn (`availableTools: []`, streaming, `start()`/`stop()` in `finally` — mirror `copilot-review-agent.ts`) pinned to a `GRADER_MODEL` constant: a strong model **distinct** from the three under test (default `claude-opus-4.8`; overridable via `config.model` if entitlement differs). The rendered `prompt` already contains the interpolated review output and rubric. Return `{ output: JSON.stringify({ pass: true, score, reason }) }` with `score ∈ [0,1]` — **always hardcode `pass: true`** so the rubric stays non-gating (the `score` is the only signal). This is required because promptfoo resolves an `llm-rubric` as `pass = (grader.pass ?? true) && score >= threshold` (logical AND), so a grader-emitted `pass: false` would gate the cell red even with `threshold: 0`. Instruct the model to emit only `{ score, reason }` and set `pass: true` in code (never let the judge decide pass); parse defensively, and on a **parse failure still return `pass: true` with `score: 0`** (a malformed judge reply must not gate). On a provider/transport error return `{ error }`.

#### 2. Per-criterion rubric text

**File**: `packages/code-reviewer/evals/rubrics/*.md` (or inline in the config)

**Intent**: Give the grader the ground-truth flaws per criterion so it scores whether the review identified them.

**Contract**: One rubric per criterion (`domain_integrity`, `correctness`, `input_contract`, `security_isolation`, `data_migration`), each enumerating that criterion's seeded flaws from `ground-truth.md` and instructing the grader to score coverage (did the review's `findings` correctly surface these bugs?) into `[0,1]`.

#### 3. Derived aggregate scoring

**File**: `packages/code-reviewer/evals/scoring/coverage.ts`

**Intent**: Combine the five per-criterion scores into one **coverage summary** number that penalizes uneven coverage more than a naive mean (a model that nails four families but misses security should score worse than the average implies). This is a directional summary of a single run (n=1) over non-deterministic live calls — not a statistical measure.

**Contract**: Export a named `coverage` function `(scores, context) => number` (imported directly as the `derivedMetrics` value in the TS config) computing a **weighted harmonic mean** of the five criterion named-scores (weights emphasizing domain risk, e.g. `security_isolation`/`data_migration` higher), blended with a **min-criterion floor** so a fully-missed family drags the aggregate down. Weights/thresholds are documented, tunable defaults. Non-obvious core:

```ts
// weighted harmonic mean (penalizes any low criterion), guarded against 0
const wsum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
const denom = CRITERIA.reduce((acc, k) => acc + WEIGHTS[k] / ((scores[k] ?? 0) + 1e-9), 0);
const harmonic = wsum / denom;
const minCriterion = Math.min(...CRITERIA.map((k) => scores[k] ?? 0));
return 0.5 * harmonic + 0.5 * minCriterion; // blend: overall coverage + worst-family floor
```

#### 4. Wire grader, rubrics, and derived metric

**File**: `packages/code-reviewer/evals/promptfooconfig.ts`

**Intent**: Attach the judge as the graded, non-gating comparison axis without disturbing the Phase 2 hard gate.

**Contract**: Add `defaultTest.options.provider: file://./providers/copilot-grader.ts`. Add five `llm-rubric` asserts to `defaultTest.assert`, each with its criterion `value` (or `file://./rubrics/<criterion>.md`), `metric: <criterion>`, and **`threshold: 0`** (belt-and-suspenders only — the real non-gating guarantee is the grader always returning `pass: true`, see §1, since promptfoo ANDs the grader's `pass` with the threshold check). Add `derivedMetrics: [{ name: "weighted_coverage", value: coverage }]`, importing the real `coverage` function from `./scoring/coverage.ts` (promptfoo's function form — a `file://` string in `value` is parsed as a mathjs expression, not a module path). Leave `is-json` + `verdict` as the hard bars.

#### 5. Offline unit test for the aggregate

**File**: `packages/code-reviewer/evals/scoring/coverage.test.ts`

**Intent**: Lock the aggregate's shape (monotonic, penalizes a zeroed family) without a live grader.

**Contract**: Feed synthetic per-criterion score maps (all-high, one-zeroed, uneven) and assert the aggregate ranks them as expected (e.g. one-zeroed < uniform-mean-equivalent).

### Success Criteria:

#### Automated Verification:

- Harness typechecks: `npx tsc --noEmit -p evals/tsconfig.json`
- Aggregate unit test passes: `npm run test:eval` (covers `coverage` ranking behavior)
- Config loads with grader + five rubrics + derived metric (config-check gate — Phase 1 §4): `npx promptfoo validate -c evals/promptfooconfig.ts`
- The five rubric asserts stay non-gating: grader hardcodes `pass: true` (`git grep -n "pass: true" evals/providers/copilot-grader.ts`) **and** each rubric has `threshold: 0` (grep check)

#### Manual Verification:

- `npm run eval` shows five per-criterion scores and a `weighted_coverage` column per model
- The grader runs using Copilot auth only (no `OPENAI_API_KEY` set), pinned to a model distinct from the three under test
- Split gate holds: a weaker model shows lower `weighted_coverage` while still passing the `verdict` hard bar
- `npm run eval:view` renders the HTML report with per-criterion component breakdown, USD cost, and coverage

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Documentation and ergonomics

### Overview

Replace the deferred README stub with real usage docs so any developer can run and read the eval.

### Changes Required:

#### 1. README "Evals (promptfoo)" section

**File**: `packages/code-reviewer/README.md`

**Intent**: Document what the eval does, how to run it, and how to read the report.

**Contract**: Rewrite the `### Evals (promptfoo)` section to cover: purpose (compare `gpt-5.3-codex` / `claude-sonnet-4.6` / `claude-haiku-4.5` on one seeded diff); prerequisites (Copilot auth, credits consumed, resolved promptfoo version + Node req); commands (`npm run eval`, `npm run eval:view`); how to read the report (USD cost, `verdict` hard gate = "does the review fail", five per-criterion scores, `weighted_coverage`); a caveat that each run is a single diff (n=1) over non-deterministic live calls, so `weighted_coverage` is a directional coverage summary — not a statistical measure — with `evaluateOptions.repeat` (>1) as an option for directional averaging; fixture provenance + the DO-NOT-MERGE note; and the grader-model note. Remove the "out of scope" disclaimer.

#### 2. Harness pointer (optional)

**File**: `packages/code-reviewer/evals/README.md`

**Intent**: A short in-folder pointer to the package README section and the layout.

**Contract**: One short paragraph + the layout tree; link back to the package README.

### Success Criteria:

#### Automated Verification:

- Referenced scripts exist: `npm run eval` and `npm run eval:view` are defined in `package.json` (grep check)
- Harness still typechecks (no regressions): `npx tsc --noEmit -p evals/tsconfig.json`

#### Manual Verification:

- A developer can run the eval end-to-end from the README alone
- The report-reading guide matches the actual columns produced in Phase 3

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests (offline, keyless, via `npm run test:eval`):

- `cost.ts` — credits→USD conversion, including `undefined` credits → `0`.
- `verdict.ts` — classifies blocked vs non-blocked `ReviewResult` fixtures correctly (the fail-gate logic).
- `coverage.ts` — aggregate ranks all-high > uneven > one-family-zeroed; penalizes a zeroed family below its arithmetic mean.

### Integration (live, manual — consumes credits):

- Full `npm run eval` across the three models on the seeded diff: three cells, USD cost, hard gate pass, five criterion scores + `weighted_coverage`.
- Grader runs keyless (Copilot auth only) on a distinct pinned model.
- Error resilience: an unavailable model yields an error cell without aborting the run.

### Manual Testing Steps:

1. Ensure Copilot auth (`COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/subscription) and Node ≥ promptfoo's requirement.
2. `npm run eval` from `packages/code-reviewer/`; confirm three models complete and block the diff.
3. `npm run eval:view`; confirm cost (USD), per-criterion scores, `weighted_coverage`, and component breakdown render.
4. Confirm the weakest model shows lower coverage but still passes the verdict hard bar (split gate).

## Performance Considerations

- Each review boots a Copilot subprocess + one LLM call; each of the five rubrics adds a grader call (≈ 3 reviews + 15 grader calls per full run). Keep `maxConcurrency: 2`. promptfoo caches grader responses, so re-runs on unchanged output are cheaper.
- Pin all models (never `"auto"`) for run-to-run comparability.

## Migration Notes

None — additive harness inside the package. No production `src/**`, CLI, CI, or schema changes. The fixture is a committed snapshot; if the seeded diff is intentionally changed later, re-capture the fixture and update `ground-truth.md` + rubrics.

## References

- Research: `context/changes/code-review-evals/research.md`
- Import seam: `packages/code-reviewer/src/index.ts:1-46`, factory `src/agents/factory.ts:14-24`, seam `src/core/review-agent.ts:26-29`
- Cost/verdict schemas: `packages/code-reviewer/src/schemas/review.ts:66-112`; gate `src/core/scoring.ts:20-30`
- Agent lifecycle to mirror in the grader: `packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts:35-125`
- README stub to replace: `packages/code-reviewer/README.md:153-155`
- Ground-truth diff: branch `test/ai-cr-live-flaws` @ `14d639b` (DO NOT MERGE)
- Prior refactor (eval-readiness intent): `context/archive/2026-08-15-code-reviewer/plan-brief.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scaffold the harness and capture the fixture

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm install`
- [x] 1.2 promptfoo binary resolves: `npx promptfoo --version`
- [x] 1.3 Config loads (config-check gate, Phase 1 §4): `npx promptfoo validate -c evals/promptfooconfig.ts`
- [x] 1.4 Fixture exists and is non-empty (three seeded files)
- [x] 1.5 Harness typechecks: `npx tsc --noEmit -p evals/tsconfig.json`

#### Manual

- [x] 1.6 Resolved promptfoo version recorded and local Node satisfies its `engines.node`
- [x] 1.7 `ground-truth.md` ledger matches the captured diff

### Phase 2: Review provider, three models, and the deterministic fail-gate

#### Automated

- [ ] 2.1 Harness typechecks: `npx tsc --noEmit -p evals/tsconfig.json`
- [ ] 2.2 Helper unit tests pass: `npm run test:eval` (cost + verdict)
- [ ] 2.3 Config loads with three providers (config-check gate)
- [ ] 2.4 No `0.01` literal outside `cost.ts`

#### Manual

- [ ] 2.5 `npm run eval` shows three model cells with structured `ReviewResult` output
- [ ] 2.6 Report shows real USD cost per model and populated token usage
- [ ] 2.7 `verdict` hard gate passes for models that block the diff
- [ ] 2.8 An erroring/unavailable model shows an error cell without aborting the run

### Phase 3: Copilot-backed grader, per-criterion rubric, and derived aggregate

#### Automated

- [ ] 3.1 Harness typechecks: `npx tsc --noEmit -p evals/tsconfig.json`
- [ ] 3.2 Aggregate unit test passes: `npm run test:eval` (coverage ranking)
- [ ] 3.3 Config loads with grader + five rubrics + derived metric (config-check gate)
- [ ] 3.4 The five rubric asserts stay non-gating: grader hardcodes `pass: true` + `threshold: 0` on each

#### Manual

- [ ] 3.5 `npm run eval` shows five per-criterion scores and a `weighted_coverage` column per model
- [ ] 3.6 Grader runs keyless (Copilot auth only), pinned to a distinct model
- [ ] 3.7 Split gate holds: weaker model = lower coverage but still passes the verdict hard bar
- [ ] 3.8 `npm run eval:view` renders component breakdown, USD cost, and coverage

### Phase 4: Documentation and ergonomics

#### Automated

- [ ] 4.1 Referenced scripts `eval` / `eval:view` exist in `package.json`
- [ ] 4.2 Harness still typechecks (no regressions)

#### Manual

- [ ] 4.3 A developer can run the eval end-to-end from the README alone
- [ ] 4.4 The report-reading guide matches the actual columns produced
