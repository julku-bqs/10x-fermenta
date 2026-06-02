# Visual Identity & Design System — Plan Brief

> Full plan: `context/changes/visual-identity/plan.md`

## What & Why

Fermenta currently looks like a generic starter template — dark cosmic theme on landing/auth, unstyled white on batch pages, no consistent brand. This plan establishes a warm, winery-themed visual identity (burgundy, amber, cream) and restructures the batch form from a growing vertical stack into a scalable 2-column card grid that can accommodate future sections (ingredients, diary, notes, gallery) without becoming an endless scroll.

## Starting Point

- Landing page: generic "10x Astro Starter" with cosmic dark theme (purple/blue gradients)
- Auth pages: dark glassmorphism cards with purple accents
- Batch pages: plain white with hardcoded gray/blue Tailwind classes, vertical form layout (`space-y-8`, max-w-xl)
- Topbar: only on landing page; batch pages have no global navigation
- Theme tokens: neutral gray (0 chroma) — unused by batch components which hardcode colors

## Desired End State

The app has a cohesive warm winery identity: cream backgrounds, burgundy primary actions, amber secondaries, Playfair Display headings on landing/titles. A floating topbar provides global navigation. The batch form uses a responsive 2-column card grid (Basics | Parameters top, Ingredients | Diary below) that scales cleanly as new sections are added in S-02 and S-03. An ingredients list mockup with yeast as the first item is ready for S-02 to make interactive.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Color mood | Warm earth tones (burgundy, amber, cream) | Evokes the winemaking craft directly; feels inviting for the hobbyist persona. | Plan |
| Page mode | Light with cream base, dark topbar anchor | Readable for data-heavy forms; warm feel without eye strain. | Plan |
| Form layout | 2-column responsive card grid | Scales to many sections without vertical scroll; mirrors the paper form zones. | Plan |
| Yeast placement | First item in ingredients list (mockup) | Yeast is functionally an ingredient; establishes the slot S-02 will fill. | Plan |
| Typography | System UI for forms, Playfair Display for titles/landing | Readability for data entry; personality for branding. | Plan |
| Navigation | Floating topbar, global on all authenticated pages | Clear nav anchor without eating horizontal space needed for 2-col grid. | Plan |
| Section cards | Borderless with background contrast | Modern, airy feel; subtle shade differences delineate zones. | Plan |
| Button colors | Burgundy primary, amber/gold secondary | Cohesive with earth palette; burgundy stands out on cream. | Plan |
| Scope | Full restyle including landing page refresh | Complete brand coherence end-to-end from first visit. | Plan |

## Scope

**In scope:**
- Global CSS token replacement (neutral → warm earth tones)
- Playfair Display font addition
- Floating topbar creation (global navigation)
- AppLayout for authenticated pages
- Landing page rewrite ("Fermenta" + motto + feature cards)
- Auth pages restyle (cream + burgundy)
- Batch list restyle (warm palette)
- Batch form 2-column grid restructure
- IngredientsList mockup component (yeast as first item)

**Out of scope:**
- Dark mode
- Mobile-first responsive optimization
- Ingredients CRUD logic (S-02)
- Diary/process CRUD (S-03)
- Accessibility audit beyond WCAG AA contrast
- Animation/transition polish

## Architecture / Approach

Bottom-up: establish tokens (Phase 1) → build layout infrastructure (Phase 2) → restyle simple pages (Phase 3) → restructure complex form (Phase 4). Each phase builds on the prior — Phase 2 inherits tokens, Phase 3 inherits layout, Phase 4 inherits everything.

Key structural change: `BatchForm.tsx` moves from `<form class="space-y-8">` to a CSS Grid (`grid-cols-1 lg:grid-cols-2 gap-6`) with section cards as grid items.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Design System Foundation | Warm palette tokens in CSS, Playfair font, button updates | Color contrast issues on cream backgrounds |
| 2. Layout & Navigation | AppLayout + floating topbar global on all pages | Breaking existing page layout flow |
| 3. Landing & Auth Pages | Winery-branded landing ("Fermenta"), warm auth forms | Copy/content quality of landing page |
| 4. Batch Pages & Form Grid | 2-col card grid form, warm batch list, ingredients mockup | Form usability regression; grid layout edge cases |

**Prerequisites:** S-01 (batch-crud-and-params) is done — pages to restyle exist.
**Estimated effort:** ~2-3 sessions across 4 phases.

## Open Risks & Assumptions

- Burgundy text on cream may need contrast tuning for WCAG AA (4.5:1 ratio) — will test during Phase 1
- Playfair Display font adds ~30-50KB load; using `font-display: swap` mitigates FOIT
- Removing `.dark` block means dark-mode users see light theme only — acceptable for MVP
- The 2-column grid at ~1024px breakpoint assumes most users are on desktop (validated by persona: hobbyist at home)

## Success Criteria (Summary)

- All pages share one cohesive warm earth-tone palette — no leftover cosmic/neutral styling
- The batch form accommodates current fields in a 2-column grid and has a clear slot for future sections
- A user can navigate the entire app (landing → auth → batches → form) without jarring style transitions
