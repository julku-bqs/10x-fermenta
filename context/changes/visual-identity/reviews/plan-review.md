<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Visual Identity & Design System

- **Plan**: context/changes/visual-identity/plan.md
- **Mode**: Deep
- **Date**: 2026-06-02
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

16/17 paths ✓ (1 PowerShell escaping false-negative on `[id].astro` — file exists), 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Removing .dark CSS variant breaks button.tsx dark: classes

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Global CSS theme tokens
- **Detail**: Plan says "Remove `.dark` block" from global.css. However, `src/components/ui/button.tsx` uses 4 `dark:` prefixed classes (lines 8, 14, 16, 18): `dark:aria-invalid:ring-destructive/40`, `dark:bg-destructive/60`, `dark:bg-input/30`, `dark:hover:bg-accent/50`. The `@custom-variant dark` on global.css line 4 makes these work. Removing that line AND the `.dark` block makes them silently no-op — the build won't break, but button styling degrades without warning.
- **Fix**: When removing the `.dark` block, also strip `dark:*` prefixed classes from button.tsx (lines 8, 14, 16, 18). Since dark mode is explicitly out of scope, these classes are dead code.
- **Decision**: PENDING

### F2 — SubmitButton overrides theme with hardcoded bg-purple-600

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Auth form sub-components
- **Detail**: Plan says SubmitButton should "use the shared `<Button>` component which now renders burgundy." It already imports `<Button>` — but passes `className="... bg-purple-600 ..."` (line 18), which wins over the theme token via CSS specificity. After Phase 1, auth submit buttons will remain purple, not burgundy.
- **Fix**: Remove the className override from SubmitButton, letting the default `<Button>` variant (bg-primary = burgundy) apply. The plan already identifies this intent — just make it explicit in Phase 3's contract for SubmitButton.tsx.
- **Decision**: PENDING

### F3 — Phase 2 introduces AppLayout but landing page remains on Layout

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 4 vs Phase 3 item 1
- **Detail**: Phase 2 item 4 says "Landing page topbar integration — ensure it uses the new Topbar correctly," but the landing page (`index.astro`) uses `<Layout>` not `<AppLayout>`. Phase 3 then rewrites Welcome.astro entirely. This creates an awkward intermediate state after Phase 2: the landing page has old cosmic content but a new-styled topbar floating over a dark background — visually broken until Phase 3 fixes it.
- **Fix A ⭐ Recommended**: Remove Phase 2 item 4 entirely
  - Strength: Phase 3 rewrites Welcome.astro anyway — touching it in Phase 2 is wasted work. Avoids ugly intermediate.
  - Tradeoff: Landing page topbar is visually broken between Phase 2 and Phase 3, but acceptable since phases ship together.
  - Confidence: HIGH — the rewrite in Phase 3 supersedes it.
  - Blind spot: None significant.
- **Fix B**: Move landing page rewrite into Phase 2
  - Strength: No intermediate broken state.
  - Tradeoff: Phase 2 becomes much larger (layout infra + full landing page rewrite), harder to test in isolation.
  - Confidence: MEDIUM — bigger phase = more risk per commit.
  - Blind spot: Landing page copy quality needs manual review anyway.
- **Decision**: PENDING

### F4 — Phase 1 manual criterion promises cream BG before Phase 3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Manual Verification
- **Detail**: Phase 1 criterion says "Landing page renders with new warm cream background" but the landing page uses `bg-cosmic` inline — changing CSS tokens won't override that. Cream BG only appears after Phase 3 removes `bg-cosmic`. The criterion should reference batch pages (which use `bg-background` token) instead.
- **Fix**: Reword Phase 1 manual criterion to "Batch pages render with warm cream background and burgundy buttons."
- **Decision**: PENDING
