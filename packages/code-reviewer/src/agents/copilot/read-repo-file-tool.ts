import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import type { Tool } from "@github/copilot-sdk";

export const READ_REPO_FILE_TOOL_NAME = "read_repo_file";

const DEFAULT_MAX_LINES = 200;
const MAX_RESULT_CHARS = 20_000;

export interface ReadRepoFileArgs {
  path: string;
  startLine?: number;
  endLine?: number;
}

export function resolveRepoRoot(cwd = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    return cwd;
  }
}

export function readRepoFile(args: ReadRepoFileArgs, repoRoot = resolveRepoRoot()): string {
  const requestedPath = args.path.trim();
  if (!requestedPath) {
    throw new Error("path is required");
  }

  const filePath = isAbsolute(requestedPath) ? requestedPath : resolve(repoRoot, requestedPath);
  const relPath = relative(repoRoot, filePath);
  if (relPath.startsWith("..") || relPath === "") {
    throw new Error("path must stay inside the repository root");
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new Error("path must point to a file");
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const startLine = clampLine(args.startLine ?? 1, 1, Math.max(lines.length, 1));
  const requestedEndLine = args.endLine ?? startLine + DEFAULT_MAX_LINES - 1;
  const endLine = clampLine(requestedEndLine, startLine, Math.max(lines.length, 1));

  const excerpt = lines
    .slice(startLine - 1, endLine)
    .map((line, index) => `${startLine + index}. ${line}`)
    .join("\n");

  const truncatedByLine = endLine < lines.length;
  const body = excerpt.length > MAX_RESULT_CHARS ? `${excerpt.slice(0, MAX_RESULT_CHARS)}\n[truncated: output too long]` : excerpt;
  const truncated = truncatedByLine || excerpt.length > MAX_RESULT_CHARS;

  return [
    `FILE: ${relPath}`,
    `LINES: ${startLine}-${endLine} of ${lines.length}`,
    truncated ? "NOTE: output truncated; request a narrower range for more context." : undefined,
    body || "(empty file)",
  ]
    .filter(Boolean)
    .join("\n");
}

function clampLine(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export const readRepoFileTool: Tool<ReadRepoFileArgs> = {
  name: READ_REPO_FILE_TOOL_NAME,
  description:
    "Read a UTF-8 text file from the checked-out repository for additional code-review context. Returns line-numbered content.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "Repository-relative file path from the git repo root, for example src/lib/service.ts.",
      },
      startLine: {
        type: "integer",
        minimum: 1,
        description: "Optional 1-based first line to include. Defaults to 1.",
      },
      endLine: {
        type: "integer",
        minimum: 1,
        description: "Optional 1-based last line to include. Defaults to at most 200 lines from startLine.",
      },
    },
    required: ["path"],
  },
  skipPermission: true,
  handler: async (args) => readRepoFile(args),
};
