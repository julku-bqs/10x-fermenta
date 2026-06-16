---
date: "2026-06-16T23:39:53+02:00"
researcher: Copilot
git_commit: 1ab73e18196a2c052d37c62b1b8a1181776e1506
branch: s-03
repository: julku-bqs/10x-fermenta
topic: "Find unused code, dead exports, unused components, and duplicated patterns"
tags: [research, codebase, unused-code, dead-code, duplication]
status: complete
last_updated: "2026-06-16"
last_updated_by: Copilot
---

# Research: Unused Code & Duplication Analysis

**Date**: 2026-06-16T23:39:53+02:00
**Researcher**: Copilot
**Git Commit**: 1ab73e18196a2c052d37c62b1b8a1181776e1506
**Branch**: s-03
**Repository**: julku-bqs/10x-fermenta

## Research Question

Find unused code issues: dead exports, unused components, duplicated logic, and unused dependencies. Propose changes without implementing them.

## Summary

The codebase has **7 unused exports**, **1 unused component**, **1 unused npm dependency**, and **8 patterns of significant code duplication** across API routes and components. The highest-impact cleanup targets are the repeated UUID regex (4 files) and the Supabase+auth boilerplate (7 routes).

---

## 1. Unused Exports (7 total)

### Unused Type Exports

| Symbol | Location | Notes |
|--------|----------|-------|
| `ApiResponse<T>` | `src/types.ts:65` | Generic response type never imported anywhere |
| `CreateBatchInput` | `src/lib/schemas/batch.ts:40` | Zod-inferred type, unused |
| `UpdateBatchInput` | `src/lib/schemas/batch.ts:41` | Zod-inferred type, unused |
| `IngredientInput` | `src/lib/schemas/batch.ts:42` | Zod-inferred type, unused |
| `UpdateDiaryEntryInput` | `src/lib/schemas/diary-entry.ts:18` | Zod-inferred type, unused |

### Unused Constants

| Symbol | Location | Notes |
|--------|----------|-------|
| `configStatuses` | `src/lib/config-status.ts:11` | Exported but only used internally to derive `missingConfigs` |
| `buttonVariants` | `src/components/ui/button.tsx:50` | CVA variants only used inside the same file |

### Proposal

- **`ApiResponse<T>`**: Safe to remove — no consumers. If we need it later, it's trivial to recreate.
- **Schema types** (`CreateBatchInput`, `UpdateBatchInput`, `IngredientInput`, `UpdateDiaryEntryInput`): Keep exports but mark as intentional API surface. These are useful for consumers of the schemas (tests, future form components). Tradeoff: removing them saves zero bytes (types are erased at compile time) but hurts discoverability.
- **`configStatuses`**: Remove `export` keyword — keep as module-private `const`.
- **`buttonVariants`**: Remove `export` — only used inside button.tsx. shadcn/ui exports it by default for composition, but we don't use it externally.

---

## 2. Unused Components (1 total)

| Component | Location | Notes |
|-----------|----------|-------|
| `LibBadge.astro` | `src/components/ui/LibBadge.astro` | Not referenced anywhere |

### Proposal

- **Delete `LibBadge.astro`** — no consumers, no references. If it was a shadcn component installed speculatively, it can be re-added later.

---

## 3. Unused NPM Dependencies (1 total)

| Package | Type | Notes |
|---------|------|-------|
| `@eslint/compat` | devDependency | Not imported in `eslint.config.js` or anywhere else |

### Proposal

- **Remove `@eslint/compat`** from devDependencies. The config uses `tseslint.config()` directly. Run `npm uninstall @eslint/compat` to clean up.

---

## 4. Duplicated Logic (8 patterns)

### 4.1 UUID Regex — 🔴 HIGH priority

**Pattern:** `const UUID_REGEX = /^[0-9a-f]{8}-...$/i;` duplicated in 4 files.

**Files:**
- `src/pages/api/batches/[id]/index.ts:6`
- `src/pages/api/batches/[id]/diary/[entryId].ts:6`
- `src/pages/api/batches/[id]/diary/index.ts:6`
- `src/pages/api/batches/[id]/diary/regenerate.ts:7`

**Proposal:** Move to `src/lib/validators.ts` as a single exported constant. All routes import from there.

**Tradeoffs:** Minimal — tiny change, no runtime cost, reduces 4 definitions to 1.

---

### 4.2 Supabase Client + Auth Guard — 🔴 HIGH priority

**Pattern:**
```typescript
const supabase = createClient(context.request.headers, context.cookies);
if (!supabase || !context.locals.user) {
  return jsonError("Server configuration error", 500);
}
```

**Files:** 7+ API route handlers (every protected endpoint).

**Proposal:** Create `getAuthenticatedClient(context)` in `src/lib/api.ts` that returns `{ supabase, user }` or throws/returns an error Response. Each route becomes a one-liner.

**Tradeoffs:**
- Pro: Eliminates ~3 lines × 10+ handlers = 30+ lines of boilerplate
- Con: Slightly less explicit per-route; need to handle the "error response" return pattern (e.g., return a discriminated union `{ ok: true, supabase, user } | { ok: false, response: Response }`)

---

### 4.3 JSON Body Parsing — 🟡 MEDIUM priority

**Pattern:**
```typescript
let body: unknown;
try { body = await context.request.json(); }
catch { return jsonError("Invalid JSON body", 400); }
```

**Files:** 4 POST/PUT routes.

**Proposal:** Add `parseJsonBody(request)` to `src/lib/api.ts` returning `{ data: unknown } | { error: Response }`.

**Tradeoffs:** Saves ~5 lines per route. Low risk since it's a pure function.

---

### 4.4 UUID Param Validation — 🟡 MEDIUM priority

**Pattern:**
```typescript
const id = context.params.id;
if (!id || !UUID_REGEX.test(id)) { return jsonError("Invalid batch ID", 400); }
```

**Files:** 3 routes + 1 with dual-ID validation.

**Proposal:** Add `validateUuidParam(params, name)` to `src/lib/validators.ts` returning the validated string or an error Response.

---

### 4.5 Zod Schema Validation — 🟡 MEDIUM priority (partially solved)

**Pattern:** `safeParse` + `jsonValidationError` repeated in 6 routes.

**Proposal:** Add `validateBody<T>(body, schema)` returning `{ data: T } | { error: Response }` — combines JSON parsing + schema validation in one call. Note: auth routes use redirects, so this helper only applies to JSON API routes.

---

### 4.6 Email Validation Regex — 🟡 MEDIUM priority

**Pattern:** Identical `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` in both `SignInForm.tsx` and `SignUpForm.tsx`.

**Proposal:** Extract to `src/lib/validators.ts` as `isValidEmail(email: string): boolean`.

**Tradeoffs:** Tiny win (1 line saved per form), but eliminates drift risk if validation rules change.

---

### 4.7 Fetch with JSON Headers — 🟡 MEDIUM priority

**Pattern:** `headers: { "Content-Type": "application/json" }` repeated 7+ times in DiarySection and BatchForm.

**Proposal:** Create `fetchJson(url, options)` wrapper in `src/lib/api.ts` (client-side) that auto-sets content-type and parses response.

**Tradeoffs:**
- Pro: Single error-handling path, less repetition
- Con: Adds abstraction layer over fetch; some teams prefer explicit fetch calls

---

### 4.8 Error Handling in Components — 🟢 LOW priority

**Pattern:** Inconsistent try-catch + error state management across DiarySection operations.

**Proposal:** Standardize with the fetchJson wrapper (4.7) which can throw typed errors. Lower priority — works as-is.

---

## Architecture Insights

- The API layer follows a consistent pattern but lacks shared middleware/helpers for cross-cutting concerns (auth, parsing, validation). This is typical for early Astro API routes.
- Type exports from schema files are "free" (erased at compile time) — removing them saves nothing but may hurt future consumers.
- The `src/lib/api.ts` file already has `jsonOk`, `jsonError`, etc. — it's the natural home for the proposed helpers.

## Recommended Cleanup Order

1. **Quick wins (< 5 min each):** Remove `LibBadge.astro`, uninstall `@eslint/compat`, un-export `configStatuses` and `buttonVariants`
2. **Medium wins (30 min):** Extract UUID regex and `validateUuidParam` to `src/lib/validators.ts`
3. **High-value refactor (1-2 hrs):** Create `getAuthenticatedClient()`, `parseJsonBody()`, `validateBody()` in `src/lib/api.ts` and update all routes
4. **Client-side helpers (30 min):** Extract `isValidEmail()` and `fetchJson()` for component use

## Open Questions

- Should the schema-inferred types (`CreateBatchInput`, etc.) stay exported as intentional API surface for future tests/consumers?
- For the Supabase+auth guard (4.2), should we use a discriminated union return or throw+catch pattern?
- Is `fetchJson` worth the abstraction, or do we prefer explicit fetch calls for readability?
