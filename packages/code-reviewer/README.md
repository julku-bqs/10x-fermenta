# @10x-fermenta/code-reviewer

A minimal, custom **code-review agent** built on the [GitHub Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk). It feeds a git diff to Copilot's agent runtime and prints a structured, zod-validated JSON review (summary, findings each tagged with a review criterion, nitpicks, a code-derived pass/fail verdict, and token/credit cost). `src/cli.ts` is a thin CLI entry point; the reusable pieces (`createReviewAgent`, `CopilotReviewAgent`, `getDiff`) are meant to be embedded in larger integrations such as a CI job.

## Why the Copilot SDK

- **Works with a GitHub Copilot Business subscription — no LLM API key.** Auth is your GitHub identity (OAuth device flow, org SAML SSO supported), or a GitHub token in CI.
- **GitHub-native**, so it drops straight into GitHub Actions.

The SDK boots the bundled `@github/copilot` CLI as a JSON-RPC server and exposes the same agent loop that powers the CLI.

## Requirements

- Node.js `^20.19.0 || >=22.12.0` (repo uses 24.x via `.nvmrc`)
- A GitHub Copilot subscription **or** BYOK (bring your own model key)
- Authentication (pick one):
  - **Local:** run `copilot login` once (interactive, supports SSO).
  - **CI / non-interactive:** set a token via `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`. Use a fine-grained PAT with the **"Copilot Requests"** permission, or the built-in `GITHUB_TOKEN` in Actions (see below).

> Org policy note: an admin must have the **Copilot CLI** policy enabled for your org. For Actions billing, also enable **"Allow use of Copilot CLI billed to the organization."**

## Install

```bash
cd packages/code-reviewer
npm install          # also pulls the bundled Copilot CLI
```

## Usage

```bash
# Review uncommitted changes (git diff HEAD)
npm run review

# Or with the built binary
npm run build
node dist/cli.js --staged            # staged changes
node dist/cli.js --base origin/main  # <base>...HEAD
node dist/cli.js --file changes.diff # a diff file
git diff | node dist/cli.js --stdin  # piped diff
node dist/cli.js --title "Add stage calc" --description "PR body"  # fold PR context into the review
node dist/cli.js --model gpt-5.4     # override the model
```

During development you can skip the build and run directly with `tsx`. Pass flags
straight to `tsx` — `npm run <script> -- --flag` may swallow flags such as
`--stdin` (npm parses them as its own config):

```bash
git diff | npm run dev                    # piped input is auto-detected (no --stdin needed)
npx tsx src/cli.ts --base origin/main     # pass flags directly
npx tsx src/cli.ts --staged
```

## Embedding in your own code

```ts
import { createReviewAgent } from "@10x-fermenta/code-reviewer";

const reviewer = createReviewAgent({ model: "auto" });
// `review` takes a ReviewInput object: the diff plus optional PR context.
const result = await reviewer.review({ diff: myDiffString, title, description });
console.log(result.summary, result.findings, result.verdict, result.cost);
```

> **Breaking change:** `review()` now takes a `ReviewInput` (`{ diff, title?, description? }`)
> instead of a bare diff string, and every result carries a code-derived `verdict`
> (`{ decision, pass }`). The CLI is unchanged (stdin still works; `--title`/`--description` are additive).

## CI: review every pull request

PR review is wired for this repo as a **composite action** plus a thin **caller workflow** — no PAT to manage; it uses the built-in `GITHUB_TOKEN` and the `copilot-requests: write` permission.

- **Composite action** — [`.github/actions/ai-code-review`](../../.github/actions/ai-code-review): sets up Node from `.nvmrc`, builds the reviewer (`npm ci && npm run build`), diffs `origin/main...HEAD`, runs the CLI, derives the gate, posts a **sticky** comment, and applies labels. The fail-vs-warn decision is the pure, unit-tested [`gate.mjs`](../../.github/actions/ai-code-review/gate.mjs); the comment is rendered by [`format-comment.mjs`](../../.github/actions/ai-code-review/format-comment.mjs).
- **Caller workflow** — [`.github/workflows/ai-code-review.yml`](../../.github/workflows/ai-code-review.yml): triggers on PRs to `main` (and on the `ai-cr:review` label for an on-demand re-run), grants least-privilege permissions, and delegates to the action.

On each PR it:

- Posts (or edits) **one sticky comment**: summary + verdict badge + findings grouped by criterion.
- Applies exactly one of **`ai-cr:passed`** / **`ai-cr:failed`**; a `blocked` verdict also **fails the check**. An oversize diff is **declined** and gets a neutral **`ai-cr:skipped`** (no pass/fail label, check stays green). If the reviewer itself fails to run, the job emits a `::warning::` and stays green with no label.
- Re-runs on demand when you add the **`ai-cr:review`** label; the workflow removes the label afterwards so it can fire again.

The four labels (`ai-cr:passed`, `ai-cr:failed`, `ai-cr:skipped`, `ai-cr:review`) are provisioned once with `gh label create` — the workflow does not create them.

> Branch protection is intentionally **not** enabled: the `blocked` check fails visibly but does not block merges yet. Turning it into a hard merge gate is a later repo-setting toggle with no code change.
>
> **Security caveat (revisit before enabling branch protection):** the composite action builds and runs the reviewer _from the PR checkout_ (`npm ci && npm run build && node dist/cli.js`) while the job holds `pull-requests: write` + `copilot-requests: write`. A PR that edits `packages/code-reviewer`'s `package.json`/lockfile (a malicious dependency or lifecycle script) therefore executes on the runner. This is contained today by the `on: pull_request` trigger (fork PRs get a **read-only** token and **no secrets**; same-repo PRs come only from push-access collaborators) — but before promoting the `blocked` check to a hard merge gate, harden this by building the reviewer from the trusted **base ref** and feeding only the PR _diff_ as data. Do **not** switch the trigger to `pull_request_target`.
>
> Repo settings to verify (Settings → Actions → General):
>
> - **Fork pull request workflows** → _Require approval for all outside collaborators_ — so a fork PR's workflow (which builds its code) never runs without a maintainer clicking "Approve and run".
> - **Workflow permissions** → _Read repository contents and packages permissions_ (read-only default) — the workflow escalates only the scopes it declares.
> - **Collaborators & teams** — keep write/push access tight: those are exactly the people who can open a _same-repo_ PR that runs with the write-scoped token.
> - Never store long-lived PATs/secrets this workflow can reach; it uses only the ephemeral `github.token`.

The minimal caller looks like this (the action owns the build → run → gate → comment → label pipeline):

```yaml
name: AI Code Review
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, labeled]

permissions:
  contents: read
  pull-requests: write
  copilot-requests: write # authorize Copilot billed to the org

jobs:
  review:
    if: github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # need full history for the base-ref diff
      - uses: ./.github/actions/ai-code-review
        with:
          pr-number: ${{ github.event.pull_request.number }}
          title: ${{ github.event.pull_request.title }}
          description: ${{ github.event.pull_request.body }}
```

## Project layout

| File                                         | Responsibility                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/cli.ts`                                 | CLI entry point (arg parsing + wiring). Extend this for new commands.           |
| `src/index.ts`                               | Public API barrel — re-exports the agent, factory, schemas, and prompts.        |
| `src/core/review-agent.ts`                   | `ReviewAgent` interface — the backend-agnostic seam.                            |
| `src/agents/factory.ts`                      | `createReviewAgent(config)` — selects a `ReviewAgent` implementation.           |
| `src/agents/copilot/copilot-review-agent.ts` | `CopilotReviewAgent` — manages the Copilot client/session. The integration API. |
| `src/agents/copilot/parse.ts`                | Extracts and zod-validates the model's JSON reply.                              |
| `src/prompts/review-prompt.ts`               | The review rubric/system prompt and prompt builder. Customize behavior here.    |
| `src/schemas/review.ts`                      | Zod schemas for the structured output (summary, findings, nitpicks, cost).      |
| `src/git.ts`                                 | Resolves a `DiffSource` (stdin / file / base ref / staged) into a diff.         |

## Extending the agent

The SDK supports much more than a single prompt. Natural next steps:

- **Custom / sub-agents:** pass `customAgents` to `createSession` to specialize and orchestrate ([docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/custom-agents)).
- **Custom tools & MCP servers:** let the agent fetch extra context ([MCP docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/mcp)).
- **Streaming:** subscribe to `assistant.message_delta` for live output ([streaming docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events)).
- **Session limits:** cap AI-credit spend per run in CI ([docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/session-limits)).
- **Structured output:** the review is returned as a `zod`-validated object (`src/schemas/review.ts`). Extend the schema there as your needs grow.

### Adding a backend

Every review agent implements the `ReviewAgent` interface (`src/core/review-agent.ts`) — a single `review(input) => Promise<ReviewResult>` seam. To add a backend, extend `BaseReviewAgent` and implement `runReview(input)` (the base owns the oversize-decline short-circuit and the derived verdict), then register it in `createReviewAgent` (`src/agents/factory.ts`); callers select it via the `provider` field and never touch a concrete class.

### Evals (promptfoo)

The package is structured so a [promptfoo custom provider](https://www.promptfoo.dev/docs/providers/custom-api/) can `import { createReviewAgent }` and map the returned `ReviewResult` onto promptfoo's `{ output, tokenUsage, cost }` shape (`cost` already carries `tokensIn` / `tokensOut` and, when available, `aiCredits`). Wiring up the eval environment itself is intentionally out of scope for this package.

## Notes

This package is intentionally standalone (its own `package.json` / `node_modules`) so the native Copilot CLI dependency stays out of the Astro/Cloudflare app build. It is excluded from the repo's root ESLint and TypeScript programs.

The reviewer runs **read-only**: the diff is passed inline and agent tools are disabled (`availableTools: []`). Per the SDK's agent loop a turn only continues when the model requests a tool, so with none available a review is a single turn (one LLM call). The SDK has no native max-turns setting, so this is how the cost is bounded.
