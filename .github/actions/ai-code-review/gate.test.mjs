/**
 * Unit tests for the gate decision — the load-bearing fail-vs-warn branch.
 *
 * Run out-of-vitest via `node --test .github/actions/ai-code-review/gate.test.mjs`
 * (same convention as the co-located formatter — these live with the action, not
 * in the package's vitest program). Covers the four gate cases the action relies
 * on: pass, blocked, declined, and reviewer-did-not-run.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideGate } from "./gate.mjs";

test("(a) pass JSON → ai-cr:passed, no fail", () => {
  const stdout = JSON.stringify({ verdict: { decision: "approved", pass: true } });
  const r = decideGate({ cliExit: 0, stdout });
  assert.equal(r.addLabel, "ai-cr:passed");
  assert.equal(r.removeLabel, "ai-cr:failed");
  assert.equal(r.warn, false);
  assert.equal(r.fail, false);
});

test("(a') flagged JSON (pass:true) → ai-cr:passed, no fail", () => {
  const stdout = JSON.stringify({ verdict: { decision: "flagged", pass: true } });
  const r = decideGate({ cliExit: 0, stdout });
  assert.equal(r.addLabel, "ai-cr:passed");
  assert.equal(r.fail, false);
});

test("(b) blocked JSON (pass:false) → ai-cr:failed, fail:true", () => {
  const stdout = JSON.stringify({ verdict: { decision: "blocked", pass: false } });
  const r = decideGate({ cliExit: 0, stdout });
  assert.equal(r.addLabel, "ai-cr:failed");
  assert.equal(r.removeLabel, "ai-cr:passed");
  assert.equal(r.warn, false);
  assert.equal(r.fail, true);
});

test("(c) declined JSON → ai-cr:skipped, removes both pass/fail, no fail, no warn", () => {
  const stdout = JSON.stringify({ verdict: { decision: "declined", pass: true } });
  const r = decideGate({ cliExit: 0, stdout });
  assert.equal(r.addLabel, "ai-cr:skipped");
  assert.equal(r.removeLabel, "ai-cr:passed,ai-cr:failed");
  assert.equal(r.warn, false);
  assert.equal(r.fail, false);
});

test("(d) cliExit:1 → warn, no label, no fail", () => {
  const r = decideGate({ cliExit: 1, stdout: "" });
  assert.equal(r.warn, true);
  assert.equal(r.addLabel, "");
  assert.equal(r.removeLabel, "");
  assert.equal(r.fail, false);
});

test("(d') garbage stdout on exit 0 → warn, no label, no fail", () => {
  const r = decideGate({ cliExit: 0, stdout: "not json {{{" });
  assert.equal(r.warn, true);
  assert.equal(r.addLabel, "");
  assert.equal(r.fail, false);
});

test("(d'') parseable JSON without a verdict → warn (never reads as pass)", () => {
  const stdout = JSON.stringify({ summary: "no verdict here", findings: [] });
  const r = decideGate({ cliExit: 0, stdout });
  assert.equal(r.warn, true);
  assert.equal(r.addLabel, "");
  assert.equal(r.fail, false);
});
