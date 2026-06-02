# Visual Identity & Design System Implementation Plan

## Overview

Establish Fermenta's warm winery visual identity — a cohesive design language using earth tones (burgundy, amber, cream) with Playfair Display headings — and restructure the batch form from a vertical stack into a 2-column card grid that scales as future sections (ingredients, diary, notes) are added. All existing pages (landing, auth, batch list, batch form) will be restyled to the new identity.

## Current State Analysis

- **Landing page** (`src/components/Welcome.astro`): Uses a "cosmic" dark theme (purple/blue/indigo gradients, star field, glassmorphism cards) branded as "10x Astro Starter" — entirely generic, no winery identity.
- **Auth pages** (`src/pages/auth/{signin,signup,confirm-email}.astro`): Same cosmic dark theme with glassmorphism card containers, purple/blue gradient text.
- **Batch pages** (`src/pages/batches/`): Plain white background, hardcoded Tailwind grays (`gray-700`, `gray-300`) and blue accents (`blue-600`). Not using CSS theme tokens.
- **Batch form** (`src/components/batches/BatchForm.tsx`): Vertical `space-y-8` stack with `max-w-xl` — three sections (Basics, Parameters, Yeast). Will not scale as ingredients, diary, and notes sections are added.
- **Topbar** (`src/components/Topbar.astro`): Only renders on the landing page. Batch pages have no global navigation; user cannot navigate back to landing from batches.
- **Theme tokens** (`src/styles/global.css`): Defines shadcn/ui CSS variables with a neutral gray palette (oklch with 0 chroma). Batch components don't use these — they hardcode Tailwind color classes.
- **Font**: No custom fonts loaded; uses default system font stack.

### Key Discoveries:

- `global.css:6-39` — All CSS variables are neutral (0 chroma in oklch) — switching to warm tones means updating these variables to include chroma values
- `src/components/batches/BatchForm.tsx:24-28` — Input/label styles are defined as string constants at module level — easy to update once, affects all fields
- `src/layouts/Layout.astro` — No shared nav/chrome for authenticated pages; the slot renders bare content
- `components.json:9` — shadcn/ui base color is "neutral"; button component (`src/components/ui/button.tsx`) uses theme tokens already
- The `bg-cosmic` utility (`global.css:113-115`) is only used on landing/auth — it will be replaced entirely

## Desired End State

After this plan is complete:
- The app has a warm, winery-themed visual identity with cream backgrounds, burgundy primary actions, amber secondary actions, and Playfair Display for headings.
- A floating topbar provides global navigation on all authenticated pages (home, batches, sign out).
- The landing page says "Fermenta" with a winery-appropriate motto, features that describe the product, and warm earth-tone styling with Playfair Display headings.
- Auth pages have warm cream backgrounds with burgundy-accented forms instead of dark cosmic glassmorphism.
- The batch form uses a 2-column responsive card grid (basics + params in top row; ingredients list mockup + diary placeholder in main row).
- Yeast is displayed as the first item in an ingredients list component (a static mockup ready for S-02 to make interactive).
- All hardcoded gray/blue classes are replaced with theme tokens so future components inherit the identity automatically.

**Verification**: Build succeeds, lint passes, all pages render with the new styling. Visual inspection confirms consistent warm earth-tone palette across landing → auth → batch list → batch form.

## What We're NOT Doing

- No dark mode implementation (cream light theme only in this change; dark mode can be added later)
- No responsive mobile optimization beyond basic single-column collapse
- No ingredients CRUD logic (that's S-02) — only a static list component showing yeast
- No diary/process CRUD (that's S-03) — only a placeholder slot in the grid
- No new shadcn/ui components beyond what's needed (tabs, card if required)
- No animation/transition work beyond basic hover states
- No accessibility audit beyond ensuring text contrast meets WCAG AA on the new palette

## Implementation Approach

Work bottom-up: establish tokens first (Phase 1), then build the layout infrastructure (Phase 2), then restyle pages from least-complex to most-complex (Phase 3 for landing/auth, Phase 4 for batch pages with the form restructuring). This ordering means each phase builds on a stable foundation — Phase 2 pages immediately inherit Phase 1 tokens, and Phase 4's complex grid layout benefits from the AppLayout chrome already being in place.

## Phase 1: Design System Foundation

### Overview

Replace the neutral gray CSS tokens with a warm earth-tone palette, add Playfair Display as a display/heading font, and update the button component to use burgundy/amber variants. This phase establishes the tokens that all subsequent restyling phases consume.

### Changes Required:

#### 1. Global CSS theme tokens

**File**: `src/styles/global.css`

**Intent**: Replace all `:root` CSS variables from neutral gray (0 chroma) to a warm cream/burgundy/amber palette. Remove the `bg-cosmic` utility. Add `@font-face` or Google Fonts import for Playfair Display.

**Contract**: The CSS variable names (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`) remain the same — only their oklch values change. New color mapping:
- `--background`: warm cream (e.g., `oklch(0.98 0.01 80)`)
- `--foreground`: dark warm brown (e.g., `oklch(0.20 0.02 50)`)
- `--primary`: deep burgundy (e.g., `oklch(0.35 0.12 20)` — approximately #722F37)
- `--primary-foreground`: cream/white
- `--secondary`: amber/gold (e.g., `oklch(0.75 0.12 80)`)
- `--accent`: light warm tan
- `--border`: warm gray with slight chroma
- `--muted`: slightly darker cream for section backgrounds
- Remove `.dark` block (not supporting dark mode in this change)
- Remove `bg-cosmic` utility
- Add Playfair Display font import

#### 2. Button component update

**File**: `src/components/ui/button.tsx`

**Intent**: Ensure the default variant uses the new `--primary` (burgundy) background. Add or update `secondary` variant to use `--secondary` (amber). The component already references theme tokens via Tailwind classes (`bg-primary`, `text-primary-foreground`) — no code change needed if tokens are correct.

**Contract**: Verify that existing variant classes (`bg-primary`, `bg-secondary`, `bg-destructive`) resolve to the new palette via the updated CSS variables. No signature change.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`
- Type checking passes (implicit in build)

#### Manual Verification:

- Landing page renders with new warm cream background (even if content is still cosmic-themed — Phase 3 replaces it)
- Button component in batch form shows burgundy color

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Layout & Navigation

### Overview

Create a shared `AppLayout.astro` component for authenticated pages that wraps content in the page chrome (floating topbar + cream content area). Make the topbar global with navigation links (home, batches, sign out). All batch pages and the landing page adopt the new layout.

### Changes Required:

#### 1. Floating Topbar redesign

**File**: `src/components/Topbar.astro`

**Intent**: Replace the current glassmorphism styling with a floating bar styled in the new warm palette — dark burgundy/brown background, cream text, rounded corners, slight shadow, centered with horizontal margin. Add a "Fermenta" home link on the left.

**Contract**: The component still reads `Astro.locals.user` for auth state. Renders: app name (link to `/`) on left, nav links (Batches) in center/right, user email + sign out on right. Accepts no props (reads from locals).

#### 2. Shared AppLayout for authenticated pages

**File**: `src/layouts/AppLayout.astro` (new file)

**Intent**: Create a wrapper layout for all pages that should show the floating topbar + consistent page padding on a cream background. Imports `Layout.astro` for `<head>` and outer HTML, then adds the topbar and a max-width content container.

**Contract**: `<AppLayout title="..."><slot /></AppLayout>` — renders Layout with topbar above the slot content. Content area has max-width constraint and consistent padding.

#### 3. Migrate batch pages to AppLayout

**File**: `src/pages/batches/index.astro`

**Intent**: Replace `<Layout>` with `<AppLayout>`, remove the manual container (`mx-auto max-w-4xl px-4 py-10`) since AppLayout provides it.

**Contract**: Same Astro page, different layout import. Content renders inside AppLayout's container.

**File**: `src/pages/batches/new.astro`

**Intent**: Same migration — use `<AppLayout>` instead of `<Layout>`, remove manual container wrapper.

**File**: `src/pages/batches/[id].astro`

**Intent**: Same migration pattern.

#### 4. Landing page topbar integration

**File**: `src/components/Welcome.astro`

**Intent**: Replace the inline `<Topbar />` usage inside the cosmic section. The landing page will get its own topbar treatment in Phase 3, but for now ensure it uses the new Topbar component correctly.

**Contract**: Landing page includes the updated Topbar at the top.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Batch list page shows floating topbar with "Fermenta" link, "Batches" nav, user email, sign out
- Clicking "Fermenta" in topbar navigates to `/`
- Clicking "Batches" navigates to `/batches`
- Content area has consistent padding and max-width on all batch pages

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Landing & Auth Pages

### Overview

Replace the cosmic-themed landing page with a winery-branded "Fermenta" landing using Playfair Display headings, warm cream/burgundy palette, and product-focused feature cards. Restyle auth pages from dark glassmorphism to warm cream forms with burgundy accents.

### Changes Required:

#### 1. Landing page complete rewrite

**File**: `src/components/Welcome.astro`

**Intent**: Replace the entire cosmic-themed content (star field, orbs, gradient text, generic feature cards) with a warm winery-themed landing page. Hero section features "Fermenta" title in Playfair Display, a motto (e.g., "Plan every batch with confidence"), and CTA buttons in burgundy/amber. Feature cards describe the actual product (calculation, validation, process planning). Background uses the cream palette.

**Contract**: Same component location, same slot in `index.astro`. Renders: topbar, hero section (title + motto + CTAs), feature cards section. Uses new theme tokens and Playfair Display for headings. No props needed — self-contained.

#### 2. Sign-in page restyle

**File**: `src/pages/auth/signin.astro`

**Intent**: Replace `bg-cosmic` dark background and glassmorphism card with warm cream background and a centered card with subtle warm-gray shadow and burgundy accents. Form inputs get warm border colors. Links use burgundy instead of purple.

**Contract**: Same page structure (Layout + centered form card), different styling classes. `SignInForm` component needs no change — it uses classes from `FormField` sub-component.

#### 3. Sign-up page restyle

**File**: `src/pages/auth/signup.astro`

**Intent**: Same treatment as signin — replace cosmic/glassmorphism with warm cream card styling.

**Contract**: Mirror signin page's styling approach.

#### 4. Confirm-email page restyle

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Same warm styling — replace cosmic background with cream, update text colors from blue/purple gradients to warm browns/burgundy.

**Contract**: Same content structure, updated color classes.

#### 5. Auth form sub-components

**File**: `src/components/auth/FormField.tsx`

**Intent**: Update input styling from dark-theme-oriented (white text, white/20 borders) to warm-light-theme (dark text on cream, warm-gray borders, burgundy focus ring).

**Contract**: Same props interface; only the className strings within the component change.

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Update from purple button to burgundy primary button (or use the shared `<Button>` component from shadcn/ui which now renders burgundy).

**Contract**: Same props; styling changes only.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Landing page shows "Fermenta" title in Playfair Display with a motto, warm cream background, burgundy CTA buttons
- Sign-in page has warm cream background, centered card, burgundy accent colors
- Sign-up page matches sign-in styling
- Confirm-email page matches the warm palette
- All text is readable (sufficient contrast on cream backgrounds)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Batch Pages & Form Restructuring

### Overview

Restyle the batch list page with the new palette, then restructure the batch form from a vertical stack into a responsive 2-column card grid. Create an `IngredientsList` mockup component that displays yeast as the first ingredient item, establishing the layout slot for S-02.

### Changes Required:

#### 1. Batch list page restyle

**File**: `src/components/batches/BatchListPage.tsx`

**Intent**: Replace hardcoded blue/gray classes with theme-aware colors. "New Batch" button uses `<Button>` component (now burgundy). Badge colors switch from blue to warm amber tones.

**Contract**: Same component structure and props. Visual-only changes — replace `bg-blue-600` → use `<Button>`, replace blue badge classes with amber-warm equivalents.

**File**: `src/components/batches/BatchList.tsx`

**Intent**: Update `BatchCard` styling — replace gray borders with subtle warm shadows, use theme tokens for text colors, replace blue badges/links with burgundy.

**Contract**: Same component structure. Card styling moves from `border-gray-200 bg-white` to borderless with subtle warm background and shadow. Badge from blue to amber.

**File**: `src/components/batches/BatchTable.tsx`

**Intent**: Same palette swap — warm grays, burgundy hover accents, amber badges.

**Contract**: Visual-only class updates within existing markup structure.

#### 2. Batch form restructure — grid layout

**File**: `src/components/batches/BatchForm.tsx`

**Intent**: Transform from `space-y-8` vertical layout to a CSS Grid layout with 2 columns. Top row: "Basics" card (name, date, process_type) and "Parameters" card (volume, ABV, sweetness) side by side. Below: "Ingredients" card (left column) and a placeholder diary slot (right column). Yeast fields move out of their own section into the IngredientsList component. Submit button and Cancel link span full width at the bottom.

**Contract**: Same `BatchFormProps` interface. Internal layout changes from `<form class="space-y-8">` → `<form class="grid grid-cols-1 lg:grid-cols-2 gap-6">`. Each section becomes a `<section>` card element. The section cards use borderless styling with a slightly different background shade (the `--muted` token) to differentiate from the page background. Replace `labelClass`/`inputClass` constants with theme-token-aware classes (warm grays, burgundy focus ring).

#### 3. Ingredients list mockup component

**File**: `src/components/batches/IngredientsList.tsx` (new file)

**Intent**: Create a read-only list component that displays batch ingredients. For now, it receives yeast data (name + tolerance) and renders it as the first ingredient row. The component establishes the visual pattern S-02 will make interactive (add/edit/remove). A "Coming soon" placeholder indicates more ingredients will be added.

**Contract**: `interface IngredientsListProps { yeastName: string | null; yeastTolerance: number | null; }` — renders a section card with a heading "Ingredients", a list showing yeast as the first item (or empty state), and a muted placeholder line. No interactivity beyond display.

#### 4. Update batch pages for new form width

**File**: `src/pages/batches/new.astro`

**Intent**: Remove the `max-w-xl` constraint that's too narrow for a 2-column grid. Let AppLayout's container (wider, e.g., `max-w-4xl` or `max-w-5xl`) handle the width.

**Contract**: The page content wrapper adjusts max-width from `xl` (576px) to accommodate the 2-column grid (needs ~900px+ to render two columns).

**File**: `src/pages/batches/[id].astro`

**Intent**: Same width adjustment. Also integrate the Delete button more cleanly into the new layout.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Batch list page uses burgundy "New Batch" button, amber badges, warm card styling
- Batch form on desktop (≥1024px) shows 2-column grid: Basics | Parameters in top row, Ingredients | empty diary slot in main row
- Batch form on smaller screens collapses to single column (stacked)
- Ingredients list shows yeast name and tolerance as the first item
- Submit button and Cancel link appear full-width below the grid
- Edit page (`/batches/[id]`) renders the same 2-column grid with pre-filled data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No unit test additions required — this is a visual restyling change with no business logic changes.

### Integration Tests:

- Build verification (`npm run build`) confirms all pages compile with new CSS and components.
- Lint verification (`npm run lint`) confirms all files meet formatting standards.

### Manual Testing Steps:

1. Visit `/` — verify warm landing page with "Fermenta" title, motto, feature cards, burgundy CTAs
2. Click "Sign In" — verify warm cream auth page, form renders correctly, burgundy focus states
3. Sign in — verify redirect to `/batches`, floating topbar is visible with working navigation
4. Visit `/batches` — verify warm-styled batch cards/table with amber badges, burgundy button
5. Click "New Batch" — verify 2-column grid layout with Basics | Parameters top, Ingredients below
6. Fill form and create batch — verify form submission still works, redirects to detail page
7. Visit `/batches/[id]` — verify edit view uses same 2-column grid, pre-filled data renders correctly
8. Check mobile viewport (~375px) — verify forms collapse to single column, topbar remains usable
9. Navigate via topbar: "Fermenta" → landing, "Batches" → list, "Sign out" → signed out

## Performance Considerations

- Playfair Display font adds one font load (~30-50KB). Use `font-display: swap` to avoid layout shift. Consider subsetting to Latin characters only.
- No new JS bundles — all changes are CSS/markup. React component changes don't add new dependencies.
- The CSS Grid layout is more efficient than the previous nested flexbox approach.

## Migration Notes

- The `bg-cosmic` utility in `global.css` is removed. If any other page/component referenced it, it will break at build time (caught by automated verification).
- The `.dark` class block in `global.css` is removed — dark mode is out of scope.
- Batch form's internal layout changes are backward-compatible: same props interface, same form data flow, same API calls. Only visual output changes.
- The `IngredientsList` component is a new addition that does not break any existing functionality — it receives data that's already in the form state (yeast fields).

## References

- Roadmap: `context/foundation/roadmap.md` — S-04 definition
- PRD: `context/foundation/prd.md` — NFR (editability, persona warmth)
- Paper form reference: `context/foundation/fermenta-form.jpg`
- Current button component: `src/components/ui/button.tsx`
- Current theme: `src/styles/global.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Design System Foundation

#### Automated

- [x] 1.1 Build succeeds with new theme tokens
- [x] 1.2 Lint passes

#### Manual

- [ ] 1.3 Pages render with warm cream background and burgundy buttons

### Phase 2: Layout & Navigation

#### Automated

- [x] 2.1 Build succeeds with AppLayout
- [x] 2.2 Lint passes

#### Manual

- [ ] 2.3 Floating topbar visible on all batch pages with working navigation
- [ ] 2.4 Content area has consistent padding and max-width

### Phase 3: Landing & Auth Pages

#### Automated

- [x] 3.1 Build succeeds
- [x] 3.2 Lint passes

#### Manual

- [ ] 3.3 Landing page shows Fermenta branding with Playfair Display and warm palette
- [ ] 3.4 Auth pages use warm cream styling with burgundy accents
- [ ] 3.5 All text readable with sufficient contrast

### Phase 4: Batch Pages & Form Restructuring

#### Automated

- [x] 4.1 Build succeeds
- [x] 4.2 Lint passes

#### Manual

- [ ] 4.3 Batch list uses warm palette with burgundy button and amber badges
- [ ] 4.4 Batch form renders 2-column grid on desktop
- [ ] 4.5 Ingredients list shows yeast as first item
- [ ] 4.6 Form submission works end-to-end (create and edit)
- [ ] 4.7 Responsive collapse to single column on mobile
