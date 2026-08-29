import { describe, it, expect } from "vitest";

import { USD_PER_AI_CREDIT, creditsToUsd } from "./cost.js";

describe("creditsToUsd", () => {
  it("scales linearly with the single rate constant", () => {
    expect(creditsToUsd(1)).toBe(USD_PER_AI_CREDIT);
    expect(creditsToUsd(100)).toBeCloseTo(USD_PER_AI_CREDIT * 100, 12);
    expect(creditsToUsd(2.5)).toBeCloseTo(USD_PER_AI_CREDIT * 2.5, 12);
  });

  it("pins the rate so 100 credits equals exactly one US dollar", () => {
    // 100 * rate === 1  <=>  rate === official $/credit; guards accidental rate
    // drift without restating the literal (which lives only in cost.ts).
    expect(creditsToUsd(100)).toBeCloseTo(1, 12);
  });

  it("treats zero credits as zero cost", () => {
    expect(creditsToUsd(0)).toBe(0);
  });

  it("treats undefined credits (BYOK / unreported usage) as zero cost", () => {
    expect(creditsToUsd(undefined)).toBe(0);
  });
});
