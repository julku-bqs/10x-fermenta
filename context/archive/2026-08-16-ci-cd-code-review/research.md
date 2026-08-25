---
date: 2026-08-16T17:52:13+02:00
researcher: julku-bqs
git_commit: a6a5476575f520c6e8e5fd2a31fcf1c3261745c7
branch: m5l2
repository: julku-bqs/10x-fermenta
topic: "First CI/CD workflow for PR code reviews — criterion tagging, deterministic verdict/gating, and GHA plumbing"
tags: [research, codebase, code-reviewer, ci-cd, github-actions, scoring, rls, domain]
status: complete
last_updated: 2026-08-16
last_updated_by: julku-bqs
last_updated_note: "Added follow-up research: locked the 10 open questions into decisions, grounded the seam design (Template-Method recommended), sticky-comment/inline-comment/warning-status mechanics against official docs, and flagged the diff-cap advisory. Second follow-up closes the 6 remaining planning items (MAX_DIFF_CHARS=50000 default, ReviewInput shape, buildReviewPrompt trimming, node formatter owned by the action, base-ref default main/unwired, Stryker out of scope)."
---

# Research: First CI/CD workflow for PR code reviews

**Date**: 2026-08-16T17:52:13+02:00
**Researcher**: julku-bqs
**Git Commit**: a6a5476575f520c6e8e5fd2a31fcf1c3261745c7
**Branch**: m5l2
**Repository**: julku-bqs/10x-fermenta

## Research Question

From `context/changes/ci-cd-code-review/requirements.md`: introduce the **first CI/CD workflow for PR code reviews** — a GitHub Actions workflow that runs on every PR to `main`, delegates the review to a **composite action**, and produces a PR comment + `ai-cr:passed`/`ai-cr:failed` labels. Alongside the workflow, evolve the existing `@10x-fermenta/code-reviewer` package: **tag each finding with one of five criteria**, grow the `summary`, and derive **one deterministic verdict** (in code, not the model) that the job gates on. On-demand retry when an `ai-cr:review` label is added.

## Summary

This change has **two halves that meet at the package's public API**:

- **(A) Evolve the reviewer package.** `packages/code-reviewer/` is a working, standalone Copilot-SDK agent with a backend-agnostic seam (`ReviewAgent` → `createReviewAgent` factory → `CopilotReviewAgent`). Requirements add: a `CriterionKeySchema`, a `criterion` tag on each `FindingSchema`, a `VerdictSchema` (`decision` + `pass`) **derived in code**, a richer `summary` (3–4 sentences), and a **shared post-processing seam** that maps finding severities → one verdict. The verdict logic must NOT live inside `CopilotReviewAgent` (would duplicate across backends); it belongs at the factory/interface layer.
- **(B) Add the first PR-review GHA workflow.** There is currently only `ci.yml` (lint + build). Crucially, `packages/code-reviewer/README.md` **already ships a working single-step reference workflow** (`on: [pull_request]` → build reviewer → `git diff … | node dist/cli.js --stdin` → `gh pr comment`). This change **productizes** that reference into: a **composite action** wrapping review+scoring+comment+labels, a thin caller workflow, `ai-cr:passed`/`ai-cr:failed` labels, and an `ai-cr:review` on-demand retry trigger.

**The cleanest architecture**: the model emits only `findings` (each tagged with `criterion`) + a richer `summary`; **code** derives the verdict and renders the comment. Expose `scoreReview()` and a comment formatter as **package exports** so both the CLI and the composite action reuse them (testable, single source of truth). The composite action stays thin plumbing (diff → CLI → parse → comment/label).

Biggest decisions to make in planning: (1) exact seam mechanism (decorator at the factory vs. abstract base template-method vs. standalone `scoreReview()`), (2) where verdict/label/comment rendering lives (package exports vs. action scripts), (3) the package has **no test runner** — the pure scoring function is the one piece begging for a unit test, so decide how to test it, and (4) the fork-PR token/permission model (`pull_request` vs `pull_request_target`).

## Detailed Findings

### A. Reviewer package — what exists today (the change surface)

**Schemas** — [`packages/code-reviewer/src/schemas/review.ts`](../../../packages/code-reviewer/src/schemas/review.ts)

- `SeveritySchema = z.enum(["blocker","high","medium","low"])`.
- `FindingSchema = { severity, filePath, lineNumber (string|null), message }` — **no `criterion`** yet.
- `ReviewSchema = { summary, findings[], nitpicks[] }`; `summary` describe text says "One or two sentences".
- `ReviewCostSchema = { model?, tokensIn, tokensOut, aiCredits? }`; `ReviewResultSchema = ReviewSchema.extend({ cost })`.
- Field docs use `.describe()` deliberately so they survive into a generated JSON Schema.
- **Delta from requirements**: add `CriterionKeySchema` (5 keys), add `criterion` to `FindingSchema`, add `VerdictSchema = { decision: "approved"|"flagged"|"blocked", pass: boolean }`; grow `summary` describe text to 3–4 sentences. The verdict is **attached in post-processing, not emitted by the model**.

**The seam** — [`src/core/review-agent.ts`](../../../packages/code-reviewer/src/core/review-agent.ts)

- `interface ReviewAgent { review(diff: string): Promise<ReviewResult> }` — the backend-agnostic seam, explicitly documented as the swap point.
- [`src/agents/factory.ts`](../../../packages/code-reviewer/src/agents/factory.ts): `createReviewAgent(config)` returns a `CopilotReviewAgent` (only `provider: "copilot"` today). **This is the single choke point every backend's result flows through** — natural home for a scoring decorator.
- [`src/agents/copilot/copilot-review-agent.ts`](../../../packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts): `review()` returns `{ ...parseReview(content), cost }`. Empty-diff shortcut returns a fixed "No changes to review" result with zeroed cost. Cost is accumulated from `assistant.usage` events under `streaming: true`, `availableTools: []` (read-only, single-turn). **The verdict must not be added here.**

**Prompt** — [`src/prompts/review-prompt.ts`](../../../packages/code-reviewer/src/prompts/review-prompt.ts)

- `REVIEW_SYSTEM_PROMPT` currently encodes a **4-priority** rubric (correctness / security / data-loss / error-handling) and an inline JSON contract with `summary` = "1-2 sentences".
- `buildReviewPrompt(diff)` wraps the diff in a ` ```diff ` fence for the user turn.
- **Delta from requirements**: replace the 4 priorities with the **5 criteria** (each finding tagged with exactly one), add `criterion` to the JSON contract, and grow `summary` guidance to 3–4 sentences (risk + rationale referencing the driving criteria).

**Parse/validate** — [`src/agents/copilot/parse.ts`](../../../packages/code-reviewer/src/agents/copilot/parse.ts)

- `parseReview(raw)` strips fences/prose, `JSON.parse`, then `ReviewSchema.safeParse`. **Adding `criterion` to `FindingSchema` automatically tightens validation** — the model must now emit it or parsing fails (good forcing function; ensure the prompt makes it mandatory).

**CLI / output** — [`src/cli.ts`](../../../packages/code-reviewer/src/cli.ts)

- Thin `parseArgs` wiring: `createReviewAgent({model}).review(diff)` then `process.stdout.write(JSON.stringify(result, null, 2))`. Diff sources via `getDiff` ([`src/git.ts`](../../../packages/code-reviewer/src/git.ts): stdin/file/base/staged).
- Today the README workflow pipes this **raw JSON** straight into a PR comment. The new work needs a **Markdown formatter** (JSON → readable comment) and **verdict/label derivation** — see Open Questions on where these live.

**Public API** — [`src/index.ts`](../../../packages/code-reviewer/src/index.ts)

- Side-effect-free barrel exporting `ReviewAgent`, `createReviewAgent`, `CopilotReviewAgent`, all schemas/types, `REVIEW_SYSTEM_PROMPT`/`buildReviewPrompt`, `getDiff`. **`z` is deliberately NOT re-exported** (plan-review Fix F2, see Historical Context). New exports (`scoreReview`, a comment formatter, `VerdictSchema`) should follow the same discipline.

### B. Building / running / testing the package in CI

**Manifest** — [`packages/code-reviewer/package.json`](../../../packages/code-reviewer/package.json)

- `name: @10x-fermenta/code-reviewer`, `private: true`, `type: module`, `bin.code-reviewer → ./dist/cli.js`, `engines.node: ^20.19.0 || >=22.12.0`.
- Scripts: `dev`/`review` = `tsx src/cli.ts`; `build` = `tsc -p tsconfig.json` → `dist/`; `start` = `node dist/cli.js`; `typecheck` = `tsc --noEmit`.
- Deps: `@github/copilot-sdk ^1.0.11`, `zod ^4.4.3`. DevDeps: `tsx`, `typescript ^6.0.3`, `@types/node`. **No test runner, no ESLint config.**
- `.gitignore` ignores `dist/` (build artifact, not committed).

**Standalone by design** (README "Notes"): its own `package.json`/`node_modules`, **excluded from the root ESLint & TypeScript programs**, so the native Copilot CLI dependency stays out of the Astro/Cloudflare build. **Root `package.json` has NO `workspaces` field** → the package is not installed by the root `npm ci`. CI must run `cd packages/code-reviewer && npm install && npm run build` as a **separate step**.

**Tests**: there are **no tests** under `packages/code-reviewer/**`. Root `vitest.config.ts` / `vitest.integration.config.ts` target the app's `src/` only (they do not include `packages/**`). The requirements' **deterministic severity→verdict scoring is a pure function** — the ideal first unit test — but there is nowhere to run it today. Planning must decide: add a minimal vitest setup to the package, or place scoring so root vitest can see it (less clean given the exclusion). This is the main testing gap.

**Auth in CI** — [`packages/code-reviewer/.env.example`](../../../packages/code-reviewer/.env.example) + README:

- Copilot SDK authenticates with a **GitHub token**, not an LLM key. Order: `COPILOT_GITHUB_TOKEN` > `GH_TOKEN` > `GITHUB_TOKEN`.
- In Actions: use the built-in `GITHUB_TOKEN` with `permissions: copilot-requests: write` (billed to the org; requires the "Copilot CLI billed to the organization" org policy). Model via `COPILOT_MODEL` (default `auto`).

### C. CI/CD & GitHub Actions plumbing

**Current state** — [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)

- Only workflow. `on: push`/`pull_request` to `main`. Steps: `checkout@v4` → `setup-node@v4` (node 24, npm cache) → `npm ci` → `npx astro sync` → `npm run lint` → `npm run build` (with `SUPABASE_URL`/`SUPABASE_KEY` from `secrets`).
- **No `permissions:` block anywhere.** Default branch is `main`. `.nvmrc` = `24.18.0`.
- **No `.github/actions/`** (no composite actions), **no** issue/PR templates, **no** `CODEOWNERS`/`dependabot.yml`. No existing PR-comment or label automation. (`.github/skills/**`, `.github/prompts/**`, `.github/hooks/**`, `.github/copilot-instructions.md` exist but are unrelated tooling.)

**Reference workflow already in the repo** — [`packages/code-reviewer/README.md`](../../../packages/code-reviewer/README.md) ("CI: review every pull request"):

```yaml
on: [pull_request]
permissions:
  contents: read
  pull-requests: write
  copilot-requests: write
# checkout@v4 (fetch-depth: 0) → setup-node@v4 (node 24)
# build in packages/code-reviewer (npm install && npm run build)
# git diff origin/${{ github.base_ref }}...HEAD | node dist/cli.js --stdin > review.md
# gh pr comment ${{ github.event.pull_request.number }} --body-file review.md   (GH_TOKEN = secrets.GITHUB_TOKEN)
```

This is effectively **v0 of the change**. The gap between it and the requirements:

| Requirement                                  | Reference workflow today | Work needed                                                          |
| -------------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| Composite action wrapping the review         | inline steps             | `.github/actions/<name>/action.yml` (`runs.using: composite`)        |
| `criterion` tag per finding + richer summary | not present              | prompt + schema change (Half A)                                      |
| Deterministic verdict                        | not present              | `scoreReview()` in code (Half A)                                     |
| Formatted comment (not raw JSON)             | pipes raw JSON           | comment formatter (Markdown)                                         |
| `ai-cr:passed` / `ai-cr:failed` labels       | none                     | create labels + add/remove (mutual exclusion) via `gh`               |
| On-demand retry via `ai-cr:review`           | none                     | `pull_request` `labeled` type + `if` guard + remove label after      |
| Inputs: PR title, PR description             | diff only                | pass title/desc into the CLI/prompt (description behind a cost flag) |

**Labels & comments**: the `gh` CLI is available on runners (README uses `gh pr comment`). Labels can be applied with `gh pr edit --add-label/--remove-label` or `gh api`; labels likely need to be created once (color: red for failed, green for passed). Mutual exclusion means removing the opposite label each run.

**Triggers**: base is `on: pull_request` to `main` (`opened`/`synchronize`/`reopened`). On-demand retry adds the `labeled` type with an `if:` guard checking `github.event.label.name == 'ai-cr:review'`, then removes that label after running so it can re-fire.

### Criteria grounding — real code anchors for the system prompt

The five criteria in requirements map to concrete, verifiable code (so the prompt names things that actually exist):

- **`correctness`** — general logic/edge-case/error-handling; no single anchor (spans the diff).
- **`domain_integrity`** — winemaking math:
  - [`src/lib/services/sugar-calculation.ts`](../../../src/lib/services/sugar-calculation.ts): `SUGAR_PER_ABV_GRAM_PER_LITER = 17` (line 3); `SWEETNESS_MIDPOINTS` (lines 5–10) and `SWEETNESS_RANGES` (lines 12–17); `calculateSugar()` (lines 35–58) — ingredient sugar aggregation `amount_liters * sugar% * 10` (lines 39–42) and **kg↔g conversion `/1000`** (lines 46–50).
  - [`src/lib/services/batch-validation.ts`](../../../src/lib/services/batch-validation.ts): rule set incl. `abvExceedsTolerance` (target ABV > yeast tolerance), `sweetnessWontStop` (non-dry + tolerance > ABV → won't stop), `sweetnessOutOfRange` (g/L vs `SWEETNESS_RANGES`), `totalSugarInsufficient`/`totalSugarExceedsTarget`.
  - `src/lib/services/process-plan-generation.ts`: dry vs non-dry step selection (`isNotDry`) and pulp-vs-juice process steps (per domain-grounding agent; verify exact lines in planning).
- **`input_contract`** — zod-before-write: schemas in `src/lib/schemas/{batch,diary-entry,auth}.ts`; handlers `safeParse` before any DB write in [`src/pages/api/batches/index.ts`](../../../src/pages/api/batches/index.ts), `src/pages/api/batches/[id]/index.ts`, `src/pages/api/batches/[id]/diary/index.ts`; DTO/entity types in `src/types.ts`.
- **`security_isolation`** — per-user isolation: [`src/middleware.ts`](../../../src/middleware.ts) resolves the user via `supabase.auth.getUser()` into `context.locals.user` and gates `PROTECTED_ROUTES`; API inserts assign `user_id` **server-side** (not from the body); RLS policies in [`supabase/migrations/20260530213000_batch_schema_with_rls.sql`](../../../supabase/migrations/20260530213000_batch_schema_with_rls.sql) (`FOR ALL USING (auth.uid() = user_id)` on `batches`; nested `EXISTS` policy on `diary_entries`).
- **`data_migration`** — [`supabase/migrations/`](../../../supabase/migrations/): naming `YYYYMMDDHHmmss_snake_case.sql`; `20260530213000_batch_schema_with_rls.sql` (enums + RLS baseline), `20260605220000_ingredients_jsonb_on_batches.sql` (denormalize ingredients → jsonb), `20260613140000_sugar_fields_to_batch_columns.sql` (extract sugar columns + backfill), `20260614130000_diary_entries_process_plan.sql` (`SECURITY DEFINER regenerate_diary_entries` with `auth.uid()` ownership guard; `entry_type` auto→user promotion).

## Code References

- `packages/code-reviewer/src/schemas/review.ts` — schemas to extend (`criterion`, `VerdictSchema`, richer `summary`).
- `packages/code-reviewer/src/core/review-agent.ts` — the `ReviewAgent` seam (scoring must stay backend-agnostic).
- `packages/code-reviewer/src/agents/factory.ts` — `createReviewAgent` choke point (candidate scoring decorator site).
- `packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts` — `review()` returns `{ ...parseReview, cost }`; do NOT add verdict here.
- `packages/code-reviewer/src/agents/copilot/parse.ts` — zod validation gate (criterion becomes mandatory).
- `packages/code-reviewer/src/prompts/review-prompt.ts` — 4-priority rubric → 5-criteria rubric + JSON contract.
- `packages/code-reviewer/src/cli.ts` — emits raw JSON; needs a formatter + verdict path for CI.
- `packages/code-reviewer/package.json` — standalone build (`tsc`→`dist`), no tests, no workspaces.
- `packages/code-reviewer/README.md` — ships the v0 reference PR-review workflow + auth model.
- `packages/code-reviewer/.env.example` — token order (`COPILOT_GITHUB_TOKEN > GH_TOKEN > GITHUB_TOKEN`), `COPILOT_MODEL`.
- `.github/workflows/ci.yml` — only existing workflow; conventions to mirror (node 24, checkout@v4, `secrets.*`).
- `src/lib/services/sugar-calculation.ts`, `src/lib/services/batch-validation.ts` — `domain_integrity` anchors.
- `src/middleware.ts`, `supabase/migrations/20260530213000_batch_schema_with_rls.sql` — `security_isolation` / `data_migration` anchors.

## Architecture Insights

- **The backend-agnostic seam is already load-bearing.** `ReviewAgent` + `createReviewAgent` exist precisely so scoring/eval concerns can wrap results without touching a concrete backend. The severity→verdict layer should be applied **once**, at or above the factory, so every future backend inherits it (decorator at the factory is the least-invasive fit; an abstract base `template-method` and a standalone `scoreReview()` called by callers are the alternatives).
- **Model = classifier, code = judge.** The model only emits `findings` (with `criterion`) + `summary`; the boolean gate is derived deterministically in code. This keeps prompts cheap, keeps the gate stable across runs, and makes the gate unit-testable independent of the LLM.
- **The package is a deliberately isolated mini-project.** No root workspaces, no root lint/TS, no test runner. A **composite action** is the natural encapsulation boundary — it owns "cd, install, build, run, parse, comment, label" so the caller workflow stays declarative.
- **This change productizes an existing README example.** The reference workflow already proves auth + diff + comment work end-to-end. The net-new surface is: tagging/verdict (Half A), formatted comment, labels + mutual exclusion, on-demand retry, and the composite-action wrapper.

## Historical Context (from prior changes)

- [`context/archive/2026-08-15-code-reviewer/plan-brief.md`](../../archive/2026-08-15-code-reviewer/plan-brief.md), `plan.md`, `reviews/plan-review.md`, `reviews/impl-review.md` — the modular refactor that produced today's structure (introduced the `ReviewAgent` interface + `createReviewAgent` factory, split into `core/schemas/prompts/agents/copilot`, and preserved cost accounting via `assistant.usage` + `streaming: true`). Constraints this imposes on the current change:
  - **F1 (plan-review)**: empty-diff must still return a valid "No changes to review" result with zeroed cost — keep this path working when verdict/scoring is added (verdict of an empty review = `approved`, `pass = true`).
  - **F2 (plan-review)**: the barrel must **not leak `z`/zod** into the public API — new exports (`scoreReview`, `VerdictSchema`) re-export names only.
  - Cost accounting (`assistant.usage`, streaming) **must move verbatim** or cost silently zeros — don't disturb it when inserting a scoring seam.
- [`context/foundation/domain_knowledge.md`](../../foundation/domain_knowledge.md) — canonical winemaking rules behind the `domain_integrity` criterion (load when writing/validating that criterion's prompt language).
- [`context/foundation/lessons.md`](../../foundation/lessons.md) — current lessons (`useHydrated` island policy) are UI-specific and not relevant to this change.

## Related Research

- No prior `research.md` targets this change. The archived `context/archive/2026-08-15-code-reviewer/` plan/reviews are the closest antecedent and directly constrain the package edits (see Historical Context).

## Open Questions

1. **Scoring seam mechanism** — decorator wrapping the agent at `createReviewAgent` vs. an abstract `BaseReviewAgent` (template-method) vs. a standalone `scoreReview(review): Verdict` called by CLI/action. Requirements explicitly defer this; the plan must pick one. (Decorator-at-factory is the least-invasive.)
2. **Where verdict/label/comment rendering lives** — prefer **new package exports** (`scoreReview`, `formatReviewComment`) so the CLI and the composite action share one tested implementation, rather than duplicating logic in shell/JS inside the action.
3. **Testing the scoring function** — the package has no test runner. Add a minimal `vitest` (devDep + config + `test` script) to `packages/code-reviewer/` for the pure verdict function, or relocate scoring to where root vitest already runs? The verdict derivation is the one piece that truly needs a unit test (severity→decision table + empty-list case).
4. **Fork-PR permission model** — `pull_request` gives a read-only `GITHUB_TOKEN` and no secrets for fork PRs (labeling/commenting can fail); `pull_request_target` restores permissions but runs base-ref workflow code. For this single-owner repo, start with `pull_request` + `permissions: { pull-requests: write, contents: read, copilot-requests: write }` and document the fork limitation.
5. **On-demand retry shape** — `on: pull_request` types `[opened, synchronize, reopened, labeled]` with `if: github.event.label.name == 'ai-cr:review'` on the label path, and remove `ai-cr:review` after the run so it can re-fire. Confirm one workflow handles both paths vs. a separate re-run workflow.
6. **Comment strategy** — post a fresh comment each run vs. update a single **sticky** comment (find-by-marker and edit). Requirements only say "PR comment with summary"; sticky is nicer UX but more code (`gh api` to find + `--edit-last` or a marker).
7. **Gate policy / check status** — requirements say labels are the signal and `flagged` (medium) is **non-blocking by default** (configurable knob parked). Decide whether a `blocked` verdict should also **fail the job/check** (red X that can gate branch protection) or only label.
8. **PR description as input** — cost tradeoff flagged in requirements; include PR **title** always, PR **description** optionally (behind a flag) since it inflates tokens.
9. **Diff size / cost bounding** — large PRs → large diffs. The SDK bounds _turns_ (single-turn, tools disabled) but not tokens; consider a max-diff guard or truncation, and possibly `COPILOT_MODEL` pinning for reproducible CI cost.
10. **Labels bootstrap** — `ai-cr:passed` (green), `ai-cr:failed` (red), `ai-cr:review` (trigger) must exist in the repo; decide whether the workflow creates them idempotently (`gh label create --force`) or they're provisioned once out-of-band.

---

## Follow-up Research 2026-08-16 18:46 (+02:00) — decisions locked & design grounded

Source: user follow-up resolving all 10 open questions plus 3 notes on the findings. Verified against **official docs** (GitHub Actions composite actions, the `gh pr comment` manual, the PR Reviews REST API, and workflow warning annotations), because the in-repo `packages/code-reviewer/README.md` CI example is now treated only as a **soft reference** — primary drivers are this research + official documentation, and the README example may be removed once the real workflow lands (note 3).

### Locked contract: the model returns JSON (incl. verdict); the pipeline formats (notes 1 & 2, OQ2)

- The agent/CLI **intentionally return a JSON model only** — now including the code-derived `verdict`. **Markdown rendering is a pipeline step owned by the composite action**, never the agent. `formatReviewComment` is therefore **not** a package export; a small formatting script lives with the action (`.github/actions/<name>/`) and consumes the CLI's JSON.
- Because the verdict is baked into every `ReviewResult` (see OQ1), there is **no "forgot to score" risk** and **no agent↔CI sharing concern** — promptfoo and every other consumer get the full model straight from `review()`.

### OQ1 — the scoring seam: two candidates, **recommendation = Template Method**

Hard constraint (user): the verdict must come **directly from `ReviewAgent.review()`** so every consumer always receives a full model; a standalone `scoreReview()` that callers must remember to invoke is **excluded** (a consumer that forgot it would get half-ready output). Both remaining options call one shared pure function `deriveVerdict(findings): Verdict` (the unit-tested state machine); they differ only in _where_ it is applied.

**Option A — Template Method (abstract base). ✅ RECOMMENDED.**

```ts
// core/review-agent.ts
export abstract class BaseReviewAgent implements ReviewAgent {
  async review(input: ReviewInput): Promise<ReviewResult> {
    const raw = await this.runReview(input); // backend-specific: parse + cost
    return { ...raw, verdict: deriveVerdict(raw.findings) }; // shared, applied in ONE place
  }
  protected abstract runReview(input: ReviewInput): Promise<Omit<ReviewResult, "verdict">>;
}
// CopilotReviewAgent extends BaseReviewAgent and implements runReview() (its current body minus final assembly).
```

- **Pros**: the verdict is **structurally guaranteed** for every backend — even `new CopilotReviewAgent().review()` (which `index.ts` exports directly) can never return a half-ready result; the `ReviewAgent` interface is unchanged; the Copilot agent edit is minimal (rename `review`→`runReview`, drop the top-level `return {...}`); `deriveVerdict` stays a pure, independently testable function.
- **Cons**: inheritance couples backends to the base; the `Omit<ReviewResult, "verdict">` return type is mildly awkward.

**Option B — Decorator (composition at the factory).**

```ts
export class ScoringReviewAgent implements ReviewAgent {
  constructor(private readonly inner: RawReviewAgent) {} // inner returns a result WITHOUT verdict
  async review(input: ReviewInput): Promise<ReviewResult> {
    const raw = await this.inner.review(input);
    return { ...raw, verdict: deriveVerdict(raw.findings) };
  }
}
// factory: new ScoringReviewAgent(new CopilotReviewAgent(...))
```

- **Pros**: composition over inheritance; trivial to stack further cross-cutting layers later (retries, logging); easy to test with a fake inner.
- **Cons**: the guarantee **holds only through the factory** — since `index.ts` currently exports `CopilotReviewAgent` directly, a consumer newing it up would bypass scoring unless we (a) stop exporting the raw agent and (b) give it a distinct `RawReviewAgent`/`RawReviewResult` type. That is a larger public-API change and reintroduces the exact "half-ready if bypassed" risk the constraint forbids.

**Recommendation: Option A (Template Method)** — it is the only option that makes a half-ready result _unrepresentable_ even when the concrete agent is constructed directly (the currently-exported path), while keeping `deriveVerdict` a pure, table-tested function and touching the Copilot agent minimally. Choose Option B only if we later need to stack multiple cross-cutting wrappers _and_ are ready to hide the raw agent behind the factory.

### OQ8 — agent interface gains optional `title` / `description`

`review()` becomes input-object shaped so the new fields are optional and future-extensible:

```ts
export interface ReviewInput {
  diff: string;
  title?: string;
  description?: string;
}
export interface ReviewAgent {
  review(input: ReviewInput): Promise<ReviewResult>;
}
```

- `buildReviewPrompt(input)` folds in title/description when present. The CLI gains `--title`/`--description` (or reads workflow-provided env) and keeps its stdin/flags for the diff. This is a **breaking change** to today's `review(diff: string)` — update `cli.ts` and the README embedding snippet.

### OQ8 / OQ9 — input trimming constants (⚠ the diff cap needs a saner default)

- **PR description** — trim to **3000 chars** via a single hardcoded const (e.g. `MAX_DESCRIPTION_CHARS = 3000`), easy to lift into config later. ✅ sensible as-is.
- **Diff** — the user proposed the _same_ 3000-char cap. ⚠ **Advisory: 3000 chars is far too small for a diff.** A single ~40–60 line file already exceeds it, so almost every real PR would be truncated to near-nothing and the review would be meaningless. Recommend a **separate** `MAX_DIFF_CHARS` const with a much larger default (order of tens of thousands of chars, or a token-aware budget) — still one easily-tuned const. **Confirm the diff cap value during planning.** Trimming is applied where the prompt is built (single source, unit-testable), not scattered across the action.
- **Model** stays `auto` (unchanged) — `auto` carries the credit discount; model/agent evaluation is deferred.

### OQ7 — fail vs warn: separate "review failed" from "reviewer failed"

Confirmed via docs: GitHub Actions has **no native "neutral" conclusion** from YAML/exit code (the old `exit 78` trick was removed); a true gray/neutral status requires the **Checks API** (a bot/App) — out of scope (sledgehammer). In-scope pattern that matches the user's ask:

- **The CLI exits 0 for any _successful_ review, including a `blocked` verdict** (a blocked verdict is a valid outcome, not an error). It exits non-zero only on genuine failures (provider/auth/parse). _(Small change to today's `cli.ts`, which currently `process.exit(1)` on any thrown error — no regression, since verdicts don't exist yet.)_
- **The composite action captures the CLI's exit code + stdout** and branches:
  - exit 0 + valid JSON → gate on `verdict.pass`: `false` ⇒ apply `ai-cr:failed` and **fail the job** (exit 1, blockable via branch protection); `true` ⇒ apply `ai-cr:passed`, pass.
  - exit ≠ 0 or unparseable output (LLM/provider outage, auth, timeout) ⇒ emit `::warning:: no AI review performed`, **exit 0 (non-blocking)**, apply **no pass/fail label**. This is the requested "warning state": it flags that the review didn't run without blocking the PR.
- `flagged` (medium-only findings) stays **non-blocking by default** (parked config knob).

### OQ6 — sticky comment WITHOUT `gh api`

Confirmed from the `gh` manual: `gh pr comment` supports `--edit-last` **and** `--create-if-none` ("Create a new comment if no comments are found. Can be used only with --edit-last"). A sticky reviewer comment is therefore plain `gh` — no REST sledgehammer:

```bash
gh pr comment "$PR" --edit-last --create-if-none --body-file review.md
```

`--edit-last` targets the current user's last comment; in Actions with `GITHUB_TOKEN` that user is `github-actions[bot]`, i.e. exactly the sticky reviewer comment. ✅ resolves the concern.

### Note 2 — inline file+line comments: **PARKED** (mechanism recorded)

Nice-to-have only if straightforward; confirmed it is **not**. `gh pr comment` / `gh pr review` cannot post inline (path+line) comments — that needs the REST **Reviews API** (`POST /repos/{owner}/{repo}/pulls/{n}/reviews` with a `comments[]` array, or `.../pulls/{n}/comments`) supplying `commit_id`, `path`, `line`, `side` — i.e. the `gh api` route the user wants to avoid. The model already emits `filePath` + `lineNumber`, so the _data_ is ready; only the plumbing is deferred. **Decision: park it**; revisit as a separate follow-up (map each finding → one batched review with per-line comments).

### OQ3 — scoring unit tests use the repo's existing runner (vitest 4)

The repo standardizes on **vitest ^4.1.10** (root `test: "vitest run"`, `vitest.config.ts`, `globals: true`, `@`→`src` alias). The reviewer package is standalone (own `node_modules`, excluded from root TS/ESLint), so: add `vitest` (^4) as a **devDependency of `packages/code-reviewer`**, a tiny `packages/code-reviewer/vitest.config.ts`, and a `test` script; colocate `deriveVerdict` tests. Table-driven cases: `[]`→approved; only `low`→approved; any `medium`→flagged; any `high`/`blocker`→blocked (short-circuit); `pass = decision !== "blocked"`. This mirrors root conventions without polluting the app's test program.

### OQ4 / OQ5 / OQ10 — confirmations

- **OQ4 (forks)**: no fork support now (parked). Use `on: pull_request` to `main` with `permissions: { contents: read, pull-requests: write, copilot-requests: write }`; document that fork PRs (read-only token, no secrets) are out of scope.
- **OQ5**: a **single workflow** handles both the PR trigger and the `ai-cr:review` label retry — `types: [opened, synchronize, reopened, labeled]` + an `if` guard on the label; remove `ai-cr:review` after the run (`gh pr edit --remove-label`) so it can re-fire.
- **OQ10**: labels (`ai-cr:passed`, `ai-cr:failed`, `ai-cr:review`) are **provisioned once during implementation** (local `gh` is configured). The workflow does **not** create them — it only adds/removes via `gh pr edit --add-label/--remove-label` (mutual exclusion of passed/failed).

### Revised responsibility split (post-decisions)

| Concern                                                         | Owner                                                              | Notes                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Diff/title/description → structured review **+ verdict** (JSON) | **package** (`ReviewAgent` Template-Method base + `deriveVerdict`) | verdict always present; title/desc optional; inputs trimmed by consts                     |
| JSON → Markdown comment body                                    | **composite action** (formatting script)                           | `jq` or a tiny node script; **not** a package export                                      |
| Post / refresh the PR comment                                   | **composite action**                                               | `gh pr comment --edit-last --create-if-none` (sticky, plain `gh`)                         |
| Labels (add/remove, mutual exclusion)                           | **composite action**                                               | `gh pr edit`; labels pre-provisioned                                                      |
| Gate: fail vs warn                                              | **composite action**                                               | exit0+JSON ⇒ gate on `verdict.pass`; exit≠0 ⇒ `::warning::`, non-blocking                 |
| Triggering (PR + on-demand retry)                               | **caller workflow**                                                | one workflow; `labeled` + `if ai-cr:review`; remove label after                           |
| Build/install the reviewer                                      | **caller workflow / action**                                       | `cd packages/code-reviewer && npm install && npm run build` (separate from root `npm ci`) |

### New / remaining open items for planning

1. **Confirm the diff cap value** — ⚠ 3000 chars is likely too small; recommend a larger, separate `MAX_DIFF_CHARS`.
2. `review()` input shape — object param `ReviewInput` (recommended) vs `review(diff, opts?)`.
3. Where trimming is applied — inside `buildReviewPrompt`/`review` (recommended, testable) vs the CLI arg layer.
4. Formatter implementation — `jq` vs a small node script co-located with the action; comment layout (summary + verdict badge + findings grouped by `criterion`, nitpicks folded).
5. Composite action location/name (e.g. `.github/actions/ai-code-review/action.yml`), its inputs (`pr-number`, `base-ref`, `title`, `description`, `model`) and outputs (`decision`, `pass`).
6. Optional: mutation-test `deriveVerdict` with Stryker (`@stryker-mutator/vitest-runner` is configured) via a narrowed `--mutate` over the scoring file — the gate is exactly the "risk-critical module" the repo's Stryker guidance targets.

---

## Follow-up Research 2026-08-16 19:04 (+02:00) — remaining planning items closed

The user resolved the six "New / remaining open items" above. Final decisions:

1. **`MAX_DIFF_CHARS` — separate const, proposed default `50_000`.** Rationale: at ~4 chars/token that's ~12.5k tokens for the diff, so total input (system prompt + trimmed description ≤ 3000 + diff) stays comfortably within a single-turn budget on `auto`; ~50k chars covers roughly **800–1200 changed diff lines**, i.e. the large majority of real PRs, while bounding worst-case cost/latency. Trivially tunable later. `MAX_DESCRIPTION_CHARS` stays `3000`.
2. **`ReviewInput` object shape confirmed** — `{ diff: string; title?: string; description?: string }`.
3. **Trimming lives in `buildReviewPrompt`** — both consts (`MAX_DIFF_CHARS`, `MAX_DESCRIPTION_CHARS`) sit in the prompts module and are applied there (single source, unit-testable). The empty-diff shortcut in `CopilotReviewAgent` is unaffected (emptiness is checked before the prompt is built).
4. **Comment formatter = a small node script co-located with the composite action** (e.g. `.github/actions/<name>/format-comment.mjs`), consuming the CLI's JSON — **not** a package export. Layout: `summary` + a verdict badge (`decision` / `pass`) + findings grouped by `criterion` (each with `severity` and `filePath:lineNumber`), nitpicks folded into a collapsible section.
5. **Composite action I/O:** inputs `pr-number` (required), `title`, `description`, `model` (optional); **`base-ref` optional, default `main`, initially left unwired** by the caller (the trigger is PR→`main`, so the default suffices). Outputs `decision`, `pass`.
6. **Stryker mutation testing is out of scope** for this change (deferred).

**Research status: complete — ready for `/10x-plan ci-cd-code-review`.** No open questions remain; the diff-cap default (`50_000`) is a starting value the plan may adjust.
