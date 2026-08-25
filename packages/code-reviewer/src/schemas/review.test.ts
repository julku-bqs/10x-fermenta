import { describe, expect, it } from "vitest";
import { ReviewSchema } from "./review.js";

/**
 * The `criterion` tag is fault-tolerant: a model tagging slip (missing or
 * misspelled key) must coerce to `null` rather than voiding the whole review, so
 * the finding's `severity` survives and the gate still closes on it.
 */
describe("FindingSchema criterion coercion (parsed via ReviewSchema)", () => {
  it("coerces a missing criterion to null while retaining severity", () => {
    const parsed = ReviewSchema.parse({
      summary: "s",
      findings: [{ severity: "high", filePath: "a.ts", lineNumber: "42", message: "m" }],
      nitpicks: [],
    });

    expect(parsed.findings[0].criterion).toBeNull();
    expect(parsed.findings[0].severity).toBe("high");
  });

  it("coerces an unknown criterion string to null while retaining the rest of the finding", () => {
    const parsed = ReviewSchema.parse({
      summary: "s",
      findings: [
        { criterion: "not_a_real_key", severity: "medium", filePath: "b.ts", lineNumber: null, message: "m" },
      ],
      nitpicks: [],
    });

    expect(parsed.findings[0].criterion).toBeNull();
    expect(parsed.findings[0].severity).toBe("medium");
    expect(parsed.findings[0].filePath).toBe("b.ts");
    expect(parsed.findings[0].message).toBe("m");
  });

  it("keeps a valid criterion key", () => {
    const parsed = ReviewSchema.parse({
      summary: "s",
      findings: [
        { criterion: "domain_integrity", severity: "low", filePath: "c.ts", lineNumber: null, message: "m" },
      ],
      nitpicks: [],
    });

    expect(parsed.findings[0].criterion).toBe("domain_integrity");
  });
});
