<!-- PLAN-REVIEW-REPORT -->

# Plan Review: E2E UI-Wiring Coverage (testing-e2e) — deep re-evaluation

- **Plan**: `context/changes/testing-e2e/plan.md`
- **Mode**: Deep (max)
- **Date**: 2026-07-12
- **HEAD**: 4aa78f9
- **Verdict**: REVISE → SOUND after fixes (all 3 findings fixed in triage)
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension             | Verdict          |
| --------------------- | ---------------- |
| End-State Alignment   | PASS             |
| Lean Execution        | PASS             |
| Architectural Fitness | PASS             |
| Blind Spots           | WARNING (F2, F3) |
| Plan Completeness     | WARNING (F1)     |

## Grounding

9/9 paths ✓, symbols ✓, Progress↔Phase ✓ (5+5+5+6 bullets aligned). This pass cross-checked the load-bearing claims against source (first pass had not): `/batches/[id].astro` renders `BatchForm mode="edit"` directly; `createBatchSchema` accepts every seeded field; `diary_entry.entry_date` has no min/max range; diary `PUT` accepts partial `{completed}`/`{description}`; `handleCalculate` sets both sugar fields and collapses; Regenerate/Calculate/grip accessible names match the planned locators.

## Findings

### F1 — "Cancel" link locator is ambiguous (two Cancel links)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness (internal contradiction)
- **Location**: Phase 3 step, Phase 4 step; Critical Detail "two Cancel links"
- **Detail**: BatchForm renders two identical `<a href="/batches">Cancel</a>` links (BatchForm.tsx:266-268 top, :485-487 bottom), both role=link/name "Cancel". The Phase 3/4 steps called `getByRole('link', { name: 'Cancel' })` with no `.first()/.last()` → Playwright strict-mode violation (2 elements), so the Cancel-discard branch could not run. The plan's own Critical Detail already disambiguates the twin Save buttons but never applied the same to Cancel. Both links navigate to `/batches` (list), not the detail — so the `page.goto('/batches/{id}')` reopen is mandatory.
- **Fix**: Use `getByRole('link', { name: 'Cancel' }).last()` in both Cancel-discard steps; tighten the Critical Detail to note the two Cancel links also need `.first()/.last()` and that Cancel lands on the list.
- **Decision**: FIXED (Fix in plan)

### F2 — Phase 2 readiness gate ignores the diary's separate async load

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Action + oracle
- **Detail**: The only stated gate before toggling/regenerating was "hydration via Save Changes enabled." `Save Changes` is enabled by form hydration (`useHydrated`, BatchForm.tsx:103,123), but the diary list loads on a separate async fetch — DiarySection starts `loading=true` (DiarySection.tsx:38) and populates entries in its own useEffect (:45-62), and `[id].astro` does not SSR entries. So `Save Changes` can be clickable while the diary is still a spinner → toggle/Regenerate may act before any entry row exists (locator-not-found flake, or Regenerate against an empty list).
- **Fix**: Add a diary-load gate — `await expect(page.getByText(<user-added marker>)).toBeVisible()` — before the toggle/Regenerate actions. Verified per reviewer nuance: the marker renders as a `<p>` label (EntryRow.tsx:130-135) which `getByText` matches, NOT an `<input>` value (add/edit inputs at DiarySection.tsx:315-336 / EntryRow.tsx:85-92 hold no seeded marker and `getByText` ignores control values), so the gate cannot be satisfied prematurely by an input.
- **Decision**: FIXED (Fix in plan, with deeper input-vs-label verification)

### F3 — Complete-toggle target collides with the ordering fix; count oracle can fail for the wrong reason

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots (oracle validity)
- **Location**: Phase 2 — toggle step + oracle (c), interacting with the ordering fix
- **Detail**: Oracle (c) ("zero completed after Regenerate") is only valid if the one pre-Regenerate completed entry is an untouched auto entry — those get wiped+rebuilt with completed=false. The user-added and promoted markers are `entry_type='user'` and survive Regenerate with their completed state intact (verified: `PUT {completed}` does not fire the promotion trigger; DiarySection.tsx:77-92). The plan said "toggle exactly one auto entry" without saying how to target it, and the ordering fix seeds the user marker at a known position ("strictly earliest"), so an intuitive `.first()` toggle hits the surviving user marker → count is 1, not 0 → oracle (c) fails though Regenerate worked (spurious red that also corrupts the deliberate-break). The promoted marker's position is unknown, so no fixed index is safe.
- **Fix**: Adopt a stable marker-prefix convention — seed both user-owned markers with a `user-` prefix (`user-added:` / `user-promoted:`) — and toggle complete on a row whose description does NOT start with `user-` (an untouched auto entry), never a blind `.first()`. (Reviewer-proposed simplification over capturing a specific auto description.)
- **Decision**: FIXED (Fix differently — `user-` prefix convention)

## Triage summary

- Fixed: F1 (Fix in plan), F2 (Fix in plan + input-vs-label verification), F3 (Fix differently — `user-` prefix)
- Skipped: none
- Accepted: none
- Dismissed: none

**Verdict after fixes: SOUND.**
