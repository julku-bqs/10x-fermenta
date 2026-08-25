# First CI/CD PR Code-Review Workflow Implementation Plan

## Overview

Introduce the repo's first PR-review CI/CD pipeline. Two halves meet at the `@10x-fermenta/code-reviewer` package's public API:

- **(A) Evolve the reviewer package** — tag every finding with one of five `criterion` keys, derive **one deterministic `verdict`** in code (not the model), grow the `summary`, decline oversize diffs instead of truncating them, and give the standalone package its **first tests**.
- **(B) Productize the README's v0 reference workflow** into a **composite action** (build → run → gate → sticky comment → labels) plus a thin **caller workflow** (PR→`main` + on-demand `ai-cr:review` retry), emitting `ai-cr:passed` / `ai-cr:failed` labels (with a neutral `ai-cr:skipped` for declined oversize diffs) and failing the check on a `blocked` verdict.

## Current State Analysis

- **CI**: only [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) (lint + build; node 24; `checkout@v4`; **no `permissions:` block**). No `.github/actions/`, no PR-comment/label automation, no labels.
- **Reviewer package** ([`packages/code-reviewer/`](../../../packages/code-reviewer)):
  - Backend-agnostic seam `ReviewAgent` ([`src/core/review-agent.ts`](../../../packages/code-reviewer/src/core/review-agent.ts)) → `createReviewAgent` factory ([`src/agents/factory.ts`](../../../packages/code-reviewer/src/agents/factory.ts)) → `CopilotReviewAgent` ([`src/agents/copilot/copilot-review-agent.ts`](../../../packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts)).
  - Schemas ([`src/schemas/review.ts`](../../../packages/code-reviewer/src/schemas/review.ts)): `FindingSchema` has **no `criterion`**; there is **no `VerdictSchema`**; `summary` describe text says "One or two sentences".
  - Prompt ([`src/prompts/review-prompt.ts`](../../../packages/code-reviewer/src/prompts/review-prompt.ts)): a **4-priority** rubric; `buildReviewPrompt(diff)` takes a bare string.
  - CLI ([`src/cli.ts`](../../../packages/code-reviewer/src/cli.ts)) emits **raw JSON**; `review(diff: string)`.
  - Barrel ([`src/index.ts`](../../../packages/code-reviewer/src/index.ts)) deliberately does **not** export `z`.
  - Manifest ([`package.json`](../../../packages/code-reviewer/package.json)): **no test runner**, no ESLint; standalone (`tsc`→`dist`), not in root workspaces; `engines.node ^20.19.0 || >=22.12.0`.
  - README ([`README.md`](../../../packages/code-reviewer/README.md)) ships a working **v0 reference workflow** (`on: [pull_request]` → build → `git diff … | node dist/cli.js --stdin` → `gh pr comment`).

## Desired End State

- **Package**: every `ReviewResult` carries a `verdict` (`decision` + `pass`) **structurally guaranteed** for every backend; each finding is tagged with exactly one of five criteria (an untagged or misclassified finding degrades to `criterion: null`, never voiding the review); oversize diffs are **declined** (deterministic `declined` verdict, no LLM call); the `summary` is 3–4 sentences; `review()` takes a `ReviewInput` (`{ diff, title?, description? }`); `deriveVerdict` and the decline short-circuit are **unit-tested** under a package-local vitest.
- **CI**: a composite action + caller workflow post a **sticky** PR comment, apply exactly one of `ai-cr:passed` / `ai-cr:failed` (mutual exclusion; a declined oversize diff gets a neutral `ai-cr:skipped` instead), fail the job on `blocked` (branch protection left **unwired** — flip on later), warn-and-pass when the reviewer itself fails to run, and re-run on demand when `ai-cr:review` is added.

### Key Discoveries

- **Breaking library API**: `review(diff: string)` → `review(input: ReviewInput)`. The **CLI change is additive** (new optional `--title`/`--description`; stdin-only invocation unchanged), so README CLI examples stay valid; only the library signature and the reference-workflow section change.
- **Empty-diff shortcut** ([`copilot-review-agent.ts`](../../../packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts) — the `diff.trim().length === 0` branch) must keep returning a valid "No changes" result → verdict `approved`/`pass`.
- **Cost accounting** (`assistant.usage` events under `streaming: true`, `availableTools: []`) must move **verbatim** into the refactored `runReview()` or cost silently zeros.
- **Barrel discipline** ([`index.ts`](../../../packages/code-reviewer/src/index.ts)): new exports re-export **names only**; never re-export `z`.
- **Standalone build**: root `package.json` has no `workspaces`, so CI must build the package as a **separate step** (`cd packages/code-reviewer && npm ci && npm run build`); tests run via a **package-local** vitest (^4, matching root conventions), not the app's runner. (`npm ci` needs the committed `package-lock.json` in sync — regenerate and commit it when Phase 1 adds the `vitest` devDependency, or `npm ci` will fail the build.)
- **Decline ≠ derived verdict**: `deriveVerdict([])` is `approved`; the oversize decline must **force** `declined` directly (assembled result, not routed through `deriveVerdict`).

## What We're NOT Doing

- **No inline (path+line) PR comments** — parked; needs the REST Reviews API (`gh api`), deliberately avoided. The data (`filePath`/`lineNumber`) is already emitted for a future follow-up.
- **No fork-PR support** — `on: pull_request` only; fork PRs get a read-only token / no secrets. Documented as out of scope.
- **No configurable gate-policy knob** — `flagged` (medium-only) stays **non-blocking** by a hardcoded default.
- **No branch-protection rule** in this change — the fail path is built and tested; enabling the merge gate is a later repo-setting toggle (zero code change).
- **No new criteria beyond the five** — business-alignment / architectural-fit / convention-idiom remain parked (lint + `tsc` own idioms).
- **No Stryker mutation testing** (deferred) and **no model/agent evaluation** (`model` stays `auto`).
- **No root-workspace integration** — the package stays a deliberately isolated mini-project.
- **No diff truncation** — oversize diffs are declined, never partially reviewed.

## Implementation Approach

**Model = classifier, code = judge.** The model emits only `findings` (each tagged with one `criterion`) + a richer `summary`; **code** derives the `verdict`. The verdict is attached **once** in an abstract **`BaseReviewAgent` (Template Method)** so a half-ready result is unrepresentable even when a concrete agent is constructed directly (the path `index.ts` exports today). Oversize diffs short-circuit to a deterministic **decline** before any LLM call.

**CI is thin plumbing.** A **composite action** owns the imperative pipeline (build → run CLI → gate on `verdict.pass` → format → sticky comment → labels); a **caller workflow** owns triggers and permissions. The comment formatter is a small node script **co-located with the action** (not a package export), consuming the CLI's JSON.

The package is built and fully tested (Phases 1–3) before CI wraps it (Phases 4–5).

## Critical Implementation Details

- **Ordering / lifecycle**: the oversize **decline check lives in `BaseReviewAgent.review()` before `runReview()`** (no LLM call); the **empty-diff shortcut stays inside the backend's `runReview()`** (checked before the prompt is built). Cost accounting must move verbatim.
- **Forced decline verdict**: the oversize path assembles the `ReviewResult` directly with `verdict: { decision: "declined", pass: true }`, `findings: []`, zeroed `cost` — it does **not** call `deriveVerdict` (which would return `approved` for an empty list).
- **Gate/label mapping in the action**: exit 0 + parseable JSON ⇒ gate on `verdict.pass` (`false` → add `ai-cr:failed`, remove `ai-cr:passed`, **fail job**; `true` → add `ai-cr:passed`, remove `ai-cr:failed`). Exit ≠ 0 or unparseable ⇒ `::warning::`, **no** pass/fail label, **exit 0** (non-blocking). The declined case (`decision: "declined"`) is a normal exit-0 result routed to a **neutral** branch → `ai-cr:skipped` (removing both `ai-cr:passed`/`ai-cr:failed`), **no** pass/fail label, **no** job fail — so a "not reviewed" decline never reads as "passed"; the comment clearly explains the decline. This mapping is implemented as the pure `decideGate` in `gate.mjs` (Phase 4 §3) and unit-tested against the four cases; the action only executes the resulting `gh` side-effects.

---

## Phase 1: Schemas, Scoring & Limits (pure, unit-tested)

### Overview

Land the pure, LLM-independent heart of Half A: the criterion vocabulary, the verdict contract, the deterministic scoring function, the input-size limits + declined-result helper, and the package's **first test runner**. No agent wiring yet.

### Changes Required:

#### 1. Schemas

**File**: `packages/code-reviewer/src/schemas/review.ts`

**Intent**: introduce the five-criterion vocabulary, tag each finding with exactly one (coercing an untagged or misspelled finding's `criterion` to `null` rather than voiding the whole review), add the gateable verdict, thread the verdict into the full agent result, and grow the summary guidance to 3–4 sentences. `ReviewSchema` (what the **model** emits) keeps its shape apart from the new per-finding `criterion`; the `verdict` is attached to `ReviewResultSchema` in code.

**Contract**: adds `CriterionKeySchema` + `Criterion`, `criterion` on `FindingSchema`, `VerdictSchema` + `Verdict`, `verdict` on `ReviewResultSchema`, and a longer `summary` `.describe()`.

```ts
export const CriterionKeySchema = z.enum([
  "correctness",
  "domain_integrity",
  "input_contract",
  "security_isolation",
  "data_migration",
]);
export type Criterion = z.infer<typeof CriterionKeySchema>;

// FindingSchema gains, as its first field — fault-tolerant so a model tagging
// slip (missing or misspelled key) coerces to null instead of failing the
// whole parse; the finding's severity survives, so deriveVerdict still gates:
//   criterion: CriterionKeySchema.nullable().catch(null)
//     .describe("Which of the five review criteria this finding belongs to; null if untagged.")

export const VerdictSchema = z.object({
  decision: z.enum(["approved", "flagged", "blocked", "declined"]), // "declined": oversize decline only, never from deriveVerdict
  pass: z.boolean(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

// ReviewResultSchema = ReviewSchema.extend({ cost, verdict: VerdictSchema })
```

#### 2. Scoring function + declined-result helper

**File**: `packages/code-reviewer/src/core/scoring.ts` (new)

**Intent**: the pure severity→verdict state machine the workflow gates on, plus the deterministic "decline to review" result for oversize diffs. This is the one piece that truly needs a unit test.

**Contract**: `deriveVerdict(findings: Finding[]): Verdict` and `declinedTooLongResult(diffLength: number): ReviewResult`. Derivation: start `approved` (also for `[]`); short-circuit to `blocked` on the first `blocker`/`high`; upgrade to `flagged` if any `medium`; else stay `approved`; `pass = decision !== "blocked"`. The declined helper **forces** `declined`/`pass:true`, empty findings/nitpicks, zeroed cost, and a fixed summary naming the limit.

```ts
export function deriveVerdict(findings: Finding[]): Verdict {
  let decision: Verdict["decision"] = "approved";
  for (const f of findings) {
    if (f.severity === "blocker" || f.severity === "high") {
      decision = "blocked";
      break;
    }
    if (f.severity === "medium") decision = "flagged";
  }
  return { decision, pass: decision !== "blocked" };
}
```

#### 3. Input limits

**File**: `packages/code-reviewer/src/core/limits.ts` (new)

**Intent**: a single tuning point for input bounds. `MAX_DIFF_CHARS` drives the decline short-circuit (Phase 2); `MAX_DESCRIPTION_CHARS` drives description trimming (Phase 3).

**Contract**: `export const MAX_DIFF_CHARS = 50_000;` and `export const MAX_DESCRIPTION_CHARS = 3_000;`

#### 4. Test runner setup

**File**: `packages/code-reviewer/package.json` + `packages/code-reviewer/vitest.config.ts` (new)

**Intent**: give the standalone package its first test runner, mirroring the repo's vitest ^4 conventions without touching the app's test program.

**Contract**: add devDependency `vitest` (^4), a `test: "vitest run"` script, and a minimal `vitest.config.ts` (`globals: true`).

#### 5. Unit tests

**File**: `packages/code-reviewer/src/core/scoring.test.ts` + `packages/code-reviewer/src/schemas/review.test.ts` (new)

**Intent**: lock the scoring table, the decline shape, and the criterion fault-tolerance.

**Contract**: table-driven — `[]`→approved/pass; only `low`→approved; any `medium`→flagged/pass; any `high`/`blocker`→blocked/!pass; mixed short-circuits to blocked. `declinedTooLongResult(n)` → `declined`/`pass:true`, empty findings, zeroed cost, summary contains `MAX_DIFF_CHARS`. Plus a `FindingSchema` parse (via `ReviewSchema`) of a finding whose `criterion` is missing or an unknown string → `criterion` becomes `null` with `severity` and the rest of the finding retained, so `deriveVerdict` still sees its severity (the gate stays closed on a tagging slip).

#### 6. Public API

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: export the new public names, following the no-`z`-leak discipline.

**Contract**: re-export `CriterionKeySchema`, `type Criterion`, `VerdictSchema`, `type Verdict`, and `deriveVerdict`. (Limits and `declinedTooLongResult` stay internal.)

### Success Criteria:

#### Automated Verification:

- Build succeeds: `cd packages/code-reviewer && npm run build`
- Type checking passes: `cd packages/code-reviewer && npm run typecheck`
- Unit tests pass: `cd packages/code-reviewer && npm test` (deriveVerdict table + declined-result shape + `criterion` coerces missing/unknown → `null`)

#### Manual Verification:

- The severity→decision table matches requirements (`blocker`/`high`→`blocked`, `medium`→`flagged`, `low`/none→`approved`).

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual check before Phase 2.

---

## Phase 2: Template-Method Seam + Agent Refactor + Decline Short-Circuit

### Overview

Make `review()` input-shaped and move verdict attachment + the oversize decline into a shared abstract base, so every backend inherits them. Refactor `CopilotReviewAgent` into a `BaseReviewAgent` subclass, preserving the empty-diff shortcut and cost accounting verbatim.

### Changes Required:

#### 1. The seam

**File**: `packages/code-reviewer/src/core/review-agent.ts`

**Intent**: introduce `ReviewInput`, keep the `ReviewAgent` interface as the swap point, and add a `BaseReviewAgent` whose `review()` applies the decline check and verdict attachment in one place.

**Contract**: adds `ReviewInput` and `BaseReviewAgent`; `runReview` is the backend-specific hook returning a verdict-less result.

```ts
export interface ReviewInput {
  diff: string;
  title?: string;
  description?: string;
}
export interface ReviewAgent {
  review(input: ReviewInput): Promise<ReviewResult>;
}

export abstract class BaseReviewAgent implements ReviewAgent {
  async review(input: ReviewInput): Promise<ReviewResult> {
    if (input.diff.length > MAX_DIFF_CHARS) return declinedTooLongResult(input.diff.length);
    const raw = await this.runReview(input);
    return { ...raw, verdict: deriveVerdict(raw.findings) };
  }
  protected abstract runReview(input: ReviewInput): Promise<Omit<ReviewResult, "verdict">>;
}
```

#### 2. Copilot agent refactor

**File**: `packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts`

**Intent**: extend `BaseReviewAgent`; rename `review`→`runReview` returning `Omit<ReviewResult, "verdict">`; keep the empty-diff shortcut (now verdict-less) and the `assistant.usage`/`streaming` cost accounting **verbatim**. In this phase `runReview` still calls `buildReviewPrompt(input.diff)` (title/description are wired in Phase 3), so the phase builds independently.

**Contract**: `class CopilotReviewAgent extends BaseReviewAgent { protected async runReview(input: ReviewInput): Promise<Omit<ReviewResult, "verdict">> { … } }`. The empty-diff branch returns `{ summary, findings: [], nitpicks: [], cost }` (no `verdict`); the base then attaches `approved`.

#### 3. Factory

**File**: `packages/code-reviewer/src/agents/factory.ts`

**Intent**: no logic change — confirm it still returns `CopilotReviewAgent` (now a `BaseReviewAgent` subclass) and type-checks.

**Contract**: unchanged; verified by `typecheck`.

#### 4. CLI call site (minimal)

**File**: `packages/code-reviewer/src/cli.ts`

**Intent**: keep the CLI compiling against the new signature by passing an input object; the `--title`/`--description` flags and exit-code semantics land in Phase 3.

**Contract**: change `reviewer.review(diff)` → `reviewer.review({ diff })`.

#### 5. Public API

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: export the seam's new public names.

**Contract**: re-export `type ReviewInput` and `BaseReviewAgent` (keep the existing `CopilotReviewAgent` export); no `z` leak.

#### 6. Seam tests

**File**: `packages/code-reviewer/src/core/review-agent.test.ts` (new)

**Intent**: prove the decline short-circuit and the verdict-attach path without an LLM, using a `TestReviewAgent extends BaseReviewAgent` with a spy `runReview`.

**Contract**: over-cap diff (`length > MAX_DIFF_CHARS`) → `verdict.decision === "declined"`, `pass === true`, `findings === []`, **spy called 0 times**; under-cap diff → spy called once, `verdict` equals `deriveVerdict(findings)` (e.g. a seeded `high` finding → `blocked`).

### Success Criteria:

#### Automated Verification:

- Build succeeds: `cd packages/code-reviewer && npm run build`
- Type checking passes: `cd packages/code-reviewer && npm run typecheck`
- Unit tests pass: `cd packages/code-reviewer && npm test` (decline short-circuit does not call `runReview`; normal path attaches the derived verdict)

#### Manual Verification:

- Local smoke: `git diff HEAD | node dist/cli.js --stdin` returns JSON that now includes a top-level `verdict` field.

**Implementation Note**: Pause for human confirmation of the manual smoke check before Phase 3.

---

## Phase 3: Prompt (5 Criteria) + CLI (title/description, exit codes)

### Overview

Swap the 4-priority rubric for the five criteria, add `criterion` to the JSON contract, grow the summary guidance, fold title/description into the prompt (trimming the description), and finish the CLI (`--title`/`--description` + exit-code semantics).

### Changes Required:

#### 1. Prompt

**File**: `packages/code-reviewer/src/prompts/review-prompt.ts`

**Intent**: replace the four priorities with the five criteria (each finding tagged with **exactly one** `criterion` key), add `criterion` to the JSON output contract, grow `summary` guidance to **3–4 sentences** (overall risk + rationale referencing the driving criteria), and change `buildReviewPrompt` to take `ReviewInput`, folding in `title` (when present) and `description` (trimmed to `MAX_DESCRIPTION_CHARS`).

**Contract**: `REVIEW_SYSTEM_PROMPT` names the five keys + one-line scopes (from `requirements.md`) and requires a `"criterion"` on every finding (the Phase 1 schema still coerces a missed or misspelled tag to `null`, so a single slip never voids the review); `buildReviewPrompt(input: ReviewInput): string` emits optional `Title:`/`Description:` context sections (description trimmed) before the ` ```diff ` fence.

```ts
export function buildReviewPrompt(input: ReviewInput): string {
  const { diff, title, description } = input;
  const desc = description ? description.slice(0, MAX_DESCRIPTION_CHARS) : undefined;
  // compose: optional "Title: …", optional "Description: …", then the fenced diff
}
```

#### 2. CLI

**File**: `packages/code-reviewer/src/cli.ts`

**Intent**: accept optional `--title`/`--description`, pass a full `ReviewInput`, and confirm exit-code semantics — exit 0 for any **successful** review (including a `blocked` verdict and the declined case); non-zero only on genuine failure (provider/auth/parse, already handled by the top-level `catch`).

**Contract**: add `title`/`description` string options to `parseArgs`, build `ReviewInput { diff, title, description }`, call `reviewer.review(input)`, extend `HELP`. Keep emitting raw pretty JSON (now including `verdict` + per-finding `criterion`).

#### 3. Wire title/description into the agent

**File**: `packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts`

**Intent**: upgrade the `runReview` prompt call now that `buildReviewPrompt` accepts the input object.

**Contract**: `buildReviewPrompt(input.diff)` → `buildReviewPrompt(input)`.

#### 4. Prompt unit test

**File**: `packages/code-reviewer/src/prompts/review-prompt.test.ts` (new)

**Intent**: lock the pure trimming/inclusion behavior.

**Contract**: a description longer than `MAX_DESCRIPTION_CHARS` is trimmed in the output; `title` appears when provided and is absent when omitted; the diff is always fenced.

### Success Criteria:

#### Automated Verification:

- Build + type check pass: `cd packages/code-reviewer && npm run build && npm run typecheck`
- Unit tests pass (incl. the new prompt trim/title test): `cd packages/code-reviewer && npm test`

#### Manual Verification:

- Real multi-file diff → JSON has a `criterion` (one of the five keys) on every finding and a top-level `verdict` `{ decision, pass }`; `summary` is 3–4 sentences. (Requires `COPILOT_GITHUB_TOKEN`/`gh` auth.)
- Over-cap diff (>50 000 chars) piped in → deterministic **declined** result (`declined`, `pass: true`, fixed "too large" summary) returned immediately, with no LLM latency/cost.
- `--title`/`--description` are reflected in the review context (spot-check a run).

**Implementation Note**: Pause for human confirmation of the manual checks before Phase 4.

---

## Phase 4: Composite Action + Comment Formatter

### Overview

Encapsulate the imperative pipeline as a reusable composite action, plus two co-located node scripts: one renders the CLI's JSON into a sticky Markdown comment, and one (`gate.mjs`) owns the unit-tested fail-vs-warn decision.

### Changes Required:

#### 1. Composite action

**File**: `.github/actions/ai-code-review/action.yml` (new)

**Intent**: own "setup → build reviewer → compute diff → run CLI (capturing exit code + stdout) → gate on `verdict.pass` → sticky comment → labels", so the caller workflow stays declarative. Assumes the caller has checked out the repo with full history. The **setup** step is `actions/setup-node@v4` with `node-version-file: .nvmrc` (the repo's canonical Node — currently `24.18.0`; satisfies the package's `engines.node`), so the runner Node never drifts and stays in one source of truth; `.nvmrc` is present because the caller checks out the repo.

**Contract**: `runs.using: composite`. Inputs: `pr-number` (required), `title`, `description`, `model` (optional), `base-ref` (optional, default `main`; initially left unwired). Outputs: `decision`, `pass`. Steps use `github.token` for both the CLI (Copilot auth) and `gh`; `copilot-requests: write` is granted by the caller. The gate branch is the load-bearing logic:

```bash
set +e
OUT=$(git diff "origin/${BASE_REF}...HEAD" | node dist/cli.js --stdin --title "$TITLE" --description "$DESC"); CODE=$?
set -e
# Pure decision lives in gate.mjs (Phase 4 §3) — testable without a live PR.
eval "$(CLI_EXIT=$CODE node "$ACTION_DIR/gate.mjs" <<<"$OUT")"   # → $ADD_LABEL/$REMOVE_LABEL/$WARN/$FAIL
if [ "$WARN" = "1" ]; then
  echo "::warning::AI code review did not run"   # no pass/fail label; exit 0 (non-blocking)
else
  # format-comment.mjs -> sticky comment; gh add/remove labels (mutual exclusion, below);
  # $FAIL=1 (blocked verdict) -> exit 1 (fail the check)
fi
```

**Input safety (attacker-controlled PR text):** `title`/`description` originate from `github.event.pull_request.title`/`.body` and are attacker-controlled. The `run:` step MUST receive them via a **step-level `env:` mapping** (`TITLE: ${{ inputs.title }}`, `DESC: ${{ inputs.description }}`) and reference only `"$TITLE"`/`"$DESC"` in the script — **never** interpolate `${{ inputs.* }}` inline into a `run:` block (a PR title like `` `$(…)` `` or `"; …` would otherwise inject shell). Treat an empty `description` as absent (skip the `--description` flag).

Comment + labels use plain `gh`: `gh pr comment "$PR" --edit-last --create-if-none --body-file review.md` (sticky) and `gh pr edit "$PR" --add-label … --remove-label …`.

#### 2. Comment formatter

**File**: `.github/actions/ai-code-review/format-comment.mjs` (new)

**Intent**: turn the CLI's JSON into a readable **sticky** comment — the single formatting owner (not a package export).

**Contract**: reads JSON (stdin or file arg), emits Markdown containing a hidden sticky marker (`<!-- ai-code-review -->`), a **verdict badge** (`decision` + `pass`; a `declined` decision renders a neutral "not reviewed" badge, not a green pass), the `summary`, **findings grouped by `criterion`** (each: `severity`, `filePath:lineNumber`, `message`; findings with `criterion: null` group under an **"Uncategorized"** heading), and `nitpicks` inside a collapsible `<details>`. Renders cleanly when `findings` is empty (the empty-diff "No changes" and the declined "too large" cases show just the badge + summary).

#### 3. Gate decision module

**File**: `.github/actions/ai-code-review/gate.mjs` + `.github/actions/ai-code-review/gate.test.mjs` (new)

**Intent**: isolate the load-bearing **fail-vs-warn decision** from the YAML so it is deterministically testable _before_ any live PR (Phase 4's key risk). The action stays thin wiring; this module owns the branch.

**Contract**: a pure `decideGate({ cliExit, stdout }) => { verdict, addLabel, removeLabel, warn, fail }`:

- `cliExit !== 0` **or** unparseable `stdout` → `warn: true`, no `addLabel`/`removeLabel`, `fail: false`.
- parsed JSON with `verdict.decision === "declined"` → **neutral**: `addLabel: "ai-cr:skipped"`, `removeLabel: "ai-cr:passed,ai-cr:failed"`, `warn: false`, `fail: false` (green check, no pass/fail label — a declined oversize diff never reads as "passed").
- otherwise (parsed JSON, `warn: false`) gate on `verdict.pass`: `true` → `addLabel: "ai-cr:passed"`, `removeLabel: "ai-cr:failed"`, `fail: false`; `false` → `addLabel: "ai-cr:failed"`, `removeLabel: "ai-cr:passed"`, `fail: true`.

`removeLabel` is a comma-joined list (the declined branch removes both pass/fail). A thin CLI wrapper reads `CLI_EXIT` + stdin, calls `decideGate`, and writes the fields as shell-eval'able `KEY=VALUE` lines (or to `$GITHUB_OUTPUT`) for the action's `gh` steps.

**Test** (`gate.test.mjs`, run via `node --test` — same out-of-vitest convention as the formatter): the four cases — (a) pass JSON → `ai-cr:passed`/`fail:false`; (b) `blocked` JSON (`pass:false`) → `ai-cr:failed`/`fail:true`; (c) declined JSON (`decision:"declined"`) → `ai-cr:skipped`/`fail:false`/no pass-fail label; (d) `cliExit:1` or garbage → `warn:true`/no label/`fail:false`.

### Success Criteria:

#### Automated Verification:

- `action.yml` parses as valid YAML (e.g. `node -e "require('js-yaml').load(require('fs').readFileSync('.github/actions/ai-code-review/action.yml','utf8'))"`, or `python -c "import yaml; yaml.safe_load(open(...))"`).
- `format-comment.mjs` produces expected sections for sample JSON in all four shapes (findings-present, `blocked`, declined, empty) via `node .github/actions/ai-code-review/format-comment.mjs < sample.json`.
- `gate.mjs` returns the correct decision for the four gate cases (pass, `blocked`, declined, unparseable) via `node --test .github/actions/ai-code-review/gate.test.mjs`.

#### Manual Verification:

- Eyeball the rendered Markdown for each case: verdict badge present, findings grouped by criterion, nitpicks collapsible, empty state graceful.

**Implementation Note**: Pause for human confirmation before Phase 5 (the live-PR phase).

---

## Phase 5: Caller Workflow + Labels + README + Live PR Verification

### Overview

Wire the trigger workflow (PR→`main` + on-demand retry) with the right permissions, provision the four labels once, refresh the README, and verify the whole pipeline end-to-end on a real PR.

### Changes Required:

#### 1. Caller workflow

**File**: `.github/workflows/ai-code-review.yml` (new)

**Intent**: trigger on PRs to `main` and on the `ai-cr:review` label, grant least-privilege permissions, delegate to the composite action, and remove `ai-cr:review` after a retry run so it can re-fire.

**Contract**: the on/permissions/guard skeleton is load-bearing:

```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, labeled]
permissions:
  contents: read
  pull-requests: write
  copilot-requests: write
concurrency:
  group: ai-cr-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  review:
    if: github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: ./.github/actions/ai-code-review
        with:
          pr-number: ${{ github.event.pull_request.number }}
          title: ${{ github.event.pull_request.title }}
          description: ${{ github.event.pull_request.body }}
      # title/description are passed as action INPUTS (safe); the action consumes
      # them via a step-level env: mapping, never inline in a run: block (see Phase 4 §1).
      # if triggered by the ai-cr:review label, remove it afterwards (gh pr edit --remove-label)
```

#### 2. Labels bootstrap (one-time, out-of-band)

**Intent**: create the four labels so add/remove never fails; the workflow does not create them.

**Contract**: provision once via local `gh` during implementation — `ai-cr:passed` (green, e.g. `0E8A16`), `ai-cr:failed` (red, e.g. `D73A4A`), `ai-cr:review` (yellow, e.g. `FBCA04`), and `ai-cr:skipped` (grey, e.g. `BFBFBF`, neutral "not reviewed") using `gh label create … --force`.

#### 3. README refresh

**File**: `packages/code-reviewer/README.md`

**Intent**: point the "CI: review every pull request" section at the real `.github/workflows/ai-code-review.yml` + composite action, mention the new optional `--title`/`--description` flags, and note the breaking library `review(input)` signature. Existing CLI usage examples stay (still valid).

**Contract**: replace/annotate the inline v0 workflow snippet; keep the auth/permissions note (`copilot-requests: write`); use `npm ci` (not `npm install`) in any retained build snippet.

### Success Criteria:

#### Automated Verification:

- Workflow YAML parses (and `actionlint` is clean if available).
- Existing CI ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)) stays green on the branch (lint + build unaffected).

#### Manual Verification:

- Open a test PR to `main`: a **sticky** comment appears (summary + verdict badge + criterion-grouped findings); exactly one of `ai-cr:passed` / `ai-cr:failed` is applied.
- A PR seeded with a `blocker`/`high` issue → `ai-cr:failed` **and** the check fails (red X); confirm the merge is **not** actually blocked (branch protection unwired).
- A PR with only `medium` issues → `flagged` → `ai-cr:passed` (non-blocking); comment shows the flagged badge.
- An oversize PR (>50 000-char diff) → declined comment (`declined`, "too large") + neutral **`ai-cr:skipped`** (no pass/fail label), no LLM latency.
- A forced reviewer failure (e.g. bad token) → `::warning::`, **no** pass/fail label, job non-blocking.
- Adding the `ai-cr:review` label to an existing PR re-runs the review and the label is removed afterwards.
- Sticky behavior: a second run **edits the same comment** (no duplicate).

**Implementation Note**: This is the terminal phase; confirm all manual checks with the human before closing the change.

---

## Testing Strategy

### Unit Tests (package-local vitest):

- `deriveVerdict` — table-driven: `[]`→approved; `low`→approved; `medium`→flagged; `high`/`blocker`→blocked (short-circuit); `pass = decision !== "blocked"`.
- `declinedTooLongResult` — forced `declined`/`pass:true`, empty findings, zeroed cost, summary names the limit.
- `BaseReviewAgent` (fake `runReview`) — over-cap declines without calling `runReview`; under-cap attaches the derived verdict.
- `buildReviewPrompt` — trims `description` to `MAX_DESCRIPTION_CHARS`, includes/omits `title`, always fences the diff.

### Integration Tests:

- `format-comment.mjs` against committed/sample JSON fixtures (findings-present, `blocked`, declined, empty) → expected Markdown sections.
- `gate.mjs` (`decideGate`) against the four gate fixtures (pass, `blocked`, declined, unparseable) → correct `{ addLabel, removeLabel, warn, fail }`.
- Full pipeline is exercised live on a real PR (Phase 5 manual matrix).

### Manual Testing Steps:

1. Local CLI on a real diff → JSON has per-finding `criterion` + top-level `verdict`; 3–4-sentence summary.
2. Pipe a >50 000-char diff → immediate declined result, no LLM call.
3. Open a PR → sticky comment + exactly one label.
4. Seed `blocker`/`high` → `ai-cr:failed` + red check (merge not blocked).
5. Seed only `medium` → `ai-cr:passed` (flagged, non-blocking).
6. Break the token → `::warning::`, no pass/fail label, non-blocking.
7. Add `ai-cr:review` → re-runs, label removed.
8. Second run → same sticky comment edited.

## Performance Considerations

- The SDK bounds **turns** (single-turn, `availableTools: []`); `MAX_DIFF_CHARS` bounds worst-case **input** (beyond it we decline, avoiding runaway cost/latency). `model: auto` keeps the credit discount.
- CI runs `npm ci` for the package per run (no root workspace) for reproducible, lockfile-pinned installs. Acceptable for now; node/npm caching is a later optimization.

## Migration Notes

- **Breaking library API**: `review(diff)` → `review(input)`. In-repo consumers are `cli.ts` and the README embedding — both updated here. No persisted data or DB changes. A package version bump (`0.0.1` → `0.1.0`) is optional.
- **Labels must exist** before the first workflow run (Phase 5 bootstrap).
- **Branch protection** is intentionally not enabled; turning the `blocked` fail into a merge gate is a later repo-setting toggle with no code change.

## References

- Research: [`context/changes/ci-cd-code-review/research.md`](./research.md)
- Requirements: [`context/changes/ci-cd-code-review/requirements.md`](./requirements.md)
- Prior art (constraints F1/F2, cost accounting): [`context/archive/2026-08-15-code-reviewer/plan.md`](../../archive/2026-08-15-code-reviewer/plan.md)
- v0 reference workflow + auth model: [`packages/code-reviewer/README.md`](../../../packages/code-reviewer/README.md)
- Existing CI to mirror: [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
- Schemas to extend: [`packages/code-reviewer/src/schemas/review.ts`](../../../packages/code-reviewer/src/schemas/review.ts)
- The seam: [`packages/code-reviewer/src/core/review-agent.ts`](../../../packages/code-reviewer/src/core/review-agent.ts)

## Addendum (2026-08-25): kept out-of-plan config edits

Recorded during implementation review (`reviews/impl-review.md`, finding F4). Three files changed that this plan's file list did not name; all are benign, verified green (root lint + all builds), and kept:

- `.github/workflows/ci.yml` — bumped `actions/checkout` + `actions/setup-node` to v7 and switched `node-version: 24` → `node-version-file: .nvmrc`, matching the new composite action's single source of truth for Node. Phase 5 had stated ci.yml would stay "unaffected"; this is a consistency-only change with no behavior impact (same Node 24.18.0).
- `eslint.config.js` — added `.github/actions/**/*.mjs` to the root ESLint ignore list, mirroring the existing `.github/hooks/scripts/*.mjs` + `packages/**` entries so the new CI scripts don't trip root lint.
- `packages/code-reviewer/tsconfig.build.json` — new build-only tsconfig referenced by the `build` script (`tsc -p tsconfig.build.json`) to emit `dist/` without the new `*.test.ts` files.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemas, Scoring & Limits (pure, unit-tested)

#### Automated

- [x] 1.1 Build succeeds (`cd packages/code-reviewer && npm run build`) — c627aac
- [x] 1.2 Type checking passes (`npm run typecheck`) — c627aac
- [x] 1.3 Unit tests pass (`npm test`) — deriveVerdict table + declined-result shape + criterion coercion — c627aac

#### Manual

- [x] 1.4 Severity→decision table matches requirements — c627aac

### Phase 2: Template-Method Seam + Agent Refactor + Decline Short-Circuit

#### Automated

- [x] 2.1 Build succeeds — e580df2
- [x] 2.2 Type checking passes — e580df2
- [x] 2.3 Unit tests pass — decline short-circuit (runReview not called) + normal verdict attach — e580df2

#### Manual

- [x] 2.4 CLI smoke: `git diff HEAD | node dist/cli.js --stdin` returns JSON including a `verdict` field — e580df2

### Phase 3: Prompt (5 Criteria) + CLI (title/description, exit codes)

#### Automated

- [x] 3.1 Build + type check pass — 22bdef0
- [x] 3.2 Unit tests pass incl. the `buildReviewPrompt` trim/title test — 22bdef0

#### Manual

- [x] 3.3 Real diff → per-finding `criterion` + top-level `verdict`, 3–4-sentence summary — 22bdef0
- [x] 3.4 Over-cap diff → deterministic declined result, no LLM call — 22bdef0
- [x] 3.5 `--title`/`--description` reflected in the review context — 22bdef0

### Phase 4: Composite Action + Comment Formatter

#### Automated

- [x] 4.1 `action.yml` parses as valid YAML — 5b64ccb
- [x] 4.2 `format-comment.mjs` produces expected sections for sample JSON (findings/blocked/declined/empty) — 5b64ccb
- [x] 4.3 `gate.mjs` returns the correct decision for the four cases (pass/blocked/declined/unparseable) — 5b64ccb

#### Manual

- [x] 4.4 Rendered Markdown: verdict badge + criterion grouping + collapsible nitpicks + graceful empty state — 5b64ccb

### Phase 5: Caller Workflow + Labels + README + Live PR Verification

#### Automated

- [x] 5.1 Workflow YAML parses (actionlint clean if available) — afeb76c
- [x] 5.2 Existing CI (`ci.yml`) stays green on the branch — afeb76c

#### Manual

- [x] 5.3 Test PR: sticky comment (summary + badge + grouped findings) + exactly one passed/failed label — afeb76c
- [x] 5.4 Seeded `blocker`/`high` → `ai-cr:failed` + red check; merge not blocked (branch protection unwired) — afeb76c
- [x] 5.5 Only-`medium` → `flagged` → `ai-cr:passed` (non-blocking) — afeb76c
- [x] 5.6 Oversize PR → declined comment (`declined`, "too large"), `ai-cr:skipped` (neutral), no LLM latency — afeb76c
- [x] 5.7 Forced reviewer failure → `::warning::`, no pass/fail label, non-blocking — afeb76c
- [x] 5.8 `ai-cr:review` label → re-runs and label removed afterwards — afeb76c
- [x] 5.9 Sticky: second run edits the same comment (no duplicate) — afeb76c
