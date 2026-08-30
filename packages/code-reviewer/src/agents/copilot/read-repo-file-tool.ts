import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim();
    if (repoRoot) {
      return repoRoot;
    }
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error("unable to determine the repository root");
}

export function readRepoFile(args: ReadRepoFileArgs, repoRoot = resolveRepoRoot()): string {
  const requestedPath = args.path.trim();
  if (!requestedPath) {
    throw new Error("path is required");
  }

  const resolvedRepoRoot = realpathSync(repoRoot);
  const filePath = isAbsolute(requestedPath) ? requestedPath : resolve(resolvedRepoRoot, requestedPath);
  const requestedRelPath = relative(resolvedRepoRoot, filePath);
  if (isAbsolute(requestedRelPath) || requestedRelPath === ".." || requestedRelPath.startsWith(`..${sep}`)) {
    throw new Error("path must stay inside the repository root");
  }
  if (!existsSync(filePath)) {
    throw new Error("path does not exist");
  }

  const stats = lstatSync(filePath);
  // Reject a symlink at the final path component directly; intermediate
  // symlinked directories are handled by the realpath-based boundary check below.
  if (stats.isSymbolicLink()) {
    throw new Error("symlinks are not supported");
  }
  if (!stats.isFile()) {
    throw new Error("path must point to a file");
  }

  const resolvedFilePath = realpathSync(filePath);
  const relPath = relative(resolvedRepoRoot, resolvedFilePath);
  if (isAbsolute(relPath) || relPath === ".." || relPath.startsWith(`..${sep}`)) {
    throw new Error("path must stay inside the repository root");
  }

  const source = readFileSync(resolvedFilePath, "utf8");
  const splitLines = source.split(/\r?\n/);
  const lines = splitLines.at(-1) === "" ? splitLines.slice(0, -1) : splitLines;
  const startLine = clampLine(args.startLine ?? 1, 1, Math.max(lines.length, 1));
  const requestedEndLine = args.endLine ?? startLine + DEFAULT_MAX_LINES - 1;
  const endLine = clampLine(requestedEndLine, startLine, Math.max(lines.length, 1));

  const excerptLines = lines
    .slice(startLine - 1, endLine)
    .map((line, index) => `${startLine + index}. ${line}`);

  const truncatedByLine = endLine < lines.length;
  const { body, truncatedByChar } = joinWithinCharLimit(excerptLines, MAX_RESULT_CHARS);
  const truncated = truncatedByLine || truncatedByChar;

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

function joinWithinCharLimit(lines: string[], maxChars: number): { body: string; truncatedByChar: boolean } {
  let total = 0;
  const kept: string[] = [];

  for (const line of lines) {
    const nextSize = total === 0 ? line.length : total + 1 + line.length;
    if (nextSize > maxChars) {
      break;
    }
    kept.push(line);
    total = nextSize;
  }

  return {
    body: kept.join("\n"),
    truncatedByChar: kept.length < lines.length,
  };
}

export function createReadRepoFileTool(repoRoot: string): Tool<ReadRepoFileArgs> {
  return {
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
    handler: async (args) => {
      try {
        return readRepoFile(args, repoRoot);
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
