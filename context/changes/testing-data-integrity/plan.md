# Data Integrity and Interaction Tests — Implementation Plan

## Overview

Phase 2 of the test-plan rollout: prove that data flows correctly through the application's critical paths — ingredient→calculation pipeline (Risk #4), API input validation (Risk #5), and sugar field save/cancel/reload lifecycle (Risk #7). Tests use unit + integration layers against a real local Supabase instance to verify actual persistence, not mocking behavior.

## Current State Analysis

Phase 1 (core business logic) is complete — 18 scenarios for `calculateSugar()`, boundary tests for validation warnings, process plan generation tests. Schema-level unit tests exist in `src/lib/schemas/__tests__/batch.test.ts` covering Zod parse behavior. No integration tests exist that verify:
- Persistence fidelity (does what the route accepts actually persist correctly?)
- Validation at the route level (is the schema applied before DB write?)
- Roundtrip correctness (save value === reload value through string↔number conversion)

### Key Discoveries:

- `src/lib/supabase.ts:3` — imports from `astro:env/server`; integration tests bypass this by hitting the full HTTP stack rather than importing handlers directly
- `parseFloat(form.sugar) || 0` at `BatchForm.tsx:170-171` — the string→number seam that could corrupt edge inputs
- `updateBatchSchema` explicitly uses `.optional()` without `.default()` to prevent Zod v4 from zeroing omitted fields on PUT (batch.ts:28-38)
- Cancel is navigation to `/batches`, not form reset — "last-saved values" means "what DB returns on next page load"

## Desired End State

After this plan completes:
1. A test file proves the full ingredient→sugar pipeline persists independently-derived expected kg values in the database
2. Integration tests prove all 4 batch mutation routes (POST/PUT batch, POST/PUT diary) reject malformed input with 400 + structured details and leave DB unchanged
3. Integration tests prove save roundtrip fidelity (value at save === value on reload) for both calculated and manually-entered sugar values, and that unsaved edits are not persisted
4. `test-plan.md` §6.2 documents the integration test pattern as a reusable cookbook entry
5. All tests pass: `npx vitest run`

## What We're NOT Doing

- **Auth route validation testing** — signin/signup schemas are simple string/email validators with no domain data mutation risk
- **E2e browser tests** — lifecycle semantics are verifiable at the API/data layer without a browser
- **Mocking any layer** — tests hit the full stack via HTTP; no mocks for Supabase, Astro internals, or middleware
- **Testing Astro's static rendering or build** — only API routes under `/api/` are exercised; SSR page rendering is not our concern
- **Concurrent edit protection** — explicitly out of scope (test-plan §7)

## Implementation Approach

Integration tests make real HTTP requests to a running Astro dev server pointing at local Supabase (`127.0.0.1:54321`). Zero mocking — the full stack runs: Astro routing → middleware (auth + session) → route handler → Supabase → DB. A `globalSetup` starts the dev server on a dedicated test port, creates a test user, and obtains session cookies. Per-suite `beforeEach`/`afterEach` handles data cleanup via admin Supabase client.

Test files live at `src/__tests__/integration/` to signal the different testing layer.

## Critical Implementation Details

**Timing & lifecycle** — `globalSetup` starts `astro dev --port 4322` and waits for the server to respond to a health check before returning. It also provisions the test user and signs in via `POST /api/auth/signin` to obtain session cookies. Credentials are persisted to `process.env` for the test context. `teardown()` stops the dev server. If local Supabase is not running, the server will fail to start — globalSetup should detect this and fail with a clear error message.

**State sequencing** — each integration test must create its own batch/diary via the admin Supabase client (not through API endpoints) for isolation, then clean up in `afterEach`. Tests that verify "no write occurred" must query the DB *after* the rejected request and assert row count unchanged — timing is synchronous since fetch calls are awaited.

---

## Phase 1: Integration Test Infrastructure

### Overview

Establish reusable infrastructure for HTTP-based integration tests against a running Astro dev server with local Supabase. This phase produces zero business-logic tests but unlocks all subsequent phases.

### Changes Required:

#### 1. Vitest global setup — server lifecycle + test user

**File**: `src/__tests__/integration/globalSetup.ts`

**Intent**: Start the Astro dev server on a dedicated test port, provision a test user in local Supabase Auth, sign in to obtain session cookies, and persist credentials for the test context.

**Contract**: Exports `setup()` and `teardown()` functions:
- `setup()`: Spawns `astro dev --port 4322` as a child process, waits for HTTP readiness (poll `GET http://localhost:4322/` until 200 or timeout after 30s). Creates test user via admin Supabase client (`auth.admin.createUser`). Signs in via `fetch("http://localhost:4322/api/auth/signin", { method: "POST", body: { email, password } })` and captures `Set-Cookie` header. Writes `TEST_COOKIES`, `TEST_USER_ID`, and `TEST_BASE_URL` to `process.env`.
- `teardown()`: Kills the dev server child process.

#### 2. Test helper module — HTTP client + admin Supabase client

**File**: `src/__tests__/integration/helpers.ts`

**Intent**: Provide factory functions for making authenticated API requests and for direct DB operations (setup/teardown/verification).

**Contract**:
- `getAdminClient()` → `SupabaseClient` with service role key (for data setup/teardown/verification)
- `apiRequest(path: string, options?: { method?, body?, cookies? })` → `fetch()` wrapper that prepends `TEST_BASE_URL`, injects `TEST_COOKIES` header, sets `Content-Type: application/json`, and returns the Response
- `apiRequestUnauthenticated(path, options)` → same but without cookies (for testing auth guard)
- Constants: `TEST_PORT = 4322`, local Supabase URL/keys read from env

#### 3. Vitest config extension for integration tests

**File**: `vitest.config.ts` (update)

**Intent**: Add a `globalSetup` entry pointing to the integration setup file.

**Contract**: `test.globalSetup` array includes `src/__tests__/integration/globalSetup.ts`. No module mocks, no setupFiles, no alias overrides needed — the HTTP approach requires no Astro internals.

#### 4. Environment file for test Supabase credentials

**File**: `.env.test` (or reuse existing `.env` for local dev)

**Intent**: Ensure the Astro dev server started by globalSetup connects to local Supabase.

**Contract**: Contains `SUPABASE_URL=http://127.0.0.1:54321` and `SUPABASE_KEY=<local anon key>`. The globalSetup spawns the dev server with `--mode test` or passes env vars to the child process. If the project already uses `.env` for local dev pointing at local Supabase, this file may be unnecessary — verify during implementation.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/__tests__/integration/` executes without errors (even with 0 test cases)
- globalSetup starts dev server, provisions test user, obtains cookies, and tears down cleanly
- `apiRequest("/api/batches")` returns 200 with authenticated cookies (proves full stack works)
- `apiRequestUnauthenticated("/api/batches")` returns redirect/401 (proves middleware guard works)

#### Manual Verification:

- Confirm `npx supabase start` (in WSL) is running and accessible from Windows at `127.0.0.1:54321`

---

## Phase 2: Risk #4 — Sugar Pipeline Persistence

### Overview

Prove that given ingredients with known sugar content, the full pipeline (aggregation in grams via ×10 → formula via ×17 → ÷1000 to kg → persisted fields) produces independently derived expected values in the database. Challenges the assumption that "if the formula unit test passes, the full pipeline is correct."

**Behavior asserted**: Ingredient data → `calculateSugar()` → form payload construction (parseFloat) → POST/PUT route → DB stores correct `fermentation_sugar_kg` and `sweetness_sugar_kg`.

**Regression caught**: Aggregation rounding errors, ×10 factor omission, ÷1000 applied twice or not at all, parseFloat corrupting precision.

**Research source**: `research.md` §Risk #4 — 5-stage pipeline, dual call sites, parseFloat seam, unit conversion map.

**Edge/error/boundary cases**: Zero ingredients (0 sugar → formula uses full ABV need), single ingredient with null sugar_content_percent (treated as 0), multiple ingredients where sum exceeds ABV need (fermentation_sugar_kg clamped to 0), very small sugar values (0.001 kg precision), ingredients with max values (100L × 100% = 100,000g).

**Anti-pattern avoided**: Testing only `calculateSugar()` in isolation (Phase 1 already does that) — this phase tests the data flow from ingredients through to persisted values, including the parseFloat seam.

### Changes Required:

#### 1. Pipeline integration test file

**File**: `src/__tests__/integration/sugar-pipeline.test.ts`

**Intent**: Table-driven integration tests that create a batch via the POST route with specific ingredients, then query the DB to verify stored `fermentation_sugar_kg` and `sweetness_sugar_kg` match independently calculated expected values.

**Contract**: Uses `it.each` with scenarios structured as:
```typescript
type PipelineScenario = [
  name: string,
  input: { target_volume_liters, target_abv, planned_sweetness, ingredients[] },
  expected: { fermentation_sugar_kg: number, sweetness_sugar_kg: number }
];
```

Expected values are derived inline using local domain constants (×10, ×17, ÷1000) — never imported from production code. Uses `toBeCloseTo(value, 6)` for floating-point comparison.

Scenarios must include:
- S1: Single ingredient, dry wine — verifies basic aggregation + formula
- S2: Multiple ingredients, various sugar contents — verifies summation across array
- S3: Null sugar_content_percent on some ingredients — verifies null→0 treatment
- S4: Ingredients supply more sugar than ABV needs — verifies `Math.max(0, ...)` clamp
- S5: Semi-sweet wine — verifies sweetness_sugar_kg path (midpoint × volume ÷ 1000)
- S6: Very small values (0.5L × 0.1%) — verifies precision through pipeline
- S7: Large values (100L × 100% sugar) — verifies no overflow/truncation

Each scenario: POST batch via `apiRequest("/api/batches", { method: "POST", body: payload })` → query DB via admin client → assert stored kg matches expected.

#### 2. ParseFloat seam unit test

**File**: `src/__tests__/integration/sugar-pipeline.test.ts` (additional describe block)

**Intent**: Verify that the string→number conversion pattern used by BatchForm (`parseFloat(value) || 0`) preserves values for edge inputs that real users might produce.

**Contract**: Pure unit test (no DB) that exercises `parseFloat(x) || 0` against edge strings: `"0.001"`, `"00.5"`, `"0"`, `""`, `" "`, `"1.23456789"`, `"1e-3"`. Asserts the conversion produces the expected number. This documents the seam's behavior, not tests the built-in — it catches if a future refactor introduces a different parser.

### Success Criteria:

#### Automated Verification:

- All pipeline scenarios pass: `npx vitest run src/__tests__/integration/sugar-pipeline.test.ts`
- No test imports production constants from `sugar-calculation.ts`
- Expected values in test file are independently derived (reviewable arithmetic in comments)

#### Manual Verification:

- Review scenario expected values against manual calculation to confirm they're not copied from implementation output

---

## Phase 3: Risk #5 — API Validation Rejection

### Overview

Prove that all 4 batch mutation routes (POST batch, PUT batch, POST diary, PUT diary) reject malformed input with HTTP 400 + structured `{ error, details }` response AND do not write to the database.

**Behavior asserted**: Malformed payload → route returns 400 with field-level error details → DB state unchanged.

**Regression caught**: Schema not applied to route (handler processes raw body), schema covers wrong fields, `jsonValidationError` format changes, validation bypass via extra/unknown fields.

**Research source**: `research.md` §Risk #5 — 6 routes with Zod, consistent safeParse+early-return pattern, error response shape from `api.ts:24-32`, key schema constraints, Zod v4 `.partial()` concern.

**Edge/error/boundary cases**: Missing required fields, out-of-range numbers (negative sugar, ABV > 100), wrong enum values ("sparkling" instead of "pulp"/"juice"), extra unknown fields (should be stripped/ignored), completely invalid JSON body, empty object where fields are required, nested ingredient array with one invalid item.

**Anti-pattern avoided**: Testing only that the endpoint returns 200 on valid input (happy-path-only). Every test in this phase sends INVALID input and asserts rejection.

### Changes Required:

#### 1. Batch route validation test file

**File**: `src/__tests__/integration/api-validation.test.ts`

**Intent**: For each of the 4 routes, send multiple malformed payloads and assert: (a) HTTP 400 response, (b) response body contains `{ error: "Validation failed", details: {...} }` with relevant field paths, (c) DB row count for the relevant table is unchanged after the request.

**Contract**: Structured as 4 `describe` blocks (one per route), each with `it.each` scenarios:

```typescript
type RejectionScenario = [
  name: string,
  payload: unknown,
  expectedDetailPaths: string[] // e.g., ["name", "process_type"]
];
```

**POST `/api/batches`** scenarios:
- Missing `name` (required field)
- Missing `process_type` (required enum field)
- Invalid `process_type` value ("sparkling")
- Negative `fermentation_sugar_kg` (-1)
- `target_abv` above 100
- Ingredient with empty name (nested array validation)
- Ingredient with `sugar_content_percent` above 100
- Invalid JSON body (not parseable)
- Empty object `{}`

**PUT `/api/batches/[id]`** scenarios:
- Negative `fermentation_sugar_kg`
- Invalid `planned_sweetness` enum
- Ingredient with negative `amount_liters`
- `target_volume_liters` of 0 (must be positive)

**POST `/api/batches/[id]/diary`** scenarios:
- Missing `description` (required)
- Empty string `description`
- Invalid `entry_date` format ("not-a-date")

**PUT `/api/batches/[id]/diary/[entryId]`** scenarios:
- Invalid `entry_date` format
- Empty description when explicitly provided (partial update schema allows omitting but not empty)

For PUT routes: test setup creates a batch (and diary entry) via admin client first.

#### 2. DB-unchanged assertion helper

**File**: `src/__tests__/integration/helpers.ts` (addition)

**Intent**: Add a helper that counts rows in one or more tables before/after a route call and asserts no change. Accepts an array of tables to support routes with side effects (e.g., POST batch also writes diary_entries).

**Contract**: `assertNoDbWrite(tables: Array<{ table: string, filterColumn: string, filterValue: string }>, action: () => Promise<Response>)` — queries count for each table before, runs action, queries count for each table after, asserts all equal. Convenience overload for single table: `assertNoDbWrite(table, filterColumn, filterValue, action)`.

### Success Criteria:

#### Automated Verification:

- All rejection scenarios pass: `npx vitest run src/__tests__/integration/api-validation.test.ts`
- Every test asserts status 400 AND structured error shape AND no DB write
- No test sends valid input (this file is rejection-only)

#### Manual Verification:

- Review that every schema constraint documented in `research.md` (min, max, enum, required) has at least one rejection scenario

---

## Phase 4: Risk #7 — Sugar Field Save/Reload Lifecycle

### Overview

Prove save roundtrip (form value at save time === API response === reload value), cancel-then-reload shows last-saved value, and manual-edit save works identically to calculate-save.

**Behavior asserted**: (1) PUT with sugar value → response contains same value → GET returns same value. (2) Two sequential PUTs → GET returns second value only. (3) parseFloat edge inputs survive roundtrip. (4) Partial PUT without sugar fields does NOT zero them (Zod v4 `.default()` protection).

**Regression caught**: parseFloat corruption, Zod v4 `.default()` re-applying 0 on partial update, string→number precision loss, implicit coercion to 0 for unusual inputs.

**Research source**: `research.md` §Risk #7 — form stores strings, `parseFloat() || 0` on submit, `updateBatchSchema` Zod v4 concern, cancel = navigation (no explicit restore), response = fresh DB row.

**Edge/error/boundary cases**: `0.001` (precision), `0` (falsy but valid), large value `999.999`, partial PUT omitting sugar fields (must NOT reset to 0), sequential saves with different values.

**Anti-pattern avoided**: Testing only Calculate→Save without manual-edit→Save. Since manual and calculated values are indistinguishable in form state (both are just numbers by save time), the integration test covers this by testing various numeric values including non-round numbers that a user would type manually.

### Changes Required:

#### 1. Lifecycle integration test file

**File**: `src/__tests__/integration/sugar-lifecycle.test.ts`

**Intent**: Test the save/reload contract at the API layer: PUT sugar values → GET them back → assert equality. Also test the "cancel" semantic by verifying that a subsequent GET without PUT returns the last-saved values.

**Contract**: Scenarios:

```typescript
type LifecycleScenario = [name: string, sugarValues: { fermentation_sugar_kg: number, sweetness_sugar_kg: number }];
```

**Roundtrip scenarios** (PUT then GET, assert values match):
- L1: Standard calculated values (2.55, 0.3)
- L2: Zero values (0, 0) — falsy but valid
- L3: Very small values (0.001, 0.0005) — precision test
- L4: Large values (999.999, 50.123) — no truncation
- L5: Manually-typed-style values (1.5, 0) — non-round fermentation, zero sweetness

**Partial update protection** (PUT without sugar fields, assert sugar unchanged):
- L6: Create batch with sugar (2.5, 0.3) → PUT `{ name: "Updated" }` (no sugar fields) → GET → assert sugar still (2.5, 0.3)

**Sequential save** (simulates cancel semantic):
- L7: PUT sugar (1.0, 0.5) → PUT sugar (2.0, 1.0) → GET → assert (2.0, 1.0) — last save wins
- L8: PUT sugar (1.0, 0.5) → no second PUT → GET → assert (1.0, 0.5) — "cancel" = no PUT means DB unchanged

Each test creates a fresh batch via admin client, performs PUT via `apiRequest("/api/batches/${id}", { method: "PUT", body })`, verifies via direct DB query (admin client).

### Success Criteria:

#### Automated Verification:

- All lifecycle scenarios pass: `npx vitest run src/__tests__/integration/sugar-lifecycle.test.ts`
- Partial update test (L6) confirms Zod v4 `.default()` protection works at runtime
- Precision tests use `toBeCloseTo(value, 6)` for float comparison

#### Manual Verification:

- Verify that test expectations are independently derived (not copied from a PUT response)

---

## Phase 5: §6 Cookbook Update

### Overview

Update `context/foundation/test-plan.md` §6.2 with the integration test patterns established in Phases 1–4. This makes the pattern discoverable for future contributors adding integration tests.

**Behavior asserted**: n/a — documentation phase.

**Regression caught**: n/a — prevents future test authors from reinventing infrastructure.

**Research source**: Patterns shipped in Phases 1–4.

**Anti-pattern avoided**: Leaving §6.2 as "TBD" after the work is done.

### Changes Required:

#### 1. Update test-plan.md §6.2

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the "TBD — see §3 Phase 2" placeholder in §6.2 with the canonical pattern for integration tests: file location, naming convention, helper usage, scenario structure, run command, and reference test file.

**Contract**: Section content mirrors the structure of §6.1 (location, naming, pattern, rules, run command, reference test). Covers: HTTP request via `apiRequest` helper, `assertNoDbWrite` usage, table-driven scenarios, cleanup rules, and globalSetup server lifecycle.

#### 2. Update test-plan.md §3 status

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 2 row in the §3 table as `complete` once all tests pass.

**Contract**: Change `implementing` → `complete` in the Status column for row 2. Add change folder path.

### Success Criteria:

#### Automated Verification:

- Full test suite passes: `npx vitest run`
- Lint passes on updated markdown: `npx prettier --check context/foundation/test-plan.md`

#### Manual Verification:

- §6.2 content is sufficient for a new contributor to add an integration test without reading Phase 1–4 source code

---

## Testing Strategy

### Unit Tests:

- ParseFloat seam behavior for edge string inputs (Phase 2)
- Aggregation arithmetic with independently derived expectations (Phase 2)

### Integration Tests:

- Full sugar pipeline: ingredients → calculateSugar → route → DB → verify (Phase 2)
- Route rejection: malformed input → 400 + no DB write for 4 routes (Phase 3)
- Save roundtrip: PUT → GET equivalence for various sugar values (Phase 4)
- Partial update protection: PUT without sugar → sugar unchanged (Phase 4)

### Manual Testing Steps:

1. Verify local Supabase is accessible before running tests
2. Review expected values in pipeline tests against manual calculation
3. Confirm §6.2 cookbook is self-contained for a new contributor

## Performance Considerations

Integration tests hit a real local DB — each test creates/deletes data. Keep scenarios focused (7–9 per risk) to maintain fast feedback. No test shares state with another; parallel vitest workers safe because each creates uniquely-named batches.

## References

- Research: `context/changes/testing-data-integrity/research.md`
- Phase 1 tests (pattern reference): `src/lib/services/__tests__/sugar-calculation.test.ts`
- Schema tests: `src/lib/schemas/__tests__/batch.test.ts`
- Sugar calculation service: `src/lib/services/sugar-calculation.ts`
- API route (POST batch): `src/pages/api/batches/index.ts`
- API route (PUT batch): `src/pages/api/batches/[id]/index.ts`
- Test-plan: `context/foundation/test-plan.md` §2 (risks #4, #5, #7), §3 (Phase 2 row), §6.2

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Integration Test Infrastructure

#### Automated

- [x] 1.1 vitest integration test folder runs without errors — f6de31a
- [x] 1.2 globalSetup starts dev server and provisions test user — f6de31a
- [x] 1.3 Authenticated request returns 200 (full stack works) — f6de31a
- [x] 1.4 Unauthenticated request is rejected (middleware guard works) — f6de31a

#### Manual

- [x] 1.5 Confirm local Supabase accessible from Windows at 127.0.0.1:54321 — f6de31a

### Phase 2: Risk #4 — Sugar Pipeline Persistence

#### Automated

- [x] 2.1 All pipeline scenarios pass — 8b67e58
- [x] 2.2 No test imports production constants — 8b67e58
- [x] 2.3 Expected values independently derived — 8b67e58

#### Manual

- [x] 2.4 Review scenario expected values against manual calculation — 8b67e58

### Phase 3: Risk #5 — API Validation Rejection

#### Automated

- [x] 3.1 All rejection scenarios pass
- [x] 3.2 Every test asserts 400 + structured error + no DB write
- [x] 3.3 No test sends valid input

#### Manual

- [ ] 3.4 Review schema constraint coverage against research.md

### Phase 4: Risk #7 — Sugar Field Save/Reload Lifecycle

#### Automated

- [ ] 4.1 All lifecycle scenarios pass
- [ ] 4.2 Partial update test confirms Zod v4 protection
- [ ] 4.3 Precision tests use toBeCloseTo

#### Manual

- [ ] 4.4 Verify expectations independently derived

### Phase 5: §6 Cookbook Update

#### Automated

- [ ] 5.1 Full test suite passes (npx vitest run)
- [ ] 5.2 Lint passes on updated markdown

#### Manual

- [ ] 5.3 §6.2 self-contained for new contributor
