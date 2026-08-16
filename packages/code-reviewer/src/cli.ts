#!/usr/bin/env node
/**
 * CLI entry point for the code-review agent.
 *
 * This is intentionally thin — argument parsing + wiring — so the reusable
 * pieces (`createReviewAgent`, `getDiff`) can be embedded in other integrations
 * such as a GitHub Actions job or an internal service.
 *
 * Usage:
 *   code-reviewer                      # review `git diff HEAD`
 *   code-reviewer --staged             # review staged changes
 *   code-reviewer --base origin/main   # review <base>...HEAD
 *   code-reviewer --file changes.diff  # review a diff file
 *   git diff | code-reviewer --stdin   # review piped diff
 *   code-reviewer --model gpt-5.4      # override the model
 */
import { parseArgs } from "node:util";
import { getDiff, type DiffSource } from "./git.js";
import { createReviewAgent } from "./agents/factory.js";

interface CliOptions {
  source: DiffSource;
  model?: string;
}

const HELP = `code-reviewer — review a git diff with a custom GitHub Copilot agent

Options:
  --stdin            Read the diff from stdin
  --file <path>      Read the diff from a file
  --base <ref>       Diff <ref>...HEAD (e.g. origin/main)
  --staged           Review staged changes (git diff --cached)
  --model <id>       Model to use (default: auto)
  -h, --help         Show this help

With no source flag, reviews uncommitted changes (git diff HEAD), or reads
stdin automatically when input is piped.`;

function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      stdin: { type: "boolean" },
      staged: { type: "boolean" },
      cached: { type: "boolean" },
      file: { type: "string" },
      base: { type: "string" },
      model: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }

  const source: DiffSource = {};
  if (values.stdin) source.stdin = true;
  if (values.staged || values.cached) source.staged = true;
  if (values.file !== undefined) source.file = values.file;
  if (values.base !== undefined) source.base = values.base;

  // Auto-detect piped input when no explicit source was given.
  if (!source.stdin && !source.file && !source.base && !source.staged && !process.stdin.isTTY) {
    source.stdin = true;
  }

  return { source, model: values.model };
}

async function main(): Promise<void> {
  const { source, model } = parseCliArgs(process.argv.slice(2));
  const diff = getDiff(source);

  const reviewer = createReviewAgent({ model });
  const result = await reviewer.review(diff);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`code-reviewer failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
