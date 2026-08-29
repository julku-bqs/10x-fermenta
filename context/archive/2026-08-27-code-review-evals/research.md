---
date: 2026-08-27T15:20:00+02:00
researcher: Julian Kujawski
git_commit: f709cc2ad6ee5c91979943f2be289c31d29ab2f1
branch: m5l3
repository: julku-bqs/10x-fermenta
topic: "Eval-readiness of @packages/code-reviewer and toolkit selection (promptfoo vs OSS alternatives)"
tags: [research, codebase, code-reviewer, evals, promptfoo, copilot-sdk]
status: complete
last_updated: 2026-08-27
last_updated_by: Julian Kujawski
last_updated_note: "Resolved open questions; locked a local, developer-run model-comparison eval design (Copilot-backed llm-rubric grader, credits->USD cost)."
---

# Research: Eval-readiness of `@packages/code-reviewer` and eval-toolkit selection

**Date**: 2026-08-27T15:20:00+02:00
**Researcher**: Julian Kujawski
**Git Commit**: f709cc2ad6ee5c91979943f2be289c31d29ab2f1
**Branch**: m5l3
**Repository**: julku-bqs/10x-fermenta

## Research Question

Analyze the current state of `@packages/code-reviewer` in the context of potential eval introduction — reusability of prompts, importability of the agent, etc. First pick for the eval toolkit is **promptfoo**; if the tech stack aligns, go that direction, otherwise evaluate other OSS tools. Use up-to-date web docs.

## Summary

**Verdict: use promptfoo. The stack is aligned and the package is already eval-ready by design.**

- `@packages/code-reviewer` was explicitly refactored (archive `2026-08-15-code-reviewer`) into a modular, interface-driven package **so a future promptfoo eval could import the agent**. The public API barrel (`src/index.ts`) is side-effect-free and exports everything an eval needs: the `createReviewAgent` factory, the `CopilotReviewAgent` class, the `ReviewAgent`/`ReviewInput`/`ReviewResult` contracts, the zod schemas, the pure `deriveVerdict` gate, and — crucially — the prompts (`REVIEW_SYSTEM_PROMPT`, `buildReviewPrompt`).
- **Prompt reusability**: prompts are plain exported TS constants/builders (`src/prompts/review-prompt.ts`), and the factory accepts an `instructions` override — so prompt A/B variants map directly onto a promptfoo provider matrix with zero loader code.
- **Importability**: `import { createReviewAgent } from "@10x-fermenta/code-reviewer"` resolves to a side-effect-free barrel; `review(input) => Promise<ReviewResult>` is the single seam.
- **Output/cost mapping**: `ReviewResult` already carries `cost` (`tokensIn`/`tokensOut`, optional `aiCredits`, resolved `model`) and a code-derived `verdict` — these map cleanly onto promptfoo's `ProviderResponse` (`output`, `tokenUsage`, `cost`, `metadata`).
- **Stack alignment**: promptfoo is a Node/TS-native tool that **loads TypeScript custom providers directly** and uses YAML config — matching this repo's Node + TypeScript + zod + npm stack. It is the strongest fit among OSS options (DeepEval is Python-first; Evalite is lighter/less mature; Braintrust leans production/enterprise).
- **Main net-new work is data + wiring, not refactoring**: there is no eval harness, no provider file, no golden dataset yet. The package is standalone (its own `node_modules`), so the eval harness should live _inside_ `packages/code-reviewer/` with promptfoo as a local devDependency.

## Detailed Findings

### 1. The package is structurally eval-ready

The barrel export surface is deliberate and complete (`packages/code-reviewer/src/index.ts:1-46`). Its header comment states the intent verbatim: _"so libraries and a future promptfoo eval provider can import the agent and its schemas without running the CLI."_ Exports:

- `createReviewAgent`, `ReviewAgentConfig` (factory) — `src/agents/factory.ts:14-24`
- `CopilotReviewAgent`, `CopilotReviewAgentOptions` — `src/agents/copilot/copilot-review-agent.ts:24-33`
- `BaseReviewAgent`, `ReviewAgent`, `ReviewInput` (the seam) — `src/core/review-agent.ts:8-58`
- `deriveVerdict` (pure gate) — `src/core/scoring.ts:20-30`
- `REVIEW_SYSTEM_PROMPT`, `buildReviewPrompt` (prompts) — `src/prompts/review-prompt.ts`
- All zod schemas + inferred types — `src/schemas/review.ts`
- `getDiff`, `DiffSource` (diff resolution) — `src/git.ts`

The single seam every backend implements is `ReviewAgent.review(input: ReviewInput): Promise<ReviewResult>` (`src/core/review-agent.ts:26-29`). An eval provider depends only on this interface.

### 2. Prompt reusability — first-class

- `REVIEW_SYSTEM_PROMPT` is an exported string constant: the reviewer rubric, its five criteria (`correctness`, `domain_integrity`, `input_contract`, `security_isolation`, `data_migration`), and the strict JSON output contract (`src/prompts/review-prompt.ts:15-56`).
- `buildReviewPrompt(input)` builds the user turn from a `ReviewInput`, fencing untrusted PR title/description as data (`src/prompts/review-prompt.ts:65-88`).
- The factory and `CopilotReviewAgent` accept an `instructions` override that defaults to `REVIEW_SYSTEM_PROMPT` (`src/agents/factory.ts:10`, `src/agents/copilot/copilot-review-agent.ts:31`). **This is the prompt-variant seam**: an eval can pass alternative rubrics via provider `config.instructions` and compare them head-to-head.
- Prior-decision rationale (archive plan-brief): _"Prompt representation → TS constants in `src/prompts/` → Importable + type-safe for evals with zero loader code."_

### 3. Structured output + cost map cleanly onto promptfoo `ProviderResponse`

`ReviewResult` (`src/schemas/review.ts:104-112`) = `Review` (`summary`, `findings[]`, `nitpicks[]`) + `cost` (`ReviewCost`) + `verdict` (`Verdict`).

`cost` carries `tokensIn`, `tokensOut`, optional `aiCredits`, and the resolved `model` (`src/schemas/review.ts:66-89`); it is populated from the SDK's `assistant.usage` events (`src/agents/copilot/copilot-review-agent.ts:78-107`). `verdict` (`decision` ∈ approved/flagged/blocked/declined, `pass`) is derived **in code** by `deriveVerdict`, never emitted by the model (`src/schemas/review.ts:91-102`, `src/core/scoring.ts`).

promptfoo's custom-provider `callApi` returns a `ProviderResponse` — `{ output, tokenUsage: { total, prompt, completion }, cost, error, metadata, ... }` (confirmed from the current docs). Proposed mapping in an eval provider:

| `ProviderResponse` field                                     | Source in `ReviewResult`                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `output`                                                     | the whole `ReviewResult` (structured object) or its JSON string                                                           |
| `tokenUsage.prompt`                                          | `cost.tokensIn`                                                                                                           |
| `tokenUsage.completion`                                      | `cost.tokensOut`                                                                                                          |
| `tokenUsage.total`                                           | `cost.tokensIn + cost.tokensOut`                                                                                          |
| `metadata.aiCredits` / `metadata.model` / `metadata.verdict` | `cost.aiCredits`, `cost.model`, `verdict`                                                                                 |
| `cost` (numeric, USD)                                        | **no direct source** — SDK exposes AI _credits_, not USD; leave unset or document `aiCredits` as a proxy under `metadata` |

The schemas use `.describe()` specifically so a JSON Schema can be generated (`src/schemas/review.ts:1-9`), which feeds a promptfoo `is-json` structural assertion directly.

### 4. promptfoo fit — assertions and provider loading (from current docs)

- **TS provider loading is native**: reference `- file://evals/provider.ts` (or a built `.js`); promptfoo loads TS providers in Node.js (not a frontend bundler) and finds `tsconfig.json` when `promptfoo eval` runs from the project root. Path aliases work if declared in `tsconfig.json`.
- **Provider interface**: implement `id()` + `callApi(prompt, context, options)`. Test inputs (diffs, expected data) come via `context.vars`.
- **Assertions available**: `is-json` (optionally with a JSON-Schema `value`), model-graded `llm-rubric` (with `threshold`), plus deterministic `javascript`/custom assertions — perfect for "assert `verdict.decision === 'blocked'`", "assert a finding exists in file X tagged `security_isolation`", or "assert `aiCredits < budget`".
- **Concurrency control**: `maxConcurrency` in config. **Important here** — each `review()` call constructs a fresh `CopilotClient`, calls `client.start()` (boots the bundled `@github/copilot` CLI as a JSON-RPC server subprocess) and `client.stop()` in a `finally` (`src/agents/copilot/copilot-review-agent.ts:56-125`). That's one subprocess boot + one real LLM call per test case, so eval runs must throttle `maxConcurrency` (small, e.g. 1–3) and pin `--model` (the default is `"auto"`, which is non-deterministic across runs — `src/agents/copilot/copilot-review-agent.ts:30`).

### 5. Model = classifier, code = judge → strong, cheap deterministic eval story

`deriveVerdict` is a **pure, exported** severity→verdict state machine (`src/core/scoring.ts:20-30`); `declinedTooLongResult` handles the oversize short-circuit before any LLM call (`src/core/review-agent.ts:42-46`, `src/core/scoring.ts:37-49`). This separation means an eval can:

1. Assert on **classification quality** (did the model surface the seeded bug, with the right criterion/severity?) — via `javascript`/`llm-rubric`.
2. Assert on the **deterministic gate** (`verdict`) with plain equality — no grader model, no cost.
3. Offline-eval the pure parts (`parseReview`, `deriveVerdict`) with fixtures — fast, free, no auth.

### 6. OSS alternatives (why promptfoo wins for this stack)

| Tool                                   | Node/TS support                             | Prompt eval | Agent/tool eval | Notes for this repo                                                                          |
| -------------------------------------- | ------------------------------------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------- |
| **promptfoo**                          | Native (TS providers, YAML config, CLI, CI) | ★★★★★       | ★★☆             | Best stack fit; custom provider maps 1:1 to `ReviewResult`; local + CI. **Recommended.**     |
| DeepEval                               | Python-first (JS via CLI/subprocess)        | ★★★★        | ★★★★            | 50+ metrics incl. tool-level, but best in Python — friction against a Node/TS repo.          |
| Evalite                                | Node/TS, lightweight                        | ★★☆         | ★☆              | Minimal setup but immature; weak on agent/multi-step + advanced metrics.                     |
| Braintrust                             | Node/TS SDK                                 | ★★★★        | ★★★★★           | Enterprise/observability + production agent scoring; heavyweight for a solo pre-1.0 package. |
| LangSmith / Langfuse / Ragas / Phoenix | mixed                                       | —           | —               | Tied to LangChain / RAG / ops-tracing niches; not a fit for a standalone diff-review agent.  |

promptfoo is the go-to OSS choice for TypeScript/Node prompt evaluation with dead-simple config, CLI, HTML reports, and CI integration. DeepEval offers richer agent metrics but its native home is Python. Given the repo is Node/TS/zod/npm and the package was pre-shaped for promptfoo, promptfoo is the aligned pick; DeepEval/Braintrust are only worth revisiting if deep tool-call-level agent scoring or production monitoring becomes a requirement.

### 7. Integration gaps / gotchas specific to this package

- **Standalone package boundary**: `packages/code-reviewer` is **not** a root workspace — the root `package.json` has no `workspaces` field, and the package keeps its own `package.json`/`node_modules` on purpose ("so the native Copilot CLI dependency stays out of the Astro/Cloudflare app build"; it's excluded from root ESLint/TS). ⇒ Put the eval harness (promptfoo config + provider + dataset) **inside** `packages/code-reviewer/` (e.g. `packages/code-reviewer/evals/`), add promptfoo as a devDependency there, and run `promptfoo eval` from that folder so its `tsconfig.json` is found. The provider imports from `../src/index.js` (tsx-loaded) or from the built `../dist`.
- **Auth is required for live evals**, same as CLI/CI: a Copilot subscription or a token (`COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/`GITHUB_TOKEN`). Live evals consume Copilot AI credits.
- **The `llm-rubric` grader is a separate model from the agent.** The agent uses the Copilot SDK (no API key), but promptfoo's `llm-rubric` grader defaults to OpenAI and needs its own key (or a custom grading provider). Deterministic assertions (`is-json`, `javascript` on `findings`/`verdict`) avoid this entirely — prefer them for the gate, reserve `llm-rubric` for fuzzy finding-quality checks.
- **`cost` semantics differ**: promptfoo's `cost` is a numeric (USD) estimate; the SDK reports AI _credits_ + tokens, not USD. Map `tokenUsage` faithfully and expose `aiCredits` via `metadata` rather than misreporting `cost` as dollars.
- **No golden dataset exists.** The main creative work is a labeled diff corpus. The five rubric criteria are natural eval buckets — build seeded-bug diffs per criterion (a domain-math error → `domain_integrity`; a missing zod check → `input_contract`; an IDOR/RLS gap → `security_isolation`; a destructive migration → `data_migration`; a broken edge case → `correctness`) with expected findings + expected `verdict.decision`.

## Code References

- `packages/code-reviewer/src/index.ts:1-46` — side-effect-free public API barrel (the eval import surface).
- `packages/code-reviewer/src/core/review-agent.ts:8-58` — `ReviewInput`, `ReviewAgent` seam, `BaseReviewAgent` (oversize decline + verdict attach).
- `packages/code-reviewer/src/agents/factory.ts:1-33` — `createReviewAgent({ provider, model, instructions })`.
- `packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts:35-125` — SDK session lifecycle, `assistant.usage` cost accounting, single-turn/read-only design (`availableTools: []`).
- `packages/code-reviewer/src/prompts/review-prompt.ts:15-88` — `REVIEW_SYSTEM_PROMPT` rubric + `buildReviewPrompt` (untrusted-context fencing).
- `packages/code-reviewer/src/schemas/review.ts:1-112` — zod schemas (`.describe()` for JSON-Schema export), `ReviewCost`, `Verdict`, `ReviewResult`.
- `packages/code-reviewer/src/core/scoring.ts:20-49` — pure `deriveVerdict` + `declinedTooLongResult`.
- `packages/code-reviewer/src/core/limits.ts:11-12` — `MAX_DIFF_CHARS` (50k), `MAX_DESCRIPTION_CHARS` (3k).
- `packages/code-reviewer/src/cli.ts:1-110` — thin CLI (arg parse → `getDiff` → `createReviewAgent` → `review`).
- `packages/code-reviewer/package.json` — `private: true`, `main`/`types`/`exports` → `dist`, `bin: code-reviewer`; deps `@github/copilot-sdk`, `zod`; not a root workspace.
- `packages/code-reviewer/README.md` — "Evals (promptfoo)" section: import `createReviewAgent`, map `ReviewResult` → `{ output, tokenUsage, cost }`; "Wiring up the eval environment itself is intentionally out of scope for this package."
- `.github/actions/ai-code-review/action.yml` — CI: builds the package, pipes `git diff origin/main...HEAD` into `node dist/cli.js`, gates on the derived verdict.

## Architecture Insights

- **Interface-first, single-implementation**: `ReviewAgent` seam + `createReviewAgent` factory means an eval provider (and future non-Copilot backends) plug in without touching callers. `provider` currently only accepts `"copilot"` (`src/agents/factory.ts:9`).
- **Deterministic gate isolated from the model**: the one piece that "truly needs a unit test" (`deriveVerdict`) is pure and exported — evals can assert on it for free while separately grading the model's classification quality.
- **Read-only, single-turn, cost-bounded**: `availableTools: []` forces one LLM call per review, and oversize diffs decline before any call — predictable per-eval cost, but still one Copilot-CLI subprocess per test case (throttle `maxConcurrency`).
- **Untrusted-input hygiene already built in**: PR title/description are fenced as data in the prompt — the eval corpus can include prompt-injection cases to regression-test this.
- **Isolation boundary**: the package is intentionally walled off from the Astro/Cloudflare app build; evals must respect that boundary and live inside the package.

## Historical Context (from prior changes)

- `context/archive/2026-08-15-code-reviewer/plan-brief.md` — the modular refactor whose explicit goal was _"so a future promptfoo eval can import the agent and run against it."_ Key decisions: barrel export surface, prompts as importable TS constants ("zero loader code" for evals), `ReviewResult` carries cost "mapping cleanly to a promptfoo provider." **Out of scope then**: "promptfoo/eval environment (no provider file, no config)" — i.e. exactly this change's job.
- `context/archive/2026-08-16-ci-cd-code-review/` — the CI composite action + gate wiring. Relevant because evals and CI share the same CLI/agent and the same derived `verdict`; an eval could also cover CI gate parity.
- `context/foundation/tech-stack.md` — Node/TS, npm, GitHub Actions, `has_ai: false` for the _app_ (the Copilot dependency is deliberately quarantined in this package).

## Related Research

- `context/archive/2026-08-15-code-reviewer/research.md` — original code-reviewer design exploration.
- `context/archive/2026-08-16-ci-cd-code-review/research.md` — CI/CD code-review wiring exploration.

## Open Questions

1. **Dataset**: seeded-bug synthetic diffs vs. real historical PRs (or both)? How many cases per criterion for a meaningful signal? Where do fixtures live (`packages/code-reviewer/evals/fixtures/`)?
2. **Scope of eval**: live end-to-end (real Copilot calls, credits, non-deterministic) vs. offline unit-eval of pure parts (`parseReview`, `deriveVerdict`) with recorded/fixture outputs — or a tiered split (offline gate in CI, periodic live quality eval)?
3. **Grader**: use deterministic `javascript`/`is-json` assertions only (no extra key), or add `llm-rubric` (needs an OpenAI key or a custom Copilot grading provider)?
4. **Budget & reproducibility**: pin which model(s), set `maxConcurrency`, and cap credits per run; do we gate CI on eval pass/regression or run it out-of-band?
5. **Prompt-variant matrix**: eval the current `REVIEW_SYSTEM_PROMPT` only, or set up an A/B matrix via `config.instructions` from the start?

## Follow-up Research 2026-08-27 (evening) — open questions resolved, eval design locked

**Reframing (important):** promptfoo here is a **local, developer-run harness — not a CI gate.** Its two jobs: (a) compare models on **cost-to-value** for the review agent (same `REVIEW_SYSTEM_PROMPT`, different models), and (b) serve as a reusable bench to tune the CR process when the prompt/rubric changes. Set up once; run manually by developers. This **supersedes** the earlier "tiered / offline-in-CI" recommendation in Open Question #2.

### Resolved decisions

| #   | Question            | Decision                                                                                                                                                                        |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dataset source      | Seeded synthetic diffs, sourced from branch **`test/ai-cr-live-flaws`** (⚠️ testing only — **DO NOT MERGE**; commit `14d639b`).                                                 |
| 1b  | Cases per criterion | **2** (optionally a 3rd per criterion later).                                                                                                                                   |
| 2   | Eval scope          | **Live end-to-end, run locally/manually — NOT in CI.**                                                                                                                          |
| 3   | Grader              | Deterministic (`is-json` + `javascript` on findings/verdict) **plus** `llm-rubric`, graded by a **Copilot-backed custom provider** (no OpenAI key; uses existing Copilot auth). |
| 4/5 | Models compared     | **`gpt-5.3-codex`, `claude-sonnet-4.6`, `claude-haiku-4.5`** — one promptfoo provider each, identical system prompt.                                                            |
| 6   | Max concurrency     | **2**.                                                                                                                                                                          |
| 7   | CI gating           | **Out-of-band** (dev tool only).                                                                                                                                                |
| 8   | Prompt A/B matrix   | **No** — same prompt; the model is the varied axis.                                                                                                                             |

### Verified technical facts (web)

- **Custom grader without a key**: promptfoo model-graded assertions (`llm-rubric`, `g-eval`, `model-graded-closedqa`) accept a grader override via `assert[].options.provider` (a string path) or `defaultTest.options.provider`. The grader provider returns `{ reason, score, pass }` JSON. ⇒ build a **generic Copilot chat provider** (single-turn, `availableTools: []`) as the grader — it reuses the same `@github/copilot-sdk` auth the review agent already uses, so **no OpenAI/API key is needed**. (Sources: promptfoo model-graded overview + custom-api docs.)
- **Credits → USD is resolvable**: user rule **`1 AI credit = $0.01 USD`** (current pricing). ⇒ the eval provider populates promptfoo's numeric `cost` field as `cost = ReviewResult.cost.aiCredits * USD_PER_AI_CREDIT`, alongside faithful `tokenUsage`. **Encapsulate the factor as a single named configuration constant** (e.g. `USD_PER_AI_CREDIT = 0.01` in one module) — never a hardcoded literal at the call site — so a future pricing change is a one-line edit. This **closes the earlier "no USD source" gotcha** (Finding #7) — promptfoo's side-by-side cost column becomes real dollars, so cost-to-value model comparison is direct.

### Dataset ground-truth — branch `test/ai-cr-live-flaws` (commit `14d639b`)

A single dense multi-flaw PR ("feat(batches): add quick-export endpoint with export metrics", 3 new files / 83 insertions) that spans **all five criteria** — a strong comprehensive case, sliceable into focused single-flaw diffs to reach 3/criterion:

| File                                                      | Seeded flaws → criterion                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/services/export-metrics.ts`                      | `computeTotalSugar` = `kg × volume` (dimensionally wrong; no kg→g) → **domain_integrity**; `estimateAbv` bogus `sugarPerLiter / 10` → **domain_integrity**; `classifyDryness` **inverted** (`>45 ? "dry" : "sweet"`) → **domain_integrity**; `sumSugarReadings` off-by-one `i <= length` (reads `undefined` → NaN) → **correctness**.                                                          |
| `src/pages/api/batches/quick-export.ts`                   | hardcoded `EXPORT_API_KEY` + `console.log` leaking it → **security_isolation**; no zod validation, `as ExportRequest` cast → **input_contract**; `.or(\`id.eq.${body.batchId}\`)`string-interpolated + no owner filter → **security_isolation** (IDOR/injection);`classifyDryness(sugarKg / volume)` unit bug at call site → **domain_integrity**; unguarded divide-by-zero → **correctness**. |
| `supabase/migrations/20260825220000_export_audit_log.sql` | new table with **no RLS/policies**, persists `api_key text not null` → **data_migration** (+ security); unconditional `update batches set updated_at = now()` → **data_migration** (destructive); `add column export_status text not null` (no default on a populated table) → **data_migration**; `drop column diary_entries.notes` → **data_migration** (destructive).                       |

### Remaining nuances for the plan (not blockers)

- The branch is _one_ multi-flaw PR; the plan must decide whether to **slice it into per-criterion single-flaw diffs** (cleaner assertions) and/or keep the whole diff as one comprehensive case, then top up to **2/criterion (+ optional 3rd)**.
- **Pin each provider to a concrete model** (never `auto`) for reproducibility; keep `maxConcurrency: 2` (each case boots a Copilot subprocess + one live LLM call).
- **Grader is fuzzy by nature**: set a `threshold` on `llm-rubric` and prefer deterministic `javascript` assertions for the verdict/finding-presence gate; reserve `llm-rubric` for finding _quality_.
- **Harness location**: inside `packages/code-reviewer/evals/` (standalone package — promptfoo as a local devDependency; the provider imports `../src` via tsx, or the built `../dist`).
