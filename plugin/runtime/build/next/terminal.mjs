// Terminal actions (A11, D32): what is still running, the first-match terminal choice, its Spanish notes, applying it
// (status, journal, quiesce + finalizeRelease) and finishing the release of a run that already stopped.
import { finishPerformance } from "../perf.mjs";
import { fencedTwoPhase, isTerminalUnit, readLeaseToken } from "../state.mjs";
import { ENV_INFRA_STOP } from "./constants.mjs";
import { err, isAssumed, isLive, passIntent, resolveDeps, sibling } from "./context.mjs";
import { removeAllG2Snapshots } from "./g2.mjs";
import { blockedClosure, scopedState } from "./scope.mjs";

export function runningSummary(state) {
  const units = state.units.filter(isLive);
  const jobs = state.jobs.filter((j) => j.state === "running" && j.kind !== "worker");
  const workers = state.jobs.filter((j) => j.state === "running" && j.kind === "worker");
  return { any: units.length > 0 || jobs.length > 0 || workers.length > 0, jobs: jobs.length > 0, workers: units.length > 0 || workers.length > 0 };
}

/**
 * A11 selection when nothing runs and nothing was dispatched, first match. Pure.
 * @returns {{action: string, status?: string, reason: string}} `action:"wait"` (admission blocked) carries a wait reason
 */
export function chooseTerminal(state, { pol, l4, plan, candidates, dispatch }) {
  state = scopedState(state);
  const bothOut = pol && !pol.claude_new_units && !pol.codex_new_units;
  if (pol?.paused) return { action: "paused-quota", status: "paused", reason: bothOut ? "quota" : "quota_claude_no_drive" };
  if (state.handbacks_in_a_row >= ENV_INFRA_STOP) return { action: "stop", status: "stopped", reason: "env_infra_handbacks" };
  if (state.units.every(isTerminalUnit)) return { action: "done", status: state.status, reason: "done" };
  if (dispatch?.admissionBlocked) return { action: "wait", reason: dispatch.admissionBlocked };
  const nonTerminal = state.units.filter((u) => !isTerminalUnit(u));
  const { all, ownerRoots } = blockedClosure(state);
  if (ownerRoots.length && nonTerminal.every((u) => all.has(u.id))) {
    const gatesOnly = ownerRoots.every((u) => u.state === "waiting_gate" || u.waiting_gate);
    return { action: "waiting-owner", status: gatesOnly ? "waiting_gate" : "waiting_owner", reason: gatesOnly ? "gate" : "owner_answer" };
  }
  const queued = nonTerminal.some((u) => u.state === "queued" && (!u.parked || isAssumed(u)));
  if (queued && (plan?.deadlock || !candidates?.quotaBlocked)) return { action: "deadlock", status: "stopped", reason: "deadlock" };
  return { action: "stop", status: "stopped", reason: "no_progress" };
}

export function terminalNotes(terminal, quota) {
  switch (terminal.action) {
    case "paused-quota": return [`Pausa por cupo: Claude al ${quota.out.claude.pct ?? "?"} %, Codex al ${quota.out.codex.pct ?? "?"} %. Claude vuelve ${quota.resets.claude ?? "sin fecha conocida"}; Codex vuelve ${quota.resets.codex ?? "sin fecha conocida"}.`];
    case "waiting-owner": return [terminal.status === "waiting_gate" ? "Todo lo que queda espera tu firma en una puerta humana." : "Todo lo que queda espera tu respuesta."];
    case "deadlock": return ["El plan no puede avanzar: hay unidades en cola sin dependencias resolubles."];
    case "stop": return [terminal.reason === "env_infra_handbacks" ? "Me detengo: tres devoluciones seguidas por fallos del entorno." : "Me detengo: nada más puede avanzar."];
    default: return [];
  }
}

/**
 * Apply a non-`done` terminal action (D32): status and reason, journal `paused{reason,status}` or `run_stopped{reason}`,
 * then `quiesce` + `finalizeRelease` with `projectStatus:false` (nothing runs, so no worker is stopped).
 * Exported for the lifecycle module (D01), which applies the same contract.
 * @param {{project: string, epoch: number, actor?: string, deps?: object}} ref
 * @param {{action: string, status: string, reason: string}} terminal
 * @param {object} [deps]
 * @returns {Promise<object>} the written state
 */
export async function applyTerminal(ref, terminal, deps = {}) {
  const d = resolveDeps(deps);
  const runRef = { ...ref, deps: d };
  const stopped = terminal.action === "stop" || terminal.action === "deadlock";
  const state = await fencedTwoPhase(runRef, async (ctx) => {
    const s = await ctx.readState();
    if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
    await ctx.appendEvent(stopped
      ? { type: "run_stopped", data: { reason: terminal.reason } }
      : { type: "paused", data: { reason: terminal.reason, status: terminal.status, action: terminal.action } });
    const next = { ...s, status: terminal.status, status_reason: terminal.reason };
    await ctx.writeState(next);
    return next;
  }, passIntent);
  if (state.status === "stopped" || state.status === "waiting_gate") await finishPerformance({ project: ref.project, state }, d);
  const bs = d.buildState ?? await import("../../build-state.mjs");
  const token = await readLeaseToken(ref.project, ref.epoch, d);
  await bs.quiesce(ref.project, token, Number(ref.epoch), { projectStatus: false });
  await bs.finalizeRelease(ref.project, token, Number(ref.epoch));
  // After release, reserve the lease mutex across cleanup: the run's G2 snapshots go, except one a still-running G2 job judges (NB5).
  await removeAllG2Snapshots({ project: ref.project, state }, d);
  if (stopped) {
    const runtime = state.coordinator === "codex-session" ? "codex" : "claude";
    await Promise.resolve()
      .then(async () => (await sibling(d, "telemetry", "emitEvent"))(ref.project, { runtime, runId: state.run_id, name: "build.stopped", data: { reason: terminal.reason } }, d))
      .catch((error) => d.log(`next: telemetry build.stopped failed: ${error?.message ?? error}`));
  }
  return state;
}

/** A run that is no longer active (a terminal action whose release was interrupted): finish the release, report it. */
export async function alreadyStopped(run, state) {
  const action = state.status === "finished" ? "done"
    : state.status === "waiting_owner" || state.status === "waiting_gate" ? "waiting-owner"
      : state.status === "paused" ? "paused-quota"
        : state.status_reason === "deadlock" ? "deadlock" : "stop";
  const bs = run.d.buildState ?? await import("../../build-state.mjs");
  try {
    const token = await readLeaseToken(run.ref.project, run.ref.epoch, run.d);
    // A lease already quiesced (the previous `next` crashed between quiesce and release) is only released (NB3).
    const lease = typeof bs.currentLease === "function" ? await bs.currentLease(run.ref.project) : null;
    if (!lease?.quiesced_at) await bs.quiesce(run.ref.project, token, run.ref.epoch, { projectStatus: false });
    await bs.finalizeRelease(run.ref.project, token, run.ref.epoch);
  } catch (error) {
    // A finished run whose release already completed has no lease left to fence against: that is the expected idempotent case.
    if (state.status !== "finished" || error.code !== "FENCE") throw error;
  }
  return { ok: true, cmd: "next", epoch: run.ref.epoch, action, units: [], wait: null, admit: null, quota: null, notes_es: [] };
}
