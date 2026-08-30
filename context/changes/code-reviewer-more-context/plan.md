## Overview

Enable `CopilotReviewAgent` to fetch minimal repository context during a review without widening its permissions beyond one read-only file tool.

## Phase 1 — Add the read tool

- Create one custom tool that reads a repository file by repo-relative path and optional line range.
- Resolve paths from the git repo root so CI reviews started from `packages/code-reviewer` can still inspect normal PR file paths.
- Keep reads bounded and repo-scoped.

### Success criteria

#### Automated

- Focused unit tests cover successful repo-file reads and path-escape rejection.
- Focused unit tests verify `CopilotReviewAgent` registers only the custom read tool.

#### Manual

- Review the session config and confirm the tool surface is limited to the single read-only repo file tool.

## Phase 2 — Guide the reviewer to use that context safely

- Update the system prompt so the reviewer knows it may use repo reads for surrounding change context.
- Preserve the existing untrusted PR-context boundary and strict JSON-only response contract.

### Success criteria

#### Automated

- Prompt tests verify the tool guidance is present.

#### Manual

- Prompt review confirms repo file contents are treated as context, not instructions, and the JSON contract remains intact.

## Phase 3 — Validate the end-to-end intent

- Run focused package tests for the touched reviewer files.
- Keep the README and change folder in sync with the new behavior.

### Success criteria

#### Automated

- `cd /home/runner/work/10x-fermenta/10x-fermenta/packages/code-reviewer && npm test`

#### Manual

- Proof target: run the reviewer against a diff (optionally with title/description), observe at least one `read_repo_file` use for additional context, and confirm the final output is valid JSON whose findings reflect the extra read context.
