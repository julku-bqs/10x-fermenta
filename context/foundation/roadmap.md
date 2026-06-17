---
project: "Fermenta"
version: 1
status: draft
created: 2026-05-29
updated: 2026-06-17
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
| F-01 | batch-schema-with-rls | (foundation) batch/ingredient/process tables + RLS for per-user isolation | — | Access Control, NFR | done |
| S-01 | batch-crud-and-params | create a batch with parameters and yeast, list their batches | F-01 | US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-007 | done |
| S-02 | ingredients-calculation-validation | add ingredients, see calculated sugar needs, see validation warnings | S-01 | US-01, FR-006, FR-008, FR-009 | done |
| S-03 | process-plan-generation | receive a generated process plan and edit/add/remove entries | S-01 | US-01, FR-010, FR-011 | done |
| S-04 | visual-identity | experience a consistent, modern UI tailored to the home winery context | S-01 | NFR | done |
| S-05 | batch-delete-duplicate | delete a batch or duplicate it as a new batch with clean diary | S-02 | FR-001 | proposed |
| S-06 | batch-list-actions | access delete and duplicate actions directly from the batch list | S-05 | FR-001 | proposed |
| S-07 | ingredients-drag-reorder | reorder ingredients via drag & drop | S-02 | FR-006 | proposed |
| S-08 | regenerate-dirty-guard | see Regenerate Plan disabled when form has unsaved changes | S-03 | FR-010 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Calculation core | `F-01` → `S-01` → `S-02` | Critical path to north star; carries the highest-risk guardrail (calculation correctness). |
| B | Process diary | `S-03` | Parallel with S-02 after S-01 lands; completes the full planning flow. |
| C | Visual identity | `S-04` | Independent of A/B; establishes the design language. Once landed, existing S-01 pages are restyled to match. |
| D | Batch management | `S-05` → `S-06` | Delete/duplicate logic first, then surface in list. Can start after S-02. |
| E | UX polish | `S-07`, `S-08` | Independent of each other. S-07 starts after S-02; S-08 after S-03. |

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
- **Status:** done

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
- **Status:** done

### S-02: Ingredients, sugar calculation, and validation warnings

- **Outcome:** user can add ingredients to a batch (name + amount + sugar content), see calculated sugar needs (for dry wines: missing fermentation sugar; for non-dry wines: separate fermentation and sweetness amounts as editable ingredient entries), and receive validation warnings when the plan is inconsistent (ABV exceeds yeast tolerance; sweetness not dry with tolerance exceeding ABV).
- **Change ID:** ingredients-calculation-validation
- **PRD refs:** US-01, FR-006, FR-008, FR-009
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Contains the highest-risk guardrail: "Sugar calculation must be mathematically correct — wrong math destroys user trust immediately." Calculation correctness must be verified against known test cases before this slice can be considered done.
- **Status:** done

### S-03: Process plan generation and editing

- **Outcome:** user can receive a generated process plan based on process type (pulp or juice templates) with parameter-driven steps — including, for non-dry wines, sugar addition, fermentation stop/interruption, and sweetness correction steps — and can edit, add, or remove entries in the plan.
- **Change ID:** process-plan-generation
- **PRD refs:** US-01, FR-010, FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Template logic for two process types with parameter-driven conditional steps requires clear specification. Lower risk than calculation but unclear templates could produce unhelpful defaults that users delete entirely (violates secondary Success Criterion).
- **Status:** done

### S-04: Visual identity and design system

- **Outcome:** The application has a consistent, modern visual identity tailored to the home winery community — cohesive color palette, typography, layout structure (topbar, content area), and component styling. All existing pages (auth, batch list, batch form, batch detail) are restyled to the new design. The design system is documented enough (via Tailwind theme tokens and component patterns) that future slices inherit it automatically.
- **Change ID:** visual-identity
- **PRD refs:** NFR (every field and output is editable or optional — UI must convey editability clearly), User & Persona (less technical hobbyist — warm, approachable, not clinical)
- **Prerequisites:** S-01 (pages to restyle must exist)
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** Exact color palette, typography choices, and layout details to be defined during `/10x-plan` session. User wants a modern look — specifics are open for design discussion.
- **Risk:** Medium — purely UI work with no data-layer risk, but scope can creep if not bounded. Plan should define a finite set of pages/components to restyle and a "done" checklist. If S-02 or S-03 land before S-04, their pages will need a restyle pass (acceptable since S-04 is independent).
- **Status:** done

### S-05: Delete and duplicate a batch

- **Outcome:** user can delete a batch (with confirmation) from the batch detail page, and duplicate a batch — creating a copy with a new name/date, same parameters and ingredients, but a freshly generated diary (like a new batch).
- **Change ID:** batch-delete-duplicate
- **PRD refs:** FR-001 (batch lifecycle management)
- **Prerequisites:** S-02 (ingredients must exist to copy correctly)
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — straightforward API work (DELETE endpoint + POST clone). Confirmation UX prevents accidental loss. Cascading delete of diary entries handled by DB foreign keys.
- **Status:** proposed

### S-06: Batch list action buttons

- **Outcome:** batch cards in the list view expose contextual action buttons (delete, duplicate) so users don't need to navigate into the detail page for quick operations.
- **Change ID:** batch-list-actions
- **PRD refs:** FR-001 (batch lifecycle management)
- **Prerequisites:** S-05 (delete/duplicate logic and API must exist)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — purely UI work consuming existing APIs. Needs careful touch-target sizing and confirmation pattern on mobile.
- **Status:** proposed

### S-07: Ingredients drag & drop reordering

- **Outcome:** user can reorder ingredients via drag & drop in the ingredients section. Order is persisted in the JSONB array position on save.
- **Change ID:** ingredients-drag-reorder
- **PRD refs:** FR-006 (ingredient management UX)
- **Prerequisites:** S-02 (ingredients section must exist)
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** Choice of drag & drop library (e.g., @dnd-kit or pragmatic-drag-and-drop). Decide during `/10x-plan`.
- **Risk:** Low-medium — drag & drop in React requires accessibility considerations (keyboard reorder fallback). Ingredients are JSONB array, so reorder is just array splice + save.
- **Status:** proposed

### S-08: Regenerate plan dirty guard

- **Outcome:** the "Regenerate Plan" button is disabled when the batch form has unsaved changes, with a tooltip explaining the user must save first. Prevents regeneration against stale persisted state.
- **Change ID:** regenerate-dirty-guard
- **PRD refs:** FR-010 (process plan generation correctness)
- **Prerequisites:** S-03 (diary/regenerate feature must exist)
- **Parallel with:** S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — small UX guard. Requires threading `isDirty` from BatchForm down to DiarySection.
- **Status:** proposed

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | batch-schema-with-rls | Set up batch/ingredient/process schema with RLS | done | — |
| S-01 | batch-crud-and-params | Batch creation form, parameters, and list page | done | — |
| S-02 | ingredients-calculation-validation | Ingredient management with sugar calculation and validation | done | — |
| S-03 | process-plan-generation | Process plan generation and editing | done | — |
| S-04 | visual-identity | Visual identity and design system for home winery context | done | — |
| S-05 | batch-delete-duplicate | Batch delete and duplicate functionality | no | Run `/10x-new batch-delete-duplicate` first |
| S-06 | batch-list-actions | Batch list action buttons (delete, duplicate) | no | Blocked on S-05 |
| S-07 | ingredients-drag-reorder | Drag & drop ingredient reordering | no | Run `/10x-new ingredients-drag-reorder` first |
| S-08 | regenerate-dirty-guard | Disable Regenerate when form is dirty | yes | Change initialized; run `/10x-plan regenerate-dirty-guard` |

## Open Roadmap Questions

(None — PRD has 0 open questions and no cross-cutting unknowns surfaced during roadmap generation.)

## Parked

- **Reference database for ingredients/yeast** — Why parked: PRD §Non-Goals; v2 convenience feature, not core value. Users provide sugar content manually in MVP.
- **Batch comparison or statistics** — Why parked: PRD §Non-Goals; MVP serves one batch at a time; cross-batch analysis is future scope.
- **Sharing between users** — Why parked: PRD §Non-Goals; MVP is single-user-focused; social features out of scope.
- **"Final result" recording** — Why parked: PRD §Non-Goals; a diary entry serves this purpose for now; dedicated capture deferred to v2.
- **Offline support** — Why parked: PRD §Non-Goals; app requires connectivity; not an MVP target.

## Done

- **F-01** (`batch-schema-with-rls`) — Implemented 2026-05-30. Migration `20260530213000_batch_schema_with_rls.sql` live.
- **S-01** (`batch-crud-and-params`) — Implemented 2026-06-01. Batch list, creation form with params/yeast, detail page operational.
- **S-04** (`visual-identity`) — Implemented 2026-06-02. Warm winery design system, AppLayout with floating topbar, ingredient card inline-edit pattern. Merged as #8.
- **S-02** (`ingredients-calculation-validation`) — Implemented 2026-06-08. Ingredient management, sugar calculation (fermentation + sweetness), 9-rule validation engine, atomic save. PR #15. 57 tests.
- **S-03** (`process-plan-generation`) — Implemented. Process plan generation from templates (pulp/juice) with parameter-driven steps, inline editing, add/remove entries.
