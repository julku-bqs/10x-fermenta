---
title: Research — code-reviewer-more-context
status: complete
created: 2026-08-30
updated: 2026-08-30
---

## Summary

- `packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts` currently creates a Copilot session with `availableTools: []`, so the reviewer cannot read any repository files for extra context.
- The GitHub composite action runs the reviewer from `working-directory: packages/code-reviewer`, so any file-read tool must resolve PR file paths from the git repo root rather than from `process.cwd()` alone.
- The existing prompt already has the right safety model for untrusted PR metadata and strict JSON output, so the smallest viable change is:
  1. add one repo-scoped read-only file tool,
  2. allow only that tool,
  3. instruct the reviewer to use it for surrounding change context,
  4. add focused unit tests around the new seam.

## Grounding

- Review agent: `/home/runner/work/10x-fermenta/10x-fermenta/packages/code-reviewer/src/agents/copilot/copilot-review-agent.ts`
- Prompt: `/home/runner/work/10x-fermenta/10x-fermenta/packages/code-reviewer/src/prompts/review-prompt.ts`
- CI integration: `/home/runner/work/10x-fermenta/10x-fermenta/.github/actions/ai-code-review/action.yml`
