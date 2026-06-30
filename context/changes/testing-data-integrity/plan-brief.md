# Data Integrity and Interaction Tests — Plan Brief

> Full plan: `context/changes/testing-data-integrity/plan.md`
> Research: `context/changes/testing-data-integrity/research.md`

## What & Why

Prove that data flows correctly through the application's three riskiest integrity seams: ingredient→sugar calculation pipeline, API input validation, and sugar field save/reload lifecycle. These are the failure scenarios most likely to corrupt user data silently — and none are covered by existing tests.

## Starting Point

Phase 1 (core business logic) shipped trusted unit tests for `calculateSugar()`, validation warnings, and process plan generation. Schema-level Zod tests exist. No integration tests verify actual DB persistence, route-level validation, or roundtrip fidelity. The API route testing infrastructure does not exist yet.

## Desired End State

Integration tests prove — against a real local Supabase — that (1) sugar values computed from ingredients persist correctly in the DB, (2) all 4 batch mutation routes reject malformed input without writing, and (3) saved sugar values survive the roundtrip through parseFloat→API→DB→reload unchanged. The test-plan cookbook (§6.2) documents the pattern for future contributors.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| DB strategy | Real local Supabase | Mocking proves mock behavior, not persistence correctness | Plan |
| Route scope for Risk #5 | 4 batch routes (POST/PUT batch + diary) | Auth routes have no domain data mutation risk | Plan |
| Test infrastructure approach | HTTP requests to running Astro dev server | Full stack integration with zero mocks — tests middleware, routing, handlers, and DB together | Plan |
| Expected value derivation | Local constants + inline arithmetic | Prevents oracle problem — never import production constants | Research |

## Scope

**In scope:**
- Sugar pipeline end-to-end (ingredients → DB) with 7 scenarios
- API rejection for 4 routes with 15+ malformed payloads
- Save/reload roundtrip for 8 lifecycle scenarios
- §6.2 cookbook update

**Out of scope:**
- Auth route validation (low risk for data corruption)
- Browser-level e2e testing
- Concurrent edit handling
- UI presentation testing

## Architecture / Approach

Route handlers are tested via real HTTP requests to a running Astro dev server on a dedicated test port (4322). No mocking — the full stack runs naturally. A globalSetup starts the server, provisions a test user, signs in to get session cookies. Each test creates its own data via admin client and cleans up after — no shared state between tests.

```
globalSetup: start astro dev :4322 → create user → sign in → store cookies
                                        ↓
Test file → fetch("http://localhost:4322/api/batches", { Cookie: ... })
                                        ↓
                    Astro middleware resolves user from cookie
                                        ↓
                              Route validates (Zod)
                                        ↓
                              Supabase writes to real local DB
                                        ↓
                        Test queries DB directly to verify
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Integration test infrastructure | Helpers, globalSetup, module mock, APIContext factory | Local Supabase not running → clear error needed |
| 2. Risk #4: Sugar pipeline persistence | 7 pipeline scenarios + parseFloat seam tests | Expected values must be independently derived, not oracle-copied |
| 3. Risk #5: API validation rejection | 15+ rejection scenarios across 4 routes | Must verify DB unchanged, not just 400 status |
| 4. Risk #7: Save/reload lifecycle | 8 lifecycle scenarios including partial update | Zod v4 `.default()` could silently zero fields |
| 5. §6 Cookbook update | test-plan.md §6.2 filled in | Must be self-contained for new contributors |

**Prerequisites:** Local Supabase running (`npx supabase start` in WSL), Phase 1 tests passing.
**Estimated effort:** ~2-3 sessions across 5 phases.

## Open Risks & Assumptions

- Local Supabase must be running for integration tests — CI will need a Supabase service container (deferred to Phase 4 of test-plan rollout)
- `astro:env/server` mock may need adjustment if Astro changes the module resolution in future versions
- parseFloat behavior is locale-independent in Node.js (assumed — true for V8)

## Success Criteria (Summary)

- `npx vitest run` passes with all new integration tests
- Every Risk #4/#5/#7 response scenario from test-plan §2 has at least one test proving it
- §6.2 is a complete, self-contained cookbook entry for adding integration tests
