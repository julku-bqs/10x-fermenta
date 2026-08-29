import { CopilotClient } from "@github/copilot-sdk";
import type { ApiProvider, CallApiContextParams, ProviderResponse } from "promptfoo";

/**
 * Grader model — a strong model DISTINCT from the three under test
 * (`gpt-5.3-codex`, `claude-sonnet-4.6`, `claude-haiku-4.5`) so the judge never
 * grades its own output. Overridable via `config.model` if entitlement differs.
 */
const GRADER_MODEL = "claude-opus-4.8";

/**
 * Appended to whatever grading system prompt promptfoo renders, to force a
 * parseable, score-only reply. `pass` is decided in code (always `true`), never
 * by the judge.
 */
const GRADER_OUTPUT_INSTRUCTION =
  'Respond with ONLY a single JSON object: {"score": <number between 0 and 1>, "reason": "<one-sentence justification>"}. ' +
  "score is the fraction of the rubric's listed flaws that the review correctly identified " +
  "(1 = every flaw surfaced, 0 = none). Do not add markdown fences or any text outside the JSON object.";

interface GraderConfig {
  /** Override the pinned grader model. Defaults to `GRADER_MODEL`. */
  model?: string;
}

interface GraderOptions {
  id?: string;
  label?: string;
  config?: GraderConfig;
}

interface RenderedChatMessage {
  role?: string;
  content?: string;
}

interface GraderVerdict {
  score: number;
  reason: string;
}

/**
 * A keyless, single-turn Copilot-backed grader for promptfoo `llm-rubric`
 * assertions. It reuses the existing Copilot auth (no OpenAI key), mirrors the
 * review agent's one-turn lifecycle (`availableTools: []`, streaming,
 * `start()`/`stop()` in `finally`), and returns promptfoo's grader verdict
 * shape.
 *
 * The rubric stays NON-GATING because this grader ALWAYS returns `pass: true`
 * and varies only `score` — promptfoo resolves an `llm-rubric` as
 * `pass = (grader.pass ?? true) && score >= threshold` (a logical AND), so a
 * grader-emitted `pass: false` would gate the cell red even with `threshold: 0`.
 * A malformed judge reply degrades to `score: 0` (still `pass: true`), never a
 * gate; only a provider/transport error returns `{ error }`.
 */
export default class CopilotGrader implements ApiProvider {
  public readonly config: GraderConfig;
  public readonly label?: string;
  private readonly model: string;
  private readonly providerId: string;

  constructor(options: GraderOptions = {}) {
    this.config = options.config ?? {};
    this.model = this.config.model ?? GRADER_MODEL;
    this.providerId = options.id ?? `copilot-grader:${this.model}`;
    this.label = options.label;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(prompt: string, _context?: CallApiContextParams): Promise<ProviderResponse> {
    const { system, user } = splitRenderedPrompt(prompt);
    const client = new CopilotClient();
    try {
      await client.start();
      const session = await client.createSession({
        model: this.model,
        systemMessage: { mode: "append", content: `${system}\n\n${GRADER_OUTPUT_INSTRUCTION}`.trim() },
        streaming: true,
        availableTools: [],
        onPermissionRequest: async () => ({ kind: "approve-once" }),
      });

      let content = "";
      session.on("assistant.message", (event) => {
        content += event.data.content;
      });

      await session.sendAndWait({ prompt: user });

      const { score, reason } = extractVerdict(content);
      // `pass` is hardcoded true so the rubric is score-only (non-gating).
      return { output: JSON.stringify({ pass: true, score, reason }) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    } finally {
      await client.stop();
    }
  }
}

/**
 * promptfoo renders the grading prompt as a JSON array of chat messages
 * (`[{role,content},...]`). Split it into system text (the rubric instructions)
 * and the user turn (the `<Output>…</Output><Rubric>…</Rubric>` payload). If the
 * prompt is not a JSON chat array, treat the whole string as the user turn.
 */
function splitRenderedPrompt(prompt: string): { system: string; user: string } {
  try {
    const parsed: unknown = JSON.parse(prompt);
    if (Array.isArray(parsed)) {
      const messages = parsed as RenderedChatMessage[];
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content ?? "")
        .join("\n\n");
      const user = messages
        .filter((m) => m.role !== "system")
        .map((m) => m.content ?? "")
        .join("\n\n");
      return { system, user: user.trim() ? user : prompt };
    }
  } catch {
    // Not a JSON chat array — fall through and use the raw prompt as the user turn.
  }
  return { system: "", user: prompt };
}

/**
 * Defensively pull `{ score, reason }` out of the model's reply. A reply we
 * cannot parse into a finite numeric score degrades to `score: 0` (the caller
 * still returns `pass: true`, so a malformed judge reply never gates a cell).
 */
function extractVerdict(content: string): GraderVerdict {
  const json = firstJsonObject(content);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    const numScore = typeof record.score === "number" ? record.score : Number(record.score);
    if (Number.isFinite(numScore)) {
      const score = Math.max(0, Math.min(1, numScore));
      const reason = typeof record.reason === "string" ? record.reason : "";
      return { score, reason };
    }
  }
  return {
    score: 0,
    reason: `Grader reply had no parseable numeric score; defaulting to 0. Raw: ${truncate(content)}`,
  };
}

/** Parse the first JSON object in a string, tolerating surrounding prose/fences. */
function firstJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // fall through to substring extraction
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function truncate(value: string, max = 200): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
