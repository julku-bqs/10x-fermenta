import { describe, expect, it, vi } from "vitest";
import { BaseReviewAgent, type ReviewInput } from "./review-agent.js";
import { MAX_DIFF_CHARS } from "./limits.js";
import type { Finding, ReviewResult } from "../schemas/review.js";

type RawResult = Omit<ReviewResult, "verdict">;

/** A `BaseReviewAgent` whose backend hook is a spy, so the seam is testable without an LLM. */
class TestReviewAgent extends BaseReviewAgent {
  readonly spy = vi.fn<(input: ReviewInput) => Promise<RawResult>>();

  constructor(result: RawResult) {
    super();
    this.spy.mockResolvedValue(result);
  }

  protected runReview(input: ReviewInput): Promise<RawResult> {
    return this.spy(input);
  }
}

function rawResult(findings: Finding[]): RawResult {
  return { summary: "s", findings, nitpicks: [], cost: { tokensIn: 1, tokensOut: 2 } };
}

const highFinding: Finding = {
  criterion: "correctness",
  severity: "high",
  filePath: "a.ts",
  lineNumber: null,
  message: "boom",
};

describe("BaseReviewAgent.review", () => {
  it("declines an over-cap diff without calling the backend", async () => {
    const agent = new TestReviewAgent(rawResult([]));
    const diff = "x".repeat(MAX_DIFF_CHARS + 1);

    const result = await agent.review({ diff });

    expect(result.verdict).toEqual({ decision: "declined", pass: true });
    expect(result.findings).toEqual([]);
    expect(agent.spy).not.toHaveBeenCalled();
  });

  it("attaches the derived verdict for an under-cap diff", async () => {
    const agent = new TestReviewAgent(rawResult([highFinding]));

    const result = await agent.review({ diff: "small diff" });

    expect(agent.spy).toHaveBeenCalledTimes(1);
    expect(result.verdict).toEqual({ decision: "blocked", pass: false });
  });
});
