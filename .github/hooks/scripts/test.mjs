import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { WRITE_TOOLS, readPayload, getFilePaths, filterByExtension, stateFile } from "./shared.mjs";

const payload = await readPayload();

if (!WRITE_TOOLS.has(payload.tool_name)) {
  process.exit(0);
}

const files = filterByExtension(getFilePaths(payload), /\.(ts|tsx)$/);

if (files.length === 0) {
  process.exit(0);
}

const logPath = stateFile(payload.cwd, "test-results.jsonl");

// On Windows, execSync's default cmd.exe shell breaks vitest 4's worker bootstrap (0 tests collected); PowerShell avoids it.
const shell = process.platform === "win32" ? "powershell.exe" : undefined;

// Run the related tests for each modified file and append the outcome to a shared
// log. The Stop hook (test-report.mjs) reads this log and feeds failures back to
// the agent, so this hook itself never blocks - it only records state.
for (const file of files) {
  let ok = true;
  let output = "";

  try {
    execSync(`npx vitest related "${file}" --run --passWithNoTests`, {
      cwd: payload.cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell,
      env: { ...process.env, AI_AGENT: "1" },
    });
  } catch (err) {
    ok = false;
    output = (err.stdout || err.stderr || "Tests failed").toString().trim();
  }

  appendFileSync(logPath, JSON.stringify({ file, ok, output }) + "\n");
}
