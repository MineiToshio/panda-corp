#!/usr/bin/env node
import { acquire, applyChangePlan, assertFence, currentLease, finalizeRelease, isFresh, pauseForOwner, quiesce, readLedger, reclaim, reconcileBuildingChange, recoverChangeTransactions, release, renew, reserveDispatch, setHealth, setProjectPhase, stampChangeIntegration, stampLastGreen, syncRollups, transitionWorkOrder } from "../runtime/build-state.mjs";
import { lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
const args = process.argv.slice(2); const command = args.shift();
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const project = opt("project", "."); const token = opt("token"); const epoch = Number(opt("epoch"));
const output = (value) => console.log(JSON.stringify(value));
const existsRegular = async (file) => {
  try { const stat = await lstat(file); if (stat.isSymbolicLink() || !stat.isFile()) throw Object.assign(new Error(`non-regular path rejected: ${file}`), { code: "INVALID_PATH" }); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
};
const git = (root, argv) => execFileSync("git", argv, { cwd: root, encoding: "utf8" }).trim();
const dirtyPaths = (root) => {
  const raw = execFileSync("git", ["status", "--porcelain=v1", "-z"], { cwd: root, encoding: "utf8" });
  return raw.split("\0").filter(Boolean).map((entry) => entry.slice(3));
};
const assertOnlyStatus = (root, stage) => {
  const allowed = ".pandacorp/status.yaml";
  const dirty = dirtyPaths(root);
  const forbidden = dirty.filter((file) => file !== allowed && file !== ".pandacorp/run/" && !file.startsWith(".pandacorp/run/"));
  if (forbidden.length) throw Object.assign(new Error(`${stage}: pre-loop close refuses non-status drift: ${forbidden.join(", ")}`), { code: "SCOPE" });
  const staged = git(root, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
  const forbiddenStaged = staged.filter((file) => file !== allowed);
  if (forbiddenStaged.length) throw Object.assign(new Error(`${stage}: pre-loop close refuses staged non-status paths: ${forbiddenStaged.join(", ")}`), { code: "SCOPE" });
  return dirty.filter((file) => file !== ".pandacorp/run/" && !file.startsWith(".pandacorp/run/"));
};
try {
  if (command === "acquire") output(await acquire(project, { runtime: opt("runtime"), runId: opt("run-id"), ttlSeconds: Number(opt("ttl", 600)) }));
  else if (command === "renew") output(await renew(project, token, epoch));
  else if (command === "release") output(await release(project, token, epoch));
  else if (command === "quiesce") output(await quiesce(project, token, epoch));
  else if (command === "finalize-release") output(await finalizeRelease(project, token, epoch));
  else if (command === "reclaim") output(await reclaim(project, { runtime: opt("runtime"), runId: opt("run-id"), ttlSeconds: Number(opt("ttl", 600)) }));
  else if (command === "validate") output(await assertFence(project, token, epoch));
  else if (command === "status") { const lease = await currentLease(project); output({ lease, fresh: isFresh(lease) }); }
  else if (command === "inspect-stop") {
    await assertFence(project, token, epoch);
    const statusFile = path.join(path.resolve(project), ".pandacorp", "status.yaml");
    const stopFile = path.join(path.resolve(project), ".pandacorp", "run", "stop");
    if (!(await existsRegular(statusFile))) throw Object.assign(new Error(`${statusFile} is missing or not a regular file`), { code: "INVALID_PATH" });
    output({ status_exists: true, stop: await existsRegular(stopFile), method: "node-lstat" });
  }
  else if (command === "close-preloop") {
    await assertFence(project, token, epoch);
    const root = path.resolve(project); const allowed_paths = [".pandacorp/status.yaml"];
    const before = assertOnlyStatus(root, "before-quiesce");
    await quiesce(root, token, epoch);
    assertOnlyStatus(root, "after-quiesce");
    execFileSync("git", ["add", "--", allowed_paths[0]], { cwd: root, stdio: "pipe" });
    assertOnlyStatus(root, "after-stage");
    let commit = null;
    if (git(root, ["diff", "--cached", "--name-only"])) {
      execFileSync("git", ["commit", "-m", "chore: quiesce Claude build lease", "--", allowed_paths[0]], { cwd: root, stdio: "pipe" });
      commit = git(root, ["rev-parse", "HEAD"]);
    }
    const after = assertOnlyStatus(root, "after-commit");
    if (after.length) throw Object.assign(new Error(`after-commit: allowed path remained dirty: ${after.join(", ")}`), { code: "SCOPE" });
    await finalizeRelease(root, token, epoch);
    output({ done: true, reason: opt("reason", "pre-loop stop"), allowed_paths, before_dirty: before, after_dirty: after, commit, lease_released: true });
  }
  else if (command === "reserve-dispatch") output(await reserveDispatch(project, token, epoch, { id: opt("id"), units: Number(opt("units")), limit: Number(opt("limit")) }));
  else if (command === "set-health") output(await setHealth(project, token, epoch, Number(opt("consecutive-blocks"))));
  else if (command === "sync-rollups") output(await syncRollups(project, token, epoch));
  else if (command === "transition-wo") output(await transitionWorkOrder(project, token, epoch, { file: opt("file"), to: opt("to"), reason: opt("reason", "") }));
  else if (command === "stamp-last-green") output(await stampLastGreen(project, token, epoch, opt("sha")));
  else if (command === "set-phase") output(await setProjectPhase(project, token, epoch, opt("phase")));
  else if (command === "pause-owner") output(await pauseForOwner(project, token, epoch, { subject: opt("subject"), summary: opt("summary") }));
  else if (command === "apply-change-plan") output(await applyChangePlan(project, token, epoch, JSON.parse(opt("payload", "{}"))));
  else if (command === "stamp-change-integration") output(await stampChangeIntegration(project, token, epoch, { changeFile: opt("change-file"), sha: opt("sha") }));
  else if (command === "reconcile-building-change") output(await reconcileBuildingChange(project, token, epoch, { changeFile: opt("change-file") }));
  else if (command === "recover-change-transactions") output(await recoverChangeTransactions(project, token, epoch));
  else if (command === "ledger") { const lease = await assertFence(project, token, epoch); output(await readLedger(project, lease)); }
  else throw Object.assign(new Error("unknown command"), { code: "USAGE" });
} catch (error) { console.error(JSON.stringify({ error: error.code || "ERROR", message: error.message })); process.exit(error.code === "USAGE" ? 3 : 2); }
