---
change_id: diary-consolidation
title: Consolidate duplicated diary entry UI components and schemas
status: impl_reviewed
created: 2026-06-14
updated: 2026-06-16
archived_at: null
---

## Notes

Merge TimelineEntry and LocalEntryRow (~340 lines of near-identical code) into a single EntryRow component. Extract shared diary entry schema to eliminate drift between batch.ts inline definition and diary-entry.ts. Remove duplicated LocalDiaryEntry type. Fix notes rendering bug where TimelineEntry renders expand container even when notes is null. See diary-consolidation.md for full task breakdown.
