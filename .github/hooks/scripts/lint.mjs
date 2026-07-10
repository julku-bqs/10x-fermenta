import { execSync } from "node:child_process";
import { WRITE_TOOLS, readPayload, getFilePaths, filterByExtension } from "./shared.mjs";

const payload = await readPayload();

if (!WRITE_TOOLS.has(payload.tool_name)) {
  process.exit(0);
}

const files = filterByExtension(getFilePaths(payload), /\.(ts|tsx|astro)$/);

if (files.length === 0) {
  process.exit(0);
}

try {
  execSync(`npx eslint --fix ${files.map((f) => `"${f}"`).join(" ")}`, {
    cwd: payload.cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  process.exit(0);
} catch (err) {
  const errors = (err.stdout || err.stderr || "Unknown lint error").trim();
  process.stderr.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: errors,
    },
  }));
  process.exit(err.status || 1);
}
