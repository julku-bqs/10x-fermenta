import { execSync } from "node:child_process";
import { readPayload } from "./shared.mjs";

const payload = await readPayload();

// Guard against infinite loops: if the agent is already continuing because a
// previous Stop hook blocked, allow it to stop this time.
if (payload.stop_hook_active) {
  process.exit(0);
}

try {
  execSync("npx astro check", {
    cwd: payload.cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch (err) {
  const errors = (err.stdout || err.stderr || "Typecheck failed").toString().trim();
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "Stop",
        decision: "block",
        reason: `Typecheck failed. Fix the errors below, then re-run \`npx astro check\` yourself and repeat the fix-and-verify cycle until it reports no errors before finishing.\n\n${errors}`,
      },
    }),
  );
}

