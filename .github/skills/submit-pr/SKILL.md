---
name: submit-pr
description: Push current branch to origin, find or create a GitHub issue matching the change, and open a pull request linking the issue. Stops with a PR link for manual review. Use after implementation is committed and ready for review.
---

# /submit-pr — Push & Open Pull Request

Push the current branch, ensure a corresponding GitHub issue exists (or create one), and open a PR that links it. The workflow stops with a clickable PR link — merge is always manual.

## When to invoke

**Only when the user explicitly requests it.** Never start this procedure automatically.

- Trigger phrases: "submit PR", "open PR", "push and create PR", "submit for review", "/submit-pr"
- After `/10x-implement` completes, the agent may *suggest* running `/submit-pr` — but must wait for the user to confirm before invoking it

## Initial Response

When invoked:

1. **Detect context automatically:**
   - Current branch name (must not be `main` — refuse if so)
   - Look for `context/changes/<change-id>/change.md` matching the branch name or most recent change
   - Read `change.md` for title, description, and roadmap ID

2. **If no change folder is found**, ask the user:
   - "Which change-id does this PR belong to?" (freeform)
   - If still unresolvable, ask for a PR title and description directly

## Execution Sequence

### Step 1: Push branch

```
git push origin <branch-name>
```

If the branch already exists on remote, push updates. If push fails, report the error and stop.

### Step 2: Find or create GitHub issue

Search existing issues for one matching the change-id or roadmap ID:
- Search query: `<roadmap-id> OR <change-id>` in repo issues
- Match by title pattern: `[<roadmap-id>]` prefix (e.g., `[S-04]`)

**If found:** Use it. Note the issue number.

**If not found:** Create one following the project conventions:

- **Title format:** `[<roadmap-id>] <short description>`
  - `roadmap-id` comes from `change.md` (e.g., `S-01`, `F-01`, `S-04`)
  - If no roadmap ID exists, use the change-id in brackets: `[<change-id>]`
- **Labels:** Apply based on roadmap prefix:
  - `F-*` → `foundation`
  - `S-*` → `slice`
  - Always add `status: in-progress`
- **Body template:**
  ```markdown
  > <one-line user story or summary from change.md>

  ---

  | Field | Value |
  |---|---|
  | Roadmap ID | <id> |
  | Change ID | <change-id> |
  | Status | in-progress |

  ---
  _Auto-created by /submit-pr skill._
  ```
- **Assignee:** Current authenticated GitHub user

### Step 3: Create pull request

- **Title:** Same as issue title
- **Base:** `main`
- **Head:** Current branch
- **Body:**
  ```markdown
  Closes #<issue-number>

  ## Summary

  <Short description from change.md or plan-brief.md>

  ## Changes

  <List key files changed, grouped by area — read from git diff --stat against main>
  ```

### Step 4: Output result

Print exactly:

```
✅ PR ready for review:
   <full PR URL>

Issue: #<number> — <title>
Branch: <branch> → main
```

Then STOP. Do not merge, do not ask follow-up questions.

## Error Handling

- **Branch is `main`:** "Cannot submit PR from main. Switch to a feature branch first." → STOP
- **No commits ahead of main:** "Branch is up to date with main — nothing to submit." → STOP
- **Push fails:** Report git error verbatim → STOP
- **PR already exists for this branch:** Report existing PR URL → STOP

## Conventions Reference

These conventions are documented in AGENTS.md § GitHub Issues & PRs:

| Element | Format |
|---------|--------|
| Issue title | `[<roadmap-id>] Short description` |
| Issue labels | `foundation` or `slice` + `status: *` |
| PR title | Matches issue title |
| PR body | `Closes #N` + summary + change list |
| Branch naming | Matches change-id (kebab-case) |
