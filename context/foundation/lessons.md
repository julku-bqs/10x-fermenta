# Lessons

Recurring rules and patterns discovered during development. Treat as priors for future plans and reviews.

---

## `useHydrated` gates JS-required islands, not native-POST forms

- **Context**: React islands with controlled inputs rendered `client:load`: `src/components/batches/BatchForm.tsx` (reuse) vs `src/components/auth/*.tsx` (avoid).
- **Problem**: controlled inputs on an SSR-painted island can eat keystrokes typed before hydration.
- **Rule**: reuse useHydrated to disable controls on JS-required islands (e.g. BatchForm, fetch submit); do NOT use it to disable native-POST forms (auth SignInForm/SignUpForm) because it regresses no-JS submit. The detector is shared; the disable-until-hydrated policy is per-island.
- **Applies to**: implement, impl-review
