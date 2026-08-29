import { describe, it, expect } from "vitest";

import type { ReviewResult } from "../../src/index.js";
import { reviewActuallyFails } from "./verdict.js";

const base: Omit<ReviewResult, "verdict"> = {
  summary: "Seeded diff with blocking issues.",
  findings: [],
  nitpicks: [],
  cost: { tokensIn: 10, tokensOut: 20 },
};

const blocked: ReviewResult = { ...base, verdict: { decision: "blocked", pass: false } };
const approved: ReviewResult = { ...base, verdict: { decision: "approved", pass: true } };
const flagged: ReviewResult = { ...base, verdict: { decision: "flagged", pass: true } };

describe("reviewActuallyFails", () => {
  it("passes when the review blocks the PR", () => {
    const r = reviewActuallyFails(JSON.stringify(blocked));
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
  });

  it("fails when the review approves the PR", () => {
    const r = reviewActuallyFails(JSON.stringify(approved));
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0);
  });

  it("fails when the review only flags (does not block) the PR", () => {
    const r = reviewActuallyFails(JSON.stringify(flagged));
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0);
  });

  it("accepts an already-parsed ReviewResult object", () => {
    const r = reviewActuallyFails(blocked as unknown as object);
    expect(r.pass).toBe(true);
  });

  it("fails clearly on unparseable output", () => {
    const r = reviewActuallyFails("not json{");
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0);
    expect(r.reason).toMatch(/not valid JSON/i);
  });

  it("fails clearly on JSON that is not a ReviewResult", () => {
    const r = reviewActuallyFails(JSON.stringify({ hello: "world" }));
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/not a well-formed ReviewResult/i);
  });
});
