import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createReadRepoFileTool, readRepoFile } from "./read-repo-file-tool.js";

describe("readRepoFile", () => {
  it("reads a repo-relative file with line numbers", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "read-repo-file-"));
    try {
      mkdirSync(join(repoRoot, "src"));
      writeFileSync(join(repoRoot, "src/example.ts"), ["alpha", "beta", "gamma", ""].join("\n"));

      const out = readRepoFile({ path: "src/example.ts", startLine: 2, endLine: 3 }, repoRoot);

      expect(out).toContain("FILE: src/example.ts");
      expect(out).toContain("LINES: 2-3 of 3");
      expect(out).toContain("2. beta");
      expect(out).toContain("3. gamma");
      expect(out).not.toContain("NOTE: output truncated");
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

  it("rejects the repository root itself because it is not a file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "read-repo-file-"));
    try {
      expect(() => readRepoFile({ path: "." }, repoRoot)).toThrow(/path must point to a file/);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns a graceful tool error string for unreadable paths", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "read-repo-file-"));

    try {
      const readRepoFileTool = createReadRepoFileTool(repoRoot);

      await expect(
        readRepoFileTool.handler?.(
          { path: "../outside.txt" },
          {
            sessionId: "session",
            toolCallId: "tool-call",
            toolName: readRepoFileTool.name,
            arguments: { path: "../outside.txt" },
          },
        ),
      ).resolves.toMatch(
        /Error reading file: path must stay inside the repository root/,
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects symlinks even when the path stays under the repository root", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "read-repo-file-"));
    try {
      writeFileSync(join(repoRoot, "target.txt"), "secret");
      symlinkSync(join(repoRoot, "target.txt"), join(repoRoot, "link.txt"));

      expect(() => readRepoFile({ path: "link.txt" }, repoRoot)).toThrow(/symlinks are not supported/);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects paths that escape through an intermediate symlinked directory", () => {
    const tempParent = mkdtempSync(join(tmpdir(), "read-repo-file-parent-"));
    const repoRoot = join(tempParent, "repo");
    const outsideRoot = join(tempParent, "outside");
    try {
      mkdirSync(join(repoRoot, "src"), { recursive: true });
      mkdirSync(outsideRoot, { recursive: true });
      writeFileSync(join(outsideRoot, "secret.txt"), "secret");
      symlinkSync(outsideRoot, join(repoRoot, "src/outside"));

      expect(() => readRepoFile({ path: "src/outside/secret.txt" }, repoRoot)).toThrow(
        /path must stay inside the repository root/,
      );
    } finally {
      rmSync(tempParent, { recursive: true, force: true });
    }
  });
});
