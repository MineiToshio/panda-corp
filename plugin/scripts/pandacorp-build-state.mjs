#!/usr/bin/env node
import { acquire, applyChangePlan, assertFence, currentLease, finalizeRelease, isFresh, pauseForOwner, quiesce, readLedger, reclaim, reconcileBuildingChange, recoverChangeTransactions, release, renew, reserveDispatch, setHealth, setProjectPhase, stampChangeIntegration, stampLastGreen, syncRollups, transitionWorkOrder } from "../runtime/build-state.mjs";
const args = process.argv.slice(2); const command = args.shift();
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const project = opt("project", "."); const token = opt("token"); const epoch = Number(opt("epoch"));
const output = (value) => console.log(JSON.stringify(value));
try {
  if (command === "acquire") output(await acquire(project, { runtime: opt("runtime"), runId: opt("run-id"), ttlSeconds: Number(opt("ttl", 600)) }));
  else if (command === "renew") output(await renew(project, token, epoch));
  else if (command === "release") output(await release(project, token, epoch));
  else if (command === "quiesce") output(await quiesce(project, token, epoch));
  else if (command === "finalize-release") output(await finalizeRelease(project, token, epoch));
  else if (command === "reclaim") output(await reclaim(project, { runtime: opt("runtime"), runId: opt("run-id"), ttlSeconds: Number(opt("ttl", 600)) }));
  else if (command === "validate") output(await assertFence(project, token, epoch));
  else if (command === "status") { const lease = await currentLease(project); output({ lease, fresh: isFresh(lease) }); }
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
