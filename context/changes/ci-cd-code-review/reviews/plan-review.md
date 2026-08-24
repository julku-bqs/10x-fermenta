<!-- PLAN-REVIEW-REPORT -->

# Plan Review: First CI/CD PR Code-Review Workflow

- **Plan**: context/changes/ci-cd-code-review/plan.md
- **Mode**: Deep
- **Date**: 2026-08-20
- **Verdict**: REVISE
- **Findings**: 1 critical, 3 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 12/12 paths ✓, 8/8 symbols ✓, brief↔plan ✓
Internal scans: contradiction ✓ clean · promise-gap ✓ clean · contract-break ✓ clean · progress↔phase ⚠️ (see F4)

## Findings

### F1 — Required strict `criterion` enum makes the gate fail OPEN

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1 (Schemas) + Phase 3 §1 (Prompt), interacting with `src/agents/copilot/parse.ts`
- **Detail**: Phase 1 adds `criterion: CriterionKeySchema` — a strict 5-value `z.enum`, no `.optional`/`.default`/`.catch` — as a REQUIRED field on `FindingSchema`. `parseReview` (parse.ts) validates the model's JSON with `ReviewSchema.safeParse` and THROWS on any mismatch. So if the model omits or misspells one finding's `criterion` (Phase 3's own named key risk), the ENTIRE review is discarded: `review()` rejects → CLI exits non-zero → the composite action's `else` branch emits `::warning::`, applies NO pass/fail label, and exits 0 (non-blocking). A PR containing real `blocker`/`high` findings then silently goes green. The verdict is derived from `severity`, not `criterion`, so a display-only tag is handed the power to void a safety-critical review — defeating the brief's goal of a "trustworthy gate."
- **Fix A ⭐ Recommended**: Make `criterion` fault-tolerant — `.catch("correctness")` per-finding (or a preprocess defaulting missing/unknown → `correctness`); add a unit test: unknown criterion → coerced, finding retained, verdict still derived from severities.
  - Strength: Keeps the gate CLOSED — severities survive a tagging hiccup so `deriveVerdict` still sees the high/blocker. Matches the plan's own "code judges" philosophy.
  - Tradeoff: A mis-tagged finding may group under the wrong criterion in the comment (cosmetic).
  - Confidence: HIGH — zod ^4.4.3 supports `.catch`; failure chain verified in parse.ts.
  - Blind spot: Doesn't help on structurally invalid JSON (rarer; the warn path legitimately covers that).
- **Fix B**: Keep `criterion` strict; change failure semantics — on a NON-empty diff, parse/reviewer failure → `blocked`/fail (or a "needs human" label), not warn-and-pass.
  - Strength: No silent green; any reviewer hiccup errs safe.
  - Tradeoff: Conflicts with the plan's intended "warn-and-pass when the reviewer can't run" — every transient provider blip becomes a red check; noisy during bed-in.
  - Confidence: MED — depends on provider-failure vs mis-tag frequency.
  - Blind spot: Can't distinguish "mis-tagged" from "provider down"; both go red.
- **Decision**: FIXED via Fix A (nullable variant — `CriterionKeySchema.nullable().catch(null)`, "Uncategorized" group in Phase 4)

### F2 — PR title/body flow into the action unsanitized (injection + robustness)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 (action.yml) + Phase 5 §1 (caller passes title/description)
- **Detail**: The caller forwards `github.event.pull_request.title` and `.body` into the composite action, which runs them through a shell (`--title "$TITLE" --description "$DESC"`). Title/body are attacker-controlled on `pull_request`. If an implementer references `${{ inputs.title }}`/`${{ inputs.description }}` inline inside a `run:` block (the naive reading), a title like `` `$(…)` `` or `"; …` yields script injection — a GitHub-documented CI vuln class. The plan's snippet uses `"$TITLE"`/`"$DESC"` (env-style, safe) but never states the rule, nor handles empty/multi-line bodies.
- **Fix**: In action.yml, pass title/description ONLY via a step-level `env:` mapping and reference `"$TITLE"`/`"$DESC"` in `run:` — never inline `${{ }}` in the script. Treat empty body as absent.
  - Strength: Neutralizes the injection class with zero behavior change; env-passing also handles multi-line bodies.
  - Tradeoff: None significant.
  - Confidence: HIGH — standard GitHub hardening guidance.
  - Blind spot: Description still reaches the LLM prompt; prompt-injection content is separate (tools disabled, bounded).
- **Decision**: FIXED via Fix (step-level `env:` mapping mandated in Phase 4 §1; caller annotated in Phase 5 §1)

### F3 — The load-bearing gate logic has no automated test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 (action.yml gate) / Testing Strategy
- **Detail**: The action's bash gate — parse JSON, branch on `verdict.pass`, mutual-exclusion labels, `exit 1` vs `::warning::`/`exit 0` — is the single most consequential piece of CI logic, and the brief names it Phase 4's key risk ("Exit-code branching (fail vs warn) correctness"). Yet Phase 4's automated checks cover only YAML validity + `format-comment.mjs`; the fail-vs-warn behavior is verified ONLY in the Phase 5 manual live-PR matrix. Shell embedded in YAML is untestable as written.
- **Fix**: Extract the decision (CLI exit code + stdout → {label ops, process exit code, warn?}) into a co-located `gate.mjs` (sibling to `format-comment.mjs`) and fixture-test its four cases (pass, blocked, declined, unparseable). `action.yml` becomes thin wiring that calls it.
  - Strength: Makes the highest-risk branch deterministically testable BEFORE the live PR; mirrors the plan's own "keep judgment in testable code" rationale for the verdict.
  - Tradeoff: One more small script + a thin indirection in the action.
  - Confidence: HIGH — same pattern the plan already accepts for `format-comment.mjs`.
  - Blind spot: `gh` label/comment side-effects still need the live PR; the script tests the decision, not the network calls.
- **Decision**: FIXED via Fix (extracted pure `gate.mjs` + `gate.test.mjs` four-case fixtures; Phase 4 §3, wired into the action snippet + Testing Strategy)

### F4 — Progress headings don't match the plan-body phase titles

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `## Progress` vs `## Phase N` headings
- **Detail**: 4 of 5 Progress headings are abbreviated vs the body: "…Scoring & Limits" (drops "(pure, unit-tested)"), "…+ Decline" (drops "Short-Circuit"), "Prompt (5 Criteria) + CLI" (drops "(title/description, exit codes)"), "…+ Live PR" (drops "Verification"). The Progress↔Phase contract expects matching `### Phase N: <name>` ("don't rename titles"). All `N.M` items and phase numbers match, so `/10x-implement` parse risk is low — but reconcile.
- **Fix**: Rename the four `### Phase N` Progress headings to match the body verbatim.
- **Decision**: FIXED via Fix (Progress Phases 1/2/3/5 headings now match the `## Phase N` body titles verbatim)

### F5 — Oversize decline auto-passes the largest PRs (extends an acknowledged risk)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 (`MAX_DIFF_CHARS = 50_000`) + decline→`pass:true`
- **Detail**: The plan already flags declined→`pass:true`→`ai-cr:passed` and mitigates via comment wording. Added angle: 50 000 chars is a LOW bar (~700–1000 diff lines), so many normal PRs exceed it, and the failure direction is auto-pass — the biggest, often riskiest PRs get a green "passed" label with NO review. Advisory today (branch protection off), but the label/comment ARE the product.
- **Fix**: Either raise `MAX_DIFF_CHARS` after measuring real PR sizes, or map the declined case to a NEUTRAL signal (distinct label / no pass label) so "not reviewed" never reads as "passed".
  - Strength: Removes the false-green on exactly the PRs most needing review.
  - Tradeoff: A neutral/no-label decline complicates the "exactly one pass/fail label" invariant the plan asserts.
  - Confidence: MED — right threshold depends on this repo's PR-size distribution, unmeasured.
  - Blind spot: Real diff-size distribution not surveyed.
- **Decision**: FIXED via Fix (neutral decline — new `decision: "declined"` verdict + `ai-cr:skipped` label; gate routes declined to a neutral, no-pass/fail, non-failing branch)

### F6 — `npm install` (not `npm ci`) in the per-run build

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 action / Performance Considerations
- **Detail**: The package ships a committed `package-lock.json`, but the action builds with `npm install`, which can mutate the lockfile and is non-deterministic/slower.
- **Fix**: Use `npm ci` in the action's build step for reproducible installs.
- **Decision**: FIXED via Fix (`npm ci` in the standalone-build step + Performance note; lockfile-sync caveat added for the new `vitest` devDep; README refresh note)

### F7 — Composite action node version unspecified

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §1 (action "setup") / Phase 5 caller
- **Detail**: The caller workflow has no `setup-node`; the action's "setup" step doesn't pin a version. `engines.node` requires `^20.19 || >=22.12`; an unpinned runner node could drift.
- **Fix**: Add `actions/setup-node@v4` (node 24, matching `ci.yml`) inside the action before build.
- **Decision**: FIXED via Fix differently (pin the action's setup step to `actions/setup-node@v4` with `node-version-file: .nvmrc` = `24.18.0` — single source of truth, better than hardcoding)
