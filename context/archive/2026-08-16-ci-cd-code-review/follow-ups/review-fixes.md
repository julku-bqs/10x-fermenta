# Review follow-ups: ci-cd-code-review

Deferred items from the implementation review (`reviews/impl-review.md`). Each was consciously postponed during triage rather than skipped.

## F1 (Fix A) — Harden the reviewer to run from the trusted base ref before enabling branch protection

- **Source**: `reviews/impl-review.md` finding F1 (⚠️ WARNING, HIGH impact, Safety & Quality).
- **Triage outcome**: resolved with **Fix B** (accept + document) on 2026-08-25 — a SECURITY caveat and repo-settings checklist were added to `packages/code-reviewer/README.md`. This item captures the **deferred Fix A**.
- **What's left**: the composite action still builds and runs the reviewer _from the PR checkout_ (`npm ci && npm run build && node dist/cli.js`) under `pull-requests: write` + `copilot-requests: write`. Contained today by `on: pull_request` (fork PRs = read-only token, no secrets) — but before the `blocked` check is ever promoted to a **hard merge gate (branch protection)**, harden it:
  - Build/install and run the reviewer from the trusted **base ref** (`origin/main`), and feed only the PR **diff** as data.
  - Keep the trigger as `pull_request` (never `pull_request_target`).
- **Trigger / when to do this**: as a prerequisite to enabling branch protection on `main` for the AI review check.
- **Also verify (repo settings, one-time)** — see the README CI section:
  - Settings → Actions → General → Fork PR workflows → _Require approval for all outside collaborators_.
  - Settings → Actions → General → Workflow permissions → read-only default.
  - Keep write/push access (Collaborators & teams) tight — those are the only authors of same-repo PRs that run with the write-scoped token.
- **Status**: OPEN.
