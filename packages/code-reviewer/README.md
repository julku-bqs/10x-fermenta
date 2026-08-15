# @10x-fermenta/code-reviewer

A minimal, custom **code-review agent** built on the [GitHub Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk). It feeds a git diff to Copilot's agent runtime and prints a Markdown review. `src/index.ts` is a thin CLI entry point; the reusable pieces (`CodeReviewer`, `getDiff`) are meant to be embedded in larger integrations such as a CI job.

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
node dist/index.js --staged            # staged changes
node dist/index.js --base origin/main  # <base>...HEAD
node dist/index.js --file changes.diff # a diff file
git diff | node dist/index.js --stdin  # piped diff
node dist/index.js --model gpt-5.4     # override the model
```

During development you can skip the build and run directly with `tsx`. Pass flags
straight to `tsx` — `npm run <script> -- --flag` may swallow flags such as
`--stdin` (npm parses them as its own config):

```bash
git diff | npm run dev                    # piped input is auto-detected (no --stdin needed)
npx tsx src/index.ts --base origin/main   # pass flags directly
npx tsx src/index.ts --staged
```

## Embedding in your own code

```ts
import { CodeReviewer } from "@10x-fermenta/code-reviewer";

const reviewer = new CodeReviewer({ model: "auto" });
const { review } = await reviewer.review(myDiffString);
console.log(review);
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
          git diff origin/${{ github.base_ref }}...HEAD | node dist/index.js --stdin > review.md
      - name: Post the review as a comment
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh pr comment ${{ github.event.pull_request.number }} --body-file packages/code-reviewer/review.md
```

## Project layout

| File              | Responsibility                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| `src/index.ts`    | CLI entry point (arg parsing + wiring). Extend this for new commands.        |
| `src/reviewer.ts` | `CodeReviewer` — manages the Copilot client/session. The integration API.    |
| `src/agent.ts`    | The review rubric/system prompt and prompt builder. Customize behavior here. |
| `src/git.ts`      | Resolves a `DiffSource` (stdin / file / base ref / staged) into a diff.      |
| `src/schemas.ts`  | Zod entry point for future structured output. No model defined yet.          |

## Extending the agent

The SDK supports much more than a single prompt. Natural next steps:

- **Custom / sub-agents:** pass `customAgents` to `createSession` to specialize and orchestrate ([docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/custom-agents)).
- **Custom tools & MCP servers:** let the agent fetch extra context ([MCP docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/mcp)).
- **Streaming:** subscribe to `assistant.message_delta` for live output ([streaming docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events)).
- **Session limits:** cap AI-credit spend per run in CI ([docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/session-limits)).
- **Structured output:** `zod` is already installed and scaffolded in `src/schemas.ts`, ready for when you switch the review from Markdown to a validated JSON shape.

## Notes

This package is intentionally standalone (its own `package.json` / `node_modules`) so the native Copilot CLI dependency stays out of the Astro/Cloudflare app build. It is excluded from the repo's root ESLint and TypeScript programs.
