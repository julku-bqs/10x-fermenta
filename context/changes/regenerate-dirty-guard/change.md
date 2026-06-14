---
id: regenerate-dirty-guard
title: Disable Regenerate button when batch form is dirty
status: proposed
created: 2026-06-14
updated: 2026-06-14
---

## Summary

Disable the "Regenerate Plan" button when the batch form has unsaved changes. Show a tooltip explaining that the batch must be saved first — regeneration uses persisted params, not dirty form state.

## Scope

- Pass `isDirty` flag from BatchForm to DiarySection
- Disable Regenerate button + show tooltip when dirty
- No alert/modal — purely visual feedback
