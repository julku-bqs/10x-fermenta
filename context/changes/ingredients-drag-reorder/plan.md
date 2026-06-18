# Ingredients Drag & Drop Reordering — Implementation Plan

## Overview

Add drag-and-drop reordering to the ingredients list in the batch form using `@dnd-kit/sortable`. Users reorder via a grip handle (desktop pointer) or long-press (mobile touch). Built-in keyboard support provides accessible reordering. DnD is fully disabled when any ingredient card is in edit mode.

## Current State Analysis

- `IngredientsSection` renders ingredients via `ingredients.map()` with index-based keys (`key={user-${index}}`)
- `IngredientCard` has collapsed (view) and expanded (edit) states toggled by click
- Ingredients are a JSONB array on the `batches` table — array position is the canonical order
- No DnD library is installed; no existing drag patterns in the codebase
- `editingIndex` state already tracks which card is expanded

### Key Discoveries:

- `src/components/batches/IngredientsSection.tsx:158-178` — the ingredient list render loop
- `src/components/batches/IngredientCard.tsx:88-103` — collapsed card is a `<button>` element (needs restructuring for drag handle)
- `lucide-react` already installed — provides `GripVertical` icon for the drag handle
- React 19 — fully compatible with @dnd-kit v6

## Desired End State

Users can reorder ingredients by dragging the grip icon (desktop) or long-pressing anywhere on a collapsed card (mobile). Other items animate smoothly to show where the dragged item will land. Keyboard users can focus the grip handle and use arrow keys to reorder. The reordered array is persisted when the batch is saved (existing save flow — no API changes). Verification: reorder ingredients, save batch, reload page — order is preserved.

## What We're NOT Doing

- Adding a persistent `id` field to the `Ingredient` type (index-based IDs work for sortable context)
- Database schema changes (JSONB array position is already the order)
- API endpoint changes (batch PUT already accepts the full ingredients array)
- Drag-and-drop for sugar cards (only user ingredients)
- Multi-select drag (single item at a time)

## Implementation Approach

Install `@dnd-kit/core` + `@dnd-kit/sortable`. Wrap the ingredients list in `DndContext`/`SortableContext` with three sensors (Pointer for handle-only desktop drag, Touch with 250ms delay for mobile long-press, Keyboard for accessibility). Each `IngredientCard` uses the `useSortable` hook. On drag end, `arrayMove` reorders the array and propagates via `onBatchChange`. The entire DnD context is disabled when `editingIndex !== null`.

## Phase 1: DnD Integration & Reorder Logic

### Overview

Install @dnd-kit, integrate sortable context into IngredientsSection, add drag handles to IngredientCard, and wire up the reorder callback. Includes sensor configuration, edit-mode guard, keyboard accessibility, and smooth animations.

### Changes Required:

#### 1. Install @dnd-kit packages

**Intent**: Add the DnD library dependencies needed for sortable list functionality.

**Contract**: Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` to `dependencies` in `package.json`.

#### 2. Sortable wrapper in IngredientsSection

**File**: `src/components/batches/IngredientsSection.tsx`

**Intent**: Wrap the ingredients `.map()` block with `DndContext` + `SortableContext` providing vertical list sorting. Configure three sensors (PointerSensor with handle-only activation, TouchSensor with 250ms delay, KeyboardSensor with sortable keyboard coordinates). On `onDragEnd`, compute old/new indices from `active.id`/`over.id`, call `arrayMove`, and propagate via `onBatchChange({ ingredients: reordered })`. Disable the DnD context entirely when `editingIndex !== null`.

**Contract**: New imports from `@dnd-kit/core` (`DndContext`, `closestCenter`, `KeyboardSensor`, `PointerSensor`, `TouchSensor`, `useSensor`, `useSensors`) and `@dnd-kit/sortable` (`SortableContext`, `verticalListSortingStrategy`, `arrayMove`, `sortableKeyboardCoordinates`). Sortable item IDs are string indices (`"0"`, `"1"`, ...) derived from the ingredients array length.

#### 3. Make IngredientCard sortable

**File**: `src/components/batches/IngredientCard.tsx`

**Intent**: Use `useSortable` hook inside IngredientCard so each item participates in the sortable context. The collapsed (view) state gains a visible grip handle (GripVertical icon from lucide-react) that receives the drag listeners and attributes. Apply CSS transform/transition from `useSortable` for smooth animation. The expanded (edit) state does not render a drag handle (since DnD is disabled during editing anyway).

**Contract**: New props: none needed (the hook reads context internally). New import: `useSortable` from `@dnd-kit/sortable`, `CSS` from `@dnd-kit/utilities`, `GripVertical` from `lucide-react`. The component receives an `id` prop (string) for the sortable registration. The collapsed card wraps its content in a layout `<div>` (receives sortable transform/transition styles) containing two sibling elements: a `<button>` grip handle with drag listeners and the existing `<button>` for click-to-edit. This avoids nested interactive elements (invalid HTML) and preserves semantic button elements (no jsx-a11y warnings).

#### 4. Update IngredientsSection to pass sortable IDs

**File**: `src/components/batches/IngredientsSection.tsx`

**Intent**: Change the `.map()` to pass each `IngredientCard` its sortable `id` (stringified index). Update `key` from `user-${index}` to the sortable id for consistency.

**Contract**: `<IngredientCard id={String(index)} ... />` inside the `SortableContext` items array of `ingredients.map((_, i) => String(i))`.

### Success Criteria:

#### Automated Verification:

- Dependencies install cleanly: `npm install`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Existing tests pass: `npm run test`

#### Manual Verification:

- Desktop: grip handle visible on each collapsed ingredient card; dragging it reorders the list with smooth animation
- Mobile: long-press (~250ms) on a collapsed card initiates drag; reorder works via touch
- Keyboard: focus grip handle, use arrow keys to reorder, screen reader announces position
- Edit mode: expanding any ingredient card disables all drag handles (no drag affordance visible)
- Persistence: reorder ingredients → save batch → reload → order is preserved
- Edge cases: single ingredient (no drag needed), empty list (no crash), add after reorder (appends correctly)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

### Addenda (post-implementation)

- **DragOverlay**: Added `DragOverlay` (not in original plan) for a better drag UX — renders the dragged item as a raised ghost card during the drag, with `activeId` state and `onDragStart`/`onDragCancel` handlers wired in `IngredientsSection.tsx`.
- **TouchSensor delay**: The 250ms `activationConstraint` was intentionally removed after implementation; testing showed it caused more friction than benefit for the use case.
- **Edit-mode DnD guard**: Implemented by passing `disabled: isDragDisabled` to each `useSortable` rather than conditionally mounting the `DndContext`. Functionally equivalent — with all sortable items disabled no listeners attach. Grip handles are hidden when disabled.

---

## Testing Strategy

### Unit Tests:

- No custom reorder logic to test — `arrayMove` is provided by `@dnd-kit/sortable`
- Existing batch save tests cover array persistence

### Integration Tests:

- Not required — this is a purely client-side UI interaction; existing batch save tests cover array persistence

### Manual Testing Steps:

1. Open a batch with 3+ ingredients
2. Drag second ingredient above first using grip handle — verify order updates
3. Long-press an ingredient on mobile/touch simulation — verify drag initiates after ~250ms
4. Click an ingredient to expand (edit mode) — verify no drag handles are visible
5. Use keyboard: Tab to grip handle → Space/Enter to pick up → Arrow Down → Space to drop
6. Save batch, reload page — verify reordered ingredients persist
7. Add a new ingredient after reordering — verify it appends at the end

## Performance Considerations

- @dnd-kit uses CSS transforms (no layout thrashing) — performant for lists under 100 items
- Ingredients lists are typically 3-10 items — no virtualization needed
- Sensors use activation constraints to prevent accidental drags (distance: 8px for pointer)

## References

- Roadmap: S-07 in `context/foundation/roadmap.md:152-162`
- @dnd-kit sortable docs: https://docs.dndkit.com/presets/sortable
- Related prior decision: `context/changes/sugar-fields-refactoring/plan-brief.md` — "Drag-and-drop will be a separate change"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DnD Integration & Reorder Logic

#### Automated

- [x] 1.1 Dependencies install cleanly — a1a038f
- [x] 1.2 Type checking passes — a1a038f
- [x] 1.3 Linting passes — a1a038f
- [x] 1.4 Build succeeds — a1a038f
- [x] 1.5 Existing tests pass — a1a038f

#### Manual

- [x] 1.6 Desktop drag via grip handle reorders with animation — a1a038f
- [x] 1.7 Mobile long-press drag works — a1a038f
- [x] 1.8 Keyboard reorder works with screen reader announcements — a1a038f
- [x] 1.9 Edit mode disables all drag — a1a038f
- [x] 1.10 Reorder persists after save and reload — a1a038f
- [x] 1.11 Edge cases (single item, empty list, add after reorder) — a1a038f
