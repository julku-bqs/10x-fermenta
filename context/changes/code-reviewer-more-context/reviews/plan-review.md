<!-- PLAN-REVIEW-REPORT -->

# Plan Review: File-read tool for CopilotReviewAgent + token-usage stop condition

- **Plan**: context/changes/code-reviewer-more-context/plan.md
- **Mode**: Deep
- **Date**: 2026-08-29
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | FAIL    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | PASS    |

## Grounding

8/8 claimed paths exist ✓. SDK signatures verified: `sendAndWait(options, timeout?)` with 60 s default that throws (session.d.ts:162-163), and `sessionLimits?: SessionLimitsConfig` whose sole field is `maxAiCredits?: number` (generated/session-events.d.ts:847-852). Source claims confirmed: `availableTools: []`, auto-approve `onPermissionRequest`, usage accumulator, no-timeout `sendAndWait`, `limits.ts` constants, factory passes only `{model, instructions}`, `REVIEW_SYSTEM_PROMPT` (five-criteria rubric + UNTRUSTED fence + single-JSON), grader `availableTools: []`, eval provider reuses `createReviewAgent`, README Notes single-turn paragraph (line 188). package.json scripts (`typecheck`/`build`/`test`/`review`/`eval`) all exist. brief↔plan consistent. Progress↔Phase contract well-formed: exactly one `## Progress` block, both phases matched, all 1.1–2.7 success-criteria bullets mapped, phase blocks use plain bullets only. **Contradiction found:** research L91-92 assumes the CLI "runs from the repo root"; the CI action runs it with `working-directory: packages/code-reviewer` (see F1).

## Findings

### F1 — Reviewer runs from packages/code-reviewer, so repo-root context/ reads won't resolve

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Desired End State + Phase 2 §1; vs. `.github/actions/ai-code-review/action.yml`
- **Detail**: The CI review step runs with `working-directory: packages/code-reviewer` (action.yml), and `npm run review` also runs from that dir. But `cli.ts` → `createReviewAgent` → `copilot-review-agent.ts` construct `new CopilotClient()` and `createSession(...)` with **no** `workingDirectory`, so per the SDK (`types.d.ts:2182` — "relative paths resolve against workingDirectory, or the runtime cwd if unset") the agent's `view`/`glob` resolve against the package dir. `git diff origin/main...HEAD` emits repo-root-relative paths (`context/changes/<id>/...`) and the Phase-2 prompt names that same repo-root layout — from `packages/code-reviewer` those point at the non-existent `packages/code-reviewer/context/...`. Because context is "optional," the failed reads are swallowed and a valid review still returns, so the headline "review against context/ intent" **silently no-ops in CI**. The plan's Current State asserts the opposite ("view/glob resolve against the checked-out repo including context/"), and the plan's own manual verification (npm run review reading a context/ doc) cannot pass as written. **Verify first (~5 min):** from `packages/code-reviewer`, run the tool-enabled agent on a diff citing a context/ path and confirm whether `view context/...` resolves — settles the SDK cwd-vs-gitroot question.
- **Fix A ⭐ Recommended**: Anchor the SDK working directory to the git toplevel
  - Approach: In `copilot-review-agent.ts` resolve the repo root (e.g. `git rev-parse --show-toplevel`) and pass `workingDirectory` to `createSession` (or `new CopilotClient({ workingDirectory })`).
  - Strength: Correct in CI **and** local-from-subdir; prompt paths stay repo-root-relative; no CI/caller coupling.
  - Tradeoff: Adds a git call / cwd resolution to the agent.
  - Confidence: HIGH it fixes resolution; MED on whether the client- or session-level option governs the read tools — confirm which.
  - Blind spot: Interaction with the SDK's own git-root detection unverified.
- **Fix B**: Run the action (and document `npm run review`) from the repo root
  - Approach: action.yml `working-directory: .` + `node packages/code-reviewer/dist/cli.js`.
  - Strength: No source change; matches research's original assumption.
  - Tradeoff: Couples correctness to caller cwd; local `npm run review` from the package dir still breaks; fragile.
  - Confidence: MED — depends on every caller remembering the cwd contract.
  - Blind spot: The plan scoped CI out; this reopens the action file.
- **Decision**: FIXED via Fix A (refined) — factory-encapsulated `resolveRepoRoot()` threads `workingDirectory` into the agent options; agent sets it on `createSession` (verify session- vs client-level during impl).

### F2 — Multi-turn narration breaks the single-content accumulator + brace extraction

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (enable tools) vs. `copilot-review-agent.ts:78` / `parse.ts`
- **Detail**: With `availableTools: []` the review is exactly one assistant message = the JSON. Enabling tools makes it multi-turn, but `content += event.data.content` still concatenates **every** assistant message — including interstitial tool-turn narration — before the final JSON. `extractJsonObject` takes the first ``fenced block, else first-`{`..last-`}`. Code-review narration routinely contains braces or fenced snippets, so a stray `{` or`` in an earlier turn makes extraction slice the wrong span → `parseReview` throws → no review (soft: CI warns green, but the feature produced nothing). The plan forecloses this ("no partial-JSON path needed," "no new tests," "existing tests pass unchanged"); research only flagged truncation under the deferred abort() path, not accumulation.
- **Fix A ⭐ Recommended**: Parse the returned final message, not the accumulator
  - Approach: `sendAndWait(...)` returns the final `AssistantMessageEvent` — parse `response?.data.content`; keep the usage handler for cost.
  - Strength: The final turn is the JSON answer; ignores earlier chatter.
  - Tradeoff: Relies on the returned event being the final content turn.
  - Confidence: HIGH — matches the SDK docblock example (session.d.ts:158).
  - Blind spot: Behavior if the model streams JSON across delta messages.
- **Fix B**: Keep only the latest assistant.message (reset content, don't `+=`)
  - Strength: One-line change; drops prior-turn narration.
  - Tradeoff: Assumes the final message is one complete JSON object.
  - Confidence: MED — fragile if the final answer is split across events.
  - Blind spot: Same streaming-split risk as A.
- **Decision**: FIXED via Fix A — parse `sendAndWait`'s returned final `AssistantMessageEvent` (`.data.content`) instead of the multi-turn accumulator; keep the `assistant.usage` handler for cost.

### F3 — No CI job timeout-minutes; deferred #2911 wedge can hang a review ~6h

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details (#2911) vs. `.github/workflows/ai-code-review.yml`
- **Detail**: The plan defers the outer `Promise.race` guard and accepts the #2911 wedge (sendAndWait timeout ignored, maxAiCredits can't halt it). But the `review` job sets no `timeout-minutes`, so a wedged production review (default `auto` model — not only the eval's sonnet/haiku the plan implies) hangs until GitHub's 6 h default, burning Actions minutes; `concurrency.cancel-in-progress` only helps on a new push. A job-level timeout is a free backstop the plan didn't weigh.
- **Fix**: Add `timeout-minutes: <N>` to the review job in `ai-code-review.yml` — a cheap wall-clock backstop independent of the deferred in-code `Promise.race`.
- **Decision**: FIXED — Phase 1 §6 adds `timeout-minutes: 10` to the review job (~2× the 5-min sendAndWait bound).

### F4 — sessionLimits is @experimental in the pinned SDK under a caret range

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (sessionLimits) vs. `node_modules/@github/copilot-sdk` types
- **Detail**: `sessionLimits?: SessionLimitsConfig` is tagged `@experimental` (`types.d.ts:2007-2009`); the package pins `@github/copilot-sdk@^1.0.11` (caret → minor/patch upgrades). The plan frames `maxAiCredits` as "first-class." It works today, but a minor SDK bump could change/remove the surface and silently drop the cost cap.
- **Fix**: Note the experimental status in the code comment near `sessionLimits`; optionally tighten the pin (e.g. `~1.0.11`) so the cost-bound surface can't shift under an unattended minor bump.
- **Decision**: FIXED — Phase 1 §2 records the `@experimental` note + pin guidance. Checked npm: 1.0.11 is the current `latest` (no GA past it; only 1.0.12-unstable / 1.0.13-preview), so the surface is still experimental.

## Triage Summary

- **Date**: 2026-08-29
- **Fixed**: F1 (Fix A, refined — factory `resolveRepoRoot()` → agent `workingDirectory`), F2 (Fix A — parse returned final message), F3 (`timeout-minutes: 10`), F4 (experimental note + pin guidance)
- **Skipped / Accepted / Dismissed**: none
- **Verdict after fixes**: REVISE → **SOUND** — End-State Alignment (F1) and both Blind-Spots warnings (F2, F3) resolved in the plan; Progress↔Phase contract preserved (added 1.7–1.9).

---

# Second Pass — re-review for issues missed in the first pass

- **Date**: 2026-08-30
- **Mode**: Deep
- **Verdict**: SOUND (unchanged) — 0 critical, 1 warning, 2 observations, all resolved
- **Scope**: fresh deep pass with F1–F4 fixes verified present in the plan; new findings only.

## Verdicts (2nd pass)

| Dimension             | Verdict                 |
| --------------------- | ----------------------- |
| End-State Alignment   | PASS                    |
| Lean Execution        | PASS                    |
| Architectural Fitness | PASS                    |
| Blind Spots           | WARNING (F5) → resolved |
| Plan Completeness     | PASS                    |

## Grounding (2nd pass)

6/6 modified paths verified by reading each (`limits.ts`, `copilot-review-agent.ts`, `factory.ts`, `review-prompt.ts`, `ai-code-review.yml`, `README.md`). Symbols confirmed: `availableTools`, `sendAndWait`, `REVIEW_SYSTEM_PROMPT` + `UNTRUSTED PR CONTEXT` fence, `createReviewAgent`, `MAX_DIFF_CHARS`/`declinedTooLongResult`. Eval read-targets confirmed reachable from repo root: `context/foundation/domain_knowledge.md` ✓, `src/lib/api.ts` ✓ (fixture import). `context/` layout confirmed: `changes/`, `archive/`, `domain/`, `foundation/`. Prior F1–F4 fixes verified present in the plan (factory `resolveRepoRoot`→`workingDirectory`, final-message parse, `timeout-minutes: 10`, `@experimental` note/pin).

## Findings (2nd pass)

### F5 — Enabling tools breaks the eval's isolated-fixture comparability

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4 (factory `workingDirectory`) + Phase 2 §1 (context prompt) × `evals/providers/review-provider.ts` + `evals/promptfooconfig.ts`
- **Detail**: The eval review-provider builds via `createReviewAgent`, which now resolves `workingDirectory` to the git repo root and enables `["view","grep","glob"]`. Running `npm run eval` from `packages/code-reviewer`, the tool-enabled agent therefore reads the **live repo tree** while grading the isolated seeded fixture (`quick-export-multiflaw.diff`). Confirmed reachable and on-point: `context/foundation/domain_knowledge.md` (the sugar/unit/dryness rules the fixture's `domain_integrity` flaws are seeded against) and the real `src/lib/api.ts` it imports. The eval's contract (promptfooconfig header + README "Reading the report") is comparable, pinned-model scoring on the SAME diff; the plan/research frame the eval's tool inheritance purely as a cost-measurement win and never weigh that (a) scores now depend on the mutable repo tree → non-reproducible, and (b) `ground-truth.md` was calibrated for an isolated diff while models now face "diff + whatever real repo context they read."
- **Fix A ⭐ Recommended**: Isolate the eval agent's reads (sandboxed `workingDirectory` on the eval provider).
  - Strength: Restores deterministic, apples-to-apples scoring against the committed ground-truth calibration.
  - Tradeoff: Harness no longer exercises context-reading end-to-end.
  - Confidence: HIGH isolation restores determinism; MED on session- vs client-level `workingDirectory` wiring.
  - Blind spot: An empty sandbox makes reads no-op; verify graceful degrade.
- **Fix B**: Accept and document (extend the eval README's non-determinism caveat; no code change).
  - Strength: Zero code; matches the eval's dev-only, already-disclaimed status.
  - Tradeoff: Comparability keeps degrading silently as the tree evolves.
  - Confidence: HIGH it's cheap; LOW that a note alone prevents mis-reading.
  - Blind spot: Doesn't bound a read that balloons (see F6).
- **Decision**: FIXED via **Fix B** — user intent is to let the agent read the repo for richer context; `ground-truth.md` remains the grader's expectation ledger. Plan now documents the live-repo-read reproducibility caveat (Phase 2 §3 README + Testing Strategy → Integration Tests) and broadens verification 2.7 / Progress 2.7.

### F6 — Tool-read payload is unbounded while diff input is capped

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1–§2 vs. `core/review-agent.ts` (`MAX_DIFF_CHARS`) + Critical Implementation Details (#2911)
- **Detail**: `BaseReviewAgent.review` caps review INPUT at `MAX_DIFF_CHARS` before any call, but nothing caps what the read tools pull IN. With `workingDirectory` = repo root, a broad `grep`/`glob` or one large `view` can produce a big tool-result payload — the cumulative-payload trigger behind the accepted `#2911` wedge. Guards are a prompt hint (unenforced), `maxAiCredits` (soft/between-turns), and CI `timeout-minutes: 10` (CI-only) — a **local** `npm run review` wedge has no wall-clock backstop.
- **Fix (as offered)**: Note the input/read asymmetry + local no-backstop caveat; optionally a one-line prompt cap on read count/size.
- **Decision**: FIXED via **Fix differently** — user reframed around the input cap: raise `MAX_DIFF_CHARS` `50_000 → 1_000_000` (kept **finite** so the decline path / `ai-cr:skipped` / `review-agent.test.ts` stay valid; a `Number.MAX_SAFE_INTEGER` sentinel would `RangeError` the test's `"x".repeat(MAX_DIFF_CHARS + 1)` and make the decline unreachable). Full removal deferred. Plan Phase 1 §1 updated; "What We're NOT Doing" now records the CI-only backstop / local-wedge caveat (reads remain unbounded; prompt guidance is the only in-band limiter). Note: the AI-credit cap is a between-turns bound and does not cap the first-turn input, so it is not a true replacement for the char limit — the finite cap keeps that first-turn guard.

### F7 — Context-matching silently depends on the docs being in the diff

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Decision 2 (agent self-explores; no changeId) + Phase 2 §1 prompt
- **Detail**: The agent picks which `context/changes/<id>/` folder to read from "paths that appear in the diff" — which holds only when the PR ADDS its context docs. For a code-only PR whose docs already live on `main`, the diff carries no context path and `glob context/changes/**` returns every folder with no signal which matches THIS change, so "review against this change's stated intent" won't fire. The plan didn't state the coupling; manual verification 2.4 only covered the docs-in-diff case.
- **Fix (as offered)**: Document the docs-in-diff coupling as an explicit v1 limitation.
- **Decision**: FIXED via **Fix differently** — user rejected both documenting and introducing coupling; instead the system message gains a **`context/`-tree map** (`foundation/`, `domain/`, `changes/<id>/`, `archive/<id>/`) so the agent self-locates the matching change by correlating diff paths / subject with each `change.md` — no `<change-id>` threaded, graceful fallback preserved. Plan Phase 2 §1 (Intent + Contract) rewritten; Desired End State de-coupled from "if the PR carries them"; verification 2.4 / Progress 2.4 updated to test self-location.

## Triage Summary (2nd pass)

- **Date**: 2026-08-30
- **Fixed**: F5 (Fix B — documented eval live-repo-read caveat), F6 (Fix differently — `MAX_DIFF_CHARS` → 1,000,000 finite), F7 (Fix differently — `context/`-layout map, agent self-locates)
- **Skipped / Accepted / Dismissed**: none
- **Verdict after fixes**: **SOUND** (unchanged) — Blind Spots warning resolved; Progress↔Phase contract preserved (2.4 and 2.7 reworded in lockstep, no bullets added/removed).
