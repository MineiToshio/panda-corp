#!/usr/bin/env node
/** Proposal 32 R10 — offline/runtime-source certification harness. Never claims live app proof. */
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  acquire,
  finalizeRelease,
  quiesce,
  reclaim,
  release,
  reserveDispatch,
  setHealth,
  transitionWorkOrder,
} from "../runtime/build-state.mjs";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
let passed = 0;
const evidence = [];
function ok(condition, name, kind = "fixture") {
  if (!condition) throw new Error(name);
  passed++;
  evidence.push({ name, kind, status: "PROVEN" });
  console.log(`PASS [${kind}] ${name}`);
}
async function git(project, ...args) {
  return (await exec("git", ["-C", project, ...args])).stdout.trim();
}
async function commitAll(project, message) {
  await git(project, "add", ".pandacorp/status.yaml", "docs/frds");
  const staged = await git(project, "diff", "--cached", "--name-only");
  if (staged) await git(project, "commit", "-m", message);
  return git(project, "rev-parse", "HEAD");
}
async function resolveRun(project, runtime, mode = "auto") {
  const { stdout } = await exec("node", [path.join(root, "plugin/scripts/resolve-build-run-id.mjs"), "--project", project, "--runtime", runtime, "--mode", mode, "--new-id", `new-${runtime}`]);
  return JSON.parse(stdout);
}
async function fixture() {
  const project = await mkdtemp(path.join(os.tmpdir(), "pandacorp-r10-"));
  await mkdir(path.join(project, ".pandacorp/run"), { recursive: true });
  await mkdir(path.join(project, "docs/frds/frd-a/work-orders"), { recursive: true });
  await writeFile(path.join(project, ".gitignore"), ".pandacorp/run/\n");
  await writeFile(path.join(project, ".pandacorp/status.yaml"), "phase: implementation\nrunning: false\noverlay_version: 9.0.0\n");
  const fm = "---\nimplementation_status: PLANNED\n---\n";
  await writeFile(path.join(project, "docs/frds/frd-a/frd.md"), fm);
  await writeFile(
    path.join(project, "docs/frds/frd-a/blueprint.md"),
    `${fm}\n## Build Plan\n\n| WO | Depends |\n|---|---|\n| WO-A | — |\n| WO-B | WO-A |\n`,
  );
  await writeFile(path.join(project, "docs/frds/frd-a/work-orders/wo-a.md"), `---\nid: WO-A\nimplementation_status: PLANNED\ndependsOn: []\n---\n`);
  await writeFile(path.join(project, "docs/frds/frd-a/work-orders/wo-b.md"), `---\nid: WO-B\nimplementation_status: PLANNED\ndependsOn: [WO-A]\n---\n`);
  await git(project, "init", "-b", "main");
  await git(project, "config", "user.email", "r10@example.invalid");
  await git(project, "config", "user.name", "R10 fixture");
  await git(project, "add", ".");
  await git(project, "commit", "-m", "test: seed R10 cold-switch project");
  return project;
}
async function safePoint(project, runtime, runId, woFile, dispatchId) {
  const lease = await acquire(project, { runtime, runId, ttlSeconds: 60 });
  const ledgerBeforeHealth = await reserveDispatch(project, lease.token, lease.epoch, { id: dispatchId, units: 1, limit: 4 });
  const ledgerAfterHealth = await setHealth(project, lease.token, lease.epoch, ledgerBeforeHealth.consecutive_blocks + 1);
  await transitionWorkOrder(project, lease.token, lease.epoch, { file: woFile, to: "IN_PROGRESS" });
  await transitionWorkOrder(project, lease.token, lease.epoch, { file: woFile, to: "IN_REVIEW" });
  await transitionWorkOrder(project, lease.token, lease.epoch, { file: woFile, to: "VERIFIED" });
  const evidenceSha = await commitAll(project, `test(${runtime}): verified safe point`);
  await quiesce(project, lease.token, lease.epoch);
  await commitAll(project, `chore(${runtime}): quiesce safe point`);
  await finalizeRelease(project, lease.token, lease.epoch);
  return { lease, evidenceSha, ledgerBeforeHealth, ledgerAfterHealth };
}

const projects = [];
try {
  const project = await fixture();
  projects.push(project);
  const logicalRunId = "shared-r10-cold-run";
  const first = await safePoint(project, "claude", logicalRunId, "docs/frds/frd-a/work-orders/wo-a.md", "claude-WO-A");
  ok(!await readFile(path.join(project, ".pandacorp/run/build.lease/lease.json"), "utf8").then(() => true).catch(() => false), "Claude safe point releases ownership before Codex", "fixture-real-cli");
  const codexResolution = await resolveRun(project, "codex");
  ok(codexResolution.continuation && codexResolution.run_id === logicalRunId, "Codex launcher protocol auto-resolves the prior Claude logical run without owner-supplied IDs", "fixture-real-cli");
  const second = await safePoint(project, "codex", logicalRunId, "docs/frds/frd-a/work-orders/wo-b.md", "codex-WO-B");
  const woA = await readFile(path.join(project, "docs/frds/frd-a/work-orders/wo-a.md"), "utf8");
  const woB = await readFile(path.join(project, "docs/frds/frd-a/work-orders/wo-b.md"), "utf8");
  ok(/VERIFIED/.test(woA) && /VERIFIED/.test(woB) && second.lease.epoch > first.lease.epoch, "Claude→Codex reconstructs canonical WOs with a newer fenced epoch", "fixture-real-cli");
  ok(second.ledgerBeforeHealth.spend_units === 2 && second.ledgerBeforeHealth.consecutive_blocks === 1 && second.ledgerAfterHealth.consecutive_blocks === 2, "Claude→Codex preserves cumulative spend and health brakes under one logical run id", "fixture-real-cli");
  const claudeResolution = await resolveRun(project, "claude");
  ok(claudeResolution.continuation && claudeResolution.run_id === logicalRunId, "Claude launcher protocol auto-resolves the prior Codex logical run without owner-supplied IDs", "fixture-real-cli");
  const third = await acquire(project, { runtime: "claude", runId: logicalRunId, ttlSeconds: 60 });
  ok(third.epoch > second.lease.epoch, "Codex→Claude cold return acquires only after Codex finalization", "fixture-real-cli");
  const returnLedger = await reserveDispatch(project, third.token, third.epoch, { id: "claude-return-check", units: 1, limit: 4 });
  ok(returnLedger.spend_units === 3 && returnLedger.consecutive_blocks === 2, "Codex→Claude preserves the same durable spend and health floors", "fixture-real-cli");
  const replay = await reserveDispatch(project, third.token, third.epoch, { id: "codex-WO-B", units: 1, limit: 4 });
  await reserveDispatch(project, third.token, third.epoch, { id: "overspend-after-switches", units: 2, limit: 4 }).then(() => { throw new Error("overspend after switches succeeded"); }, () => {});
  ok(replay.spend_units === 3 && replay.dispatch_count === 3, "dispatch replay stays idempotent and overspend stays blocked after both switches", "fixture-real-cli");
  await quiesce(project, third.token, third.epoch);
  await commitAll(project, "chore(claude): quiesce return safe point");
  await finalizeRelease(project, third.token, third.epoch);
  ok(!(await git(project, "status", "--porcelain")), "cold-switch fixture ends clean with no transcript/message handoff", "fixture-real-cli");

  const contention = await fixture();
  projects.push(contention);
  const attempts = await Promise.allSettled([
    acquire(contention, { runtime: "claude", runId: "race-claude", ttlSeconds: 60 }),
    acquire(contention, { runtime: "codex", runId: "race-codex", ttlSeconds: 60 }),
  ]);
  const winners = attempts.filter((item) => item.status === "fulfilled");
  ok(winners.length === 1, "simultaneous Claude/Codex acquisition has exactly one winner", "fixture-real-cli");
  const winner = winners[0].value;
  await release(contention, winner.token, winner.epoch);

  const fenced = await fixture();
  projects.push(fenced);
  const owner = await acquire(fenced, { runtime: "codex", runId: "fence-owner", ttlSeconds: 3 });
  await release(fenced, "not-the-owner", owner.epoch).then(() => { throw new Error("non-owner release succeeded"); }, () => {});
  ok(true, "non-owner release is rejected", "fixture-real-cli");
  const leasePath = path.join(fenced, ".pandacorp/run/build.lease/lease.json");
  const stale = JSON.parse(await readFile(leasePath, "utf8"));
  stale.renewed_at = "2000-01-01T00:00:00.000Z";
  await writeFile(leasePath, `${JSON.stringify(stale, null, 2)}\n`);
  const reclaimed = await reclaim(fenced, { runtime: "claude", runId: "stale-reclaimer", ttlSeconds: 60 });
  await reserveDispatch(fenced, owner.token, owner.epoch, { id: "zombie", units: 1, limit: 1 }).then(() => { throw new Error("zombie dispatch succeeded"); }, () => {});
  ok(reclaimed.epoch > owner.epoch, "stale reclaim increments epoch and fences zombie dispatch", "fixture-real-cli");
  await release(fenced, reclaimed.token, reclaimed.epoch);

  const ownership = JSON.parse(await readFile(path.join(root, "plugin/runtime/capability-ownership.json"), "utf8"));
  const policy = JSON.parse(await readFile(path.join(root, "plugin/runtime/skill-runtime-policy.json"), "utf8"));
  ok(ownership.capabilities.factory_backlog_orchestration.runtime_owner === "claude" && /Single-item mode only/.test(policy.overrides["implement-backlog"].codex.fallback), "drain-all remains explicitly Claude-only; Codex exposes single-item fallback", "source");
  const schedulerOwners = Object.entries(ownership.capabilities).filter(([, value]) => value.scheduler_owner).map(([id, value]) => [id, value.scheduler_owner]);
  ok(schedulerOwners.length === 2 && schedulerOwners.every(([, ownerName]) => ownerName === "claude"), "only the two deployed routines have scheduler ownership and both remain Claude-owned", "source");
  const [claudeLauncher, codexLauncher] = await Promise.all([
    readFile(path.join(root, "plugin/scripts/launch-implement.sh"), "utf8"),
    readFile(path.join(root, "plugin/scripts/launch-codex-implement.sh"), "utf8"),
  ]);
  ok(claudeLauncher.includes("resolve-build-run-id.mjs") && codexLauncher.includes("resolve-build-run-id.mjs"), "both runtime launchers consume the single automatic logical-run resolver", "source");
  const codexSuite = await readFile(path.join(root, "plugin/scripts/test-codex-executor.mjs"), "utf8");
  ok(/orphan IN_PROGRESS/.test(codexSuite) && /preserved RED baseline/.test(codexSuite) && /refuses release when hardening evidence is absent/.test(codexSuite), "Codex certification suite binds IN_PROGRESS reconciliation, preserved RED evidence and hardening", "source");
  const claudeEngine = await readFile(path.join(root, "plugin/templates/shared/.claude/engines/pandacorp-build.js"), "utf8");
  const claudeSuite = await readFile(path.join(root, "plugin/scripts/test-pandacorp-build.mjs"), "utf8");
  ok(/preserve gate-worktree crash evidence/.test(claudeEngine) && /dirty, orphaned, unregistered, or ambiguous/.test(claudeEngine) && !/worktree remove\s+--force[^\n]*gate-worktree|rm\s+-rf[^\n]*gate-worktree/.test(claudeEngine) && /worktree creation fails/.test(claudeSuite) && /hardening-failure close/.test(claudeSuite), "Claude source/harness preserves unsafe gate-worktree evidence, falls back synchronously and binds hardening failure", "source");

  const separateSuites = [
    ["build-state fencing, spend/health and transaction crash recovery", "node plugin/scripts/test-build-state.mjs"],
    ["Stop ownership, uncertified Codex lease and jq fail-closed", "node plugin/scripts/test-codex-enforcement.mjs"],
    ["Claude safe-point/release source lifecycle", "node plugin/scripts/test-engine-lease-lifecycle.mjs"],
    ["plugin/cache/generated drift", "bash plugin/scripts/test-check-derived-drift.sh"],
    ["overlay gate-config drift", "bash plugin/scripts/test-detect-gate-config-newer.sh"],
    ["Claude-only backlog drain-all", "node plugin/scripts/test-pandacorp-backlog.mjs"],
  ];
  for (const [name, command] of separateSuites) {
    evidence.push({ name, kind: "fixture/source-suite", status: "SEPARATE_COMMAND", command });
  }

  evidence.push({ name: "installed Claude Dynamic Workflow→installed Codex app→installed Claude app", kind: "live", status: "PENDING", reason: "R10 harness cannot launch a Claude Code Dynamic Workflow from Codex; requires owner-run installed-runtime canary." });
  evidence.push({ name: "Codex full executor subprocess suite", kind: "fixture", status: "SEPARATE_COMMAND", command: "node plugin/scripts/test-codex-executor.mjs", reason: "Runs separately because its process-group kill canaries intentionally terminate nested process groups." });
  evidence.push({ name: "Claude Dynamic Workflow source harness", kind: "fixture", status: "SEPARATE_COMMAND", command: "node plugin/scripts/test-pandacorp-build.mjs", reason: "Runs separately from the aggregate so runtime lifecycle canaries cannot affect its parent process." });
  console.log("PENDING [live] installed bidirectional runtime canary — no live claim fabricated");
  console.log(`RESULT: ${passed} proven checks; 1 live scenario pending`);
  console.log(JSON.stringify({ ring: "R10", verdict: "FIXTURE_PROVEN_LIVE_PENDING", evidence }, null, 2));
} finally {
  for (const project of projects) await rm(project, { recursive: true, force: true });
}
