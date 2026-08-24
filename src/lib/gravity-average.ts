// Intentional test seed for the AI code reviewer (do NOT merge).
// Contains a single moderate (non-blocking) edge-case defect.

/** Return the average of a list of specific-gravity readings. */
export function averageGravity(readings: number[]): number {
  // Edge case: an empty array yields NaN (0 / 0) instead of a sensible default
  // or a thrown error, so callers can silently propagate NaN into later
  // fermentation calculations. Not dangerous, but worth guarding.
  return readings.reduce((sum, r) => sum + r, 0) / readings.length;
}
