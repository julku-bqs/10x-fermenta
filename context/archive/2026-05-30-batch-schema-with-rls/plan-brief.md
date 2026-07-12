# Batch Data Schema with RLS — Plan Brief

> Full plan: `context/changes/batch-schema-with-rls/plan.md`

## What & Why

Create the foundational database tables (batches, ingredients, diary_entries) with Row-Level Security for Fermenta's batch planning domain. Every vertical slice (S-01 through S-03) depends on these tables existing with correct RLS — this must be verified in isolation before user-facing code is built on top.

## Starting Point

Empty public schema. Supabase is configured for auth only — the SSR client and middleware work, but no domain tables or migrations exist. The `supabase/migrations/` directory is freshly created.

## Desired End State

Three tables with enums, indexes, and RLS policies exist in the public schema. Any authenticated user can CRUD their own batches, ingredients, and diary entries — but cannot see or modify another user's data. Verified by direct SQL queries proving cross-user isolation.

## Key Decisions Made

| Decision                 | Choice                                                          | Why (1 sentence)                                                                                          |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Yeast modeling           | Nullable columns on batch table                                 | Simplest approach matching the common single-yeast case; extensible to catalog FK in v2.                  |
| Sweetness representation | Postgres enum (dry, semi_dry, semi_sweet, sweet)                | Covers standard winemaking levels needed for calculation branching logic.                                 |
| Ingredient type model    | Technical enum: user_input, fermentation_sugar, sweetness_sugar | Not user-facing; user enters ingredients freely, only auto-generated sugar entries carry technical types. |
| Primary keys             | UUIDv4 (gen_random_uuid) + created_at for ordering              | Zero custom code; standard Supabase pattern; UUIDv7 adds complexity with marginal benefit at MVP scale.   |
| Process entry ordering   | Integer sort_order column                                       | Simple, allows reordering via UPDATE without linked-list complexity.                                      |
| RLS granularity          | Single ALL policy per table                                     | Minimal SQL for MVP flat-user model; trivial to split into per-operation later.                           |
| Deployment method        | Supabase MCP + local migration file                             | Immediate verification + git-tracked migration for CI/CD.                                                 |
| Verification approach    | SQL-based isolation proof + security advisors                   | Directly proves the NFR ("one user's data never visible to another").                                     |

## Scope

**In scope:**

- `batches` table with params, yeast columns, timestamps
- `ingredients` table with type enum (user_input, fermentation_sugar, sweetness_sugar), sugar_content, unit, sort_order
- `diary_entries` table with description, sort_order (the user's working diary; pre-populated by process generation in S-03, freely editable)
- Postgres enums: process_type, sweetness_level, ingredient_type
- RLS enabled + ALL policy on each table
- Indexes for user_id and batch_id lookups
- FK cascade (batch deletion cascades to children)

**Out of scope:**

- API routes (S-01)
- TypeScript types or client code
- Seed data
- Reference/catalog tables (v2)
- Triggers, stored procedures, or calculation logic (S-02)
- Per-operation RLS policies (deferred until needed)

## Architecture / Approach

Single atomic migration containing: enum definitions → table creation → RLS enable → policy creation → index creation. Applied to the linked Supabase project via MCP tool and verified with targeted SQL queries. The migration file is also saved locally at `supabase/migrations/` for git tracking and CI.

## Phases at a Glance

| Phase               | What it delivers                                        | Key risk                                                                         |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Schema Migration | Tables, enums, RLS policies, indexes applied to project | Schema mismatch with PRD requirements — mitigated by manual review               |
| 2. RLS Verification | Proof that cross-user data access is impossible         | False-positive verification if test setup doesn't properly simulate auth context |

**Prerequisites:** Supabase project linked and accessible via MCP tools (confirmed).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes `auth.uid()` returns the authenticated user's UUID in the Supabase context (confirmed by existing auth flow).
- RLS verification via `SET LOCAL` may behave differently than actual client requests — manual Studio check recommended as backup.

## Success Criteria (Summary)

- All three tables visible in Supabase with correct schema.
- Security advisor reports no RLS warnings.
- SQL proof: user A's SELECT returns zero rows of user B's data (and vice versa) for all three tables.
