---
title: Anti-Corruption Layer Refactoring Plan
created: 2026-08-08
type: refactor-plan
---

# Anti-Corruption Layer Refactoring Plan

> Scope note: This is a **refactoring plan**, not an implementation. No production
> code is modified here. Findings are cited with `file:line` evidence. Where
> evidence could not be found, it is stated explicitly.

---

## STEP 0 — Discover Context

### Stack summary

| Concern            | Technology                                                      | Evidence                                                                                                              |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Web framework      | Astro 6, SSR (`output: "server"`)                               | [astro.config.mjs](../../astro.config.mjs) (AGENTS.md import); `import type { APIRoute } from "astro"` in every route |
| UI islands         | React 19                                                        | [package.json:42-43](../../package.json)                                                                              |
| Styling            | Tailwind 4 + shadcn/ui                                          | [package.json:44-46](../../package.json)                                                                              |
| Deployment runtime | Cloudflare Workers (`@astrojs/cloudflare`)                      | [package.json:24](../../package.json); [context/foundation/infrastructure.md:44](../foundation/infrastructure.md)     |
| Auth + persistence | Supabase (`@supabase/ssr`, `@supabase/supabase-js`, PostgreSQL) | [package.json:32-33](../../package.json); [supabase/migrations/](../../supabase/migrations)                           |
| Input validation   | Zod 4                                                           | [package.json:47](../../package.json)                                                                                 |
| Tests              | Vitest, Playwright, Stryker                                     | [package.json:53-55,58,60](../../package.json)                                                                        |

The product is **Fermenta**, a solo-built home-winemaking batch planner. Domain
capabilities (sugar calculation, plan validation, process-plan generation) are
described in [prd.md:85-97](../foundation/prd.md).

### External dependency inventory (runtime, from [package.json](../../package.json))

| Dependency                                                                                                                 | Role                    | Layer(s) it should live in                       |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `@supabase/ssr`, `@supabase/supabase-js`                                                                                   | Auth + Postgres access  | Persistence/adapter only                         |
| `@astrojs/cloudflare`                                                                                                      | Edge SSR adapter        | Build/infra config                               |
| `zod`                                                                                                                      | Request-body validation | API boundary (acceptable)                        |
| `@dnd-kit/*`                                                                                                               | Drag-and-drop reorder   | Single UI component only                         |
| `radix-ui`, `@radix-ui/react-slot`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | UI primitives           | UI only                                          |
| `astro`, `react`, `react-dom`                                                                                              | Frameworks              | Everywhere (framework, not a corruptible vendor) |

### Layer map (as-built)

```
Persistence (PostgreSQL owned by Supabase)
  supabase/migrations/*.sql
    tables: batches, ingredients, diary_entries
    RLS policies (auth.uid() = user_id)
    RPC: regenerate_diary_entries(p_batch_id, p_entries)   [SECURITY DEFINER]

Vendor client factory
  src/lib/supabase.ts            createServerClient(...) → SupabaseClient | null

Ambient contract
  src/env.d.ts                   App.Locals.supabase: SupabaseClient | null
                                 App.Locals.user: User | null   (Supabase type)

Request middleware
  src/middleware.ts              builds client, resolves user, guards routes

Interface layer — HTTP API            Interface layer — SSR pages
  src/pages/api/auth/*.ts               src/pages/batches/[id].astro
  src/pages/api/batches/**.ts           src/pages/batches/new.astro
                                        src/pages/batches/index.astro (clean)

Domain services (PURE — no vendor)
  src/lib/services/sugar-calculation.ts
  src/lib/services/process-plan-generation.ts
  src/lib/services/batch-validation.ts

Validation schemas (zod)              Shared domain types
  src/lib/schemas/*.ts                  src/types.ts  (Batch, DiaryEntry, ...)

UI (React islands) — fetch via HTTP /api, consume domain JSON
  src/components/**                      NO @supabase import (client bundle clean)
```

**Key structural observation:** the domain services and the React UI are already
Supabase-free. The vendor is concentrated in the **server-side application /
interface layer** (middleware, API routes, SSR pages) and the **ambient
`App.Locals` contract** — there is **no repository or gateway abstraction** between
those handlers and the Supabase SDK.

---

## STEP 1 — Identify Leaking Dependencies

### Candidate A — Supabase SDK (`@supabase/ssr` + `@supabase/supabase-js`)

**The leak.** The `SupabaseClient` object and its `User` type are published on the
ambient `App.Locals` contract and then consumed raw by every server handler. The
PostgREST query-builder (`.from(...).select/insert/update/delete`), the RPC name
string, the `.auth.*` methods, and the vendor result envelope `{ data, error }`
all appear directly in interface-layer code, duplicated across many files.

Direct-import evidence:

- [src/env.d.ts:3](../../src/env.d.ts) — `user: import("@supabase/supabase-js").User | null`
- [src/env.d.ts:4](../../src/env.d.ts) — `supabase: import("@supabase/supabase-js").SupabaseClient | null`
- [src/lib/supabase.ts:1](../../src/lib/supabase.ts) — `import { createServerClient, parseCookieHeader } from "@supabase/ssr"`

Query-builder / RPC / auth calls leaking into handlers (verified):

- Batches list/create: [src/pages/api/batches/index.ts:30,46,61,89](../../src/pages/api/batches/index.ts)
- Batch by id (GET/PUT/DELETE): [src/pages/api/batches/[id]/index.ts:19,52,72](../../src/pages/api/batches/[id]/index.ts)
- Diary list/create: [src/pages/api/batches/[id]/diary/index.ts:20,58](../../src/pages/api/batches/[id]/diary/index.ts)
- Diary update/delete: [src/pages/api/batches/[id]/diary/[entryId].ts:34,60](../../src/pages/api/batches/[id]/diary/[entryId].ts)
- Regenerate (query + `rpc`): [src/pages/api/batches/[id]/diary/regenerate.ts:22,32,43](../../src/pages/api/batches/[id]/diary/regenerate.ts)
- SSR page query: [src/pages/batches/[id].astro:18](../../src/pages/batches/[id].astro)
- SSR page query: [src/pages/batches/new.astro:17](../../src/pages/batches/new.astro)
- Auth calls: [signin.ts:23](../../src/pages/api/auth/signin.ts), [signup.ts:23](../../src/pages/api/auth/signup.ts), [signout.ts:7](../../src/pages/api/auth/signout.ts), [middleware.ts:13](../../src/middleware.ts)

Symptoms from the STEP-1 signal list, all present:

- **Same package across multiple layers** — ambient types, middleware, API, SSR pages.
- **Library types in cross-layer contracts** — `SupabaseClient`/`User` on `App.Locals`.
- **Duplicated reconstruction/mapping** — the `data as Batch` cast and the
  `if (error) return jsonError(...)` envelope-unwrap are copy-pasted in ~10 places,
  each needing `// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment`
  (e.g. [batches/index.ts:28,40](../../src/pages/api/batches/index.ts),
  [batches/[id]/index.ts:18,51](../../src/pages/api/batches/[id]/index.ts),
  [regenerate.ts:21,28](../../src/pages/api/batches/[id]/diary/regenerate.ts),
  [[id].astro:17,24](../../src/pages/batches/[id].astro)).
- **Persistence schema mirrored in domain vocabulary** — `Batch`/`DiaryEntry` in
  [src/types.ts:9-49](../../src/types.ts) mirror the DB columns 1:1 and are produced
  by unchecked casts rather than a mapping function.
- **Test vocabulary polluted** — a unit test hand-builds a fake Supabase query
  builder ([api/batches/**tests**/index.test.ts:5-7](../../src/pages/api/batches/__tests__/index.test.ts))
  and a schema test names an assertion "Supabase partial update safe"
  ([schemas/**tests**/batch.test.ts:190](../../src/lib/schemas/__tests__/batch.test.ts)).

### Candidate B — Astro framework types (`APIRoute`, `APIContext`, `astro:env`)

Present in every route and in [src/lib/config-status.ts:1](../../src/lib/config-status.ts).
This is the **host framework**, not a corruptible third-party integration — isolating
it would fight the grain of an Astro app and yields little value. **Not selected.**

### Candidate C — `@dnd-kit/*`

Confined to a single UI component (drag-reorder of ingredients). No cross-layer or
cross-boundary leak. **Low priority.**

### Candidate D — Cloudflare adapter

Build/infra config only ([astro.config.mjs](../../astro.config.mjs), [wrangler.jsonc](../../wrangler.jsonc)).
Not present in domain or interface code. **Not selected.**

### Ranked inventory

| Rank | Dependency         | Layers affected                                | Non-test files affected | Severity             |
| ---- | ------------------ | ---------------------------------------------- | ----------------------- | -------------------- |
| 1    | **Supabase SDK**   | ambient types, middleware, HTTP API, SSR pages | 13                      | **High**             |
| 2    | Astro types        | interface                                      | ~all routes             | N/A (host framework) |
| 3    | `@dnd-kit`         | UI                                             | 1                       | Low                  |
| 4    | Cloudflare adapter | build/infra                                    | 0 (config)              | Low                  |

---

## STEP 2 — Classify and Select #1

Evaluation of the top candidate (Supabase) on the required axes.

**A. Breadth of impact.** 13 non-test production files depend on Supabase's shape or
semantics, spanning **four layers** (ambient `App.Locals` contract, middleware, HTTP
API routes, SSR `.astro` pages). Four additional test files are coupled to the vendor
shape. Full list:

1. [src/env.d.ts](../../src/env.d.ts)
2. [src/middleware.ts](../../src/middleware.ts)
3. [src/lib/supabase.ts](../../src/lib/supabase.ts)
4. [src/lib/config-status.ts](../../src/lib/config-status.ts) _(env-name awareness only)_
5. [src/pages/api/auth/signin.ts](../../src/pages/api/auth/signin.ts)
6. [src/pages/api/auth/signup.ts](../../src/pages/api/auth/signup.ts)
7. [src/pages/api/auth/signout.ts](../../src/pages/api/auth/signout.ts)
8. [src/pages/api/batches/index.ts](../../src/pages/api/batches/index.ts)
9. [src/pages/api/batches/[id]/index.ts](../../src/pages/api/batches/[id]/index.ts)
10. [src/pages/api/batches/[id]/diary/index.ts](../../src/pages/api/batches/[id]/diary/index.ts)
11. [src/pages/api/batches/[id]/diary/[entryId].ts](../../src/pages/api/batches/[id]/diary/[entryId].ts)
12. [src/pages/api/batches/[id]/diary/regenerate.ts](../../src/pages/api/batches/[id]/diary/regenerate.ts)
13. [src/pages/batches/[id].astro](../../src/pages/batches/[id].astro)
14. [src/pages/batches/new.astro](../../src/pages/batches/new.astro)

**B. Replacement cost (today).** Swapping the persistence provider, or even moving a
single query, requires editing all 13 files, re-deriving the `{ data, error }`
unwrap, and re-authoring the unsafe casts. There is no single seam to change. Cost is
**high and diffuse**.

**C. Intent vs implementation gap.** Documentation explicitly claims the vendor is
**already isolated**, which the code contradicts:

> "While this project uses Supabase (mitigating DB lock-in), any future use of these
> bindings creates migration cost." — [infrastructure.md:51](../foundation/infrastructure.md)

The doc treats "uses Supabase" as _mitigating_ lock-in, but the implementation
hard-couples 13 files to the SDK, so the mitigation is only nominal. The pre-mortem
further states a future pivot is survivable **"only if the project had been
architecturally set up to route compute-heavy tasks elsewhere from day one"**
([infrastructure.md:56](../foundation/infrastructure.md)) — an explicit
architectural-separation intent that no seam currently satisfies.

**D. Domain pollution.** Moderate-to-high at the interface layer: PostgREST verbs
(`from`, `select`, `eq`, `single`, `maybeSingle`, `rpc`), the raw RPC name
`"regenerate_diary_entries"`, and the `{ data, error }` envelope are the working
vocabulary of the API routes. The pure domain services escaped, but every handler
that reaches persistence "speaks Postgres".

**Selection.** **Supabase SDK is the single worst leak.** It is the only candidate
that crosses multiple architectural boundaries, is duplicated across the codebase,
carries the highest replacement cost, and directly contradicts a documented
architectural claim. Candidates B–D are either the host framework or single-file/config.

---

## STEP 3 — Diagnosis

Fact-based demonstration of exactly how Supabase leaks, using verified evidence.

### 3.1 The vendor client is published as an application-wide contract

[src/env.d.ts:1-6](../../src/env.d.ts):

```ts
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
  }
}
```

Every `context.locals.supabase` / `Astro.locals.supabase` reference in the app is,
by construction, a reference to a vendor type. `App.Locals.user` is the vendor's
`User`, so even the layout consumes a Supabase shape
([Topbar.astro:4,17](../../src/components/Topbar.astro) reads `user.email`).

### 3.2 Duplicated envelope-unwrap + unsafe reconstruction

The same three-line pattern — _call builder → unwrap `{ data, error }` → cast to
domain type_ — is repeated across handlers, each suppressing the type checker.

[src/pages/api/batches/index.ts:29-40](../../src/pages/api/batches/index.ts):

```ts
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { data, error } = await supabase
  .from("batches")
  .insert({ ...batchData, user_id: context.locals.user.id })
  .select()
  .single();
if (error) {
  /* ... */ return jsonError("Failed to create batch", 500);
}
const batch = data as Batch;
```

The identical shape recurs at
[batches/[id]/index.ts:18-24,51-58,72-80](../../src/pages/api/batches/[id]/index.ts),
[regenerate.ts:21-28](../../src/pages/api/batches/[id]/diary/regenerate.ts), and in
SSR at [[id].astro:17-24](../../src/pages/batches/[id].astro) and
[new.astro:16-25](../../src/pages/batches/new.astro). The `data as Batch` cast is the
**only** "mapping" from persistence to domain, and it is unchecked.

### 3.3 Vendor-specific persistence operations in the interface layer

The atomic regeneration is invoked by RPC name and shape directly from an HTTP route
([regenerate.ts:32-35](../../src/pages/api/batches/[id]/diary/regenerate.ts)):

```ts
const { error: rpcError } = await supabase.rpc("regenerate_diary_entries", {
  p_batch_id: batchId,
  p_entries: entries,
});
```

`p_batch_id` / `p_entries` are the DB function's parameter names
([migration:47-49](../../supabase/migrations/20260614130000_diary_entries_process_plan.sql)).
A stored-procedure contract has leaked all the way up to the request handler.

### 3.4 Client/server boundary — the one piece of good news

The React UI does **not** import Supabase; it fetches domain JSON over HTTP
([BatchListPage.tsx:31-42](../../src/components/batches/BatchListPage.tsx),
[DiarySection.tsx:51-54](../../src/components/batches/diary/DiarySection.tsx)). So the
**client bundle is already free of server-only vendor code** — there is no dangerous
"server SDK pulled into the browser" case. The corruption is entirely server-side, which
makes the ACL a server-only refactor with no client risk.

### 3.5 Architectural consequence

Because persistence knowledge is smeared across 13 files with no seam:

- Replacing or supplementing Supabase (e.g., routing heavy work to an Edge Function,
  the exact scenario in [infrastructure.md:56](../foundation/infrastructure.md)) is a
  wide, error-prone edit rather than an adapter swap.
- Row→domain mapping bugs cannot be centralized or unit-tested; each casts blindly.
- The documented claim that Supabase "mitigates DB lock-in"
  ([infrastructure.md:51](../foundation/infrastructure.md)) is not yet true in code.

---

## STEP 4 — Design the Anti-Corruption Layer

The ACL introduces **domain-language ports**, **Supabase adapters** that are the _only_
place the SDK is known, and a small **`AuthUser` value object** that replaces the vendor
`User` on the ambient contract. Directory layout follows the project convention that
services/helpers live under `src/lib/` ([AGENTS.md] "Services/helpers go in `src/lib/`").

```
src/lib/
  domain/
    auth-user.ts            # value object (replaces @supabase User)
    persistence.ts          # RepositoryResult / PersistenceError (replaces { data, error })
  ports/
    batch-repository.ts     # domain interface
    diary-repository.ts     # domain interface
    auth-gateway.ts         # domain interface
  adapters/supabase/
    client.ts               # was src/lib/supabase.ts (createServerClient)
    supabase-batch-repository.ts
    supabase-diary-repository.ts
    supabase-auth-gateway.ts
    mappers.ts              # row → Batch / DiaryEntry, User → AuthUser
```

### A. Domain model (Value Objects)

`Batch`, `DiaryEntry`, `Ingredient`, `SweetnessLevel` already exist as domain types in
[src/types.ts](../../src/types.ts) and stay the single source of truth. Two small
additions replace vendor shapes that currently cross boundaries.

**`AuthUser`** — the identity value object the app speaks instead of Supabase `User`:

```ts
// src/lib/domain/auth-user.ts
export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}
```

Responsibilities: expose only what the app uses today (`id`, `email` — see
[middleware.ts:14](../../src/middleware.ts), [batches/index.ts:31](../../src/pages/api/batches/index.ts),
[Topbar.astro:17](../../src/components/Topbar.astro)); nothing vendor-specific.

**`RepositoryResult` / `PersistenceError`** — domain-owned outcome that replaces the raw
`{ data, error }` envelope so handlers stop unwrapping PostgREST:

```ts
// src/lib/domain/persistence.ts
export type NotFound = { readonly kind: "not_found" };
export type PersistenceFailure = { readonly kind: "failure"; readonly message: string };
// Repositories return domain values or null; they THROW PersistenceFailure on
// infrastructure errors so routes translate one exception type, not vendor envelopes.
export class PersistenceError extends Error {}
```

Mapping responsibility (adapter-owned), pseudocode:

```
mapRowToBatch(row):            # replaces every `data as Batch`
  return {
    id: row.id, user_id: row.user_id, name: row.name,
    batch_date: row.batch_date, process_type: row.process_type,
    ...map remaining columns..., ingredients: row.ingredients ?? []
  } as Batch
mapUser(supabaseUser):        # replaces `App.Locals.user: User`
  return supabaseUser ? { id: supabaseUser.id, email: supabaseUser.email ?? null } : null
```

### B. Ports (narrow domain interfaces — no vendor types)

Ports use only domain vocabulary and existing schema-inferred input types
(`CreateBatchInput`/`UpdateBatchInput` from [schemas/batch.ts:40-41](../../src/lib/schemas/batch.ts),
`CreateDiaryEntryInput`/`UpdateDiaryEntryInput` from
[schemas/diary-entry.ts:17-18](../../src/lib/schemas/diary-entry.ts),
`DiaryEntryDraft` from [process-plan-generation.ts:9-13](../../src/lib/services/process-plan-generation.ts)).

```ts
// src/lib/ports/batch-repository.ts
export interface BatchRepository {
  listForCurrentUser(): Promise<Batch[]>; // GET /api/batches
  findById(id: string): Promise<Batch | null>; // GET /api/batches/[id], SSR pages
  create(input: CreateBatchInput, ownerId: string): Promise<Batch>;
  update(id: string, changes: UpdateBatchInput): Promise<Batch | null>;
  delete(id: string): Promise<boolean>; // true if a row was removed
}

// src/lib/ports/diary-repository.ts
export interface DiaryRepository {
  listForBatch(batchId: string): Promise<DiaryEntry[]>;
  create(batchId: string, input: CreateDiaryEntryInput): Promise<DiaryEntry>;
  createMany(batchId: string, drafts: NewDiaryEntry[]): Promise<void>; // batch/user auto-entries
  update(batchId: string, entryId: string, changes: UpdateDiaryEntryInput): Promise<DiaryEntry | null>;
  delete(batchId: string, entryId: string): Promise<boolean>;
  regenerate(batchId: string, drafts: DiaryEntryDraft[]): Promise<DiaryEntry[]>; // hides the RPC
}

// src/lib/ports/auth-gateway.ts
export type AuthOutcome = { ok: true } | { ok: false; message: string };
export interface AuthGateway {
  getCurrentUser(): Promise<AuthUser | null>;
  signInWithPassword(email: string, password: string): Promise<AuthOutcome>;
  signUpWithPassword(email: string, password: string): Promise<AuthOutcome>;
  signOut(): Promise<void>;
}
```

The ports must **not** expose: `SupabaseClient`, `PostgrestError`, `User`, the
`{ data, error }` envelope, the `regenerate_diary_entries` name, or any `p_*` parameter.

### C. Adapters (the only place Supabase is known)

```ts
// src/lib/adapters/supabase/supabase-batch-repository.ts
import type { SupabaseClient } from "@supabase/supabase-js"; // ← ONLY here (+ siblings)
export class SupabaseBatchRepository implements BatchRepository {
  constructor(private readonly db: SupabaseClient) {}
  async listForCurrentUser() {
    const { data, error } = await this.db.from("batches").select("*").order("created_at", { ascending: false });
    if (error) throw new PersistenceError(error.message);
    return (data ?? []).map(mapRowToBatch);
  }
  // findById/create/update/delete: same pattern — unwrap once, map, translate errors.
}
```

Responsibilities:

- Own the `@supabase/*` imports, the query-builder chains, and the `rpc(...)` call.
- Translate the vendor envelope into domain values / `PersistenceError`.
- Map rows ↔ domain via `mappers.ts` (deletes every `data as Batch` cast).
- `SupabaseAuthGateway` wraps `.auth.*` ([signin.ts:23](../../src/pages/api/auth/signin.ts),
  [signup.ts:23](../../src/pages/api/auth/signup.ts), [signout.ts:7](../../src/pages/api/auth/signout.ts),
  [middleware.ts:13](../../src/middleware.ts)) and returns `AuthUser`/`AuthOutcome`.

Dependency ownership: adapters are constructed once in
[src/middleware.ts](../../src/middleware.ts) from the request headers + cookies (the
existing `createClient` inputs) and attached to `context.locals` as ports.

### D. Revised ambient contract

```ts
// src/env.d.ts  (no @supabase import remains)
declare namespace App {
  interface Locals {
    user: import("@/lib/domain/auth-user").AuthUser | null;
    batches: import("@/lib/ports/batch-repository").BatchRepository | null;
    diary: import("@/lib/ports/diary-repository").DiaryRepository | null;
    auth: import("@/lib/ports/auth-gateway").AuthGateway | null;
  }
}
```

---

## STEP 5 — Prove Isolation (Before / After)

### Current dependency exposure (13 non-test files)

`@supabase/*` types, `.from(...)`, `.rpc(...)`, `.auth.*`, or `{ data, error }`
handling appear in: `env.d.ts`, `middleware.ts`, `lib/supabase.ts`,
`api/auth/{signin,signup,signout}.ts`, `api/batches/index.ts`,
`api/batches/[id]/index.ts`, `api/batches/[id]/diary/{index,[entryId],regenerate}.ts`,
`pages/batches/[id].astro`, `pages/batches/new.astro`. (`lib/config-status.ts` knows the
env-var _names_ only.)

### Target dependency exposure (post-refactor)

`@supabase/*` and PostgREST verbs appear **only** under
`src/lib/adapters/supabase/**`. All other files speak ports + domain types.

### Files that stop depending on the library

All 13 above **except** the vendor client factory (which _moves_ into
`adapters/supabase/client.ts`). `env.d.ts` stops importing `@supabase/supabase-js`.
Every `eslint-disable ... no-unsafe-assignment` tied to `data as Batch` is removed.

### Files that remain aware of the library

`src/lib/adapters/supabase/**` (by design). Accepted exceptions **outside** the app
boundary: the integration-test admin client
([**tests**/integration/helpers.ts:3,31-33](../../src/__tests__/integration/helpers.ts),
[globalSetup.ts:4](../../src/__tests__/integration/globalSetup.ts)) — legitimate test
infrastructure using the service-role key for setup/verification, not application code.

### Before / After per duplicated location

**Batches list — [api/batches/index.ts:83-96](../../src/pages/api/batches/index.ts)**

```
Before: const supabase = context.locals.supabase;
        if (!supabase || !context.locals.user) return jsonError("Server configuration error", 500);
        const { data, error } = await supabase.from("batches").select("*").order("created_at", { ascending: false });
        if (error) return jsonError("Failed to fetch batches", 500);
        return jsonOk(data);
After:  if (!context.locals.batches || !context.locals.user) return jsonError("Server configuration error", 500);
        return jsonOk(await context.locals.batches.listForCurrentUser());   // adapter throws → mapped to 500 by a shared catch
```

**Regenerate RPC — [regenerate.ts:22-53](../../src/pages/api/batches/[id]/diary/regenerate.ts)**

```
Before: const { data: batch } = await supabase.from("batches").select("*").eq("id", batchId).single();
        const typedBatch = batch as Batch;
        const entries = generateProcessPlan({ batch: typedBatch });
        await supabase.rpc("regenerate_diary_entries", { p_batch_id: batchId, p_entries: entries });
        const { data: allEntries } = await supabase.from("diary_entries").select("*")...;
After:  const batch = await context.locals.batches.findById(batchId);          // domain Batch, no cast
        if (!batch) return jsonError("Batch not found", 404);
        const entries = generateProcessPlan({ batch });
        return jsonOk(await context.locals.diary.regenerate(batchId, entries)); // RPC hidden in adapter
```

**SSR page — [pages/batches/[id].astro:10-24](../../src/pages/batches/[id].astro)**

```
Before: const supabase = createClient(Astro.request.headers, Astro.cookies);
        const { data, error } = await supabase.from("batches").select("*").eq("id", id).single();
        const batch = data as Batch;
After:  const batch = await Astro.locals.batches?.findById(id!);
        if (!batch) return new Response(null, { status: 404 });
```

**Identity type — [env.d.ts:3](../../src/env.d.ts) / [Topbar.astro:17](../../src/components/Topbar.astro)**

```
Before: user: import("@supabase/supabase-js").User | null;   // Topbar reads user.email
After:  user: AuthUser | null;                                // { id, email } — Topbar unchanged
```

### Post-refactor guarantees

- **UI** already receives domain-ready JSON (unchanged; no vendor in client bundle).
- **API** returns domain values from ports; no `{ data, error }` unwrap in routes.
- **Persistence** stores domain concepts via adapter mapping; row→domain casts vanish.
- **Only** `adapters/supabase/**` knows the SDK, the table names, and the RPC contract.

### Open questions resolved from the dependency contract

- **PostgREST `single()` "no rows" is an error, not `null`.** Per the PostgREST spec,
  `single()` returns HTTP 406 / a `PGRST116` error when zero rows match — which is why
  the current code treats `error || !data` as "not found"
  ([[id]/index.ts:21](../../src/pages/api/batches/[id]/index.ts)). This decision
  belongs **inside the adapter**: `findById` maps `PGRST116` → `null`, and only real
  failures → `PersistenceError`. Routes must not see PostgREST error codes.
  (Source: PostgREST — Resource Representation / singular responses,
  https://postgrest.org/en/stable/references/api/resource_representation.html.)
- **`delete().select("id").maybeSingle()`** returns `null` when nothing was deleted
  ([[id]/index.ts:72-80](../../src/pages/api/batches/[id]/index.ts)); the adapter's
  `delete()` collapses this to a domain `boolean`, so the 404-vs-204 choice is the
  route's, expressed in domain terms.

---

## STEP 6 — Verification and Refactoring Plan

### 1. Current dependency exposure map

`@supabase/*` awareness across 4 layers + 13 files (STEP 2 list). Vendor verbs
(`from`/`rpc`/`auth`) and the `{ data, error }` envelope duplicated in ~10 handlers.

### 2. Target dependency exposure map

`@supabase/*` and PostgREST/RPC vocabulary confined to `src/lib/adapters/supabase/**`.
`env.d.ts`, middleware, all API routes, and all SSR pages speak ports + domain types.

### 3. Files removed from dependency awareness

`env.d.ts`, `middleware.ts`, `api/auth/{signin,signup,signout}.ts`,
`api/batches/index.ts`, `api/batches/[id]/index.ts`,
`api/batches/[id]/diary/{index,[entryId],regenerate}.ts`, `pages/batches/[id].astro`,
`pages/batches/new.astro`. (`lib/supabase.ts` relocates into the adapter folder.)

### 4. Verification checklist

- [ ] `rg "@supabase" src --glob '!**/__tests__/**' --glob '!**/adapters/**'` → **no matches**.
- [ ] `rg "\.from\(|\.rpc\(|\.auth\." src --glob '!**/adapters/**' --glob '!**/__tests__/**'` → **no matches**.
- [ ] `rg "as Batch|as DiaryEntry" src/pages` → **no matches** (casts moved into mappers).
- [ ] No `eslint-disable ... no-unsafe-assignment` remains in `src/pages/**`.
- [ ] `npm run lint` passes; `npm run build` succeeds.
- [ ] `npm run test` (unit) and `npm run test:integration` pass — behavior preserved.
- [ ] `npm run test:e2e` smoke path (sign-in → list → create → regenerate) green.

### 5. Incremental refactoring phases

Each phase is independently shippable and preserves behavior
([prompt constraint], [infrastructure.md:51](../foundation/infrastructure.md) intent).

| Phase                    | Objective                                                                                                                                                            | Files affected                                                                                                                                                                                                      | Risk                                           | Verification                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **0. Domain seams**      | Add `AuthUser`, `persistence.ts`, and the three port interfaces. No wiring.                                                                                          | `src/lib/domain/*`, `src/lib/ports/*` (new)                                                                                                                                                                         | **Low** (additive)                             | `npm run lint`, `npm run build`                                                                                            |
| **1. Supabase adapters** | Implement batch/diary/auth adapters + `mappers.ts`; move `lib/supabase.ts` → `adapters/supabase/client.ts` (re-export shim to keep imports valid).                   | `src/lib/adapters/supabase/*` (new), `lib/supabase.ts`                                                                                                                                                              | **Low** (additive; nothing calls adapters yet) | Adapter unit tests against a faked client; `build`                                                                         |
| **2. Middleware rewire** | Construct adapters in middleware; attach `locals.{batches,diary,auth,user:AuthUser}`; update `env.d.ts`; keep `locals.supabase` temporarily for un-migrated callers. | [middleware.ts](../../src/middleware.ts), [env.d.ts](../../src/env.d.ts)                                                                                                                                            | **Medium** (auth guard path)                   | `test:integration` smoke + unauthenticated-guard tests                                                                     |
| **3. Batches API**       | Route `api/batches/index.ts` + `[id]/index.ts` through `locals.batches`; delete casts + eslint-disables; add one shared `PersistenceError`→500 catch.                | [batches/index.ts](../../src/pages/api/batches/index.ts), [[id]/index.ts](../../src/pages/api/batches/[id]/index.ts)                                                                                                | **Medium**                                     | Update [**tests**/index.test.ts](../../src/pages/api/batches/__tests__/index.test.ts) to mock the port; `test:integration` |
| **4. Diary API**         | Route diary list/create/update/delete + `regenerate` through `locals.diary`; hide the RPC.                                                                           | [diary/index.ts](../../src/pages/api/batches/[id]/diary/index.ts), [diary/[entryId].ts](../../src/pages/api/batches/[id]/diary/[entryId].ts), [regenerate.ts](../../src/pages/api/batches/[id]/diary/regenerate.ts) | **Medium**                                     | `test:integration` (diary + regenerate lifecycle)                                                                          |
| **5. Auth API**          | Route `signin/signup/signout` through `locals.auth` (`AuthGateway`).                                                                                                 | [signin.ts](../../src/pages/api/auth/signin.ts), [signup.ts](../../src/pages/api/auth/signup.ts), [signout.ts](../../src/pages/api/auth/signout.ts)                                                                 | **Medium** (redirect flows)                    | `test:e2e` auth flow                                                                                                       |
| **6. SSR pages**         | `[id].astro` + `new.astro` use `Astro.locals.batches.findById`; remove `createClient`/casts. `Topbar.astro` already `AuthUser`-compatible.                           | [[id].astro](../../src/pages/batches/[id].astro), [new.astro](../../src/pages/batches/new.astro)                                                                                                                    | **Low**                                        | Manual + `test:e2e` copy-batch path                                                                                        |
| **7. Seal the boundary** | Remove the temporary `locals.supabase` field and the `client.ts` re-export shim; retarget the fake in the unit test to the port.                                     | [env.d.ts](../../src/env.d.ts), unit test, any shim                                                                                                                                                                 | **Low**                                        | Full checklist §4 (all greps empty)                                                                                        |

**Notes / residuals.**

- `lib/config-status.ts` reads `SUPABASE_URL`/`SUPABASE_KEY` names only; leave as-is
  (config, not domain) or fold behind a capability flag later — out of scope.
- Integration-test admin client is intentionally retained as out-of-boundary test
  infra; the success grep excludes `__tests__/**`.
- Optional follow-up: consider generating Supabase row types
  (`supabase gen types`) inside the adapter to make `mappers.ts` fully type-checked
  and delete the last unsafe casts at the source. No evidence such a file exists today.

---

## Executive Summary

The single worst dependency leak is the **Supabase SDK** (`@supabase/ssr` +
`@supabase/supabase-js`): its `SupabaseClient` and `User` types are published on the
app-wide `App.Locals` contract ([env.d.ts:3-4](../../src/env.d.ts)) and consumed raw by
13 non-test files across four layers, with the PostgREST query-builder, the
`regenerate_diary_entries` RPC contract, and the `{ data, error }` envelope duplicated
across roughly ten handlers behind repeated `data as Batch` casts and
`eslint-disable` suppressions. It was chosen over Astro types (the host framework),
`@dnd-kit` (one UI file), and the Cloudflare adapter (config) because only it crosses
multiple boundaries, carries a high, diffuse replacement cost, and directly
contradicts the documented claim that using Supabase already "mitigates DB lock-in"
([infrastructure.md:51](../foundation/infrastructure.md)). The proposed ACL adds
domain-language **ports** (`BatchRepository`, `DiaryRepository`, `AuthGateway`), a
small **`AuthUser`** value object that replaces the vendor `User`, and **Supabase
adapters** that become the sole home of the SDK, the table names, the RPC, and all
row→domain mapping. Isolation is achieved by constructing the adapters once in
middleware and exposing only ports on `context.locals`, so API routes, SSR pages, and
the layout stop speaking Postgres while the already-clean React client bundle is
untouched. The refactor proceeds in eight low-to-medium-risk, behavior-preserving
phases, each verified by the existing unit/integration/e2e suites. Success is
measurable: a `ripgrep` for `@supabase` (and for `.from(` / `.rpc(` / `.auth.`) across
`src`, excluding tests, returns matches **only** within
`src/lib/adapters/supabase/**`.
