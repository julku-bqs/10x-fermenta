import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { readRepoFile } from "./read-repo-file-tool.js";

describe("readRepoFile", () => {
  it("reads a repo-relative file with line numbers", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "read-repo-file-"));
    try {
      mkdirSync(join(repoRoot, "src"));
      writeFileSync(join(repoRoot, "src/example.ts"), ["alpha", "beta", "gamma"].join("\n"));

      const out = readRepoFile({ path: "src/example.ts", startLine: 2, endLine: 3 }, repoRoot);

      expect(out).toContain("FILE: src/example.ts");
      expect(out).toContain("LINES: 2-3 of 3");
      expect(out).toContain("2. beta");
      expect(out).toContain("3. gamma");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects paths outside the repository root", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "read-repo-file-"));
    try {
      expect(() => readRepoFile({ path: "../outside.txt" }, repoRoot)).toThrow(
        /path must stay inside the repository root/,
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
