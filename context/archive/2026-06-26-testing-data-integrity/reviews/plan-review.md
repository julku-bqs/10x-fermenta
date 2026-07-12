<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Data Integrity and Interaction Tests

- **Plan**: context/changes/testing-data-integrity/plan.md
- **Mode**: Deep
- **Date**: 2026-06-27
- **Verdict**: SOUND
- **Findings**: 2 critical, 1 warning, 1 observation — all resolved (initial); 1 warning resolved (re-review)

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | PASS    |

## Grounding

Initial: 9/9 paths verified, 3/3 symbols confirmed, brief↔plan consistent.
Re-review: 7/7 paths verified, astro --port confirmed, Progress↔Phase 5/5 matched.

## Findings (initial review)

### F1 — globalSetup cannot share variables with test files

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — globalSetup.ts + helpers.ts
- **Detail**: Vitest's globalSetup runs in a SEPARATE context from test files — you cannot import shared state from it. The test runner explicitly errors if vitest is imported inside globalSetup. Variables set in globalSetup are invisible to test files unless persisted externally.
- **Fix**: Replaced entire approach — switched from handler imports to HTTP-based testing. globalSetup now starts dev server and writes cookies to `process.env`. No module-level sharing needed.
- **Decision**: FIXED — resolved by switching to Approach B (HTTP to dev server)

### F2 — APIContext requires more than {request, cookies, locals, params}

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — helpers.ts `createAPIContext`
- **Detail**: Astro's APIContext interface requires 16+ properties (url, site, generator, clientAddress, redirect, rewrite, getActionResult, callAction, cache, session, etc.). The plan's contract listed only method/body/params/user. TypeScript compilation would fail.
- **Fix**: Eliminated entirely — HTTP approach calls routes via `fetch()` through the real Astro server. No APIContext construction needed.
- **Decision**: FIXED — resolved by switching to Approach B (HTTP to dev server)

### F3 — POST batch writes to diary_entries; assertNoDbWrite is single-table

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — assertNoDbWrite helper + POST batch rejection scenarios
- **Detail**: POST `/api/batches` has a side effect: on success it calls `generateProcessPlan()` and inserts diary entries (index.ts:42-77). The original `assertNoDbWrite(table, ...)` accepted a single table. Phase 3 rejection tests must verify BOTH `batches` AND `diary_entries` are unchanged after a rejected POST.
- **Fix**: `assertNoDbWrite` now accepts an array of `{ table, filterColumn, filterValue }` objects. Convenience overload for single table retained.
- **Decision**: FIXED — applied Fix A (array of tables)

### F4 — Phase 5 §3 status update is stale

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — Change 2 contract
- **Detail**: Phase 5 said "Change `researched` → `complete`" but the §3 row was already updated to `implementing` by the orchestrator. The contract now correctly references `implementing` → `complete`.
- **Fix**: Updated contract text.
- **Decision**: FIXED

## Findings (re-review)

### F5 — Two stale statements contradict the HTTP approach

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries (line 17) + What We're NOT Doing (line 36)
- **Detail**: Two lines survived from the pre-revision mock-based approach that directly contradicted the HTTP-based implementation approach. Would confuse an implementer reading top-to-bottom.
- **Fix**: Removed stale Key Discovery about importable handlers. Replaced stale "What We're NOT Doing" entry with "Testing Astro's static rendering or build."
- **Decision**: FIXED

## Triage Summary

| Outcome   | Findings               |
| --------- | ---------------------- |
| Fixed     | F1, F2, F3, F4, F5 (5) |
| Skipped   | — (0)                  |
| Accepted  | — (0)                  |
| Dismissed | — (0)                  |

## Architectural Decision Record

During initial triage, the plan's entire testing approach was revised based on F1+F2:

- **Before**: Import Astro route handlers directly, mock `@/lib/supabase` and `astro:env/server`, construct fake `APIContext` objects.
- **After**: Make real HTTP requests to a running `astro dev` server on port 4322. Zero mocks. Full stack tested: Astro routing → middleware (auth + session) → handler → Supabase → DB.
- **Rationale**: The plan's own principle — "verify actual persistence, not mock behavior" — applies equally to the Astro layer. Mocking APIContext and the Supabase module proved mock wiring, not integration. The HTTP approach is simpler (just `fetch()` + cookies), more robust to Astro upgrades, and additionally tests middleware auth guards for free.
