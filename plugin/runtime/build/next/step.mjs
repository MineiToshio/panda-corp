// One scheduling pass of `next`: renew + one admission reading, harvest, integrate, quota policy, managed units and the
// planner round, landing, admission and dispatch, then wait or a terminal action (A11).
import { withRunCleanup } from "../lifecycle/cleanup.mjs";
import { cleanupRunWorktrees } from "../integrate/worktrees.mjs";
import { bootstrapIntegrationWorktree } from "../integrate.mjs";
import { recordSample } from "../perf.mjs";
import { ENV_INFRA_STOP, G2_SNAPSHOT_FAIL_MAX, LAND_RETRY_S, RETRY_S } from "./constants.mjs";
import { admissionCtx, fresh, mutate, sibling } from "./context.mjs";
import { buildCandidates } from "./candidates.mjs";
import { dispatchRound, readSignalsSafe } from "./dispatch.mjs";
import { handBackExhaustedG2 } from "./g2.mjs";
import { harvest } from "./harvest.mjs";
import { integrateStep, landRunning } from "./integration.mjs";
import { landDecision } from "./landing.mjs";
import { listDeferred, parkIrreversiblePending, planRound, quotaView, readRunParams, scheduleManagedUnits } from "./planning.mjs";
import { alreadyStopped, applyTerminal, chooseTerminal, runningSummary, terminalNotes } from "./terminal.mjs";
import { watchList } from "./wait.mjs";

export async function step(run) {
  const { d } = run;
  // (0) renew + the call's single admission reading (phase 1 of a fenced step).
  const signals = await readSignalsSafe(run);
  const diskFreeGib = d.admission.readDiskFreeGib(run.ref.project, d);
  let state = await mutate(run, async (s, ctx) => {
    run.leaseRuntime = ctx.lease?.runtime ?? run.leaseRuntime ?? null;
    if (!run.recorded && s.status === "active") {
      run.reading = d.admission.recordReading(signals.value, admissionCtx(run));
      await recordSample({ project: run.ref.project, state: s, reading: run.reading, signals: signals.value, diskFreeGib }, d);
      run.recorded = true;
    }
    return { value: s };
  });
  if (state.status !== "active") return { out: await alreadyStopped(run, state), watch: [] };
  if (run.reading?.scale_event && !run.scaledEmitted) {
    const { from, to, reason } = run.reading.scale_event;
    try { await (await sibling(d, "telemetry", "emitEvent"))(run.ref.project, { runtime: run.leaseRuntime ?? (state.coordinator === "codex-session" ? "codex" : "claude"), runId: state.run_id, name: "build.scaled", data: { from, to, reason } }, d); } catch (error) { d.log(`next: scale telemetry failed: ${error.message}`); }
    run.scaledEmitted = true;
  }
  d.adaptiveStep = run.reading?.step ?? d.admission.readAdaptive(admissionCtx(run)).step;
  const notes = [];
  run.diskBlocked = false;
  const boot = await bootstrapIntegrationWorktree({ project: run.ref.project, runId: state.run_id }, d);
  if (boot.exit === 4) return finish(run, state, { action: "wait", wait: { reason: "disk", retry_after_s: RETRY_S.disk }, notes });

  // (1) harvest finished jobs and workers; (2) integrate committed chains (the G2 spawn rides on admission, step 6).
  await harvest(run, await fresh(run), notes);
  // The land job rebases and fast-forwards the integration branch: nothing else writes it meanwhile (C05).
  if (!landRunning(await fresh(run))) await integrateStep(run, await fresh(run), notes);
  state = await fresh(run);
  if (run.diskBlocked) return finish(run, state, { action: "wait", wait: { reason: "disk", retry_after_s: RETRY_S.disk }, notes });

  // (3) quota policy (the A11 priority is owned by quota.policy): handoff, or the paused-quota terminal action.
  const quota = await quotaView(run, state);
  const pol = quota.policy;
  if (pol.handoff) {
    notes.push(`Claude al ${quota.out.claude.pct ?? "?"} %: relevo a drive.`);
    return finish(run, state, { action: "handoff", quota, notes });
  }
  if (pol.paused) {
    if (runningSummary(state).any) return finish(run, state, { action: "wait", wait: { reason: "quota", retry_after_s: RETRY_S.quota }, quota, notes });
    const terminal = { action: "paused-quota", status: "paused", reason: quota.bothOut ? "quota" : "quota_claude_no_drive" };
    notes.push(...terminalNotes(terminal, quota));
    state = await applyTerminal(run.ref, terminal, d);
    return finish(run, state, { action: terminal.action, quota, notes });
  }

  // (4)(5) deferred reviews first, planner round, pending answers (D19).
  const deferredEntries = await listDeferred(run);
  state = await scheduleManagedUnits(run, state, pol, deferredEntries);
  const plan = await planRound(run, state, pol);
  state = plan.state;
  state = await parkIrreversiblePending(run, state);

  // Landing first (priority landing > heavy job > new builder).
  const landing = await landDecision(run, state, pol, deferredEntries, notes);
  state = landing.state;
  if (landing.diskBlocked) return finish(run, state, { action: "wait", wait: { reason: "disk", retry_after_s: RETRY_S.disk }, quota, notes });
  if (landing.action === "land") return finish(run, state, { action: "land", quota, notes });
  if (landRunning(state)) return finish(run, state, { action: "wait", wait: { reason: "jobs_running", retry_after_s: RETRY_S.jobs_running }, quota, notes });

  // (6)(7) admission and dispatch.
  const runParams = await readRunParams(run);
  const candidates = await buildCandidates(run, state, pol, plan, runParams, deferredEntries);
  state = candidates.state;
  const dispatch = await dispatchRound(run, state, candidates, runParams, signals, quota);
  state = dispatch.state;
  const g2Fails = dispatch.g2Fails ?? {};
  for (const frd of dispatch.g2Failed ?? []) {
    notes.push(`G2 de ${frd} no arrancó: no se pudo crear su copia de la rama de integración (fallo ${g2Fails[frd] ?? 1} de ${G2_SNAPSHOT_FAIL_MAX}); ${(g2Fails[frd] ?? 1) >= G2_SNAPSHOT_FAIL_MAX ? "se devuelve por fallo del entorno" : "se reintenta en el siguiente paso"}.`);
  }
  if (dispatch.diskBlocked) notes.push("Disco insuficiente: espero a que haya al menos 15 GiB libres tras reservar 1,5 GiB para una copia nueva. El trabajo en curso sigue.");
  if (dispatch.units.length) return finish(run, state, { action: "dispatch", units: dispatch.units, admit: dispatch.admit, quota, notes });

  if (dispatch.diskBlocked) return finish(run, state, { action: "wait", wait: { reason: "disk", retry_after_s: RETRY_S.disk }, admit: dispatch.admit, quota, notes });
  // BL-0317: an empty FRD review was settled in this pass; the landing decision ran before it, so retry instead of stopping.
  if (candidates.settled) return finish(run, state, { action: "wait", wait: { reason: "gate", retry_after_s: RETRY_S.gate }, admit: dispatch.admit, quota, notes });
  // Nothing dispatched: wait while anything runs (A11), else a terminal action.
  const running = runningSummary(state);
  if (running.any || landing.waitLand) {
    const reason = running.jobs || landing.waitLand ? "jobs_running" : "workers_running";
    return finish(run, state, { action: "wait", wait: { reason, retry_after_s: landing.waitLand ? LAND_RETRY_S : RETRY_S[reason] }, admit: dispatch.admit, quota, notes });
  }
  if ((dispatch.g2Failed ?? []).length) {
    // A G2 snapshot that could not be created leaves nothing running: wait and retry it at the next call, or hand the FRD
    // back as an environment failure once it has failed G2_SNAPSHOT_FAIL_MAX passes in a row (never a silent stop: NB2).
    const retrying = await handBackExhaustedG2(run, state, dispatch.g2Failed, g2Fails, notes);
    state = await fresh(run);
    if (retrying.length) return finish(run, state, { action: "wait", wait: { reason: "jobs_running", retry_after_s: RETRY_S.gate }, admit: dispatch.admit, quota, notes });
  }
  if (landing.bootFailed && state.handbacks_in_a_row < ENV_INFRA_STOP) {
    // The landing retries (and re-runs the bootstrap) at the next call: a quiet pass here is not "no progress". The
    // ENV_INFRA_STOP streak of hand-backs ends the run through chooseTerminal (FIX-D-4).
    return finish(run, state, { action: "wait", wait: { reason: "gate", retry_after_s: RETRY_S.gate }, admit: dispatch.admit, quota, notes });
  }
  const terminal = chooseTerminal(state, { pol, plan, candidates, dispatch });
  if (terminal.action === "wait") {
    return finish(run, state, { action: "wait", wait: { reason: terminal.reason, retry_after_s: RETRY_S[terminal.reason] }, admit: dispatch.admit, quota, notes });
  }
  notes.push(...terminalNotes(terminal, quota));
  if (terminal.action !== "done") state = await applyTerminal(run.ref, terminal, d);
  else if (state.units.some(u => u.state === "blocked")) await withRunCleanup({ project: run.ref.project, state, epoch: run.ref.epoch }, current => cleanupRunWorktrees({ project: run.ref.project, state: current }, d), d);
  return finish(run, state, { action: terminal.action, admit: dispatch.admit, quota, notes });
}

function finish(run, state, { action, units = [], wait = null, admit = null, quota, notes = [] }) {
  const out = {
    ok: true, cmd: "next", epoch: run.ref.epoch, action, units, wait,
    admit: admit ?? null, quota: quota?.out ?? null, notes_es: notes.filter(Boolean),
  };
  return { out, watch: watchList(run, state) };
}
