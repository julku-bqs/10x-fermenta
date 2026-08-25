#!/usr/bin/env node
/**
 * The load-bearing fail-vs-warn gate decision, isolated from the composite
 * action's YAML so it is deterministically testable *before* any live PR.
 *
 * `decideGate` is pure: given the CLI's exit code and stdout, it returns the
 * label mutations plus the warn/fail flags the action acts on. Run directly, the
 * module reads `CLI_EXIT` + stdin and prints shell-eval'able `KEY=VALUE` lines
 * (DECISION / ADD_LABEL / REMOVE_LABEL / WARN / FAIL) for the action's `gh`
 * steps. The action stays thin wiring; this module owns the branch.
 */
import { pathToFileURL } from "node:url";

const PASS_LABEL = "ai-cr:passed";
const FAIL_LABEL = "ai-cr:failed";
const SKIP_LABEL = "ai-cr:skipped";

/** Warn-and-pass: reviewer never produced a usable verdict. Touch no label. */
const WARN_RESULT = { verdict: null, addLabel: "", removeLabel: "", warn: true, fail: false };

/**
 * Decide the gate outcome from the CLI's exit code and stdout.
 *
 * @param {{ cliExit: number, stdout: string }} args
 * @returns {{ verdict: object | null, addLabel: string, removeLabel: string, warn: boolean, fail: boolean }}
 */
export function decideGate({ cliExit, stdout }) {
  // Reviewer failed to run (crash / non-zero exit): warn, never block.
  if (cliExit !== 0) return { ...WARN_RESULT };

  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    // Unparseable output is indistinguishable from a crash for gating purposes.
    return { ...WARN_RESULT };
  }

  const verdict = result?.verdict;
  if (!verdict || typeof verdict !== "object") return { ...WARN_RESULT };

  // Oversize decline: neutral "not reviewed". Never reads as passed, never blocks;
  // strip any stale pass/fail label so a re-run of a shrunk-then-grown PR is clean.
  if (verdict.decision === "declined") {
    return {
      verdict,
      addLabel: SKIP_LABEL,
      removeLabel: `${PASS_LABEL},${FAIL_LABEL}`,
      warn: false,
      fail: false,
    };
  }

  // Normal result: gate on the single boolean the model never touches. Strip a
  // stale ai-cr:skipped too, so a declined-then-reviewed PR ends on exactly one label.
  if (verdict.pass === false) {
    return { verdict, addLabel: FAIL_LABEL, removeLabel: `${PASS_LABEL},${SKIP_LABEL}`, warn: false, fail: true };
  }
  return { verdict, addLabel: PASS_LABEL, removeLabel: `${FAIL_LABEL},${SKIP_LABEL}`, warn: false, fail: false };
}

/** Single-quote a value for safe `eval` in bash; escape embedded single quotes. */
function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

/** Render the decision as shell-eval'able `KEY=VALUE` lines. */
export function emitShell(decision) {
  return [
    `DECISION=${shellQuote(decision.verdict?.decision ?? "")}`,
    `ADD_LABEL=${shellQuote(decision.addLabel)}`,
    `REMOVE_LABEL=${shellQuote(decision.removeLabel)}`,
    `WARN=${decision.warn ? "1" : "0"}`,
    `FAIL=${decision.fail ? "1" : "0"}`,
  ].join("\n");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// Direct execution: read CLI_EXIT + stdin, emit shell lines for the action to eval.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const stdout = await readStdin();
  const parsedExit = Number.parseInt(process.env.CLI_EXIT ?? "0", 10);
  const cliExit = Number.isNaN(parsedExit) ? 1 : parsedExit;
  process.stdout.write(`${emitShell(decideGate({ cliExit, stdout }))}\n`);
}
