<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Data Integrity and Interaction Tests

- **Plan**: context/changes/testing-data-integrity/plan.md
- **Scope**: All Phases (1–5 of 5)
- **Date**: 2026-06-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 5 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Pipeline test proves persistence, not end-to-end calculation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/__tests__/integration/sugar-pipeline.test.ts:234-241
- **Detail**: Plan says "Prove ingredient data → calculateSugar() → form payload → POST → DB stores correct values." Actual: the test pre-computes sugar via deriveExpected() and sends those values IN the POST payload (line 240: `fermentation_sugar_kg: expected.fermentation_sugar_kg`). So it proves "DB stores what was POSTed" — a persistence roundtrip — not that the calculation pipeline from ingredients is correct. If calculateSugar() broke in the React component, this test still passes.
- **Fix A ⭐ Recommended**: Accept as persistence test and rename/document
  - Strength: Matches what the test actually proves; the client-side calculation is a React concern needing e2e (explicitly out of scope). Existing unit tests in Phase 1 cover calculateSugar() logic.
  - Tradeoff: Plan's stated "full pipeline" coverage shrinks to "route → DB roundtrip". The gap between unit test and integration test (form payload construction) stays untested.
  - Confidence: HIGH — the plan's "What We're NOT Doing" excludes browser/e2e tests, so this was always the ceiling.
  - Blind spot: The parseFloat seam test partially mitigates but only covers the conversion pattern in isolation.
- **Fix B**: Restructure test to omit sugar fields from POST and assert server-side recalculation
  - Strength: Would test the true end-to-end pipeline if the server recalculated from ingredients.
  - Tradeoff: The server route does NOT recalculate — it stores what the client sends. This fix would require architectural changes to the route handler.
  - Confidence: LOW — reading the POST route confirms it persists the received values; there is no server-side calculation.
  - Blind spot: Would require verifying route behavior first.
- **Decision**: PENDING

### F2 — POST batch rejection tests skip no-DB-write assertion

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/__tests__/integration/api-validation.test.ts:107-114
- **Detail**: Plan requires "every test asserts status 400 AND structured error AND no DB write." The PUT tests use assertNoDbWrite, but POST tests intentionally skip it (comment: "race with parallel test files"). A regression that returns 400 while also inserting a row would go undetected.
- **Fix A ⭐ Recommended**: Add assertNoDbWrite with unique batch name filter
  - Strength: Each POST sends a unique name like "Pipeline test: S1". Filter on that name to isolate from parallel writes. Eliminates the race concern while meeting plan requirements.
  - Tradeoff: Relies on batch names being unique per test — if naming convention changes, filter breaks.
  - Confidence: HIGH — batches table has a name column and no concurrent test would use the same sentinel name.
  - Blind spot: None significant.
- **Fix B**: Add a post-request count check filtered by user_id + timestamp
  - Strength: More robust than name-based matching.
  - Tradeoff: Timestamp-based filtering is flaky in fast parallel runs.
  - Confidence: MEDIUM — depends on clock precision.
  - Blind spot: Supabase timestamp resolution unclear.
- **Decision**: PENDING

### F3 — No error recovery after dev server spawn

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/__tests__/integration/globalSetup.ts:108-145
- **Detail**: setup() spawns the dev server at line 108, then provisions user and signs in. If provisioning or sign-in throws, the spawned dev server is never killed — orphaning the process on port 4322 and causing subsequent test runs to fail with EADDRINUSE.
- **Fix**: Wrap lines 130-144 in try/catch; on error, kill the dev server process tree before re-throwing.
- **Decision**: PENDING

### F4 — assertNoDbWrite ignores query errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/__tests__/integration/helpers.ts:137-148
- **Detail**: Both snapshot queries destructure `{ data }` without checking `error`. If the query fails (DB down, table renamed), data is null, the helper uses an empty set, and the assertion vacuously passes — hiding the fact that the DB-write check never ran.
- **Fix**: Add `if (result.error) throw new Error(...)` after each query.
- **Decision**: PENDING

### F5 — Fixture setup ignores Supabase errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/__tests__/integration/api-validation.test.ts:16-38
- **Detail**: Fixture creation casts `data` to `{ id: string }` without checking `error`. If the insert fails (RLS, schema mismatch), subsequent tests receive undefined IDs and fail with opaque errors.
- **Fix**: Check `error` after each insert and throw a clear fixture-setup error before tests run.
- **Decision**: PENDING

### F6 — Separate integration config instead of extending vitest.config.ts

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: vitest.integration.config.ts
- **Detail**: Plan specified updating vitest.config.ts with a globalSetup entry. Implementation created a separate vitest.integration.config.ts and excluded integration tests from the primary config. This is arguably better (unit tests stay fast, integration tests run in isolation) but differs from the written plan.
- **Decision**: PENDING

### F7 — Unplanned production code change (EntryRow.tsx)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/batches/diary/EntryRow.tsx
- **Detail**: Commit 1ecd614 adds `?? ""` fallback for undefined entry_date. Commit message: "handle undefined entry_date to satisfy strict TS checks." Small defensive fix discovered during testing, not in plan. Benign scope addition.
- **Decision**: PENDING
