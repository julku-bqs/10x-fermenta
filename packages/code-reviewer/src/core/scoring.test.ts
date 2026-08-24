import { describe, expect, it } from "vitest";
import { declinedTooLongResult, deriveVerdict } from "./scoring.js";
import { MAX_DIFF_CHARS } from "./limits.js";
import type { Finding, Severity } from "../schemas/review.js";

function finding(severity: Severity): Finding {
  return { criterion: "correctness", severity, filePath: "a.ts", lineNumber: null, message: "x" };
}

describe("deriveVerdict", () => {
  const cases: Array<{ name: string; severities: Severity[]; decision: string; pass: boolean }> = [
    { name: "empty list", severities: [], decision: "approved", pass: true },
    { name: "only low", severities: ["low", "low"], decision: "approved", pass: true },
    { name: "any medium", severities: ["low", "medium"], decision: "flagged", pass: true },
    { name: "a high", severities: ["medium", "high"], decision: "blocked", pass: false },
    { name: "a blocker", severities: ["blocker"], decision: "blocked", pass: false },
    { name: "mixed short-circuits to blocked", severities: ["high", "medium", "low"], decision: "blocked", pass: false },
  ];

  it.each(cases)("$name → $decision (pass=$pass)", ({ severities, decision, pass }) => {
    const verdict = deriveVerdict(severities.map(finding));
    expect(verdict.decision).toBe(decision);
    expect(verdict.pass).toBe(pass);
  });
});

describe("declinedTooLongResult", () => {
  it("forces a declined verdict with zeroed cost, no findings, and a limit-naming summary", () => {
    const result = declinedTooLongResult(123_456);

    expect(result.verdict).toEqual({ decision: "declined", pass: true });
    expect(result.findings).toEqual([]);
    expect(result.nitpicks).toEqual([]);
    expect(result.cost).toEqual({ tokensIn: 0, tokensOut: 0 });
    expect(result.summary).toContain(String(MAX_DIFF_CHARS));
  });
});
