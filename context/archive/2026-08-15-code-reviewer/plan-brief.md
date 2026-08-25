# Modular code-reviewer agent — Plan Brief

> Full plan: `context/changes/code-reviewer/plan.md`

## What & Why

Refactor `packages/code-reviewer` from a single SDK-coupled class into a modular, interface-driven package. The goal is a clean seam — `ReviewAgent` — behind which the Copilot SDK implementation lives, so it can be swapped or joined by other backends later, and so a future promptfoo eval can import the agent and run against it. Prompts and structured-output schemas become their own modules.

## Starting Point

Today it's ~300 LOC in five flat files: `index.ts` (CLI), `reviewer.ts` (`CodeReviewer` — SDK session **and** JSON parsing, mixed), `agent.ts` (prompts), `git.ts` (diff I/O), `schemas.ts` (zod). `CodeReviewer` is concrete and instantiated directly by the CLI — there's no interface to add agents against. The package is private/pre-1.0, standalone, has no tests.

## Desired End State

Source organized by concern under `src/{core,schemas,prompts,agents/copilot}/` plus `git.ts`, a thin `cli.ts`, and a side-effect-free barrel `index.ts`. Behavior is identical — same prompts, same JSON output, same CLI flags — but the Copilot logic sits behind `ReviewAgent`, reachable via a `createReviewAgent()` factory and exported for reuse.

## Key Decisions Made

| Decision              | Choice                                                                    | Why (1 sentence)                                                                                     | Source |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| Directory layout      | Nested by concern (`core/`, `schemas/`, `prompts/`, `agents/copilot/`)    | Makes the modular structure explicit and gives future backends a home                                | Plan   |
| Interface grain       | Domain-specific `ReviewAgent.review(diff) → ReviewResult` + small factory | `ReviewResult` already carries cost, mapping cleanly to a promptfoo provider                         | Plan   |
| Naming / back-compat  | Clean rename to `CopilotReviewAgent`, drop `CodeReviewer`                 | Package is private/pre-1.0, so the cheapest path also tells the "one impl behind an interface" story | Plan   |
| Export surface        | Barrel `index.ts` exports interface, schemas, impl, factory, prompts      | Gives a future eval provider everything without deep imports                                         | Plan   |
| Prompt representation | TS constants in `src/prompts/`                                            | Importable + type-safe for evals with zero loader code                                               | Plan   |
| Parser location       | Dedicated `parse.ts` in `agents/copilot/`                                 | Fence/prose stripping is chat-reply-shaped, keeping `schemas/` pure                                  | Plan   |
| Verification scope    | Defer tests; typecheck + build + one manual run                           | Keeps the change tight and avoids eval-adjacent toolchain setup                                      | Plan   |

## Scope

**In scope:** module reorganization; `ReviewAgent` interface + factory; `CopilotReviewAgent` + parser; barrel export surface; `package.json` `bin`/`main`/`exports`/`scripts` repoint; README update.

**Out of scope:** promptfoo/eval environment (no provider file, no config); test runner/unit tests; any review-behavior, prompt-wording, schema, CLI-flag, or auth change; new agent backends; root repo tooling.

## Architecture / Approach

The CLI (`cli.ts`) resolves a diff via `git.ts` and calls `createReviewAgent(config)`, which returns a `ReviewAgent`. The only implementation, `CopilotReviewAgent`, owns the Copilot SDK client/session lifecycle and cost accounting, delegates JSON extraction to `parse.ts`, validates with `schemas/review.ts`, and uses the rubric from `prompts/review-prompt.ts`. A barrel `index.ts` re-exports the public API for library and eval consumers.

## Phases at a Glance

| Phase                            | What it delivers                                                        | Key risk                                             |
| -------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Leaf modules + interface      | `schemas/`, `prompts/`, `core/review-agent.ts`; imports rewired         | Missed importer breaks typecheck                     |
| 2. Copilot impl behind interface | `CopilotReviewAgent` + `parse.ts` + `factory.ts`; `reviewer.ts` deleted | Accidental behavior drift when moving SDK/cost logic |
| 3. Entry points + metadata       | `cli.ts`, barrel `index.ts`, `package.json` repoint                     | `bin`/`main` mismatch breaks the binary or import    |
| 4. Documentation                 | README matches new layout + API                                         | Stale `CodeReviewer` / `dist/index.js` references    |

**Prerequisites:** dependencies already installed; Copilot auth only needed for the manual run in Phase 3.
**Estimated effort:** ~1 session across 4 tight phases (a structure-only refactor of ~300 LOC).

## Open Risks & Assumptions

- The `index.ts` → `cli.ts` swap and `package.json` `bin` repoint must land together, or the installed binary breaks.
- The barrel must stay side-effect-free (no shebang / no `main()`) so library and eval imports don't execute the CLI.
- Preserving `streaming: true` and the `assistant.usage` handlers is required — dropping them silently zeroes reported cost.
- Manual verification in Phase 3 assumes working Copilot auth (login or token).

## Success Criteria (Summary)

- `npm run typecheck` and `npm run build` pass; `node dist/cli.js` reviews a piped diff with the same JSON shape as before.
- `import { createReviewAgent } from "@10x-fermenta/code-reviewer"` resolves and constructs a `ReviewAgent`.
- No `CodeReviewer` or `dist/index.js` references remain; README examples are copy-paste runnable.
