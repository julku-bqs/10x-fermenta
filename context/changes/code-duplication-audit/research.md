---
date: "2026-06-16T23:29:00+02:00"
researcher: Copilot
git_commit: 9aa72488cd6d5e1195be61a751dd83033ed89a3a
branch: s-03
repository: julku-bqs/10x-fermenta
topic: "Code duplication audit — duplicated methods, components, and logic blocks"
tags: [research, codebase, duplication, refactoring, DRY]
status: complete
last_updated: "2026-06-16"
last_updated_by: Copilot
---

# Research: Code Duplication Audit

**Date**: 2026-06-16T23:29:00+02:00
**Researcher**: Copilot
**Git Commit**: 9aa72488cd6d5e1195be61a751dd83033ed89a3a
**Branch**: s-03
**Repository**: julku-bqs/10x-fermenta

## Research Question

Identify code duplication across the codebase — not single duplicated lines, but duplicated methods, components, and logic blocks (by implementation, not just name).

## Summary

The codebase has **five major duplication clusters**:

1. **Auth forms** — SignInForm/SignUpForm share ~70% of their logic (validation, handlers, JSX structure).
2. **API route boilerplate** — Supabase init, auth guard, UUID validation, JSON parsing, and Zod error handling are copy-pasted across all 5 batch API routes plus 2 auth routes.
3. **Batch components** — Repeated object-building/parsing in BatchForm, duplicated label maps, shared prop interfaces, and repeated localStorage/date patterns.
4. **Type/interface redefinition** — Domain types (Ingredient, BatchParams, DiaryEntry, sweetness/type unions) are redefined in services instead of imported from `types.ts`.
5. **Business logic** — "dry vs non-dry" branching and total-sugar arithmetic appear in 3 separate services.

---

## Detailed Findings

### 1. Auth Forms (SignInForm / SignUpForm)

| Duplicated Code | SignInForm | SignUpForm |
|---|---|---|
| Email validation | `:18-24` | `:22-30` |
| Password required check | `:25-27` | `:31-35` |
| `clearError` helper | `:32-34` | `:47-49` |
| `handleSubmit` handler | `:36-40` | `:51-55` |
| Form `<form>` attributes | `:43` | `:66` |
| Email field JSX | `:44-56` | `:67-79` |
| Password field JSX | `:58-78` | `:81-102` |
| `onChange` → `setValue` + `clearError` | `:49-52, 63-66` | `:72-75, 86-89, 110-113` |
| ServerError placement | `:80` | `:127` |
| SubmitButton usage | `:82-84` | `:129-131` |

**Astro page shell** is also duplicated:
- `src/pages/auth/signin.astro:2-20`
- `src/pages/auth/signup.astro:2-20`

**Extraction opportunity**: A `useAuthForm` hook + `AuthPageShell.astro` layout wrapper.

---

### 2. API Route Boilerplate

#### 2a. Supabase init + auth/config guard (copied in every batch route)

- `src/pages/api/batches/index.ts:9-12, 83-86`
- `src/pages/api/batches/[id]/index.ts:9-12, 29-32`
- `src/pages/api/batches/[id]/diary/index.ts:9-12, 34-37`
- `src/pages/api/batches/[id]/diary/regenerate.ts:10-13`
- `src/pages/api/batches/[id]/diary/[entryId].ts:9-12, 49-52`

#### 2b. UUID_REGEX constant (identical definition in 4 files)

- `src/pages/api/batches/[id]/index.ts:6`
- `src/pages/api/batches/[id]/diary/index.ts:6`
- `src/pages/api/batches/[id]/diary/regenerate.ts:7`
- `src/pages/api/batches/[id]/diary/[entryId].ts:6`

#### 2c. Batch ID validation block (same test + 400 response)

- `src/pages/api/batches/[id]/index.ts:14-17, 34-37`
- `src/pages/api/batches/[id]/diary/index.ts:14-17, 39-42`
- `src/pages/api/batches/[id]/diary/regenerate.ts:15-18`
- `src/pages/api/batches/[id]/diary/[entryId].ts:14-18, 54-58`

#### 2d. JSON body parse try/catch

- `src/pages/api/batches/index.ts:14-19`
- `src/pages/api/batches/[id]/index.ts:39-44`
- `src/pages/api/batches/[id]/diary/index.ts:44-49`
- `src/pages/api/batches/[id]/diary/[entryId].ts:20-25`

#### 2e. Zod validation failure handling

- `src/pages/api/batches/index.ts:21-24`
- `src/pages/api/batches/[id]/index.ts:46-49`
- `src/pages/api/batches/[id]/diary/index.ts:51-54`
- `src/pages/api/batches/[id]/diary/[entryId].ts:27-30`

#### 2f. Auth form parsing + redirect (same in both auth routes)

- `src/pages/api/auth/signin.ts:6-15, 19-22, 25-27`
- `src/pages/api/auth/signup.ts:6-15, 19-22, 25-27`

#### 2g. Diary query duplicated

- `src/pages/api/batches/[id]/diary/index.ts:19-24`
- `src/pages/api/batches/[id]/diary/regenerate.ts:42-47`

**Extraction opportunity**: A `withAuthenticatedBatch(handler)` middleware wrapper that handles Supabase init, config check, auth, UUID parse, and batch existence. Move `UUID_REGEX` to `src/lib/utils.ts`.

---

### 3. Batch Components

#### 3a. Form state ↔ domain object mapping (repeated 3× inside BatchForm)

- `src/components/batches/BatchForm.tsx:38-49`
- `src/components/batches/BatchForm.tsx:84-95`
- `src/components/batches/BatchForm.tsx:104-116`

And form → domain parsing repeated at:
- `src/components/batches/BatchForm.tsx:161-174, 414-426, 449-461`

#### 3b. Duplicated label maps (wine type → display string)

- `src/components/batches/BatchList.tsx:3-12`
- `src/components/batches/BatchTable.tsx:3-9`

#### 3c. Identical `batches` prop interface

- `src/components/batches/BatchListPage.tsx:9-11`
- `src/components/batches/BatchList.tsx:67-69`
- `src/components/batches/BatchTable.tsx:11-13`

#### 3d. localStorage-backed UI preference pattern

- `src/components/batches/BatchListPage.tsx:7, 14-22`
- `src/components/batches/diary/DiarySection.tsx:11, 20-24, 40, 69-75`

#### 3e. "Default date = today" logic (repeated 6+ times)

- `BatchForm.tsx:40, 107, 163, 301-304`
- `diary/DiarySection.tsx:281, 288, 321-324`
- `diary/EntryRow.tsx:34-40, 78-81`

#### 3f. Diary add/edit form duplicated

- `diary/DiarySection.tsx:313-359`
- `diary/EntryRow.tsx:71-116`

#### 3g. Repeated fetch/API call pattern in DiarySection

- `diary/DiarySection.tsx:49-61, 77-92, 94-106, 108-115, 122-130, 132-149`

**Extraction opportunity**: Extract `useLocalStorageState` hook, `useBatchFormMapper` for state↔domain, shared `LABEL_MAPS` constant, `DiaryEntryForm` component, and a generic `useApiMutation` hook.

---

### 4. Type/Interface Redefinition

| Redefined Type | Canonical Location | Duplicate Locations |
|---|---|---|
| `Ingredient` shape | `src/types.ts:3-7` | `src/lib/services/sugar-calculation.ts:23-26`, `src/lib/schemas/batch.ts:4-8` |
| `BatchParams` subset | `src/types.ts:51-63` | `src/lib/services/batch-validation.ts:10-19` |
| `DiaryEntry` subset | `src/types.ts:39-48` | `src/lib/services/process-plan-generation.ts:9-13` |
| `"pulp" \| "juice"` union | `src/types.ts:14, 31, 54` | `src/lib/schemas/batch.ts:13` |
| Sweetness values | `src/types.ts:1, 34` | `src/lib/schemas/batch.ts:16, 32` |

**Extraction opportunity**: Import from `types.ts` or create shared `src/lib/domain-constants.ts` for unions/enums.

---

### 5. Duplicated Business Logic

#### 5a. "Dry vs non-dry" branching (3 services)

- `src/lib/services/sugar-calculation.ts:5-17, 50-51`
- `src/lib/services/batch-validation.ts:45-55, 97-107`
- `src/lib/services/process-plan-generation.ts:47, 137-147`

#### 5b. Total sugar arithmetic (duplicated within batch-validation)

- `src/lib/services/batch-validation.ts:72-75`
- `src/lib/services/batch-validation.ts:82-94`

#### 5c. Supabase config check

- `src/lib/config-status.ts:14`
- `src/lib/supabase.ts:6-8`

#### 5d. Default date formatting

- `src/lib/schemas/batch.ts:12`
- `src/pages/api/batches/index.ts:65`
- `src/pages/api/batches/[id]/diary/index.ts:63`

---

### 6. Test Code Duplication

- `sugar-calculation.test.ts` repeats near-identical input objects across 12+ test cases — a factory helper would eliminate ~80 lines.
- `batch.test.ts` repeats `safeParse(baseFields)` + `expect(result.success)` + guarded access pattern ~15 times.

---

## Architecture Insights

- The codebase already centralizes **UI primitives** well (FormField, PasswordToggle, ServerError, SubmitButton, api.ts response helpers).
- The main gap is **mid-level abstractions**: route middleware, form state hooks, domain constant re-exports, and composable service helpers for shared business rules.
- Astro's file-based routing doesn't natively support middleware chaining per-route, but a `withAuth` wrapper function pattern would work.

## Code References

- `src/components/auth/SignInForm.tsx` — auth form logic
- `src/components/auth/SignUpForm.tsx` — auth form logic (duplicate)
- `src/pages/api/batches/[id]/index.ts` — representative batch route
- `src/components/batches/BatchForm.tsx` — largest component, most internal duplication
- `src/lib/services/batch-validation.ts` — business logic with type + logic duplication
- `src/types.ts` — canonical type definitions (not always imported)

## Open Questions

1. Should the refactoring be done as a single change or broken into smaller PRs per cluster?
2. Is there appetite for a route-middleware pattern (`withAuth`, `withBatchId`) or should the Astro SSR approach stay file-contained?
3. Should the domain constants (`sweetness`, `wine_type`) become a shared enum/const-object or stay as Zod-derived types?
