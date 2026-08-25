import { describe, expect, it } from "vitest";
import { buildReviewPrompt } from "./review-prompt.js";
import { MAX_DESCRIPTION_CHARS } from "../core/limits.js";

describe("buildReviewPrompt", () => {
  it("always fences the diff", () => {
    const out = buildReviewPrompt({ diff: "diff --git a/x b/x" });

    expect(out).toContain("```diff");
    expect(out).toContain("diff --git a/x b/x");
  });

  it("includes the title when provided and omits the section when absent", () => {
    expect(buildReviewPrompt({ diff: "d", title: "Add sugar calc" })).toContain("Title: Add sugar calc");
    expect(buildReviewPrompt({ diff: "d" })).not.toContain("Title:");
  });

  it("includes the description when provided and omits the section when absent", () => {
    expect(buildReviewPrompt({ diff: "d", description: "why this change" })).toContain("Description:\nwhy this change");
    expect(buildReviewPrompt({ diff: "d" })).not.toContain("Description:");
  });

  it("trims the description to MAX_DESCRIPTION_CHARS", () => {
    const long = "a".repeat(MAX_DESCRIPTION_CHARS + 500);

    const out = buildReviewPrompt({ diff: "d", description: long });

    expect(out).toContain("a".repeat(MAX_DESCRIPTION_CHARS));
    expect(out).not.toContain("a".repeat(MAX_DESCRIPTION_CHARS + 1));
  });

  it("wraps author-supplied PR context in an untrusted-data boundary", () => {
    const out = buildReviewPrompt({ diff: "d", title: "t", description: "why" });

    expect(out).toContain("BEGIN UNTRUSTED PR CONTEXT");
    expect(out).toContain("END UNTRUSTED PR CONTEXT");
    expect(buildReviewPrompt({ diff: "d" })).not.toContain("UNTRUSTED PR CONTEXT");
  });
});
