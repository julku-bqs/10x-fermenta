#!/usr/bin/env node
/**
 * Render the code-reviewer's JSON into a **sticky** PR comment.
 *
 * The single formatting owner (co-located with the action, not a package
 * export). Reads the CLI's JSON from stdin or a file argument and writes
 * Markdown to stdout: a hidden sticky marker, a verdict badge, the summary,
 * findings grouped by criterion, and nitpicks inside a collapsible block.
 *
 *   node format-comment.mjs < result.json
 *   node format-comment.mjs result.json
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Hidden marker so the sticky comment is identifiable even without --edit-last. */
const STICKY_MARKER = "<!-- ai-code-review -->";

/** decision → badge line (declined stays neutral — never a green pass). */
const BADGES = {
  approved: "✅ **Approved** — no blocking issues found.",
  flagged: "⚠️ **Flagged** — non-blocking issues worth a look.",
  blocked: "❌ **Changes requested** — blocking issues found.",
  declined: "⚪ **Not reviewed** — this change was not evaluated.",
};

/** Stable group order + human labels for the five criteria; null → Uncategorized (last). */
const CRITERIA = [
  ["correctness", "Correctness"],
  ["domain_integrity", "Domain integrity"],
  ["input_contract", "Input contract"],
  ["security_isolation", "Security & isolation"],
  ["data_migration", "Data & migration"],
];
const CRITERION_LABELS = new Map(CRITERIA);
const CRITERION_ORDER = CRITERIA.map(([key]) => key);
const UNCATEGORIZED = "__uncategorized__";

const SEVERITY_RANK = { blocker: 0, high: 1, medium: 2, low: 3 };

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function loadInput() {
  const fileArg = process.argv[2];
  return fileArg ? readFileSync(fileArg, "utf8") : readStdin();
}

/** Location cell: `path:line` when a line is present, else just the path. */
function location(finding) {
  const line = finding.lineNumber ? `:${finding.lineNumber}` : "";
  return `\`${finding.filePath}${line}\``;
}

/** Group findings by criterion into the fixed order, Uncategorized last. */
function groupFindings(findings) {
  const groups = new Map();
  for (const key of CRITERION_ORDER) groups.set(key, []);
  groups.set(UNCATEGORIZED, []);
  for (const f of findings) {
    const key = f.criterion && groups.has(f.criterion) ? f.criterion : UNCATEGORIZED;
    groups.get(key).push(f);
  }
  return groups;
}

function renderFindings(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return "";
  const groups = groupFindings(findings);
  const blocks = [];
  for (const [key, items] of groups) {
    if (items.length === 0) continue;
    const heading = key === UNCATEGORIZED ? "Uncategorized" : CRITERION_LABELS.get(key);
    const sorted = [...items].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99),
    );
    const rows = sorted
      .map((f) => `- \`${f.severity}\` · ${location(f)}\n  ${f.message}`)
      .join("\n");
    blocks.push(`#### ${heading}\n\n${rows}`);
  }
  if (blocks.length === 0) return "";
  return `### Findings\n\n${blocks.join("\n\n")}`;
}

function renderNitpicks(nitpicks) {
  if (!Array.isArray(nitpicks) || nitpicks.length === 0) return "";
  const items = nitpicks.map((n) => `- ${n}`).join("\n");
  return `<details>\n<summary>Nitpicks (${nitpicks.length})</summary>\n\n${items}\n\n</details>`;
}

function renderBadge(verdict) {
  const decision = verdict?.decision;
  const badge = BADGES[decision] ?? `❔ **${decision ?? "Unknown"}**`;
  const gate =
    decision === "declined" ? "neutral" : verdict?.pass === false ? "fail" : "pass";
  return `${badge}\n\n> **Gate:** ${gate}`;
}

export function render(result) {
  const parts = [STICKY_MARKER, "## 🤖 AI Code Review", renderBadge(result.verdict)];
  if (result.summary) parts.push(String(result.summary));
  const findings = renderFindings(result.findings);
  if (findings) parts.push(findings);
  const nitpicks = renderNitpicks(result.nitpicks);
  if (nitpicks) parts.push(nitpicks);
  parts.push("---\n<sub>Automated review by <code>@10x-fermenta/code-reviewer</code>.</sub>");
  return `${parts.join("\n\n")}\n`;
}

/** Fallback comment when stdout was not valid JSON (the action normally gates this out). */
function renderUnparseable() {
  return (
    `${STICKY_MARKER}\n\n## 🤖 AI Code Review\n\n` +
    "⚪ **Not reviewed** — the reviewer did not return a readable result.\n"
  );
}

async function main() {
  const raw = await loadInput();
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    process.stdout.write(renderUnparseable());
    return;
  }
  process.stdout.write(render(result));
}

// Direct execution only: importing this module (e.g. from the test) must not read stdin.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`format-comment failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
