import { describe, it, expect } from "vitest";

import { CRITERIA, coverage } from "./coverage.js";

/** Build a score map with the same value for every criterion. */
function uniform(value: number): Record<string, number> {
  return Object.fromEntries(CRITERIA.map((k) => [k, value]));
}

/** Unweighted arithmetic mean of the five criterion scores (the naive baseline). */
function arithmeticMean(scores: Record<string, number>): number {
  return CRITERIA.reduce((acc, k) => acc + (scores[k] ?? 0), 0) / CRITERIA.length;
}

describe("coverage aggregate", () => {
  it("is ~1 when every criterion is fully covered", () => {
    expect(coverage(uniform(1))).toBeCloseTo(1, 6);
  });

  it("is ~0 when nothing is covered (and when the map is empty)", () => {
    expect(coverage(uniform(0))).toBeCloseTo(0, 6);
    expect(coverage({})).toBeCloseTo(0, 6);
  });

  it("equals the level when coverage is uniform", () => {
    expect(coverage(uniform(0.5))).toBeCloseTo(0.5, 6);
  });

  it("ranks all-high > uneven > one-family-zeroed", () => {
    const allHigh = uniform(1);
    const uneven = { ...uniform(0.9), security_isolation: 0.3 };
    const oneZeroed = { ...uniform(1), security_isolation: 0 };
    expect(coverage(allHigh)).toBeGreaterThan(coverage(uneven));
    expect(coverage(uneven)).toBeGreaterThan(coverage(oneZeroed));
  });

  it("penalizes a zeroed family far below its arithmetic mean", () => {
    const oneZeroed = { ...uniform(1), security_isolation: 0 };
    // Naive mean would be 0.8; the aggregate must drag it down toward 0.
    expect(arithmeticMean(oneZeroed)).toBeCloseTo(0.8, 6);
    expect(coverage(oneZeroed)).toBeLessThan(0.2);
  });

  it("does not reward covering a low-weight family while missing a high-weight one", () => {
    // Miss the heaviest family (security) vs. miss the lightest (input_contract),
    // holding everything else at 1. Missing the heavier family must score lower.
    const missSecurity = { ...uniform(1), security_isolation: 0 };
    const missInput = { ...uniform(1), input_contract: 0 };
    expect(coverage(missSecurity)).toBeLessThan(coverage(missInput));
  });

  it("is monotonic: raising any one criterion never lowers the aggregate", () => {
    const base = { ...uniform(0.4), correctness: 0.1 };
    const raised = { ...base, correctness: 0.6 };
    expect(coverage(raised)).toBeGreaterThanOrEqual(coverage(base));
  });

  it("ignores extra named scores that are not criteria", () => {
    const withNoise = { ...uniform(1), verdict_blocked: 0, "is-json": 0 };
    expect(coverage(withNoise)).toBeCloseTo(coverage(uniform(1)), 6);
  });
});
