<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Make batch-list load failures visible

- **Plan**: context/changes/fail-visible-batch-list/plan.md
- **Scope**: All phases (1–2 of 2)
- **Date**: 2026-07-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Unrelated future-work change folder bundled into p1 commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/data-access-repository-layer/change.md (commit f30c8b1)
- **Detail**: The p1 commit includes `context/changes/data-access-repository-layer/change.md` — a separate future-work change the plan explicitly lists under "What We're NOT Doing". It was staged because the user chose "Stage everything" at the p1 dirty-path prompt (a conscious call, not silent drift). Benign (a doc file for separate work) but mixes two change scopes in one feature commit.
- **Fix**: Leave as-is (already committed, harmless), or in future keep unrelated change folders out of a feature commit by choosing "stage only the planned set" at the dirty-path prompt.
- **Decision**: SKIPPED

### F2 — BatchListPage structure adapted from the plan's snippet

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/batches/BatchListPage.tsx:21-51
- **Detail**: The plan proposed a single `load()` function reused on mount + Retry. The implementation instead uses an effect-scoped `fetchBatches()` driven by a `reloadKey` counter (retry() bumps the key) plus a `cancelled` cleanup flag. Deliberate adaptation to satisfy the repo's strict type-checked lint (no-confusing-void-expression, no-unnecessary-condition, react-hooks/set-state-in-effect) and mirrors the existing DiarySection mount-fetch convention. Behavior is identical to the plan's contract.
- **Fix**: None needed — behavior matches the plan; noted for traceability.
- **Decision**: SKIPPED

### F3 — Mount-fetch lacks the StrictMode double-invoke guard used by DiarySection

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/batches/BatchListPage.tsx:21-46
- **Detail**: DiarySection guards its mount-fetch with a `useRef` (fetchedRef) so React dev StrictMode's double-effect-invoke doesn't fire two requests. This component relies only on the `cancelled` flag, so in dev StrictMode two `GET /api/batches` fire on mount. No state bug (the first's setState is ignored) and it's dev-only — production mounts once. Purely cosmetic.
- **Fix**: Optionally add a fetchedRef-style guard to match DiarySection, or leave it (the cancelled flag already prevents any state race).
- **Decision**: FIXED — added `fetchedKeyRef` (keyed on reloadKey) guard mirroring DiarySection; removed the `cancelled` flag to avoid the StrictMode guard+cancel deadlock. Lint/build/test green.
