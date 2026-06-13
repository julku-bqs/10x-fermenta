---
change_id: sugar-fields-refactoring
title: Sugar fields refactoring
status: implemented
created: 2026-06-13
updated: 2026-06-13
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Follow-up: Residual sugar should reduce sweetness sugar requirement

When ingredient sugar exceeds ABV needs (fermentation_sugar_kg = 0), the excess remains as residual sweetness after fermentation stops. Currently `calculateSugar()` computes `sweetness_sugar_kg` purely from volume × midpoint, ignoring this residual. The calculation should subtract excess ingredient sugar from the sweetness target. Track as a separate change.
