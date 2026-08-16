<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Modular code-reviewer agent

- **Plan**: context/changes/code-reviewer/plan.md
- **Scope**: All 4 phases (full-plan review) — landed in commit `ddd60eb`
- **Date**: 2026-08-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension           | Verdict                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| Plan Adherence      | PASS                                                                     |
| Scope Discipline    | PASS                                                                     |
| Safety & Quality    | PASS (4 observations — all pre-existing, none introduced by this change) |
| Architecture        | PASS                                                                     |
| Pattern Consistency | WARNING                                                                  |
| Success Criteria    | PASS                                                                     |

**Overall: APPROVED** — a clean, faithful refactor. All 11 planned files match intent, the
behavior-critical Copilot session/cost logic was preserved verbatim (`streaming: true`,
`availableTools: []`, `onPermissionRequest`, `assistant.usage` accounting, `client.stop()` in
`finally`), and every automated success criterion passes. One minor hygiene warning (stale
lockfile) and four inherited observations for future hardening.

### Automated verification (all pass)

- `npm run typecheck` → pass (exit 0)
- `npm run build` → pass; `dist/index.d.ts`, `dist/cli.js`, `dist/index.js` all emitted
- Barrel side-effect-free: `dist/index.js` first line is `/**` (no shebang); `import()` produces no execution and exposes exactly the 10 expected value exports — `z` correctly excluded from the public surface
- Empty-diff smoke (`"" | node dist/cli.js --stdin`) → prints `No changes to review (empty diff).` with empty findings/nitpicks and zeroed cost
- `node dist/cli.js --help` → prints help with all flags (`--stdin`, `--file`, `--base`, `--staged`, `--model`)
- Greps: no `./agent.js` / `./schemas.js` / `./reviewer.js` imports remain; no `CodeReviewer` in package; no `dist/index.js` in README

## Findings

### F1 — Stale bin path in package-lock.json

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: packages/code-reviewer/package-lock.json:14
- **Detail**: Phase 3 repointed `package.json` `bin.code-reviewer` from `./dist/index.js` to `./dist/cli.js`, but the committed lockfile's root package node still records `"bin": { "code-reviewer": "dist/index.js" }`. The lockfile was not regenerated alongside the manifest edit, so it is out of sync with `package.json`. Low real-world impact (npm does not link a package's own bin for itself, and the next `npm install` auto-heals it), but it is a committed manifest/lockfile inconsistency.
- **Fix**: Run `npm install` in `packages/code-reviewer` to regenerate `package-lock.json`, then commit the updated lockfile.
- **Decision**: FIXED — regenerated package-lock.json via `npm install`; clean one-line diff (`bin.code-reviewer` `dist/index.js` → `dist/cli.js`).

### F2 — onPermissionRequest blindly auto-approves tool requests

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts:61
- **Detail**: `onPermissionRequest: async () => ({ kind: "approve-once" })` approves any tool request. Fully mitigated today because `availableTools: []` means no tool can ever be requested, so this handler is currently unreachable. It is a latent defense-in-depth gap that becomes live only if a future change adds a tool to the allowlist without revisiting this. **Pre-existing** — moved verbatim from `reviewer.ts` per the plan's explicit "move verbatim" constraint; not introduced or worsened by this refactor.
- **Fix**: When/if the allowlist is populated, fail closed — deny unless a named, read-only, expected tool is requested.
- **Decision**: SKIPPED — unreachable today (empty allowlist), pre-existing, out of this refactor's scope.

### F3 — Diff embedded in a Markdown fence can prompt-inject the reviewer

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/prompts/review-prompt.ts:47-51
- **Detail**: `buildReviewPrompt` wraps the raw diff in a ` ```diff ` fence. A diff whose content contains a ``` sequence (or injection text) can break out of the fence and steer the reviewer. Blast radius is limited to a wrong/malformed review of a malicious diff — the agent has no tools and no side effects (`availableTools: []`), so no code execution or exfiltration. **Pre-existing** — the plan explicitly forbade changing prompt wording, so faithfully preserved. Worth hardening later, as diffs are untrusted input by nature.
- **Fix**: Delimit the diff with a nonce/XML-style wrapper (or escape backticks) and label it as untrusted data in `REVIEW_SYSTEM_PROMPT` — deferred, since it is a prompt-wording change out of this refactor's scope.
- **Decision**: SKIPPED — pre-existing; prompt-wording change out of this refactor's scope, limited blast radius.

### F4 — parseReview surfaces raw zod errors without context

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agents/copilot/parse.ts:12
- **Detail**: The JSON.parse failure path throws a helpful message including a raw-response snippet, but the final `ReviewSchema.parse(parsed)` lets a raw zod error bubble with no equivalent context (which field failed, what the model returned). Harder to diagnose a schema-shape mismatch in the model reply. **Pre-existing** — moved from `reviewer.ts` internals.
- **Fix**: Use `ReviewSchema.safeParse()` and, on failure, throw an error that includes the zod issues plus a truncated raw-response snippet (mirroring the JSON.parse branch).
- **Decision**: FIXED — parse.ts now uses `safeParse` and throws with field-level zod issues + raw snippet; typecheck passes.

### F5 — CLI value flags accept a missing value

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/cli.ts:52-59
- **Detail**: Value-bearing flags (`--file`, `--base`, `--model`) read the next token via `argv[++i]` without validating it exists or isn't itself a flag, so `--model --stdin` would consume `--stdin` as the model id. Minor CLI ergonomics issue. **Pre-existing** — the CLI logic was relocated verbatim from `index.ts` to `cli.ts`.
- **Fix**: Validate that the next token exists and does not start with `--`; otherwise print an error and exit non-zero.
- **Decision**: FIXED (fixed differently) — replaced the hand-rolled arg loop with Node core `node:util` `parseArgs` (zero new deps; package targets Node ≥20 where it's stable). Natively rejects missing/ambiguous values (`--model --stdin` → exit 1) and unknown flags/positionals, preserves `--help`/`--staged`/`--cached`/stdin auto-detect, and adds `--flag=value`. Verified: typecheck, build, `--help`, empty-diff smoke, bug case, unknown-flag all pass.
