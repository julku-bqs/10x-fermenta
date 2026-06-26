---
change_id: expose-step-key
title: Expose step template key in DiaryEntryDraft and diary_entries table
status: new
created: 2026-06-23
updated: 2026-06-23
archived_at: null
---

## Notes

Add `key` field (e.g., "stabilize", "press", "pitch_yeast") to the `DiaryEntryDraft` interface output of `generateProcessPlan()` and to the `diary_entries` DB table. Currently the key exists only in the internal `StepTemplate` interface and is discarded during generation — the output only has `description`, `entry_date`, `entry_type`.

Motivation:
- Testability: tests can assert on stable keys instead of brittle description substrings (descriptions will be localized in v2).
- Re-generation: with keys persisted, a "regenerate auto steps" feature can identify which existing entries came from which template, preserving user edits to non-auto entries.
- Editing UX: keys enable referencing specific steps programmatically (e.g., "mark stabilize as done").

Scope: migration adding nullable `key` column to `diary_entries`, update `DiaryEntryDraft` interface, update `generateProcessPlan` to include key in output, update API route insert mapping.

Discovered during: `/10x-research testing-core-business-logic` — process plan tests cannot assert on step keys because they're not in the output.
