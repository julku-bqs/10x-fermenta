---
change_id: sugar-calculation-improvements
title: Sugar calculation improvements accounting for residual sugar
status: new
created: 2026-06-13
updated: 2026-06-13
archived_at: null
---

## Notes

### Residual sugar should reduce sweetness sugar requirement

When ingredient sugar exceeds ABV needs (`fermentation_sugar_kg = 0`), the excess remains as residual sweetness after fermentation stops (yeast hits tolerance or fermentation is halted). Currently `calculateSugar()` computes `sweetness_sugar_kg` purely from `SWEETNESS_MIDPOINTS[level] × volume / 1000`, ignoring residual sugar from ingredients.

**Expected behavior**: subtract excess ingredient sugar (the portion above what's needed for ABV) from the sweetness sugar target. If residual sugar already meets or exceeds the sweetness midpoint, `sweetness_sugar_kg` should be 0 (or reduced).

**Example**: 20L batch, 12% ABV, semi_sweet (midpoint 30 g/L).
- ABV needs: 12 × 17 × 20 = 4080g
- Ingredient sugar: 6000g → excess = 1920g → residual = 96 g/L
- Current result: sweetness_sugar_kg = 0.6 (ignores residual)
- Correct result: sweetness_sugar_kg = 0 (residual 96 g/L already exceeds 30 g/L target)

### Volume contribution from sugar additions

Adding significant amounts of sugar increases total liquid volume (~0.6 L per kg of dissolved sugar). Currently `calculateSugar()` uses `target_volume_liters` as-is, but post-sugar volume is higher, slightly diluting the effective g/L for sweetness. The calculation could iterate or apply a correction factor to account for this.

### Pulp vs juice sugar extraction efficiency

For pulp process, not all sugar in fruit is extracted into the must. A coefficient (e.g., 0.7–0.9) on ingredient sugar for pulp batches would give more realistic estimates. Juice process extracts ~100% since the juice is already separated. This could be a configurable multiplier per process type.

### Cap fermentation sugar at yeast tolerance

If yeast tolerance < target ABV, fermentation will physically stop at the tolerance ceiling regardless of available sugar. Currently `calculateSugar()` computes fermentation sugar for the full target ABV — but that sugar won't fully ferment. The calculation should cap the effective ABV at `min(target_abv, yeast_alcohol_tolerance)` when tolerance is known, so `fermentation_sugar_kg` reflects what will actually be consumed. Excess sugar beyond what the yeast can process becomes unintended residual sweetness.
