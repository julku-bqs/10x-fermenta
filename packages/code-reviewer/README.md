# @10x-fermenta/code-reviewer

A minimal, custom **code-review agent** built on the [GitHub Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk). It feeds a git diff to Copilot's agent runtime and prints a structured, zod-validated JSON review (summary, findings, nitpicks, and token/credit cost). `src/cli.ts` is a thin CLI entry point; the reusable pieces (`createReviewAgent`, `CopilotReviewAgent`, `getDiff`) are meant to be embedded in larger integrations such as a CI job.

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
const result = await reviewer.review(myDiffString);
console.log(result.summary, result.findings, result.cost);
```

## CI: review every pull request

Uses the built-in `GITHUB_TOKEN` — no PAT to manage. Requires the `copilot-requests: write` permission.

```yaml
name: Copilot Code Review
on: [pull_request]

permissions:
  contents: read
  pull-requests: write
  copilot-requests: write # authorize Copilot billed to the org

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # need the base ref for the diff
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Build reviewer
        working-directory: packages/code-reviewer
        run: |
          npm install
          npm run build
      - name: Review the PR diff
        working-directory: packages/code-reviewer
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git diff origin/${{ github.base_ref }}...HEAD | node dist/cli.js --stdin > review.md
      - name: Post the review as a comment
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh pr comment ${{ github.event.pull_request.number }} --body-file packages/code-reviewer/review.md
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

Every review agent implements the `ReviewAgent` interface (`src/core/review-agent.ts`) — a single `review(diff) => Promise<ReviewResult>` seam. To add a backend, implement that interface and register it in `createReviewAgent` (`src/agents/factory.ts`); callers select it via the `provider` field and never touch a concrete class.

### Evals (promptfoo)

The package is structured so a [promptfoo custom provider](https://www.promptfoo.dev/docs/providers/custom-api/) can `import { createReviewAgent }` and map the returned `ReviewResult` onto promptfoo's `{ output, tokenUsage, cost }` shape (`cost` already carries `tokensIn` / `tokensOut` and, when available, `aiCredits`). Wiring up the eval environment itself is intentionally out of scope for this package.

## Notes

This package is intentionally standalone (its own `package.json` / `node_modules`) so the native Copilot CLI dependency stays out of the Astro/Cloudflare app build. It is excluded from the repo's root ESLint and TypeScript programs.

The reviewer runs **read-only**: the diff is passed inline and agent tools are disabled (`availableTools: []`). Per the SDK's agent loop a turn only continues when the model requests a tool, so with none available a review is a single turn (one LLM call). The SDK has no native max-turns setting, so this is how the cost is bounded.
