import { readFileSync, existsSync, rmSync } from "node:fs";
import { readPayload, stateFile } from "./shared.mjs";

const payload = await readPayload();

const logPath = stateFile(payload.cwd, "test-results.jsonl");

if (!existsSync(logPath)) {
  process.exit(0); // no test runs recorded -> allow the agent to stop
}

// Append-only log: keep only the latest outcome per file (last write wins), so a
// file that failed then later passed within the same turn is not reported stale.
const latest = new Map();
for (const line of readFileSync(logPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try {
    const entry = JSON.parse(line);
    latest.set(entry.file, entry);
  } catch {
    // ignore malformed lines
  }
}

// Soft loop-prevention: clear the log after reading so each batch of results is
// reported once. The reason tells the agent to re-run the tests itself and loop
// until green. A fresh edit repopulates the log, so genuine new failures still
// get reported on the next stop.
rmSync(logPath, { force: true });

const failed = [...latest.values()].filter((e) => !e.ok);

if (failed.length === 0) {
  process.exit(0); // all related tests passed -> allow the agent to stop
}

const report = failed.map((e) => `### ${e.file}\n${e.output}`).join("\n\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "Stop",
      decision: "block",
      reason: `Related tests failed for files you changed. Fix them, then re-run \`npx vitest related <file> --run\` for the affected files and repeat the fix-and-verify cycle until they pass before finishing.\n\n${report}`,
    },
  }),
);
