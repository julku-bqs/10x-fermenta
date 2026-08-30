---
change_id: code-reviewer-more-context
title: Add a file-read tool to CopilotReviewAgent for change-context-aware reviews
status: archived
created: 2026-08-29
updated: 2026-08-30
archived_at: 2026-08-30T09:53:39Z
---

## Notes

Introduce 1 read tool to CopilotReviewAgent in @packages\code-reviewer\ The tools should just read a repo file(s). System prompt should guide the agent, to also review code against provided change context (if available). The Pull Request should contain corresponding change notes/context/research/plan documents in @context\ folder
