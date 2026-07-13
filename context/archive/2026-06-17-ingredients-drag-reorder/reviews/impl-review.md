<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Ingredients Drag & Drop Reordering

- **Plan**: context/changes/ingredients-drag-reorder/plan.md
- **Scope**: Phase 1 of 1 (all phases)
- **Date**: 2026-06-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 1 warning · 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — TouchSensor missing activation delay

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/batches/IngredientsSection.tsx:152
- **Detail**: Plan explicitly specified "TouchSensor with 250ms delay" to prevent accidental drags during scroll on mobile. Actual implementation: `useSensor(TouchSensor)` with no activationConstraint. Without a delay, the TouchSensor activates on pointer-down, meaning a user scrolling the ingredient list may unintentionally trigger a drag. Manual verification check 1.7 was marked done, but this config gap was missed.
- **Fix**: `useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })`
  - Strength: One-line change; matches the plan contract and standard @dnd-kit practice for mobile drag-to-scroll coexistence.
  - Tradeoff: None meaningful.
  - Confidence: HIGH — plan was explicit, @dnd-kit docs confirm this is the canonical pattern for touch sensors.
  - Blind spot: Manual test 1.7 was rubber-stamped — the 250ms guard was never actually in effect during testing.
- **Decision**: SKIPPED — Intentionally removed after implementation. Testing showed the 250ms activationConstraint causes more friction than benefit. Plan updated retrospectively via addendum.

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/batches/IngredientsSection.tsx:89-92, 202-211, 236-259
- **Detail**: Plan described smooth CSS-transform animation on sortable items but did not mention DragOverlay. Implementation adds: activeId state, onDragStart/onDragCancel handlers, and custom overlay UI rendering the dragged item as a raised ghost card. Benign and improves UX — but undocumented scope addition.
- **Fix**: Add a one-line addendum to plan.md noting the DragOverlay addition.
- **Decision**: FIXED — Added addendum to plan.md documenting the DragOverlay addition.

### F3 — DnD disabled per-item rather than at context level

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/batches/IngredientsSection.tsx:149 · src/components/batches/IngredientCard.tsx:30
- **Detail**: Plan: "Disable the DnD context entirely when editingIndex !== null." Implementation: isDragDisabled flag passed as `disabled: isDragDisabled` to each useSortable. DndContext stays mounted. Grip handles hidden. Functionally equivalent — with all sortable items disabled, no listeners attach, context is inert. Mechanism differs from plan wording but outcome is correct.
- **Fix**: No code change needed. Optionally note the chosen mechanism in plan.md as an addendum.
- **Decision**: SKIPPED — Covered by the plan addendum (mechanism differs from plan wording, outcome is correct).

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/batches/IngredientsSection.tsx:218
- **Detail**: `key={String(index)}` in a reorderable list is a known React anti-pattern: after a reorder, React maps the old DOM node at position "0" to the new ingredient at position "0" rather than following the moved ingredient. Plan explicitly ruled out stable IDs ("NOT Doing: Adding a persistent id field — index-based IDs work for sortable context"). Risk is bounded because IngredientCard is a controlled component with no meaningful internal state — but note the constraint if the card ever gains internal state (e.g. optimistic edits, animation state).
- **Fix**: No action required unless IngredientCard gains internal state. If it does, the key strategy will need to change, requiring revisiting the plan constraint.
- **Decision**: FIXED — Replaced index-based keys with stable UUIDs managed via useState in IngredientsSection.tsx. IDs are generated on mount and kept in sync across add/delete/reorder.

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/batches/IngredientCard.tsx:57, 70, 85
- **Detail**: Three `<label>` elements lack `htmlFor`; their `<input>` siblings lack `id`. Labels are visually co-located but not semantically associated, so screen readers won't announce them on input focus. Likely pre-existing (edit mode markup was not a plan target).
- **Fix**: Add `useId()`-derived IDs to each input and matching `htmlFor` on each label — or address in a dedicated a11y change.
- **Decision**: FIXED — Added useId()-derived IDs to all three inputs and matching htmlFor on each label in IngredientCard.tsx.
