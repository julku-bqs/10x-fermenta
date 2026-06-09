<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Batch Data Schema with RLS

- **Plan**: context/changes/batch-schema-with-rls/plan.md
- **Scope**: Phase 1–2 of 2
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — RLS policies missing explicit role qualifier

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260530213000_batch_schema_with_rls.sql:68-81
- **Detail**: All three RLS policies use `FOR ALL` without `TO authenticated`. Without the role qualifier, policies apply to PUBLIC (all roles including `anon`). Security holds because `auth.uid()` returns NULL for anon — making conditions always false — but this is implicit rather than explicit defense-in-depth. The project rule states "granular per-operation, per-role policies" — the plan explicitly overrides per-operation for MVP simplicity, but doesn't address the per-role aspect.
- **Fix**: Add `TO authenticated` to each of the 3 policies via a new migration.
  - Strength: One-word addition per policy. Aligns with Supabase best practice and the project's own "per-role" rule.
  - Tradeoff: Requires a new migration to ALTER the existing policies (cannot edit an applied migration).
  - Confidence: HIGH — standard Supabase pattern.
  - Blind spot: None significant.
- **Decision**: DEFERRED — GitHub issue #16 created for backlog implementation

### F2 — NOT NULL added to timestamp columns beyond plan contract

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260530213000_batch_schema_with_rls.sql:31-32,48-49,56-57
- **Detail**: Plan specifies `created_at` and `updated_at` as `timestamptz DEFAULT now()` (implicitly nullable). Implementation adds `NOT NULL` on all 6 timestamp columns across 3 tables. This is a strictly tighter constraint and best-practice improvement — timestamps with a DEFAULT will never be NULL in practice. No functional risk.
- **Decision**: SKIPPED

### F3 — Unplanned files in diff (workflow artifacts)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: AGENTS.md, context/foundation/lessons.md
- **Detail**: Two files in the commit range are not described in the plan: AGENTS.md (agent onboarding doc) and lessons.md (recurring rules). Both are workflow infrastructure, not production application code. No scope creep into the application domain.
- **Decision**: SKIPPED
