# First CI/CD PR Code-Review Workflow — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`
> Requirements: `context/changes/ci-cd-code-review/requirements.md`

## What & Why

Stand up the repo's **first PR-review CI/CD pipeline**: every PR to `main` gets an automated Copilot code review that posts a sticky comment and applies a `ai-cr:passed` / `ai-cr:failed` label. To make the gate trustworthy, the reviewer package is evolved so the **model only classifies** (tags each finding with one of five criteria) while **code deterministically judges** (derives one gateable verdict). The review deliberately spends its budget on what ESLint + Prettier + `tsc` cannot catch — winemaking math, data contracts, and tenant isolation.

## Starting Point

Today there is only `ci.yml` (lint + build, no permissions block). The `@10x-fermenta/code-reviewer` package is a working standalone Copilot-SDK agent with a backend-agnostic seam (`ReviewAgent` → factory → `CopilotReviewAgent`), but its findings have **no `criterion`**, there is **no verdict**, the prompt uses a 4-priority rubric, the CLI emits raw JSON, and the package has **no test runner**. Its README already ships a v0 reference workflow that proves auth + diff + comment work end-to-end.

## Desired End State

Every `ReviewResult` structurally carries a `verdict` (`decision` + `pass`); each finding is tagged with exactly one of five criteria; oversize diffs are **declined** (deterministic `declined` verdict, no LLM call) rather than truncated; and the package has its first unit tests. On the CI side, a composite action + caller workflow post a sticky comment, apply exactly one pass/fail label, **fail the check on `blocked`** (branch protection left off for now), warn-and-pass when the reviewer itself can't run, and re-run on demand when `ai-cr:review` is added.

## Key Decisions Made

| Decision           | Choice                                                                       | Why (1 sentence)                                                                                           | Source   |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| Verdict seam       | Template Method (`BaseReviewAgent`)                                          | Makes a half-ready result unrepresentable even when the agent is constructed directly (the exported path). | Plan     |
| Verdict location   | Baked into every `review()` result in code                                   | Model classifies, code judges → stable, unit-testable gate independent of the LLM.                         | Research |
| Oversize diffs     | **Decline** (skip LLM) → forced `declined` verdict + neutral `ai-cr:skipped` | "Decline to review" beats reviewing an incomplete/truncated diff.                                          | Plan     |
| `MAX_DIFF_CHARS`   | 50 000 (no truncation)                                                       | Covers most real PRs; beyond it we decline deterministically.                                              | Plan     |
| First-rollout gate | Fail the job on `blocked`, branch protection **unwired**                     | Full red/green signal + tested fail path, but a bad verdict can't block a real merge during bed-in.        | Plan     |
| Comment            | Sticky, via plain `gh pr comment --edit-last --create-if-none`               | No REST sledgehammer; one comment that refreshes each run.                                                 | Research |
| Formatter          | Small node script co-located with the action                                 | Single formatting owner; not a package export.                                                             | Research |
| Retry              | One workflow; `labeled` type + `if` guard; remove label after                | Simplest on-demand re-run that can re-fire.                                                                | Research |
| Forks / labels     | No fork support; labels provisioned once out-of-band                         | Single-owner repo; workflow only add/removes labels.                                                       | Research |
| Testing            | Package-local vitest (^4)                                                    | Standalone package needs its own runner; matches root conventions.                                         | Research |

## Scope

**In scope:** criterion tagging + richer summary; deterministic `deriveVerdict`; decline-on-oversize; `ReviewInput` (`title`/`description`); first package tests; composite action + comment formatter; caller workflow (PR + `ai-cr:review` retry); `ai-cr:passed`/`ai-cr:failed` labels; sticky comment; fail-on-`blocked`; warn-on-reviewer-failure.

**Out of scope:** inline path+line comments; fork-PR support; configurable gate-policy knob; enabling branch protection; extra criteria (architecture/business/idioms); Stryker; model evaluation; root-workspace integration; diff truncation.

## Architecture / Approach

Two halves meet at the package API. **Half A** (package): the model emits `findings` (each with a `criterion`) + a 3–4-sentence `summary`; an abstract `BaseReviewAgent.review()` first declines oversize diffs, then calls the backend's `runReview()` and attaches `deriveVerdict(findings)`. **Half B** (CI): a thin composite action runs `build → CLI → gate on verdict.pass → sticky comment → labels`; a caller workflow owns triggers + permissions. Data flow: `git diff | cli.js --stdin --title --description` → JSON → `format-comment.mjs` → `gh` comment + labels.

## Phases at a Glance

| Phase                                   | What it delivers                                                                 | Key risk                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Schemas, scoring & limits            | criterion/verdict schema, `deriveVerdict`, limits + decline helper, first vitest | Getting the severity→verdict table exactly right          |
| 2. Template-Method seam                 | `BaseReviewAgent`, Copilot refactor, decline short-circuit                       | Preserving empty-diff shortcut + cost accounting verbatim |
| 3. Prompt + CLI                         | 5-criteria rubric, `--title`/`--description`, exit codes                         | Model reliably tagging every finding with a `criterion`   |
| 4. Composite action + formatter         | `action.yml` + `format-comment.mjs`                                              | Exit-code branching (fail vs warn) correctness            |
| 5. Workflow + labels + README + live PR | Trigger workflow, labels, docs, e2e verification                                 | Fork/permission/token behavior on a real PR               |

**Prerequisites:** `gh` configured locally (label bootstrap); org policy allowing "Copilot CLI billed to the organization"; `copilot-requests: write` available to the workflow.
**Estimated effort:** ~4–5 focused sessions across 5 phases (package Phases 1–3 are fast/testable; CI Phases 4–5 need a live PR).

## Open Risks & Assumptions

- The `blocked` fail path is built but **not** enforced as a merge gate until branch protection is toggled on — a later, conscious step.
- The declined-oversize case is **neutral**: `decision: "declined"` → `ai-cr:skipped` (no pass/fail label, check stays green), with the comment clearly explaining "declined, too large" so it isn't mistaken for a real pass.
- `format-comment.mjs` lives outside the package's vitest, so it's verified by fixture-based node runs rather than the unit suite.
- CI installs the package per run (no root workspace) — acceptable latency, cacheable later.

## Success Criteria (Summary)

- Every PR to `main` gets a sticky review comment with a verdict badge and findings grouped by criterion, plus exactly one `ai-cr:passed` / `ai-cr:failed` label.
- A `blocked` verdict turns the check red (advisory until branch protection is enabled); a reviewer failure warns without blocking.
- Oversize PRs are declined cheaply; adding `ai-cr:review` re-runs the review on demand.
