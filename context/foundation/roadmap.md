---
project: "Fermenta"
version: 1
status: draft
created: 2026-05-29
updated: 2026-05-29
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Fermenta

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A home winemaker today juggles paper forms, mental math, and scattered notes — sugar calculations get re-done from scratch, process decisions are forgotten, and there's no single place to check whether the plan is consistent before starting fermentation. Fermenta combines sugar/alcohol calculation, plan validation (yeast tolerance checks), and a structured process diary in one flow designed for the hobbyist winemaker's workflow. It's intentionally simpler than Fermolog: closer to a structured, validated version of the paper form than a community portal.

## North star

**S-02: Ingredients, sugar calculation, and validation warnings** — the smallest slice whose successful delivery proves the core product hypothesis (that combining correct calculation + consistency validation in one tool replaces the paper-form-and-mental-math workflow). The north star — the first end-to-end slice that, if it works, validates the product's reason to exist — is placed as early as Prerequisites allow because everything downstream only matters if the math is correct and trusted.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | batch-schema-with-rls | (foundation) batch/ingredient/process tables + RLS for per-user isolation | — | Access Control, NFR | ready |
| S-01 | batch-crud-and-params | create a batch with parameters and yeast, list their batches | F-01 | US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-007 | proposed |
| S-02 | ingredients-calculation-validation | add ingredients, see calculated sugar needs, see validation warnings | S-01 | US-01, FR-006, FR-008, FR-009 | proposed |
| S-03 | process-plan-generation | receive a generated process plan and edit/add/remove entries | S-01 | US-01, FR-010, FR-011 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Calculation core | `F-01` → `S-01` → `S-02` | Critical path to north star; carries the highest-risk guardrail (calculation correctness). |
| B | Process diary | `S-03` | Parallel with S-02 after S-01 lands; completes the full planning flow. |

## Baseline

What's already in place in the codebase as of 2026-05-29 (auto-researched + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6, React 19, Tailwind 4, shadcn/ui components. Auth pages (signin, signup, confirm-email) and dashboard page built.
- **Backend / API:** partial — Auth endpoints only (signin, signup, signout). No domain-specific API routes.
- **Data:** absent — No migrations, no schema, no tables. Supabase configured for auth only.
- **Auth:** present — Full auth flow: Supabase SSR client (`src/lib/supabase.ts`), middleware with protected routes (`src/middleware.ts`), auth API endpoints, auth pages.
- **Deploy / infra:** present — GitHub Actions CI (`.github/workflows/ci.yml`), Cloudflare Workers deployment (`wrangler.jsonc`), SSR adapter in `astro.config.mjs`.
- **Observability:** absent — No logging, error tracking, or metrics beyond Cloudflare's wrangler observability flag.

## Foundations

### F-01: Batch data schema with RLS

- **Outcome:** (foundation) Database tables for batches, ingredients, and process entries exist with row-level security policies ensuring one user's data is never visible to another.
- **Change ID:** batch-schema-with-rls
- **PRD refs:** Access Control, NFR (one user's batch data never visible to another user)
- **Unlocks:** S-01, S-02, S-03 — all vertical slices write/read these tables; RLS must be verified in isolation before user-facing code is built on top.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every vertical slice depends on these tables and RLS correctness. If RLS policies are wrong, data leaks between users — a hard NFR violation. Independent verification before building on top is the safe path.
- **Status:** ready

## Slices

### S-01: Create and list batches with parameters

- **Outcome:** user can create a new batch (name, date, process type), set parameters (target volume, target ABV, planned sweetness), optionally add yeast (name + alcohol tolerance), and see a list of their batches.
- **Change ID:** batch-crud-and-params
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-007
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Straightforward CRUD with no complex logic; risk is low. Sequenced after F-01 because it needs tables. FR-001/FR-002 (auth) are already present — this slice consumes them, doesn't re-implement them.
- **Status:** proposed

### S-02: Ingredients, sugar calculation, and validation warnings

- **Outcome:** user can add ingredients to a batch (name + amount + sugar content), see calculated sugar needs (for dry wines: missing fermentation sugar; for non-dry wines: separate fermentation and sweetness amounts as editable ingredient entries), and receive validation warnings when the plan is inconsistent (ABV exceeds yeast tolerance; sweetness not dry with tolerance exceeding ABV).
- **Change ID:** ingredients-calculation-validation
- **PRD refs:** US-01, FR-006, FR-008, FR-009
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Contains the highest-risk guardrail: "Sugar calculation must be mathematically correct — wrong math destroys user trust immediately." Calculation correctness must be verified against known test cases before this slice can be considered done.
- **Status:** proposed

### S-03: Process plan generation and editing

- **Outcome:** user can receive a generated process plan based on process type (pulp or juice templates) with parameter-driven steps — including, for non-dry wines, sugar addition, fermentation stop/interruption, and sweetness correction steps — and can edit, add, or remove entries in the plan.
- **Change ID:** process-plan-generation
- **PRD refs:** US-01, FR-010, FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Template logic for two process types with parameter-driven conditional steps requires clear specification. Lower risk than calculation but unclear templates could produce unhelpful defaults that users delete entirely (violates secondary Success Criterion).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | batch-schema-with-rls | Set up batch/ingredient/process schema with RLS | yes | Run `/10x-plan batch-schema-with-rls` |
| S-01 | batch-crud-and-params | Batch creation form, parameters, and list page | no | Needs F-01 |
| S-02 | ingredients-calculation-validation | Ingredient management with sugar calculation and validation | no | Needs S-01; north star slice |
| S-03 | process-plan-generation | Process plan generation and editing | no | Needs S-01; parallel with S-02 |

## Open Roadmap Questions

(None — PRD has 0 open questions and no cross-cutting unknowns surfaced during roadmap generation.)

## Parked

- **Reference database for ingredients/yeast** — Why parked: PRD §Non-Goals; v2 convenience feature, not core value. Users provide sugar content manually in MVP.
- **Batch comparison or statistics** — Why parked: PRD §Non-Goals; MVP serves one batch at a time; cross-batch analysis is future scope.
- **Sharing between users** — Why parked: PRD §Non-Goals; MVP is single-user-focused; social features out of scope.
- **"Final result" recording** — Why parked: PRD §Non-Goals; a diary entry serves this purpose for now; dedicated capture deferred to v2.
- **Offline support** — Why parked: PRD §Non-Goals; app requires connectivity; not an MVP target.

## Done

(Empty on first generation. Entries appended here when a change is archived.)
