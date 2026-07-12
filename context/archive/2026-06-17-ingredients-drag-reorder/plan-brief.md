# Ingredients Drag & Drop Reordering — Plan Brief

> Full plan: `context/changes/ingredients-drag-reorder/plan.md`

## What & Why

Add drag-and-drop reordering to the ingredients list so users can control ingredient order in their batch recipes. The order is meaningful for the winemaking process (primary juice first, additives later) and currently users can only control order by deleting and re-adding items.

## Starting Point

Ingredients render as a vertical list of `IngredientCard` components inside `IngredientsSection`. Each card toggles between collapsed (view) and expanded (edit) state on click. Ingredients are stored as a JSONB array on the `batches` table — array position is already the canonical order. No DnD library exists in the project.

## Desired End State

Users drag ingredients via a grip handle (desktop) or long-press (mobile) to reorder them. Items animate smoothly during drag. Keyboard users can reorder via arrow keys. The reordered array persists when the batch is saved. DnD is cleanly disabled during editing.

## Key Decisions Made

| Decision              | Choice                                           | Why (1 sentence)                                                                                  |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| DnD library           | @dnd-kit/sortable                                | Purpose-built React sortable with first-class accessibility, well-documented, lightweight (~15kb) |
| Drag trigger          | Grip handle (desktop) + long-press (mobile)      | Avoids conflict with click-to-edit; clear affordance on both platforms                            |
| Edit mode interaction | Disable entire DnD when any card is in edit mode | Simplest approach — zero ambiguity, trivial to implement via `editingIndex !== null` check        |
| Accessibility         | Built-in keyboard sensor with ARIA               | Free with @dnd-kit; meets WCAG without additional UI clutter                                      |
| Visual feedback       | Smooth vertical shift animation (CSS transforms) | Built into @dnd-kit's sortable preset; clear feedback of drop position                            |

## Scope

**In scope:** Drag reorder of user ingredients, grip handle UI, touch/keyboard support, edit-mode guard, smooth animations

**Out of scope:** Drag for sugar cards, persistent ingredient IDs, DB schema changes, API changes, multi-select drag

## Architecture / Approach

`DndContext` + `SortableContext` wraps the ingredients list in `IngredientsSection`. Three sensors handle input: `PointerSensor` (handle-only), `TouchSensor`, `KeyboardSensor`. Each `IngredientCard` calls `useSortable` and renders a `GripVertical` handle. On drag end, `arrayMove` reorders the array and propagates through existing `onBatchChange` → batch save flow.

## Phases at a Glance

| Phase                              | What it delivers                                                          | Key risk                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. DnD Integration & Reorder Logic | Full drag-and-drop with grip handle, sensors, animations, edit-mode guard | IngredientCard refactor from `<button>` to `<div>` wrapper may need careful click-target handling |

**Prerequisites:** None beyond S-02 (ingredients section exists — already complete)
**Estimated effort:** ~1 session, single phase

## Open Risks & Assumptions

- IngredientCard's collapsed state wraps in a layout `<div>` with two sibling `<button>` elements (grip + edit toggle) — avoids nested interactive elements while preserving semantics
- @dnd-kit v6 compatibility with React 19 assumed (widely reported as working)

## Success Criteria (Summary)

- User can reorder ingredients via drag (mouse, touch, keyboard) with smooth animation
- DnD is disabled during editing with no visual drag affordance
- Reordered ingredients persist after save and page reload
