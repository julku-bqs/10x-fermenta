# File-read tool for CopilotReviewAgent — Plan Brief

> Full plan: `context/changes/code-reviewer-more-context/plan.md`
> Research: `context/changes/code-reviewer-more-context/research.md`

## What & Why

Give the Copilot-backed code reviewer the SDK's built-in read tools (`view`, `grep`, `glob`) so it can review a diff against the code around it and, when present, the change-context docs in `context/` — judging a change against its stated intent, not just the raw hunks. Enabling tools removes the reviewer's implicit single-turn cost bound, so we replace it with an explicit `maxAiCredits` cap and a raised wait timeout.

## Starting Point

One construction site (`copilot-review-agent.ts`) sets `availableTools: []`, which forces exactly one LLM call — today's capability switch _and_ cost bound in one. Usage (tokens, AI credits) is already accumulated; `sendAndWait` runs on the SDK's 60 s default. The prompt already fences PR title/body as untrusted data and mandates a single-JSON-object output.

## Desired End State

A review can make a few targeted reads — surrounding code plus `context/changes/<id>/{change,research,plan}.md` if the PR carries them — and fold intent into its findings, while still emitting one valid `ReviewResult`. Spend is capped at 300 AI credits (soft), the wait at 300 s. A diff with no context docs produces the same valid review it does today.

## Key Decisions Made

| Decision            | Choice                                                                  | Why (1 sentence)                                                                      | Source   |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Read tools          | Built-in `["view","grep","glob"]`                                       | Complete read-only surface; no custom tools/MCP/permissions needed                    | Research |
| Cost bound          | `sessionLimits.maxAiCredits` = 300 (constant in `core/limits.ts`)       | First-class, cross-model soft cap that replaces the retired single-turn bound         | Research |
| Credit-cap exposure | Constructor option `maxAiCredits?` (default 300); **factory unchanged** | AI credits is Copilot-specific — wrong layer for the generic `ReviewAgentConfig` seam | Plan     |
| Wait timeout        | Raise `sendAndWait` to 300 s (named constant)                           | Default is 60 s and _throws_ on elapse; multi-turn reads routinely exceed it          | Plan     |
| Context targeting   | Agent self-explores; `ReviewInput` unchanged                            | Avoids threading a `changeId` hint before it's needed                                 | Research |
| Liveness on hang    | Defer outer guard; document `#2911` + code-comment escape hatch         | Keep v1 minimal; the wedge is a known SDK bug, not our logic                          | Plan     |
| CI hardening        | Defer `persist-credentials: false`                                      | Keeping `bash` out is the real control; harden before branch protection               | Research |
| Tests               | None new (existing suite + live eval)                                   | No abort/hook logic added; prompt/tool config isn't unit-mocked                       | Plan     |

## Scope

**In scope:** enable the read trio; add `MAX_AI_CREDITS`/`SEND_AND_WAIT_TIMEOUT_MS`; thread the cap through the constructor; raise the timeout; prompt guidance for tool use + change-context reading; extend the untrusted-data fence to file contents; rewrite the stale in-code comment + README "Notes".

**Out of scope:** factory/`ReviewAgentConfig` changes; `session.abort()` watchdog or `onPreToolUse` cap; outer `Promise.race` guard; `changeId`/`changeContextPath` in `ReviewInput`; enabling `bash`; CI `persist-credentials`; grader changes; new unit tests.

## Architecture / Approach

Two phases, one PR. **Phase 1** (wiring, in `copilot-review-agent.ts` + `core/limits.ts`): read trio on, credit cap + timeout applied, constructor option added, single-turn comment rewritten. **Phase 2** (behavior + docs, in `review-prompt.ts` + `README.md`): prompt teaches bounded tool use and change-context reading, untrusted-data fence extended to file contents, README updated. The eval review-provider auto-inherits the tool-enabled agent; the eval grader stays `availableTools: []`.

## Phases at a Glance

| Phase             | What it delivers                              | Key risk                                                           |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| 1. Enable + bound | Reads files, cost/wait bounded, comment fixed | `maxAiCredits` is a soft between-turns cap; one turn can overshoot |
| 2. Guide + docs   | Uses tools well, injection-safe, docs current | Prompt bloat / weakening the JSON-contract or untrusted fence      |

**Prerequisites:** Copilot auth (`copilot login` or a `GH_TOKEN`); run from `packages/code-reviewer`. The PR should carry this change's `context/` docs so the reviewer can read them.
**Estimated effort:** ~1 session across 2 phases (small, single-package change).

## Open Risks & Assumptions

- **Known SDK hang (`github/copilot-cli#2911`, OPEN):** in tool-call loops the SDK can wedge inside a model call and ignore `sendAndWait`'s timeout; `maxAiCredits` can't stop it either. Highest exposure in the eval (sonnet/haiku). Accepted for v1, documented, with a code-comment pointer to the `Promise.race` escape hatch.
- **Soft cap overshoot:** 300 AIC is checked between turns, so a single response can exceed it before the loop halts — a deliberate ceiling, not a precise limit.
- **Assumption:** read-only tools stay auto-approved and file paths resolve against the PR checkout in CI (holds today).

## Success Criteria (Summary)

- Reviews a diff against its `context/` intent when docs are present; unchanged, valid review when they aren't.
- Cost and wait are visibly bounded (`aiCredits` reported; 300 AIC / 300 s constants applied).
- Injection text in a read file is ignored; output stays a single JSON object; existing tests still pass.
