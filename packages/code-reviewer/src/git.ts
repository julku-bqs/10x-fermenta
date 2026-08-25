import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Where to obtain the diff to review. The first matching field wins, in the
 * order below. If none are set, defaults to `git diff HEAD` (all uncommitted
 * changes in the working tree).
 */
export interface DiffSource {
  /** Read the diff from stdin (e.g. `git diff | code-reviewer --stdin`). */
  stdin?: boolean;
  /** Read the diff from a file. */
  file?: string;
  /** Diff a base ref against HEAD: `git diff <base>...HEAD`. */
  base?: string;
  /** Review staged changes: `git diff --cached`. */
  staged?: boolean;
}

const MAX_BUFFER = 64 * 1024 * 1024;

/** Resolve a {@link DiffSource} into a unified diff string. */
export function getDiff(source: DiffSource): string {
  if (source.stdin) {
    return readFileSync(0, "utf8");
  }
  if (source.file) {
    return readFileSync(source.file, "utf8");
  }
  if (source.base) {
    return git(["diff", `${source.base}...HEAD`]);
  }
  if (source.staged) {
    return git(["diff", "--cached"]);
  }
  return git(["diff", "HEAD"]);
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: MAX_BUFFER });
}
