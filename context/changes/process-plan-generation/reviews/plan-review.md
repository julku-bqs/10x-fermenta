<!-- PLAN-REVIEW-REPORT -->
# Plan Review: process-plan-generation

**Plan**: `context/changes/process-plan-generation/plan.md`
**Reviewed**: 2026-06-12
**Verdict**: Actionable — 3 findings require plan amendment before implementation

---

## Summary

The plan is well-structured, thoroughly questioned, and handles edge cases thoughtfully (ownership promotion trigger, atomic regeneration, create-mode local entries). The generation pattern, testing strategy, and phase decomposition are sound.

However, codebase verification uncovered **3 structural issues** that will cause implementation failure if not addressed, plus 2 minor issues worth noting.

---

## Findings

### F1: Route conflict — `[id].ts` blocks nested diary routes
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **HIGH** | Feasibility | Phase 2 |

**What the plan says**: Create `src/pages/api/batches/[id]/diary.ts`, `src/pages/api/batches/[id]/diary/[entryId].ts`, and `src/pages/api/batches/[id]/diary/regenerate.ts`.

**What the codebase shows**: `src/pages/api/batches/[id].ts` exists as a **file**. Astro's file-based routing does not allow both a file `[id].ts` and a directory `[id]/` at the same level.

**Impact**: Phase 2 will fail immediately — routes cannot be created without first restructuring the existing file.

**Fix**: Add a prerequisite step in Phase 2: rename `src/pages/api/batches/[id].ts` → `src/pages/api/batches/[id]/index.ts`. This is a non-breaking refactor (same route behavior). Then nested routes work as planned.

---

### F2: Zod schema strips `diary_entries` from batch creation payload
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **HIGH** | Contract break | Phase 2 |

**What the plan says**: "The POST body gains an optional `diary_entries: [...]` field (user-added entries from create mode)."

**What the codebase shows**: `createBatchSchema` in `src/lib/schemas/batch.ts` is a strict `z.object({...})` without `.passthrough()`. Zod v4 strips unknown keys by default — any `diary_entries` field in the POST body will be silently removed before the handler processes it.

**Impact**: User-added diary entries from create mode will be silently lost.

**Fix**: Explicitly add `diary_entries` as an optional field to `createBatchSchema` (preferred over `.passthrough()` for type safety):
```typescript
diary_entries: z.array(z.object({
  description: z.string().min(1),
  entry_date: z.iso.date(),
  notes: z.string().nullable().optional(),
})).optional(),
```
Then the handler reads `result.data.diary_entries` and passes them to the diary insertion logic.

---

### F3: DiarySection receives `batch: Batch` but no Batch exists in create mode
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **MEDIUM** | Contract inconsistency | Phase 3 |

**What the plan says**: DiarySection accepts `batch: Batch` (the full batch object) plus `mode: 'create' | 'edit'`.

**What the codebase shows**: In create mode, there is no persisted Batch — only form state fields. The existing pattern (IngredientsSection) receives individual params (`{ target_volume_liters, target_abv, planned_sweetness }`), not a full Batch object. The `Batch` interface requires `id`, `user_id`, `created_at` etc. which don't exist before save.

**Impact**: TypeScript will reject passing a partial/fake Batch object. Either the plan's contract is wrong or the component needs two distinct prop shapes.

**Fix**: Two options (recommend A):
- **(A)** Accept `batch: Batch | null` — in create mode pass `null`, DiarySection infers params from a separate `batchParams` prop (matching IngredientsSection pattern). In edit mode, full Batch is available.
- **(B)** Create a `BatchFormState` type that DiarySection accepts, separate from `Batch`. Map form fields to this type in both modes.

---

### F4: Phase 0 mockups already implemented (plan is stale)
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **LOW** | Stale reference | Phase 0, Phase 3 |

**What the plan says**: BatchForm has a placeholder "Process diary — coming soon" at lines 443-446. Phase 0 creates mockup components from scratch.

**What the codebase shows**: The placeholder has already been replaced with `<DiaryMockupSwitcher />`. Mockup components likely already exist.

**Impact**: Phase 0 may already be partially or fully complete. The implementer will be confused by stale instructions.

**Fix**: Verify Phase 0 status. If mockups exist and a winner was chosen, update the plan: mark Phase 0 as done and remove references to the placeholder. If mockups exist but no winner was chosen, Phase 0 reduces to "pick winner and delete losers."

---

### F5: Phase 1 test intent references "null batch_date" edge case
| Severity | Category | Phase affected |
|----------|----------|----------------|
| **LOW** | Internal contradiction | Phase 1 |

**What the plan says** (line 283): Unit test intent mentions "edge cases (null batch_date, all conditions met, no conditions met)."

**What the plan also says** (line 64): "batch_date is never null."

**Impact**: Minor — the implementer might waste time writing a test for an impossible state.

**Fix**: Remove "null batch_date" from the test intent description at line 283. The test contract list (lines 285-292) already correctly omits this case.

---

## Triage Checklist

| # | Severity | Finding | Recommended action |
|---|----------|---------|-------------------|
| F1 | HIGH | Route conflict blocks Phase 2 | **Fix now** — add `[id].ts` → `[id]/index.ts` rename as Phase 2 prerequisite |
| F2 | HIGH | Zod strips diary_entries | **Fix now** — add field to createBatchSchema in plan |
| F3 | MEDIUM | Batch prop incompatible in create mode | **Fix now** — clarify contract (recommend option A) |
| F4 | LOW | Phase 0 possibly already done | **Verify & update** — check mockup status |
| F5 | LOW | Stale "null batch_date" test reference | **Fix now** — trivial text cleanup |

---

## Positive Observations

- **Ownership promotion via DB trigger** is elegant — zero API-level complexity, impossible to bypass
- **Flat step template array** is the right pattern — simple, testable, no over-engineering
- **Phase 0 exploration** is a smart risk-reduction move for a UI-heavy feature
- **Atomic regeneration via PostgreSQL function** correctly handles the transaction concern
- **batch_date NOT NULL enforcement** simplifies the entire date computation path
- The plan correctly identifies that diary CRUD is independent from batch form state — this prevents the "cancel erases my diary notes" bug
