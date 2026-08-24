/**
 * Clamp a numeric percentage into the inclusive [0, 100] range.
 *
 * Values below 0 return 0 and values above 100 return 100; NaN is treated as 0
 * so callers never propagate NaN into downstream fermentation calculations.
 */
export function clampPercentage(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
