# Modular code-reviewer agent Implementation Plan

## Overview

Refactor `packages/code-reviewer` from a concrete, SDK-coupled CLI into a modular, interface-driven package. Introduce a backend-agnostic `ReviewAgent` seam, move the current Copilot logic behind a `CopilotReviewAgent` implementation, and cleanly separate prompts and structured-output schemas into their own modules. Expose a barrel public API so a future promptfoo provider can import the agent and run evals against it — without configuring any eval environment in this change. No review behavior changes.

## Current State Analysis

The package is ~300 LOC across five files (`packages/code-reviewer/src/`):

- `index.ts` — CLI entry (shebang + `parseArgs` + wiring); instantiates the concrete class directly.
- `reviewer.ts` — `CodeReviewer`: mixes SDK client/session lifecycle, event-based cost accounting, **and** JSON extraction/validation (`parseReview` / `extractJsonObject`).
- `agent.ts` — `REVIEW_SYSTEM_PROMPT` (rubric + JSON contract) and `buildReviewPrompt(diff)`.
- `git.ts` — `getDiff(DiffSource)` diff resolution (I/O; not agent-coupled).
- `schemas.ts` — zod structured-output contracts (`Finding`, `Review`, `ReviewCost`, `ReviewResult`).

Key constraints discovered:

- **No interface seam** — `CodeReviewer` is concrete; `index.ts` instantiates it directly. Nothing to implement against to add backends.
- **Package is private (`"private": true`, `0.0.1`), standalone**, excluded from root ESLint/TS; `main`/`types`/`exports` point at `reviewer.js`; `bin` at `dist/index.js`. README documents `import { CodeReviewer }`.
- **No tests / test runner** (`package.json` has no `test` script; no config files).
- SDK usage is correct and confirmed against docs: `CopilotClient` → `createSession({ systemMessage, streaming, availableTools: [], onPermissionRequest })` → `sendAndWait`, with cost from `assistant.usage` events.

### Key Discoveries:

- `reviewer.ts:98-121` — `parseReview`/`extractJsonObject` are model-reply-shaped (strip code fences/prose) — not pure schema logic; belong with the Copilot impl, keeping `schemas/` pure.
- `reviewer.ts:43-56` — `createSession` options (`systemMessage` append, `streaming: true`, `availableTools: []`, `onPermissionRequest` approve) and the `assistant.usage` accounting bound cost to a single turn; must move verbatim.
- promptfoo custom providers need only a module exposing `callApi(...) → { output, tokenUsage, cost }` (see References). `ReviewAgent.review(diff): Promise<ReviewResult>` already returns cost, so a clean standalone export maps directly later.
- `ReviewResultSchema` already carries `cost` (tokensIn/Out, optional `model`, optional `aiCredits`) — the eval-friendly output shape already exists.

## Desired End State

A `packages/code-reviewer` whose source is organized by concern:

```
src/
  index.ts                          # library barrel (public API; side-effect free)
  cli.ts                            # CLI entry (shebang, arg parsing + wiring)
  git.ts                            # diff resolution (unchanged)
  core/
    review-agent.ts                 # ReviewAgent interface (the seam)
  schemas/
    review.ts                       # zod structured-output contracts
  prompts/
    review-prompt.ts                # REVIEW_SYSTEM_PROMPT + buildReviewPrompt
  agents/
    factory.ts                      # createReviewAgent(config): ReviewAgent
    copilot/
      copilot-review-agent.ts       # CopilotReviewAgent implements ReviewAgent
      parse.ts                      # parseReview / extractJsonObject
```

Verification: `npm run typecheck` and `npm run build` pass; `node dist/cli.js --help` works; `git diff | node dist/cli.js --stdin` produces the same JSON shape (summary/findings/nitpicks/cost) as before; `import { createReviewAgent } from "@10x-fermenta/code-reviewer"` resolves against `dist/index.js`.

## What We're NOT Doing

- **Not** configuring promptfoo or any eval environment — no provider file, no promptfoo config, no eval deps/scripts. (Explicit user constraint.)
- **Not** adding a test runner or unit tests (deferred by decision; verification is typecheck + build + one manual run).
- **Not** changing review behavior, prompt wording, the JSON output schema, CLI flags/help, or the auth model.
- **Not** adding new agent backends — only the interface seam plus the single Copilot implementation and a factory.
- **Not** touching root repo tooling — the package stays standalone and excluded from root ESLint/TypeScript.

## Implementation Approach

Four incremental phases, each leaving the tree compiling with **no duplicated source of truth**:

1. Relocate the pure leaf modules (schemas, prompts) and add the `ReviewAgent` interface, rewiring the one importer.
2. Extract the Copilot logic into `CopilotReviewAgent` + `parse.ts` behind the interface, add the factory, delete `reviewer.ts`, and point the CLI at the factory.
3. Split the CLI into `cli.ts`, turn `index.ts` into the barrel, and repoint `package.json` metadata.
4. Update the README to match.

## Critical Implementation Details

- **Entry-point/packaging ordering (Phase 3):** `src/index.ts` changes role from executable to barrel. The shebang + `main()` must move to `src/cli.ts` **and** `package.json` `bin` must repoint to `dist/cli.js` in the same phase, or the installed binary breaks.
- **Barrel purity:** `src/index.ts` must be side-effect-free — no `#!/usr/bin/env node`, no top-level `main()` call — because libraries and a future eval provider import it.
- **Behavior preservation:** the Copilot `createSession` options (`systemMessage` append, `availableTools: []`, `streaming: true`, `onPermissionRequest` approve) and the `assistant.usage` cost accounting must move verbatim. Dropping `streaming: true` silently zeroes reported cost.

## Phase 1: Relocate leaf modules + define the interface

### Overview

Move the two already-cohesive concerns (structured output, prompts) into dedicated modules and introduce the interface, without changing any behavior. The concrete `CodeReviewer` stays in `reviewer.ts` for now, rewired to the new import paths.

### Changes Required:

#### 1. Structured-output schemas

**File**: `src/schemas/review.ts` (new; content moved from `src/schemas.ts`, then delete `src/schemas.ts`)

**Intent**: Establish a pure, importable data-contract module with no agent/SDK coupling.

**Contract**: Same public exports as today — `SeveritySchema`, `Severity`, `FindingSchema`, `Finding`, `ReviewSchema`, `Review`, `ReviewCostSchema`, `ReviewCost`, `ReviewResultSchema`, `ReviewResult`, and the `z` re-export. No content changes beyond relocation.

#### 2. Prompts module

**File**: `src/prompts/review-prompt.ts` (new; content moved from `src/agent.ts`, then delete `src/agent.ts`)

**Intent**: Extract the rubric/system prompt and user-turn builder into a prompts module, kept as typed TS constants (importable for future evals with zero loader code).

**Contract**: `export const REVIEW_SYSTEM_PROMPT: string` and `export function buildReviewPrompt(diff: string): string` — wording unchanged.

#### 3. Common interface

**File**: `src/core/review-agent.ts` (new)

**Intent**: Define the backend-agnostic seam every review agent implements, so Copilot can be swapped or joined by other agents later.

**Contract**: `export interface ReviewAgent { review(diff: string): Promise<ReviewResult>; }`, importing `ReviewResult` from `../schemas/review.js`.

#### 4. Rewire the existing concrete class

**File**: `src/reviewer.ts` (edit; temporary — removed in Phase 2)

**Intent**: Update import paths so the tree compiles after the moves; optionally assert interface fit early.

**Contract**: `import … from "./agent.js"` → `"./prompts/review-prompt.js"`; `import … from "./schemas.js"` → `"./schemas/review.js"`. Optionally declare `CodeReviewer implements ReviewAgent` (import from `./core/review-agent.js`) to validate the interface shape. `src/index.ts` is unchanged this phase.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `npm run typecheck` (run in `packages/code-reviewer`)
- No references to the old module paths remain: search for `./agent.js`, `./schemas.js`, `./schemas"` returns nothing

#### Manual Verification:

- Module boundaries read cleanly: `schemas/` is pure data, `prompts/` is pure strings, `core/` is interface-only

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Extract the Copilot implementation behind the interface

### Overview

Split `reviewer.ts` into a Copilot-specific `ReviewAgent` implementation plus its response parser, add a factory to select implementations, delete `reviewer.ts`, and route the CLI through the factory.

### Changes Required:

#### 1. Copilot response parser

**File**: `src/agents/copilot/parse.ts` (new; moved from `reviewer.ts` internals)

**Intent**: Isolate the model-reply-shaped JSON extraction + zod validation so `schemas/` stays pure and a future native-structured-output agent can skip it.

**Contract**: `export function parseReview(raw: string): Review`; `extractJsonObject(text: string): string` may remain module-private. Imports `ReviewSchema`, `Review` from `../../schemas/review.js`.

#### 2. Copilot agent implementation

**File**: `src/agents/copilot/copilot-review-agent.ts` (new; core of `reviewer.ts`)

**Intent**: The single concrete `ReviewAgent` backed by the Copilot SDK — owns client/session lifecycle, event-based cost accounting, and returns a validated `ReviewResult`. Reusable standalone so a future promptfoo provider imports and calls `review`.

**Contract**: `export class CopilotReviewAgent implements ReviewAgent`; `export interface CopilotReviewAgentOptions { model?: string; instructions?: string }`; constructor `(options?: CopilotReviewAgentOptions)` (defaults `model` to `COPILOT_MODEL` env then `"auto"`, `instructions` to `REVIEW_SYSTEM_PROMPT`); `review(diff: string): Promise<ReviewResult>`. Preserve verbatim: empty-diff short-circuit, `createSession` options, `assistant.message` / `assistant.usage` handlers, `sendAndWait`, nano-AIU→credits conversion, per-call `client.start()`/`stop()`. Imports: prompt from `../../prompts/review-prompt.js`, schemas/types from `../../schemas/review.js`, parser from `./parse.js`, interface from `../../core/review-agent.js`.

#### 3. Factory

**File**: `src/agents/factory.ts` (new)

**Intent**: One seam to select an implementation by name so future backends slot in without touching callers.

**Contract**: `export interface ReviewAgentConfig { provider?: "copilot"; model?: string; instructions?: string }`; `export function createReviewAgent(config?: ReviewAgentConfig): ReviewAgent`. Default `provider: "copilot"` → `new CopilotReviewAgent({ model, instructions })`; unknown provider throws a descriptive `Error`.

#### 4. Delete old class + point CLI at the factory

**File**: delete `src/reviewer.ts`; edit `src/index.ts` (still the CLI this phase)

**Intent**: The CLI builds the agent through the factory instead of a concrete class.

**Contract**: Replace `import { CodeReviewer } from "./reviewer.js"` with `import { createReviewAgent } from "./agents/factory.js"`; replace `new CodeReviewer({ model })` with `createReviewAgent({ model })`. Output/formatting unchanged.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `npm run typecheck`
- `src/reviewer.ts` is removed and no imports reference `./reviewer.js`: search returns nothing
- Interface conformance holds: `CopilotReviewAgent implements ReviewAgent` compiles

#### Manual Verification:

- Diff review confirms the Copilot `createSession` options and `assistant.usage` cost accounting are the prior logic unchanged (no accidental behavior drift)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Entry points + package metadata

### Overview

Make `index.ts` the library barrel and move the executable to `cli.ts`, then repoint `package.json` so the binary and the library entry resolve correctly. This is the phase that exposes the promptfoo-ready public surface.

### Changes Required:

#### 1. CLI entry relocation

**File**: `src/cli.ts` (new; content = current `src/index.ts` CLI logic)

**Intent**: Free `index.ts` to become the barrel; the executable lives in `cli.ts`.

**Contract**: Keeps `#!/usr/bin/env node`, `HELP`, `parseArgs`, `main()`, and `main().catch(...)`. Imports `getDiff` from `./git.js` and `createReviewAgent` from `./agents/factory.js`.

#### 2. Library barrel

**File**: `src/index.ts` (replace CLI content with re-exports; **no** shebang, **no** top-level execution)

**Intent**: Single public entry that `main`/`exports` point at, exposing everything a future promptfoo provider needs without deep imports.

**Contract**: Re-exports — `ReviewAgent` (type) from `./core/review-agent.js`; `createReviewAgent` + `ReviewAgentConfig` from `./agents/factory.js`; `CopilotReviewAgent` + `CopilotReviewAgentOptions` from `./agents/copilot/copilot-review-agent.js`; the schema values and inferred types from `./schemas/review.js` — `SeveritySchema`/`Severity`, `FindingSchema`/`Finding`, `ReviewSchema`/`Review`, `ReviewCostSchema`/`ReviewCost`, `ReviewResultSchema`/`ReviewResult` (named re-exports, **not** `export *` — the internal `export { z }` in `schemas/review.ts` is deliberately kept out of the package's public surface); `REVIEW_SYSTEM_PROMPT` + `buildReviewPrompt` from `./prompts/review-prompt.js`; `getDiff` + `DiffSource` from `./git.js`.

#### 3. Package metadata

**File**: `packages/code-reviewer/package.json` (edit)

**Intent**: Repoint the binary to the new CLI file and the library entry to the barrel.

**Contract**:

- `bin.code-reviewer`: `./dist/index.js` → `./dist/cli.js`
- `main`: `./dist/reviewer.js` → `./dist/index.js`
- `types`: `./dist/reviewer.d.ts` → `./dist/index.d.ts`
- `exports["."].types`: `./dist/reviewer.d.ts` → `./dist/index.d.ts`; `exports["."].default`: `./dist/reviewer.js` → `./dist/index.js`
- `scripts.dev` and `scripts.review`: `tsx src/index.ts` → `tsx src/cli.ts`
- `scripts.start`: `node dist/index.js` → `node dist/cli.js`

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `npm run typecheck`
- Build succeeds: `npm run build`
- Barrel + CLI emit: `dist/index.d.ts` and `dist/cli.js` exist after build
- Barrel is side-effect-free: `dist/index.js` has no shebang and does not execute on import
- Offline wiring smoke (no Copilot auth/credits): an empty/whitespace diff (e.g. `"" | node dist/cli.js --stdin`) prints the `No changes to review (empty diff).` JSON with empty `findings`/`nitpicks` and zeroed `cost` — exercises the full CLI → factory → `CopilotReviewAgent` → schema path without touching the SDK (the empty-diff short-circuit returns before `CopilotClient` is constructed)

#### Manual Verification:

- `git diff | npm run dev` (or `node dist/cli.js --stdin`) produces the same JSON shape (summary/findings/nitpicks/cost) as before the refactor
- `node dist/cli.js --help` prints help; a piped diff still auto-detects stdin; `--model` override still respected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Documentation

### Overview

Bring the README in line with the new layout, public API, and CLI paths.

### Changes Required:

#### 1. README update

**File**: `packages/code-reviewer/README.md` (edit)

**Intent**: Reflect the new module layout, public API, and CLI paths so the docs stay copy-paste runnable.

**Contract**:

- Intro: reusable pieces are now `createReviewAgent` / `CopilotReviewAgent` / `getDiff`; `src/cli.ts` is the thin entry.
- "Embedding in your own code" example: `import { createReviewAgent } from "@10x-fermenta/code-reviewer"` and `const reviewer = createReviewAgent({ model: "auto" })`.
- Usage section + CI YAML: `dist/index.js` → `dist/cli.js`.
- "Project layout" table: replace with `src/cli.ts`, `src/index.ts` (barrel), `src/core/review-agent.ts`, `src/agents/factory.ts`, `src/agents/copilot/copilot-review-agent.ts`, `src/agents/copilot/parse.ts`, `src/prompts/review-prompt.ts`, `src/schemas/review.ts`, `src/git.ts`.
- "Extending the agent": note the `ReviewAgent` interface seam (add backends via the factory) and that the package is structured so a promptfoo provider can import `createReviewAgent` and map `ReviewResult` → `{ output, tokenUsage, cost }` — eval environment intentionally out of scope for this change.

### Success Criteria:

#### Automated Verification:

- No stale CLI path remains: search README for `dist/index.js` returns nothing
- No stale class name remains: search the package for `CodeReviewer` returns nothing

#### Manual Verification:

- README embedding + CLI examples are copy-paste runnable against the refactored package

**Implementation Note**: This is the final phase; confirm docs render correctly and examples run.

---

## Testing Strategy

### Unit Tests:

- None added in this change (deferred by decision — no test runner is introduced).

### Integration Tests:

- Manual end-to-end: run the CLI against a real diff and confirm the JSON output shape is unchanged.

### Manual Testing Steps:

1. `npm run build` in `packages/code-reviewer`.
2. `node dist/cli.js --help` prints the help text.
3. `git diff | node dist/cli.js --stdin` returns a JSON object with `summary`, `findings`, `nitpicks`, and `cost`.
4. `node dist/cli.js --model gpt-5.4` (or `--staged`) still respects the flag.
5. In a scratch script, `import { createReviewAgent } from "@10x-fermenta/code-reviewer"` resolves and constructs an agent.

## Performance Considerations

None. The runtime path is identical — one LLM turn per review, per-call client lifecycle, same `availableTools: []` bound.

## Migration Notes

- Public import changes from `CodeReviewer` to `createReviewAgent` / `CopilotReviewAgent`. The package is private and pre-1.0, so there are no external consumers to migrate.
- The `code-reviewer` bin name is unchanged for end users; only internal `dist/*.js` paths moved (`index.js` → `cli.js` for the executable).

## References

- Package README: `packages/code-reviewer/README.md`
- Current implementation: `packages/code-reviewer/src/reviewer.ts`, `src/agent.ts`, `src/schemas.ts`
- Copilot SDK docs: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- promptfoo custom JS provider: https://www.promptfoo.dev/docs/providers/custom-api/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Relocate leaf modules + define the interface

#### Automated

- [x] 1.1 Typecheck passes (`npm run typecheck`) — ddd60eb
- [x] 1.2 No references to old module paths (`./agent.js`, `./schemas.js`) remain — ddd60eb

#### Manual

- [x] 1.3 Module boundaries read cleanly (schemas pure, prompts strings, core interface-only) — ddd60eb

### Phase 2: Extract the Copilot implementation behind the interface

#### Automated

- [x] 2.1 Typecheck passes (`npm run typecheck`) — ddd60eb
- [x] 2.2 `reviewer.ts` removed; no `./reviewer.js` imports remain — ddd60eb
- [x] 2.3 `CopilotReviewAgent implements ReviewAgent` compiles — ddd60eb

#### Manual

- [x] 2.4 Copilot session options + cost accounting unchanged (diff review) — ddd60eb

### Phase 3: Entry points + package metadata

#### Automated

- [x] 3.1 Typecheck passes (`npm run typecheck`) — ddd60eb
- [x] 3.2 Build succeeds (`npm run build`) — ddd60eb
- [x] 3.3 `dist/index.d.ts` and `dist/cli.js` exist after build — ddd60eb
- [x] 3.4 `dist/index.js` is side-effect-free (no shebang / no execution on import) — ddd60eb
- [x] 3.5 Offline wiring smoke: empty diff prints "No changes to review" JSON with zeroed cost (no auth/credits) — ddd60eb

#### Manual

- [x] 3.6 Piped review produces the same JSON shape (summary/findings/nitpicks/cost) — ddd60eb
- [x] 3.7 `--help` prints; stdin auto-detected; `--model` respected — ddd60eb

### Phase 4: Documentation

#### Automated

- [x] 4.1 No `dist/index.js` references remain in README — ddd60eb
- [x] 4.2 No `CodeReviewer` references remain in the package — ddd60eb

#### Manual

- [x] 4.3 README embedding + CLI examples are copy-paste runnable — ddd60eb
