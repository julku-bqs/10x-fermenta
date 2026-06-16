<!-- PLAN-REVIEW-REPORT -->
# Plan Review: process-plan-generation (Round 2)

**Plan**: `context/changes/process-plan-generation/plan.md`
**Reviewed**: 2026-06-13
**Previous review**: `reviews/plan-review-old.md` (2026-06-12)
**Verdict**: Actionable — 3 unresolved findings from prior review + 2 new findings

---

## Summary

The plan is well-structured and comprehensive. Human review feedback (notes field, ownership trigger, batch_date NOT NULL, GenerationInput flexibility, create-mode diary entries) was fully incorporated. Phase 0 is already implemented (mockup components exist and are functional).

However, **3 HIGH/MEDIUM findings from the prior review were never patched into the plan text**. They remain valid and will cause implementation failure. Additionally, 2 new findings emerged from deeper verification.

---

## Findings

### F1: [UNRESOLVED from prior review] Route conflict — `[id].ts` blocks nested diary routes
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **HIGH** | Feasibility | Phase 2 |

**Status**: Identified in plan-review-old.md as F1. Plan was NOT updated.

**Problem**: `src/pages/api/batches/[id].ts` exists as a **file**. Astro's file-based routing cannot have both `[id].ts` (file) and `[id]/diary.ts` (directory) at the same level. Phase 2 routes (`[id]/diary.ts`, `[id]/diary/[entryId].ts`, `[id]/diary/regenerate.ts`) are impossible without restructuring.

**Required fix**: Add a prerequisite step at the start of Phase 2: rename `src/pages/api/batches/[id].ts` → `src/pages/api/batches/[id]/index.ts`. Non-breaking (same route behavior).

---

### F2: [UNRESOLVED from prior review] Zod schema strips `diary_entries` from batch creation payload
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **HIGH** | Contract break | Phase 2 |

**Status**: Identified in plan-review-old.md as F2. Plan was NOT updated.

**Problem**: Phase 2 §5 says "The POST body gains an optional `diary_entries: [...]` field". But `createBatchSchema` in `src/lib/schemas/batch.ts` is strict — Zod strips unknown keys. User-added diary entries from create mode will be silently lost.

**Required fix**: Add to Phase 2 §1 (Zod schema file): extend `createBatchSchema` with an optional `diary_entries` array field, or create the field in the diary-entry schema and compose.

---

### F3: [UNRESOLVED from prior review] DiarySection `batch: Batch` prop doesn't exist in create mode
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **MEDIUM** | Contract inconsistency | Phase 3 |

**Status**: Identified in plan-review-old.md as F3. Plan was NOT updated.

**Problem**: Phase 3 §1 says DiarySection accepts `batch: Batch`. In create mode no persisted Batch exists — the `Batch` interface requires `id`, `user_id`, `created_at` etc. The existing pattern (IngredientsSection) receives individual params, not a full Batch.

**Required fix**: Clarify the prop contract. Recommended: accept `batch: Batch | null` with a separate `batchParams: { process_type, planned_sweetness, fermentation_sugar_kg, batch_date, target_volume_liters }` for create mode, matching the IngredientsSection pattern.

---

### F4: [NEW] `regenerate_diary_entries` RPC doesn't insert `notes` column
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **LOW** | Incomplete contract | Phase 1 |

**Problem**: The RPC at plan line 248 inserts `(batch_id, description, entry_date, entry_type, completed)` but omits the `notes` column. Generated entries have NULL notes, which is fine. However, the `p_entries` JSONB could later be extended with notes — the INSERT should be future-proofed.

More importantly: if a step template ever produces a `notes` value (e.g., "Use 2g/L yeast nutrient"), the current INSERT drops it silently.

**Recommended**: Either (a) document explicitly that generated entries always have NULL notes (acceptable), or (b) add `COALESCE(e->>'notes', NULL)` to the INSERT to be future-proof. Low priority — current generation logic produces no notes.

---

### F5: [NEW] Phase 0 is complete but Progress section shows it pending
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **LOW** | Stale progress | Phase 0, Phase 3 |

**Problem**: Mockup components (`DiaryMockupA`, `DiaryMockupB`, `DiaryMockupC`, `DiaryMockupSwitcher`, `mockData.ts`) are all implemented and wired into BatchForm. But the Progress section still shows all Phase 0 items as `- [ ]` unchecked. This will confuse the implementer about where to start.

**Required fix**: Update Progress section — mark Phase 0 automated items as done. Leave manual items (0.4 responsive check, 0.5 winner selection) for user confirmation. Add a note that implementation should begin at Phase 0 winner selection (or Phase 1 if winner is already chosen).

---

## Triage Checklist

| # | Severity | Finding | Recommended action | **Triage outcome** |
|---|----------|---------|-------------------|-------------------|
| F1 | HIGH | Route conflict blocks Phase 2 | Fix now | ✅ **Fixed** — added Phase 2 §0 route restructuring prerequisite |
| F2 | HIGH | Zod strips diary_entries | Fix now | ✅ **Fixed** — added Phase 2 §1b schema extension |
| F3 | MEDIUM | Batch prop incompatible in create mode | Fix now | ✅ **Fixed** — introduced `BatchParams` DTO in Phase 1, DiarySection uses `batchParams + batchId`, Phase 3.5 added for IngredientsSection refactoring |
| F4 | LOW | RPC INSERT omits notes | Accept | ✅ **Fixed** — added `notes` column to RPC INSERT |
| F5 | LOW | Phase 0 progress stale | Fix now | ✅ **Already resolved** — Phase 0 items were already marked done |

---

## Positive Observations

- Human review feedback was thoroughly incorporated (notes, ownership trigger, batch_date enforcement, flexible GenerationInput)
- Phase 0 execution quality is high — mockup switcher with full CRUD actions is a solid exploration tool
- The plan-brief.md is a well-distilled executive summary
- Testing strategy is realistic (unit for logic, manual for integration)
- The independent-save model for diary entries is correctly scoped — avoids coupling with batch form state
- `SECURITY DEFINER` bypass is documented with the compensating control (API-level ownership check)
