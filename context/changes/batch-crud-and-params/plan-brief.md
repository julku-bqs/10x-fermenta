# Batch CRUD & Parameters — Plan Brief

> Full plan: `context/changes/batch-crud-and-params/plan.md`

## What & Why

Build the first domain-facing UI for Fermenta: batch creation, listing, and editing. This is the S-01 slice — the foundation that S-02 (ingredients + calculation) and S-03 (process plan) build on. Without it, there's no batch to attach ingredients or process steps to.

## Starting Point

The database schema is complete (F-01 done): `batches` table with all columns, RLS enabled, enums defined. Auth flow is solid. The dashboard is a placeholder. No domain API routes, types, or forms exist yet.

## Desired End State

A logged-in user can create a batch via a single-page form (name, date, process type, parameters, optional yeast), see their batches in a card/table list, and view/edit any batch on its detail page. All inputs are zod-validated on both client and server. Layout preference persists across sessions via localStorage.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Form structure | Single scrollable form with sections | Fast to fill with ~8 fields; no wizard friction |
| API pattern | JSON request/response (not form POST+redirect) | Enables typed responses and field-level validation errors |
| URL structure | /batches, /batches/new, /batches/[id] | Clean REST semantics; browser-back works naturally |
| Validation | Shared zod schema on client + server | Single source of truth; instant feedback + server safety |
| List view | Cards (default) + table toggle, localStorage | Power users get density; casual users get scannability |
| Post-creation flow | Redirect to /batches/[id] | Natural entry point for viewing and later adding ingredients |
| Detail page | Full edit mode (PUT endpoint) | PRD says "every field is editable"; delete button disabled for now |
| Error UX | Banner at top + field-level inline errors | Matches auth form patterns, covers both server and validation errors |

## Scope

**In scope:**
- Batch creation form (all fields from batches table)
- Batch list page with card/table layout toggle
- Batch detail/edit page with save
- JSON API: POST/GET /api/batches, GET/PUT /api/batches/[id]
- Zod validation schemas (shared client/server)
- TypeScript types for batch domain
- Middleware protection for /batches routes

**Out of scope:**
- Batch deletion (button visible but disabled)
- Ingredients (S-02)
- Sugar calculation/validation (S-02)
- Process plan (S-03)
- Search/filter/pagination on list
- Unit/integration tests (no test runner in project)

## Architecture / Approach

```
Astro SSR pages ──► React islands (client:load)
     │                    │
     │ server-side fetch  │ client-side fetch()
     ▼                    ▼
Supabase client ◄── API routes (/api/batches/*) ──► zod validation
     │
     ▼
 batches table (RLS: user_id = auth.uid())
```

Pages fetch data server-side for SSR. React forms submit to JSON API routes. Shared zod schemas validate on both sides. RLS handles authorization at the DB level.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Foundation | zod, types, schemas, API helpers, middleware | Low — pure setup, no runtime behavior |
| 2. API Routes | POST/GET/PUT endpoints for batches | Low — straightforward CRUD with RLS |
| 3. Batch Creation UI | React form + /batches/new page | Medium — first interactive domain component |
| 4. Batch List & Detail UI | Card/table list + detail/edit page | Medium — most UI surface area |

**Prerequisites:** F-01 schema deployed (done), auth working (done)
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- Assumes zod tree-shakes well enough for Cloudflare Workers bundle size limits
- No test runner means correctness relies on manual testing + type safety
- Card/table toggle localStorage approach assumes users don't clear storage frequently

## Success Criteria (Summary)

- User can create a batch, see it in their list, and edit it — full round-trip works
- Build + lint pass with zero errors
- Unauthenticated users cannot access any batch data or UI
