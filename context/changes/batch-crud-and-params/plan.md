# Batch CRUD & Parameters — Implementation Plan

## Overview

Build the first vertical slice of Fermenta's domain UI: a JSON API and React-powered interface for creating batches (with parameters and optional yeast), listing them with card/table layout toggle, and viewing/editing batch details. This unlocks the core "plan a batch" workflow that S-02 (ingredients + calculation) and S-03 (process plan) build on.

## Current State Analysis

- **Schema**: `batches` table exists with all required columns (name, batch_date, process_type, target_volume_liters, target_abv, planned_sweetness, yeast_name, yeast_alcohol_tolerance), RLS enabled, enums (`process_type`, `sweetness_level`) defined.
- **Auth**: Full Supabase SSR auth flow with `Astro.locals.user` available on every request. Middleware protects `/dashboard`.
- **API pattern**: Existing auth endpoints use form POST + redirect. This slice introduces a new JSON API pattern (request/response as JSON, zod validation).
- **UI**: `shadcn/ui` Button + auth FormField components exist. No domain components yet.
- **Types**: No `src/types.ts`. No zod installed.
- **Pages**: Dashboard is a placeholder. No dynamic routes exist.

### Key Discoveries:

- `src/lib/supabase.ts:1-24` — `createClient(requestHeaders, cookies)` returns `SupabaseClient | null`; API routes must guard against null.
- `src/middleware.ts:4` — `PROTECTED_ROUTES` array needs `/batches` added.
- `src/components/auth/FormField.tsx` — reusable input with icon/error/hint slots; auth-themed (white on dark). Domain forms will need a neutral variant or new components.
- `astro.config.mjs` — `output: "server"` means dynamic `[id]` routes render server-side, no static generation concerns.
- No form library installed — form state will use React `useState` + zod for validation (same approach as existing auth forms but with shared schemas).

## Desired End State

After this plan is complete:

1. A logged-in user can navigate to `/batches/new`, fill out a single-page form (batch basics, parameters, yeast), submit, and be redirected to `/batches/[id]` showing their new batch.
2. A logged-in user can visit `/batches` and see their batches in a card layout (name + date + process type badge, expandable for parameters) or toggle to a table view. Layout preference persists in localStorage.
3. A logged-in user can visit `/batches/[id]` to view full batch details and edit any field (name, date, type, volume, ABV, sweetness, yeast). Save triggers a PUT and shows success/error feedback.
4. Delete button is visible but disabled (out of scope for this slice).
5. All API routes validate input with zod and return structured JSON responses.
6. Unauthenticated users are redirected to `/auth/signin` for all `/batches*` routes.

**Verification**: Create a batch via the form → see it in the list → open detail → edit a field → verify change persists. Lint + build pass. RLS prevents cross-user access (tested via Supabase SQL).

## What We're NOT Doing

- No ingredient management (S-02 scope)
- No sugar calculation or validation warnings (S-02 scope)
- No process plan generation (S-03 scope)
- No batch deletion (visible but disabled button — future scope)
- No batch duplication/cloning
- No search/filter on batch list (future enhancement)
- No pagination on batch list (acceptable for MVP scale — "small" data volume per PRD)
- No optimistic updates — standard submit → wait → response flow

## Implementation Approach

**JSON API layer**: Astro API routes at `/api/batches` (POST, GET) and `/api/batches/[id]` (GET, PUT). Each validates input with zod, uses Supabase client with RLS (user isolation automatic), and returns typed JSON responses.

**Shared schemas**: A single `src/lib/schemas/batch.ts` file exports zod schemas used by both API routes (server validation) and React components (client validation). Types are inferred from schemas via `z.infer<>`.

**React components**: Interactive form + list components rendered as Astro islands (`client:load`). Form uses controlled inputs with `useState`, validates on submit via zod, and calls the JSON API via `fetch()`.

**Astro pages**: SSR pages at `/batches/`, `/batches/new`, `/batches/[id]` — each imports Layout, fetches initial data server-side (for list and detail), and renders React islands with props.

## Phase 1: Foundation

### Overview

Install zod, create shared types/schemas, add API response helpers, and update middleware. This provides the contracts that API routes and UI components both depend on.

### Changes Required:

#### 1. Install zod

**File**: `package.json`

**Intent**: Add zod as a runtime dependency for input validation on both server and client.

**Contract**: `npm install zod` — adds `zod` to `dependencies`.

#### 2. Batch zod schemas

**File**: `src/lib/schemas/batch.ts`

**Intent**: Define the single source of truth for batch input validation — used by API routes and React form.

**Contract**: Exports:
- `createBatchSchema` — zod object validating POST body (name: string min 1, batch_date: string date or null, process_type: enum pulp|juice, target_volume_liters: number positive or null, target_abv: number 0-100 or null, planned_sweetness: enum dry|semi_dry|semi_sweet|sweet, yeast_name: string or null, yeast_alcohol_tolerance: number 0-100 or null)
- `updateBatchSchema` — same as create but all fields optional (partial)
- Type exports: `CreateBatchInput`, `UpdateBatchInput` inferred from schemas

#### 3. Shared types

**File**: `src/types.ts`

**Intent**: Define TypeScript interfaces for batch domain entities (DB row shape) and API response envelope.

**Contract**: Exports:
- `Batch` interface matching the `batches` table columns (id, user_id, name, batch_date, process_type, target_volume_liters, target_abv, planned_sweetness, yeast_name, yeast_alcohol_tolerance, created_at, updated_at)
- `ApiResponse<T>` generic type: `{ data: T } | { error: string; details?: Record<string, string[]> }`
- `BatchListItem` — subset of Batch for list display (id, name, batch_date, process_type, target_volume_liters, target_abv, planned_sweetness)

#### 4. API response helpers

**File**: `src/lib/api.ts`

**Intent**: Provide consistent JSON response factories for API routes — success and error responses with proper status codes and content-type headers.

**Contract**: Exports:
- `jsonOk<T>(data: T): Response` — 200 with JSON body `{ data }`
- `jsonCreated<T>(data: T): Response` — 201 with JSON body `{ data }`
- `jsonError(message: string, status?: number, details?: Record<string, string[]>): Response` — error response with given status (default 400)
- `jsonValidationError(zodError: ZodError): Response` — 400 with field-level error details extracted from ZodError

#### 5. Update middleware

**File**: `src/middleware.ts`

**Intent**: Protect all `/batches` and `/api/batches` routes so only authenticated users can access them.

**Contract**: Add `/batches` and `/api/batches` to `PROTECTED_ROUTES`. The existing `startsWith` matching covers sub-routes automatically.

### Success Criteria:

#### Automated Verification:

- zod is installed: `npm ls zod` exits 0
- TypeScript compiles: `npx astro check` passes (or `npm run build`)
- Lint passes: `npm run lint`
- Schema file exports expected types (import check in build)

#### Manual Verification:

- Visiting `/batches` while unauthenticated redirects to `/auth/signin`

---

## Phase 2: API Routes

### Overview

Create the JSON API endpoints for batch CRUD: create (POST), list (GET), get single (GET), and update (PUT). All routes use zod validation, the Supabase client with RLS, and the response helpers from Phase 1.

**Shared guard pattern**: Both endpoints begin with a null-guard: if `createClient()` returns null or `context.locals.user` is null → `jsonError("Server configuration error", 500)`. This is defensive only (middleware guarantees auth on protected routes) but satisfies TypeScript narrowing.

### Changes Required:

#### 1. Create & List endpoint

**File**: `src/pages/api/batches/index.ts`

**Intent**: Handle batch creation (POST) and listing (GET) for the authenticated user. POST validates input with `createBatchSchema`, inserts into `batches` table, returns the created batch. GET queries all user's batches ordered by `created_at` desc.

**Contract**:
- `POST` — accepts JSON body, validates with `createBatchSchema`, inserts row with `user_id` from `context.locals.user.id`, returns `jsonCreated(batch)`. On validation failure: `jsonValidationError`. On Supabase error: `jsonError(message, 500)`.
- `GET` — queries `batches` table (RLS filters to user), selects all columns, orders by `created_at` desc, returns `jsonOk(batches)`.

#### 2. Single batch endpoint

**File**: `src/pages/api/batches/[id].ts`

**Intent**: Handle fetching (GET) and updating (PUT) a single batch by ID. RLS ensures only the owner can access.

**Contract**:
- `GET` — fetches single batch by `id` param. Returns `jsonOk(batch)` or `jsonError("Batch not found", 404)`.
- `PUT` — validates JSON body with `updateBatchSchema`, updates the batch row, returns `jsonOk(updatedBatch)`. On validation failure: `jsonValidationError`. On not found: `jsonError("Batch not found", 404)`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build` passes
- Lint passes: `npm run lint`
- POST /api/batches with valid JSON creates a batch (testable via curl with auth cookie)
- GET /api/batches returns array of user's batches
- GET /api/batches/[id] returns single batch
- PUT /api/batches/[id] updates and returns modified batch
- POST with invalid data returns 400 with field-level errors

#### Manual Verification:

- API returns 401/redirect for unauthenticated requests
- RLS prevents accessing another user's batch via direct ID

---

## Phase 3: Batch Creation UI

### Overview

Build the React form for creating a new batch and the Astro page that hosts it. The form validates client-side with the shared zod schema, submits to the JSON API, and redirects to the detail page on success.

### Changes Required:

#### 1. Batch form component

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: A single scrollable React form with three visual sections (Batch Basics, Parameters, Yeast) that validates on submit using `createBatchSchema` and POSTs to `/api/batches`. Shows field-level errors inline and server errors as a dismissible banner at the top.

**Contract**: Props: `{ mode: "create" | "edit"; initialData?: Batch; onSuccess?: (batch: Batch) => void }`. On submit: validates → disables submit button with loading state → fetch POST (or PUT for edit mode) → calls `onSuccess` with response or displays errors → re-enables button. Uses `window.location.href` for redirect after create.

#### 2. Batch creation page

**File**: `src/pages/batches/new.astro`

**Intent**: Astro page that renders the batch creation form as a React island. Minimal server-side logic — just layout + island mount.

**Contract**: Uses `Layout` with title "New Batch". Renders `<BatchForm client:load mode="create" />`. Page is protected by middleware (user must be authenticated).

#### 3. Navigation — link from batch list to create

**File**: `src/pages/batches/index.astro` (stub — full implementation in Phase 4)

**Intent**: Create the batch list page skeleton so the `/batches` route exists and links to `/batches/new`.

**Contract**: Minimal page with Layout, heading "My Batches", and a "New Batch" button/link pointing to `/batches/new`. Batch list component is a placeholder until Phase 4.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`
- Form renders without errors (no console errors on page load)

#### Manual Verification:

- Navigate to `/batches/new` → form renders with all 3 sections visible
- Submit with empty required fields → inline error on "name" and "process type" fields
- Fill valid data → submit → redirects to `/batches/[id]` (404 for now, detail page in Phase 4)
- Server error scenario → banner appears at top of form

---

## Phase 4: Batch List & Detail UI

### Overview

Complete the batch list page with card/table layout toggle (localStorage persistence) and build the batch detail/edit page at `/batches/[id]`.

### Changes Required:

#### 1. Batch list component — card view

**File**: `src/components/batches/BatchList.tsx`

**Intent**: React component that displays batches as cards (name + date + process type badge). Each card is expandable to show parameters (volume, ABV, sweetness, yeast). Cards link to `/batches/[id]`.

**Contract**: Props: `{ batches: BatchListItem[] }`. Renders card grid. Each card shows name, formatted date, process type badge. Click expand icon reveals parameters section. Click card navigates to detail.

#### 2. Batch list component — table view

**File**: `src/components/batches/BatchTable.tsx`

**Intent**: Alternative table layout showing all batch data in rows. Columns: name, date, type, volume, ABV, sweetness. Row click navigates to detail.

**Contract**: Props: `{ batches: BatchListItem[] }`. Renders responsive table. Mobile-friendly (horizontal scroll or stacked layout).

#### 3. Layout toggle component

**File**: `src/components/batches/LayoutToggle.tsx`

**Intent**: Toggle button switching between card and table views. Persists choice in localStorage key `fermenta:batch-list-layout`.

**Contract**: Props: `{ layout: "cards" | "table"; onChange: (layout: "cards" | "table") => void }`. Renders two icon buttons (grid icon / list icon) with active state styling.

#### 4. Batch list page (full implementation)

**File**: `src/pages/batches/index.astro`

**Intent**: Replace the Phase 3 stub with the full implementation. Fetches batches server-side via Supabase, passes as props to a React island that manages layout toggle state.

**Contract**: Server-side: create Supabase client, query batches ordered by `created_at` desc, pass as JSON prop. Client-side: `<BatchListPage client:load batches={batches} />` wrapper component manages layout state + renders BatchList or BatchTable + LayoutToggle + "New Batch" button.

#### 5. Batch list page wrapper component

**File**: `src/components/batches/BatchListPage.tsx`

**Intent**: React wrapper that manages layout toggle state (reading/writing localStorage) and conditionally renders BatchList or BatchTable.

**Contract**: Props: `{ batches: BatchListItem[] }`. Manages `layout` state initialized from localStorage (default "cards"). Renders LayoutToggle + conditional list/table + "New Batch" link + empty state when no batches.

#### 6. Batch detail/edit page

**File**: `src/pages/batches/[id].astro`

**Intent**: Dynamic SSR page that fetches a single batch server-side and renders it in an editable form (reusing BatchForm in "edit" mode). Shows a disabled "Delete" button.

**Contract**: Reads `id` from `Astro.params.id`. Fetches batch via Supabase client (server-side, RLS-protected). If not found → 404 response. If found → renders `<BatchForm client:load mode="edit" initialData={batch} />` + disabled Delete button with tooltip "Coming soon".

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- `/batches` shows empty state when no batches exist
- Create a batch → `/batches` shows it as a card with name + date + badge
- Click expand → parameters appear
- Toggle to table → layout switches, refresh page → table view persists
- Toggle back to cards → persists
- Click batch → navigates to `/batches/[id]`
- Detail page shows all batch data in editable form
- Edit a field (e.g., name) → save → field updates, success feedback shown
- Delete button is visible but disabled
- `/batches/[nonexistent-id]` returns 404

---

## Testing Strategy

### Unit Tests:

- (No unit test framework in project — not adding one in this slice. Validation correctness is verified via automated build + manual API testing.)

### Integration Tests:

- (Deferred — no test runner set up. API correctness verified via manual curl/browser testing during implementation.)

### Manual Testing Steps:

1. Sign in → navigate to `/batches` → see empty state with "New Batch" button
2. Click "New Batch" → fill form with all fields → submit → redirect to detail page
3. Verify detail page shows all entered data correctly
4. Edit batch name → save → name updates
5. Navigate back to `/batches` → see batch in card list
6. Toggle to table view → verify data renders correctly
7. Refresh page → table view persists (localStorage)
8. Create a second batch → verify list ordering (newest first)
9. Try submitting form with empty name → field error appears
10. Try setting target_abv to 150 → validation error appears

## Performance Considerations

- Batch list fetched server-side (SSR) → no client-side loading state needed for initial render
- No pagination needed at MVP scale (PRD: "small" data volume)
- Card expand/collapse is CSS-only (no API call)
- Layout toggle uses localStorage (synchronous read, no flicker)
- Zod schemas shared between client/server — single bundle cost, but zod tree-shakes well

## Migration Notes

- No database migration needed — F-01 schema already has all required columns.
- Protected routes addition is backward-compatible — dashboard redirect still works.
- Dashboard page (`/dashboard`) can be deprecated/redirected in a future change; for now both routes work.

## References

- Schema plan: `context/changes/batch-schema-with-rls/plan.md`
- PRD functional requirements: `context/foundation/prd.md` (FR-003, FR-004, FR-005, FR-007)
- Roadmap slice: `context/foundation/roadmap.md` (S-01)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation

#### Automated

- [ ] 1.1 zod installed and importable
- [ ] 1.2 Batch schemas compile and export expected types
- [ ] 1.3 Types file compiles
- [ ] 1.4 API helpers compile
- [ ] 1.5 Build passes with all foundation files
- [ ] 1.6 Lint passes

#### Manual

- [ ] 1.7 Unauthenticated access to /batches redirects to signin

### Phase 2: API Routes

#### Automated

- [ ] 2.1 POST /api/batches creates batch and returns 201
- [ ] 2.2 GET /api/batches returns user's batches
- [ ] 2.3 GET /api/batches/[id] returns single batch
- [ ] 2.4 PUT /api/batches/[id] updates batch
- [ ] 2.5 POST with invalid data returns 400 with field errors
- [ ] 2.6 Build passes
- [ ] 2.7 Lint passes

#### Manual

- [ ] 2.8 API rejects unauthenticated requests
- [ ] 2.9 RLS prevents cross-user batch access

### Phase 3: Batch Creation UI

#### Automated

- [ ] 3.1 Build passes with form component and page
- [ ] 3.2 Lint passes

#### Manual

- [ ] 3.3 Form renders with 3 sections at /batches/new
- [ ] 3.4 Client-side validation shows inline errors
- [ ] 3.5 Valid submission creates batch and redirects to detail
- [ ] 3.6 Server error banner displays correctly

### Phase 4: Batch List & Detail UI

#### Automated

- [ ] 4.1 Build passes with all list and detail components
- [ ] 4.2 Lint passes

#### Manual

- [ ] 4.3 Empty state displays when no batches
- [ ] 4.4 Batch list shows cards with expand for details
- [ ] 4.5 Table view toggle works and persists in localStorage
- [ ] 4.6 Batch detail page shows all data in editable form
- [ ] 4.7 Edit and save updates batch successfully
- [ ] 4.8 Delete button visible but disabled
- [ ] 4.9 Non-existent batch ID returns 404
