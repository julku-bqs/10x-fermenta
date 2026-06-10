<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Visual Identity & Design System

- **Plan**: context/changes/visual-identity/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | WARNING ⚠️ |
| Safety & Quality | WARNING ⚠️ |
| Architecture | PASS ✅ |
| Pattern Consistency | WARNING ⚠️ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — IngredientsList is editable, not read-only as planned

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/batches/IngredientsList.tsx
- **Detail**: Plan specified a read-only display component with props `{ yeastName: string | null; yeastTolerance: number | null }` and a "Coming soon" placeholder. Actual implementation is a full inline editor with toggle, callbacks, and error props. This makes sense functionally (the form needs to edit yeast), but contradicts the plan which deferred interactivity to S-02.
- **Fix**: Accept as-is — the plan was internally contradictory (moved yeast editing here while calling it "read-only"). Document the drift in plan Progress notes.
- **Decision**: DISMISSED — false positive; IngredientsList was updated by S-02, not this change

### F2 — Unplanned scope additions: LayoutToggle, PasswordToggle, SignUpForm validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/batches/LayoutToggle.tsx, src/components/auth/PasswordToggle.tsx, src/components/auth/SignUpForm.tsx
- **Detail**: Three unplanned components add user-facing features beyond visual restyling: (1) LayoutToggle adds a cards/table view switcher with localStorage persistence; (2) PasswordToggle adds show/hide for password fields; (3) SignUpForm adds client-side email validation, password strength checking, and confirm-password matching. None of these are in the plan or its scope guardrails.
- **Fix A ⭐ Recommended**: Accept as shipped — they improve UX, are already merged, and don't introduce regressions. Add a plan addendum noting the scope expansion.
  - Strength: Preserves working code; acknowledges reality in the plan.
  - Tradeoff: Sets a precedent that scope can silently expand in visual changes.
  - Confidence: HIGH — no breaking changes, all pass build/lint.
  - Blind spot: None significant.
- **Fix B**: Record a lesson that visual-identity changes should not introduce new interactive logic.
  - Strength: Establishes a recurring rule preventing scope creep in restyling work.
  - Tradeoff: Doesn't undo current additions (they're already shipped).
  - Confidence: MEDIUM — depends on team preference for scope discipline.
  - Blind spot: May be too strict for small quality-of-life additions.
- **Decision**: ACCEPTED (Fix A) — scope expansion accepted as shipped; plan addendum noted

### F3 — Render-blocking Google Fonts CSS import

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/styles/global.css:1
- **Detail**: `@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:...")` inside CSS is render-blocking — the browser must fetch the remote stylesheet before any painting. This adds a full network round-trip to the critical rendering path. The plan noted using `font-display: swap` to avoid layout shift but didn't prescribe the loading method.
- **Fix**: Move the font load to `<link rel="preconnect">` + `<link rel="stylesheet">` in `src/layouts/Layout.astro`'s `<head>`, removing the CSS `@import`.
- **Decision**: FIXED — moved to <link> in Layout.astro <head>

### F4 — BatchForm uses hard-coded red error colors instead of semantic tokens

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/batches/BatchForm.tsx:35-36, 260, 269
- **Detail**: `inputErrorClass = "border-red-400 focus:border-red-500 focus:ring-red-400/30"` and error banner uses `text-red-600`, `bg-red-50`, `border-red-300`. Meanwhile auth components (`ServerError.tsx`, `FormField.tsx`) correctly use the `--destructive` semantic token (`text-destructive`, `border-destructive/30`, `bg-destructive/10`). The batch form errors won't respond to palette changes.
- **Fix**: Replace `border-red-400` → `border-destructive/60`, `text-red-600` → `text-destructive`, `bg-red-50` → `bg-destructive/10`, `border-red-300` → `border-destructive/30` to match auth error patterns.
- **Decision**: FIXED — replaced with semantic destructive token classes

### F5 — Auth API routes missing zod input validation

- **Severity**: ⚠️ WARNING (pre-existing)
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Security)
- **Location**: src/pages/api/auth/signin.ts:5-7
- **Detail**: Auth routes cast form data without validation (`form.get("email") as string`). If a field is missing, `null` is coerced to `string`. Batches API properly uses zod schemas. This violates the project rule: "API route handlers must validate input with zod schemas." NOTE: This is likely a pre-existing issue not introduced by this change, but the file was touched in this PR.
- **Fix A ⭐ Recommended**: Fix in a follow-up change — create `signInSchema`/`signUpSchema` and parse form data before passing to Supabase.
  - Strength: Aligns with project conventions; catches null/undefined cleanly.
  - Tradeoff: Not part of visual-identity scope; separate PR.
  - Confidence: HIGH — pattern established in batches API.
  - Blind spot: None.
- **Fix B**: Fix now in this review cycle.
  - Strength: Resolves the convention violation immediately.
  - Tradeoff: Expands this change's scope further.
  - Confidence: HIGH — straightforward implementation.
  - Blind spot: May need to update signup route too.
- **Decision**: FIXED (Fix B) — added zod schemas for signin/signup API routes

### F6 — Redundant `font-['Playfair_Display']` on h1 elements

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/Welcome.astro:10, src/pages/auth/signin.astro:13, src/pages/auth/signup.astro:13, src/pages/auth/confirm-email.astro:25
- **Detail**: `global.css` applies `font-family: "Playfair Display"` to all h1/h2/h3 in `@layer base`. Yet every `<h1>` also carries `font-['Playfair_Display']` as a Tailwind arbitrary value. This is redundant — if the brand font changes, both locations need updating.
- **Fix**: Remove `font-['Playfair_Display']` from `<h1>` elements since they inherit from the base layer. Keep it only on non-heading elements (e.g., the Topbar `<a>` link).
- **Decision**: FIXED — removed redundant font class from all h1 elements
