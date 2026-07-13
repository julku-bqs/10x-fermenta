# Core Business Logic Tests — Plan Brief

> Full plan: `context/changes/testing-core-business-logic/plan.md`
> Research: `context/changes/testing-core-business-logic/research.md`

## What & Why

Delete all 4 untrusted AI-generated test files and rebuild from scratch as table-driven parameterized tests for sugar calculation, batch validation, and process plan generation. These are the first trusted tests in the project — they protect against the top 3 risks in the test plan (wrong math, silent validation failures, wrong process steps).

## Starting Point

4 AI-generated test files exist with partial coverage but specific trust issues: oracle risk (importing production constants as expected values), missing boundary tests, no negative assertions for conditional logic, and inconsistent file locations (2 co-located, 1 in `__tests__/`).

## Desired End State

3 test files in `src/lib/services/__tests__/`, all using `test.each` with named scenarios visible in the runner. Every scenario from the research tables (S1–S8, V1–V12, P1–P17) has a passing test with independently derived expected values. `npx vitest run` exits 0. Pattern documented in test-plan.md §6.1.

## Key Decisions Made

| Decision                  | Choice                                         | Why (1 sentence)                                                                                    | Source   |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Test pattern              | Table-driven `test.each`                       | Named scenarios visible in runner output; research tables map directly to rows                      | Research |
| Expected value derivation | Local domain constants, inline arithmetic      | Prevents oracle problem — tests break when domain changes, not when implementation changes          | Research |
| File location             | `__tests__/` subfolder                         | Clean separation of test/production code, user preference                                           | Research |
| Existing test disposition | Delete + rewrite (via git mv)                  | Rewriting to new pattern anyway; git mv preserves file history                                      | Plan     |
| Phase structure           | Phase 0 sequential + 3 parallel content phases | Relocations share git index (must be sequential); test rewrites are independent pure-function files | Plan     |
| Success criteria          | Automated only                                 | Pure functions with no UI or manual verification surface                                            | Plan     |
| Scenario scope            | Complete (all S/V/P rows)                      | Phase 1 establishes canonical test patterns — incomplete coverage undermines trust                  | Plan     |

## Scope

**In scope:**

- Sugar calculation: all sweetness levels, ingredient edge cases, precision (S1–S8 + rebuilt existing)
- Batch validation: all 9 rules bidirectionally, boundary tests at exact thresholds (V1–V12 + rebuilt)
- Process plan: full 2×2×2 matrix, negative assertions, day offsets (P1–P17)
- File relocation to `__tests__/` with git history preservation (including schema test — relocation only, no rewrite)

**Out of scope:**

- Integration tests — Phase 2 of test plan
- Known formula gaps (residual sugar, volume correction) — tests validate current behavior
- CI gate wiring — Phase 4 of test plan
- Key-based assertions for process plan — pending `expose-step-key` change

## Architecture / Approach

Each test file is self-contained: imports only its target service function, defines local domain constants, and uses a single `test.each` table (or grouped `describe` blocks for validation rules). No shared test utilities, no mocks, no test database. Pure input→output assertions.

## Phases at a Glance

| Phase                            | What it delivers                                                                   | Key risk                                             |
| -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0. File Relocations              | All tests in `__tests__/`, vitest discovery verified                               | None — mechanical; must run before parallel phases   |
| 1. Sugar Calculation Tests       | Complete `test.each` suite with S1–S8 + existing scenarios rebuilt + §6.1 cookbook | Floating-point precision in `toBeCloseTo` tolerance  |
| 2. Batch Validation Tests        | Per-rule `describe` blocks with bidirectional boundary tests V1–V12                | Rule 7 has 4 guard paths — easy to miss a path       |
| 3. Process Plan Generation Tests | 8-quadrant matrix + negative assertions + day offsets P1–P17                       | Substring matching is fragile if descriptions change |

**Prerequisites:** Research complete; vitest configured; services stable (no in-flight refactoring)
**Estimated effort:** Phase 0: ~5 min; Phases 1–3: ~1 session each, can run in parallel after Phase 0

## Open Risks & Assumptions

- Process plan uses `stringContaining` for step matching (pending `expose-step-key` change will enable key-based assertions later)
- Assumes service signatures are stable (post sugar-fields-refactoring)
- If any service has a real bug (not just a test gap), the test will fail — that's a feature, not a risk

## Success Criteria (Summary)

- `npx vitest run` exits 0 with all S/V/P scenario rows passing
- No production constant imports in any test file (oracle-independent)
- Every validation rule tested in both directions (fires + does not fire)
