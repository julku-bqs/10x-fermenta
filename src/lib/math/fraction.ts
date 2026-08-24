/**
 * Convert a fraction in [0, 1] to a whole-number percentage in [0, 100].
 * Values outside the range are clamped; NaN yields 0.
 */
export function fractionToPercent(fraction: number): number {
  if (Number.isNaN(fraction)) return 0;
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}
