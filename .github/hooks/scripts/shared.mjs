import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";

export const WRITE_TOOLS = new Set([
  "apply_patch",
  "create_file",
  "replace_string_in_file",
  "multi_replace_string_in_file",
  "editFiles",
  "createFile",
  "edit",
  "create",
  "write",
  "str_replace_editor",
  "str_replace_based_edit_tool",
]);

export function readPayload() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(JSON.parse(data)));
  });
}

export function getFilePaths(payload) {
  const paths = new Set();

  if (payload.tool_input?.filePath) {
    paths.add(payload.tool_input.filePath);
  }
  if (payload.tool_input?.replacements) {
    for (const r of payload.tool_input.replacements) {
      if (r.filePath) paths.add(r.filePath);
    }
  }
  if (payload.tool_input?.files) {
    for (const f of payload.tool_input.files) {
      if (f) paths.add(f);
    }
  }

  return [...paths];
}

export function filterByExtension(paths, pattern) {
  return paths.filter((p) => pattern.test(p));
}

// Returns an absolute path to a per-repository state file under the OS temp dir,
// scoped by a hash of the workspace path so hooks in different repos don't clash.
export function stateFile(cwd, name) {
  const key = createHash("sha1").update(cwd ?? process.cwd()).digest("hex").slice(0, 12);
  const dir = join(tmpdir(), "vscode-agent-hooks", key);
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}
