<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: File-read tool for CopilotReviewAgent + token-usage stop condition

- **Plan**: context/changes/code-reviewer-more-context/plan.md
- **Scope**: Phase 1 & 2 of 2 (Phase 1 fully complete; Phase 2 code complete, 1 bounded-optional manual check pending)
- **Date**: 2026-08-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension           | Verdict                          |
| ------------------- | -------------------------------- |
| Plan Adherence      | PASS                             |
| Scope Discipline    | PASS                             |
| Safety & Quality    | PASS                             |
| Architecture        | PASS                             |
| Pattern Consistency | PASS                             |
| Success Criteria    | PASS (F1 resolved during triage) |

## Summary

The implementation is a faithful, surgical realization of the plan. All eight changed source files were planned (no unplanned/EXTRA files; `package-lock.json` is a byproduct of the `~1.0.11` pin). Every Phase 1 and Phase 2 contract landed as written:

- `core/limits.ts`: `MAX_AI_CREDITS = 300`, `SEND_AND_WAIT_TIMEOUT_MS = 300_000`, `MAX_DIFF_CHARS` 50k→1M (kept finite; decline path intact).
- `copilot-review-agent.ts`: read trio `["view","grep","glob"]`, `sessionLimits.maxAiCredits`, session-level `workingDirectory`, 300s `sendAndWait` timeout, final-message parse (dropped the `content +=` accumulator), rewritten rationale comment + `#2911` breadcrumb + `@experimental` note, constructor `maxAiCredits?`/`workingDirectory?` with sensible defaults.
- `factory.ts`: encapsulated `resolveRepoRoot()` via `execFileSync("git", ["rev-parse","--show-toplevel"])` with cwd fallback, threaded as `workingDirectory`; `ReviewAgentConfig` public shape unchanged.
- `review-prompt.ts`: `context/`-tree map + "few targeted reads" + optional-context fallback; untrusted-data fence extended to tool-read file contents; five-criteria rubric and single-JSON contract preserved verbatim.
- `README.md`: Notes rewritten (read trio, `maxAiCredits` default 300, raised timeout, `#2911`); Session-limits bullet marked realized; eval n=1 caveat extended (live-repo reads → repo-tree-dependent).
- `ai-code-review.yml`: `timeout-minutes: 10` on the `review` job.

All "What We're NOT Doing" guardrails held: `ReviewInput` stays `{ diff, title?, description? }`; `ReviewAgentConfig` gained no credit knob; the eval grader stays `availableTools: []` (copilot-grader.ts:88); no `bash`, no `session.abort()`/`onPreToolUse` cap, no in-code `Promise.race`, no `changeId` threading, no new unit tests.

Automated success criteria pass locally: `npm run typecheck` ✓, `npm run build` ✓, `npm test` → 17/17 ✓. Manual criteria 1.4–1.9, 2.5, 2.6, 2.7 carry recorded evidence; only 2.4 remains pending (see F1).

### Parse-safety note (verified, not a finding)

`parseReview(finalMessage?.data.content ?? "")`: when the final message is undefined, `parseReview("")` throws `Model did not return valid JSON`, which propagates through `finally { client.stop() }` to the existing "reviewer did not run" path — identical to the old empty-`content` behavior. No silent-pass regression. The final-message parse is strictly more correct than the retired accumulator (which could splice interstitial tool-turn braces/fences), and is confirmed by manual checks 1.8 / 2.5 / 2.6.

## Findings

### F1 — Manual verification 2.4 remains pending human confirmation

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/code-reviewer-more-context/plan.md (Progress → Phase 2 → 2.4)
- **Detail**: Progress item 2.4 (agent, guided only by the `context/`-layout map with no threaded change-id, self-locates the matching `context/changes/<id>/` folder and reflects its stated intent) is `- [ ]`, annotated "partial … a deterministic `context/changes/<id>` read is bounded-optional by design and wasn't triggered by self-sufficient test diffs — pending human confirmation." The underlying code is committed (a38a620) and the surrounding mechanism is verified: 2.5 confirms tool reads + injection fence hold, 2.6 confirms the no-docs fallback yields a valid review, and 2.4's own note records the agent reading `context/foundation/domain_knowledge.md` and glob-ing the context map. So this is an unverified _optional behavior_, not a missing or broken implementation — the only reason Success Criteria is WARNING rather than PASS.
- **Fix**: Run `npm run review` from `packages/code-reviewer` on a diff whose change docs live under `context/changes/<id>/` but are **not** referenced by the diff (so the agent must self-correlate via `change.md`); confirm the review reflects that folder's stated intent, then flip 2.4 to `- [x]` with evidence. If self-location proves non-deterministic across models, accept 2.4 as bounded-optional and note that in Progress instead.
- **Decision**: FIXED (differently) — 2.4 verified via a traced run plus an opt-in tool tracer.
  - **Verification**: `REVIEW_TRACE_TOOLS=1 npm run review -- --file <domain-threshold.diff>` (diff flips `25°Blg`→`21°Blg` in `process-plan-generation.ts`). Trace showed 5 tool calls — `view context/foundation`, two `grep`s, `view context/foundation/domain_knowledge.md`, `view process-plan-generation.ts` — and the review raised a `domain_integrity` **blocker** quoting the doc's "~25°Brix/Blg (not 21°Blg)" rule. The agent self-located the doc from the prompt's context-map alone (path never supplied), proving the read-tool + context self-location capability. Two earlier UI-diff runs (claude-sonnet-4.6, gpt-5.3-codex) made 0 tool calls, confirming `context/changes/<id>/` reads are **bounded-optional** (self-sufficient diffs correctly skip context).
  - **Code (accepted EXTRA)**: Added opt-in `attachToolTrace` to `src/agents/copilot/copilot-review-agent.ts` (+24 lines), gated by `REVIEW_TRACE_TOOLS` and a no-op on normal runs — it never changes production behavior unless the diagnostic env var is set. Accepted by the change owner as the resolution of this finding: a diagnostic that makes tool usage observable and proves implementation correctness. `npm run typecheck` and `npm test` (17/17) green with the addition.
