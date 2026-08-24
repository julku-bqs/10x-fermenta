/**
 * Section tests for the sticky-comment formatter across the four result shapes:
 * findings-present, blocked, declined (oversize), and empty. Run out-of-vitest
 * via `node --test .github/actions/ai-code-review/format-comment.test.mjs`.
 *
 * These assert structural markers (marker, badge, criterion groupings, nitpicks
 * block, graceful empty state) — the same things the manual eyeball confirms —
 * rather than pinning every character, so wording tweaks don't break the suite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render } from "./format-comment.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

const STICKY_MARKER = "<!-- ai-code-review -->";

test("findings-present: marker, flagged badge, all criterion groups, nitpicks, pass gate", () => {
  const md = render(load("findings.json"));
  assert.ok(md.startsWith(STICKY_MARKER), "starts with the hidden sticky marker");
  assert.match(md, /✅ \*\*Approved\*\*|⚠️ \*\*Flagged\*\*/);
  assert.match(md, /⚠️ \*\*Flagged\*\*/, "flagged badge present");
  assert.match(md, /### Findings/);
  assert.match(md, /#### Correctness/);
  assert.match(md, /#### Input contract/);
  assert.match(md, /#### Security & isolation/);
  assert.match(md, /#### Uncategorized/, "null criterion groups under Uncategorized");
  assert.match(md, /<details>\n<summary>Nitpicks \(2\)<\/summary>/, "nitpicks are collapsible");
  assert.match(md, /\*\*Gate:\*\* pass/);
  // Location rendering: line and range, and a path with no line.
  assert.match(md, /`src\/pages\/api\/batches\/index\.ts:42`/);
  assert.match(md, /`src\/components\/batches\/BatchForm\.tsx`/);
});

test("blocked: changes-requested badge, blocking criterion groups, fail gate, no nitpicks block", () => {
  const md = render(load("blocked.json"));
  assert.ok(md.startsWith(STICKY_MARKER));
  assert.match(md, /❌ \*\*Changes requested\*\*/, "blocked renders a red 'changes requested' badge");
  assert.match(md, /### Findings/);
  assert.match(md, /#### Domain integrity/);
  assert.match(md, /#### Data & migration/);
  assert.match(md, /\*\*Gate:\*\* fail/);
  assert.doesNotMatch(md, /<summary>Nitpicks/, "no nitpicks block when the list is empty");
});

test("declined: neutral 'not reviewed' badge, neutral gate, summary, no findings section", () => {
  const md = render(load("declined.json"));
  assert.ok(md.startsWith(STICKY_MARKER));
  assert.match(md, /⚪ \*\*Not reviewed\*\*/, "declined is neutral, never a green pass");
  assert.doesNotMatch(md, /✅ \*\*Approved\*\*/, "declined must not read as approved");
  assert.match(md, /\*\*Gate:\*\* neutral/);
  assert.match(md, /exceeds the 50000-character limit/, "summary explains the decline");
  assert.doesNotMatch(md, /### Findings/, "no findings section when there are none");
});

test("empty: approved badge, graceful (badge + summary only), no findings or nitpicks blocks", () => {
  const md = render(load("empty.json"));
  assert.ok(md.startsWith(STICKY_MARKER));
  assert.match(md, /✅ \*\*Approved\*\*/);
  assert.match(md, /\*\*Gate:\*\* pass/);
  assert.match(md, /nothing to flag/, "summary is rendered");
  assert.doesNotMatch(md, /### Findings/);
  assert.doesNotMatch(md, /<summary>Nitpicks/);
});
