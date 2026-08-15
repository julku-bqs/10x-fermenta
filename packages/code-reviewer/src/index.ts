#!/usr/bin/env node
/**
 * CLI entry point for the code-review agent.
 *
 * This is intentionally thin — argument parsing + wiring — so the reusable
 * pieces (`CodeReviewer`, `getDiff`) can be embedded in other integrations
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
import { getDiff, type DiffSource } from "./git.js";
import { CodeReviewer } from "./reviewer.js";

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

function parseArgs(argv: string[]): CliOptions {
  const source: DiffSource = {};
  let model: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--stdin":
        source.stdin = true;
        break;
      case "--staged":
      case "--cached":
        source.staged = true;
        break;
      case "--file":
        source.file = argv[++i];
        break;
      case "--base":
        source.base = argv[++i];
        break;
      case "--model":
        model = argv[++i];
        break;
      case "-h":
      case "--help":
        process.stdout.write(`${HELP}\n`);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  // Auto-detect piped input when no explicit source was given.
  if (!source.stdin && !source.file && !source.base && !source.staged && !process.stdin.isTTY) {
    source.stdin = true;
  }

  return { source, model };
}

async function main(): Promise<void> {
  const { source, model } = parseArgs(process.argv.slice(2));
  const diff = getDiff(source);

  const reviewer = new CodeReviewer({ model });
  const { review } = await reviewer.review(diff);

  process.stdout.write(`${review}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`code-reviewer failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
