import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();
const start = vi.fn();
const stop = vi.fn();

vi.mock("@github/copilot-sdk", () => ({
  CopilotClient: class {
    start = start;
    stop = stop;
    createSession = createSession;
  },
}));

import { CopilotReviewAgent } from "./copilot-review-agent.js";
import { READ_REPO_FILE_TOOL_NAME } from "./read-repo-file-tool.js";

describe("CopilotReviewAgent", () => {
  beforeEach(() => {
    createSession.mockReset();
    start.mockReset();
    stop.mockReset();
    start.mockResolvedValue(undefined);
    stop.mockResolvedValue([]);
  });

  it("registers only the repo file reader as an available tool", async () => {
    const handlers = new Map<string, (event: { data: Record<string, unknown> }) => void>();
    createSession.mockResolvedValue({
      on: (eventType: string, handler: (event: { data: Record<string, unknown> }) => void) => {
        handlers.set(eventType, handler);
        return () => undefined;
      },
      sendAndWait: vi.fn(async () => {
        handlers.get("assistant.message")?.({
          data: {
            content: JSON.stringify({
              summary: "Looks good overall. I checked the nearby code for context.",
              findings: [],
              nitpicks: [],
            }),
          },
        });
        handlers.get("assistant.usage")?.({
          data: {
            inputTokens: 10,
            outputTokens: 5,
          },
        });
      }),
    });

    const result = await new CopilotReviewAgent().review({ diff: "diff --git a/x.ts b/x.ts\n+const x = 1;" });
    const sessionConfig = createSession.mock.calls[0]?.[0];

    expect(result.verdict).toEqual({ decision: "approved", pass: true });
    expect(sessionConfig.tools).toHaveLength(1);
    expect(sessionConfig.tools[0].name).toBe(READ_REPO_FILE_TOOL_NAME);
    expect(sessionConfig.availableTools).toEqual([`custom:${READ_REPO_FILE_TOOL_NAME}`]);
  });
});
