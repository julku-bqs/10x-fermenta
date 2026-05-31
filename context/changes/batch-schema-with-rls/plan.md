# Batch Data Schema with RLS — Implementation Plan

## Overview

Create the foundational database schema for Fermenta: tables for batches, ingredients, and diary entries with Row-Level Security policies ensuring per-user data isolation. This is a database-only foundation change that unlocks all vertical slices (S-01 through S-03).

## Current State Analysis

- **Database**: Empty public schema — no tables, no types, no migrations exist.
- **Auth**: Fully wired Supabase SSR client with `auth.uid()` available for RLS.
- **Migrations directory**: `supabase/migrations/` created but empty.
- **Supabase CLI**: Available as devDependency (`supabase@^2.23.4`).

### Key Discoveries:

- `src/lib/supabase.ts` creates a server client via `@supabase/ssr` — RLS policies using `auth.uid()` will work out of the box with this client.
- `supabase/config.toml` has `major_version = 17` (Postgres 17) — all modern SQL features available.
- No `src/types.ts` exists yet — downstream slices will create shared types; this change is schema-only.

## Desired End State

Three tables exist in the public schema (`batches`, `ingredients`, `diary_entries`) with:
- Appropriate columns matching PRD requirements.
- Postgres enums for `process_type`, `sweetness_level`, and `ingredient_type`.
- RLS enabled on all tables with a single ALL policy per table. `batches` enforces `auth.uid() = user_id`; `ingredients` and `diary_entries` derive ownership through `batch_id -> batches.user_id`.
- Foreign key relationships from `ingredients` and `diary_entries` to `batches`.
- Sort order columns on `ingredients` and `diary_entries` for user-controlled ordering.
- Timestamps (`created_at`, `updated_at`) on all tables.

**Verification**: SQL queries prove that user A cannot see user B's data; Supabase security advisor reports no issues.

## What We're NOT Doing

- No API routes (S-01 scope).
- No TypeScript types or client-side code.
- No seed data.
- No reference/catalog tables (v2 scope).
- No per-operation RLS policies — using single ALL policy for MVP simplicity.
- No triggers or stored procedures for calculations (S-02 scope — calc lives in app layer).

## Implementation Approach

Single migration file containing all DDL: enum types → tables → RLS enable → policies → indexes. Applied via Supabase MCP tool for immediate verification, and also saved locally for git tracking.

## Phase 1: Schema Migration

### Overview

Create the migration SQL with all tables, enums, RLS policies, and indexes. Apply to the Supabase project and save the file locally.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260530213000_batch_schema_with_rls.sql`

**Intent**: Define the complete schema for Fermenta's batch planning domain — three tables with enums, RLS, and supporting indexes — in a single atomic migration.

**Contract**:

Enums:
- `process_type`: `pulp`, `juice`
- `sweetness_level`: `dry`, `semi_dry`, `semi_sweet`, `sweet`
- `ingredient_type`: `user_input`, `fermentation_sugar`, `sweetness_sugar`

Tables:
- `batches`: `id` (uuid PK, default gen_random_uuid()), `user_id` (uuid NOT NULL, references auth.users), `name` (text NOT NULL), `batch_date` (date), `process_type` (process_type enum NOT NULL), `target_volume_liters` (numeric), `target_abv` (numeric), `planned_sweetness` (sweetness_level NOT NULL DEFAULT 'dry'), `yeast_name` (text), `yeast_alcohol_tolerance` (numeric), `measured_sugar_content` (numeric, nullable — user fills after must/juice preparation, before adding sugar or yeast; used by S-02 calculation for accurate fermentation sugar target), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
- `ingredients`: `id` (uuid PK, default gen_random_uuid()), `batch_id` (uuid NOT NULL, FK → batches ON DELETE CASCADE), `type` (ingredient_type NOT NULL DEFAULT 'user_input'), `name` (text NOT NULL), `amount` (numeric), `unit` (text), `sugar_content_percent` (numeric — sugar content as percentage of ingredient weight/volume), `sort_order` (integer NOT NULL DEFAULT 0), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
- `diary_entries`: `id` (uuid PK, default gen_random_uuid()), `batch_id` (uuid NOT NULL, FK → batches ON DELETE CASCADE), `description` (text NOT NULL), `sort_order` (integer NOT NULL DEFAULT 0), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())

RLS:
- `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` on all three tables
- One ALL policy on `batches`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- One ALL policy on `ingredients`: `USING (EXISTS (SELECT 1 FROM batches b WHERE b.id = ingredients.batch_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM batches b WHERE b.id = ingredients.batch_id AND b.user_id = auth.uid()))`
- One ALL policy on `diary_entries`: `USING (EXISTS (SELECT 1 FROM batches b WHERE b.id = diary_entries.batch_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM batches b WHERE b.id = diary_entries.batch_id AND b.user_id = auth.uid()))`

Indexes:
- `batches(user_id)` — fast per-user listing
- `ingredients(batch_id)` — fast per-batch lookup
- `diary_entries(batch_id)` — fast per-batch lookup

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly via Supabase MCP `apply_migration` (no errors)
- `supabase-list_tables` returns all three tables (`batches`, `ingredients`, `diary_entries`) with expected columns
- `supabase-get_advisors` (security) reports no RLS-related warnings for these tables
- Migration file exists at `supabase/migrations/20260530213000_batch_schema_with_rls.sql`

#### Manual Verification:

- Review the migration file and confirm schema matches PRD requirements

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: RLS Verification

### Overview

Prove that RLS policies correctly isolate user data by running targeted SQL queries that simulate cross-user access attempts.

### Changes Required:

#### 1. Verification queries via Supabase MCP

**File**: (no file — executed via `supabase-execute_sql`)

**Intent**: Insert test rows as two simulated users and prove that each user's SELECT/UPDATE/DELETE cannot reach the other's data. Clean up test data after verification.

**Contract**:
- Insert batches for two different UUIDs (simulated user_id values)
- Query with `SET LOCAL role = 'authenticated'; SET LOCAL request.jwt.claims = '{"sub":"<user_a_uuid>"}'` to simulate authenticated user context
- SELECT should return only user A's batches when authenticated as A
- Repeat for ingredients and diary_entries
- Clean up: DELETE all test rows

#### 2. Security advisor check

**File**: (no file — executed via `supabase-get_advisors`)

**Intent**: Run the Supabase security advisor to confirm no RLS warnings or vulnerabilities exist on the newly created tables.

### Success Criteria:

#### Automated Verification:

- SELECT as user A returns 0 rows from user B's data
- SELECT as user B returns 0 rows from user A's data
- Supabase security advisor returns no warnings for `batches`, `ingredients`, `diary_entries`
- DELETE test batch confirms child rows in ingredients and diary_entries are cascaded
- Test data is cleaned up (no orphan rows remain)

#### Manual Verification:

- Review verification query output and confirm isolation is correct

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not applicable — pure DDL, no application code in this change.

### Integration Tests:

- RLS isolation proof via direct SQL (Phase 2).
- FK cascade verification: deleting a batch cascades to its ingredients and diary_entries.

### Manual Testing Steps:

1. Review migration file for completeness against PRD data requirements.
2. Confirm via Supabase Studio that tables appear with correct columns and types.
3. Confirm RLS is enabled (lock icon visible in Studio).

## Performance Considerations

- Indexes on `user_id` (batches) and `batch_id` (ingredients, diary_entries) support the ownership checks and keep per-batch access patterns efficient.
- At MVP scale (small data volume per PRD), no further optimization needed.

## Migration Notes

- First migration in the project — no existing data to handle.
- Enums chosen over text CHECK constraints for type safety and Supabase Studio usability.
- `ON DELETE CASCADE` on child table FKs ensures batch deletion is clean (no orphan rows).

## References

- PRD: `context/foundation/prd.md` — FR-003 through FR-011, Access Control, NFR
- Roadmap: `context/foundation/roadmap.md` — F-01 entry
- Supabase client: `src/lib/supabase.ts` — confirms `auth.uid()` availability

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema Migration

#### Automated

- [ ] 1.1 Migration applies cleanly via Supabase MCP apply_migration
- [ ] 1.2 list_tables returns all three tables with expected columns
- [ ] 1.3 Security advisor reports no RLS warnings
- [ ] 1.4 Migration file exists at supabase/migrations/

#### Manual

- [ ] 1.5 Review migration file confirms schema matches PRD

### Phase 2: RLS Verification

#### Automated

- [ ] 2.1 SELECT as user A returns 0 rows from user B data
- [ ] 2.2 SELECT as user B returns 0 rows from user A data
- [ ] 2.3 Security advisor returns no warnings
- [ ] 2.4 FK cascade verified (DELETE batch removes child rows)
- [ ] 2.5 Test data cleaned up

#### Manual

- [ ] 2.6 Review verification output confirms isolation
