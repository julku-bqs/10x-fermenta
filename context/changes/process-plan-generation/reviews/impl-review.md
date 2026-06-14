<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Process Plan Generation & Diary Editing

- **Plan**: context/changes/process-plan-generation/plan.md
- **Scope**: All Phases (0–4)
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — regenerate_diary_entries RPC bypasses RLS without ownership check

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260614130000_diary_entries_process_plan.sql:42-53
- **Detail**: The `regenerate_diary_entries` function is SECURITY DEFINER (bypasses RLS) but does not verify that `auth.uid()` owns the batch. Any authenticated user who discovers a batch_id could call the RPC directly and replace another user's auto-generated entries. The API endpoint validates ownership before calling the RPC, but the function itself is exposed via `supabase.rpc()` on the client.
- **Fix**: Add ownership check inside the function: `IF NOT EXISTS (SELECT 1 FROM batches WHERE id = p_batch_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;`
  - Strength: Defense-in-depth — function is safe even if called directly.
  - Tradeoff: Extra query per call (negligible for single-row lookup).
  - Confidence: HIGH — standard Supabase pattern for SECURITY DEFINER RPCs.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Diary entry date/completed edits not protected from regenerate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/...:28-33 (promote trigger)
- **Detail**: The ownership promotion trigger only fires on `description` or `notes` changes. If a user changes `entry_date` or toggles `completed` on an auto entry, it stays `entry_type = 'auto'` and will be wiped on regenerate. The plan explicitly specifies this behavior.
- **Fix A ⭐ Recommended**: Accept current behavior — document it
  - Strength: Matches plan. Date edits on auto entries are rare. Completed toggle is progress-tracking, not content.
  - Tradeoff: Edge case: user moves an auto entry's date, regenerates, date resets.
  - Confidence: HIGH — the plan explicitly chose this boundary.
  - Blind spot: None significant.
- **Fix B**: Expand trigger to include entry_date
  - Strength: Any user modification promotes the entry.
  - Tradeoff: Completed toggle would also promote, making regenerate unable to reset progress.
  - Confidence: LOW — completed promotion would break the regenerate UX.
  - Blind spot: Would need to exclude completed from trigger.
- **Decision**: FIXED (Fix A — documented behavior in migration comment)

### F3 — batch_date schema still allows null (schema/DB mismatch)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/schemas/batch.ts:11
- **Detail**: `createBatchSchema` has `batch_date: z.iso.date().nullable().default(null)` but the DB column is now NOT NULL with DEFAULT CURRENT_DATE. The form defaults to today and the submit handler falls back to today, so null never reaches the DB in practice — but the schema doesn't reflect the constraint.
- **Fix**: Change to `z.iso.date().default(new Date().toISOString().slice(0,10))` removing `.nullable()`.
  - Strength: Schema matches DB; Zod catches nulls at validation.
  - Tradeoff: Minor — need to verify updateBatchSchema still allows optional date.
  - Confidence: HIGH — straightforward alignment.
  - Blind spot: None significant.
- **Decision**: FIXED (removed .nullable() from both create and update schemas)

### F4 — DELETE diary entry returns 204 even if no row matched

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/batches/[id]/diary/[entryId].ts:60-66
- **Detail**: Supabase `.delete().eq(...)` succeeds with no error even if 0 rows matched. The handler always returns 204. Existing batch endpoint returns 404 when no row is affected.
- **Fix**: Add `.select().single()` to the delete chain; return 404 if `error || !data`.
  - Strength: Matches the existing PUT pattern and batch endpoint.
  - Tradeoff: Slightly more verbose.
  - Confidence: HIGH — same pattern used 10 lines above in PUT.
  - Blind spot: None significant.
- **Decision**: DISMISSED — finding based on wrong premise; no other DELETE endpoint exists; idempotent 204 is the intended convention

### F5 — calculationResult not passed to DiarySection

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/batches/BatchForm.tsx:430-449
- **Detail**: Plan specified DiarySection accepts `calculationResult` prop for future use in generation conditions. Implementation omits it. Currently no step condition uses it, so behavior is correct — but the interface doesn't match the plan's extensibility contract.
- **Fix**: Skip — no step currently uses calculationResult. Add the prop when v2 measurement-driven sugar additions need it.
  - Strength: YAGNI — adding unused props clutters the interface.
  - Tradeoff: Minor plan drift on paper.
  - Confidence: HIGH — plan itself notes this is for "future condition additions."
  - Blind spot: None significant.
- **Decision**: SKIPPED — YAGNI; add when v2 measurement-driven generation needs it
