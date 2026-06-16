---
date: 2026-06-16T23:36:51+02:00
researcher: Copilot
git_commit: 3fb90912dc3a9d7a6a3d79b81cf182267e5e3120
branch: s-03
repository: julku-bqs/10x-fermenta
topic: "Codebase pattern inconsistencies: test location, exports, props, error handling"
tags: [research, codebase, patterns, consistency, testing, conventions]
status: complete
last_updated: 2026-06-16
last_updated_by: Copilot
---

# Research: Codebase Pattern Inconsistencies

**Date**: 2026-06-16T23:36:51+02:00
**Researcher**: Copilot
**Git Commit**: 3fb90912dc3a9d7a6a3d79b81cf182267e5e3120
**Branch**: s-03
**Repository**: julku-bqs/10x-fermenta

## Research Question

Find pattern inconsistency issues across the codebase — test file placement, export styles, naming conventions, error handling — and propose the idiomatic fix for each.

## Summary

Six inconsistency categories were identified. The most impactful are: (1) mixed test file location, (2) default vs named exports, (3) component props naming, and (4) systematic ESLint disables hiding Supabase typing gaps. Each has a clear majority pattern that should become the standard.

## Detailed Findings

### 1. Test File Location (HIGH priority)

**Current state — two patterns coexist:**

| Pattern | Files | Count |
|---------|-------|-------|
| Co-located `*.test.ts` next to source | `schemas/batch.test.ts`, `services/sugar-calculation.test.ts`, `services/batch-validation.test.ts` | 3 |
| `__tests__/` subfolder | `services/__tests__/process-plan-generation.test.ts` | 1 |

**Recommendation: Co-located (majority pattern)**

Rationale:
- 3 out of 4 test files already use co-location.
- Vitest defaults to discovering `*.test.ts` anywhere — no config change needed.
- Co-location provides instant discoverability (test is next to implementation).
- The Astro/Vite ecosystem conventions favor co-location over `__tests__/`.

**Fix:**
- Move `src/lib/services/__tests__/process-plan-generation.test.ts` → `src/lib/services/process-plan-generation.test.ts`
- Delete the empty `__tests__/` directory.

---

### 2. Export Patterns (MEDIUM priority)

**Current state:**

| Pattern | Files |
|---------|-------|
| Named exports (`export function X`) | ~95% of components and all lib modules |
| Default exports (`export default function X`) | `SignInForm.tsx`, `SignUpForm.tsx` |

**Recommendation: Named exports everywhere**

Rationale:
- Named exports enable better tree-shaking, IDE auto-imports, and refactoring.
- The overwhelming majority of the codebase already uses named exports.
- Astro components import by name from `client:load` directives.

**Fix:**
- `src/components/auth/SignInForm.tsx`: change `export default function SignInForm` → `export function SignInForm`
- `src/components/auth/SignUpForm.tsx`: change `export default function SignUpForm` → `export function SignUpForm`
- Update corresponding Astro page imports (from default import to named import).

---

### 3. Component Props Naming (MEDIUM priority)

**Current state:**

| Pattern | Files | Count |
|---------|-------|-------|
| `ComponentNameProps` | BatchFormProps, BatchListProps, UserMenuProps, FormFieldProps, etc. | 13 |
| Generic `Props` | SignInForm, SignUpForm | 2 |

**Recommendation: `ComponentNameProps` (majority pattern)**

Rationale:
- Descriptive naming avoids naming collisions when refactoring.
- 13 of 15 component interfaces already use this convention.
- Only the two auth form components use the generic `Props` name.

**Fix:**
- `src/components/auth/SignInForm.tsx`: rename `interface Props` → `interface SignInFormProps`
- `src/components/auth/SignUpForm.tsx`: rename `interface Props` → `interface SignUpFormProps`

---

### 4. ESLint Disables — Supabase Typing (MEDIUM priority)

**Current state:**
7 API files + 1 Astro page suppress `@typescript-eslint/no-unsafe-assignment` because Supabase `.select("*")` returns untyped data.

Affected files:
- `src/pages/api/batches/index.ts`
- `src/pages/api/batches/[id]/index.ts`
- `src/pages/api/batches/[id]/diary/index.ts`
- `src/pages/api/batches/[id]/diary/[entryId].ts`
- `src/pages/api/batches/[id]/diary/regenerate.ts`
- `src/pages/batches/[id].astro`

**Recommendation: Type Supabase queries with generated types**

Proper fix: use `supabase-js` generic typing on the client or cast results with `as Database['public']['Tables']['batches']['Row']`. This removes the need for eslint-disable comments entirely.

---

### 5. Relative Imports (LOW priority)

**Current state:**
Two diary components use relative paths instead of the `@/` alias:
- `src/components/batches/diary/EntryRow.tsx:4` — `import { batchInputClass } from "../styles";`
- `src/components/batches/diary/DiarySection.tsx:4` — `import { batchInputClass } from "../styles";`

**Recommendation:** Convert to `@/components/batches/styles` for consistency with the rest of the codebase (33 other files all use `@/`).

---

### 6. DELETE Response Helper (LOW priority)

**Current state:**
- `src/pages/api/batches/[id]/diary/[entryId].ts:66` returns `new Response(null, { status: 204 })` instead of using the json helper functions from `src/lib/api.ts`.

**Recommendation:** Add a `jsonNoContent()` helper to `src/lib/api.ts` and use it, or keep the raw Response (204 No Content with null body is standard REST — a helper would be empty sugar). Mark as "acceptable deviation" and document the pattern.

---

### 7. Missing try/catch in regenerate endpoint (LOW priority)

**Current state:**
- `src/pages/api/batches/[id]/diary/regenerate.ts` does NOT wrap `context.request.json()` in try/catch, while all other POST/PUT endpoints do.

**Recommendation:** Add the same try/catch pattern for `context.request.json()` as the other endpoints.

## Code References

- `src/lib/services/__tests__/process-plan-generation.test.ts` — lone `__tests__` folder test
- `src/lib/services/sugar-calculation.test.ts` — co-located test (majority pattern)
- `src/components/auth/SignInForm.tsx:36` — default export (minority pattern)
- `src/components/auth/SignUpForm.tsx:13` — default export (minority pattern)
- `src/components/auth/SignInForm.tsx:8` — generic `Props` interface
- `src/lib/api.ts:3-31` — JSON response helpers (jsonOk, jsonError, jsonCreated, jsonValidationError)
- `vitest.config.ts:1-13` — Vitest config (globals enabled, @ alias)
- `src/components/batches/diary/EntryRow.tsx:4` — relative import

## Architecture Insights

The codebase follows clear conventions in most areas:
- **Astro env schema** for secrets (type-safe, no process.env leaks)
- **Single Supabase client factory** with consistent null-check guards
- **Zod schemas** centralized in `src/lib/schemas/` with inferred types
- **Functional grouping** (services/, schemas/, components by feature)

The inconsistencies are concentrated in the auth components (written earlier?) and the one legacy `__tests__` folder. The batch/diary code follows consistent patterns — likely written after conventions solidified.

## Proposed Fix Priority

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Move `__tests__/` test to co-located | 5 min | High — removes confusing precedent |
| 2 | Named exports in auth forms | 5 min | Medium — consistency |
| 3 | Rename `Props` → `ComponentNameProps` | 5 min | Medium — consistency |
| 4 | Fix relative imports in diary components | 2 min | Low — consistency |
| 5 | Add try/catch in regenerate endpoint | 2 min | Low — robustness |
| 6 | Supabase typed queries (remove eslint-disables) | 30 min | Medium — type safety |

## Open Questions

- Should Supabase types be generated via `supabase gen types` or manually maintained? (affects fix #6 approach)
- Is there a preference for keeping 204 as raw Response vs adding a helper?
