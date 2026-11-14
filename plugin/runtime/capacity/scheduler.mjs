// Capacity continuation shares the build lease mutex; no timer, model or provider API lives here.
import { decide, readCapacity, logCapacityDecision } from "../capacity.mjs";
import { fencedTwoPhase } from "../build/state.mjs";
import { capacityTaskForUnit } from "../build/routing.mjs";
import { readJson } from "../build/fsx.mjs";
import { buildPaths } from "../build/paths.mjs";

export const BACKOFF_S = Object.freeze([60, 120, 240, 480, 900]);
export const backoffSeconds = (attempt = 0, retryAfter) => {
  const supplied = Number(retryAfter);
  return Number.isFinite(supplied) && supplied > 0 ? Math.min(900, supplied) : BACKOFF_S[Math.min(attempt, 4)];
};
export const capacityNow = (d = {}) => d.env?.PANDACORP_NOW ? Date.parse(d.env.PANDACORP_NOW) : d.clock ? new Date(d.clock()).getTime() : Date.now();
const iso = (ms) => new Date(ms).toISOString();
export const pinOf = (u) => u.pin ?? { tool: u.worker.runtime, model: u.worker.model, effort: u.worker.effort };
const taskOf = (u) => ({ id: u.id, type: "implement", risk: "normal", pin: pinOf(u) });
export function capacityAudit(project, state, action, { unit = null, reason, resumeAt = null, cell = null, ...extra } = {}, d = {}) {
  const cells = state.units.filter(u => u.state === "suspended" && u.worker).map(pinOf);
  logCapacityDecision({ id: unit ?? state.run_id, type: "implement", risk: "normal" },
    { action, reason, resumeAt, cell: cell ?? (cells.length === 1 ? cells[0] : null), cells, ...extra }, { env: d.env, now: capacityNow(d), log: buildPaths(project, d).capacityDecisionsFile });
}

const healthyObservation = (reading, model) => {
  const windows = reading?.windows?.filter(w => w.applicability === "required" && (w.scope === "all" || w.scope === `model:${model}`)) ?? [];
  return (reading?.tool === "claude" ? ["five_hour", "weekly"] : ["weekly"])
    .every(id => windows.some(w => w.id === id && w.scope === "all")) && windows.every(w => w.state === "known");
};

/** A real subscription limit needs a NEW, healthy observation after its reset. Unknown is never renewal. */
export function continuationDecision(unit, readings, now) {
  const s = unit.suspension;
  if (now < Date.parse(s.resumeAt)) return { ready: false, reason: "not_due", resumeAt: s.resumeAt };
  if (s.reason === "rate_limit") return { ready: true, reason: "transient_backoff_elapsed" };
  const decision = decide({ task: taskOf(unit), readings, now });
  const reading = decision.readings_used[pinOf(unit).tool];
  const renewed = healthyObservation(reading, pinOf(unit).model) && Date.parse(reading.observedAt) > Date.parse(s.at)
    && Date.parse(reading.observedAt) >= Date.parse(s.resetAt);
  return renewed && decision.action === "run" ? { ready: true, reason: "renewed_capacity", decision }
    : { ready: false, reason: renewed ? "pinned_tool_exhausted" : "renewal_unconfirmed", decision,
      resumeAt: iso(now + backoffSeconds(s.readRetries ?? 0) * 1000) };
}

/** Called inside the lease mutex. Every generation has exactly one waiting -> resuming winner. */
export async function enterCapacityWaiting(ctx, state, resumeAt, d = {}) {
  const patch = { status: "waiting", status_reason: "capacity", resumeAt,
    wake: { generation: (state.wake?.generation ?? 0) + 1, epoch: ctx.epoch, owner: null,
      resetAt: resumeAt, waitedAt: iso(capacityNow(d)), readRetries: 0 } };
  await ctx.appendEvent({ type: "capacity_state", data: { patch } });
  await ctx.writeState({ ...state, ...patch });
  capacityAudit(ctx.project, state, "waiting", { reason: "all_work_waiting", resumeAt,
    cells: state.units.filter(u => u.state === "suspended").map(pinOf) }, d);
  return { ...state, ...patch };
}

/** Lead, manual resume and drive use this SAME conditional transition, under the existing epoch fence.
 * A lead passes generation from `next`; an obsolete scheduled wake cannot steal a later generation.
 */
export async function wakeCapacity({ project, epoch, owner = "drive", generation = null, activate = true }, d = {}) {
  const now = capacityNow(d);
  return fencedTwoPhase({ project, epoch, deps: d }, async ctx => {
    let state = await ctx.readState();
    if (state.status === "resuming" && state.wake?.claimPid) {
      let alive;
      if (d.isAlive) alive = d.isAlive(state.wake.claimPid);
      else { try { process.kill(state.wake.claimPid, 0); alive = true; } catch (e) { alive = e.code === "EPERM"; } }
      if (!alive) {
        const patch = { status: "waiting", wake: { ...state.wake, owner: null, claimPid: null } };
        await ctx.appendEvent({ type: "capacity_state", data: { patch } });
        state = { ...state, ...patch }; await ctx.writeState(state);
        capacityAudit(project, state, "waiting", { reason: "dead_wake_owner", resumeAt: state.resumeAt }, d);
      }
    }
    if (state.status !== "waiting" || generation !== null && state.wake?.generation !== Number(generation))
      return { claimed: false, action: state.status === "active" ? "already_resumed" : "waiting", resumeAt: state.resumeAt };
    if (now < Date.parse(state.resumeAt) + 60000) return { claimed: false, action: "waiting", resumeAt: state.resumeAt };
    const readings = (d.readCapacity ?? readCapacity)({ env: d.env, now });
    const suspended = state.units.filter(u => u.state === "suspended");
    let ready = suspended.some(u => continuationDecision(u, readings, now).ready);
    // Queued independent work may wake on either tool; suspended work may ONLY wake its own pin.
    if (!ready) for (const unit of state.units) {
      let task = unit.state === "queued" && !unit.parked ? capacityTaskForUnit(unit) : null;
      if (unit.state === "reported" && unit.doubt_id) {
        const record = await readJson(ctx.paths.doubtFile(unit.doubt_id));
        if (record?.capacity_wait) task = { ...capacityTaskForUnit(unit), type: "design" };
      }
      if (!task) continue;
      const selected = decide({ task, readings, now });
      const r = selected.readings_used[selected.tool];
      if (selected.action === "run" && healthyObservation(r, selected.model) && Date.parse(r.observedAt) >= Date.parse(state.wake.resetAt)) {
        ready = true; break;
      }
    }
    capacityAudit(project, state, "wake", { reason: ready ? "capacity_confirmed" : "renewal_unconfirmed", resumeAt: state.resumeAt, owner }, d);
    if (!ready) {
      const retry = state.wake.readRetries ?? 0;
      const patch = { resumeAt: iso(now + backoffSeconds(retry) * 1000 - 60000),
        wake: { ...state.wake, readRetries: retry + 1 } };
      await ctx.appendEvent({ type: "capacity_state", data: { patch } });
      await ctx.writeState({ ...state, ...patch });
      capacityAudit(project, state, "waiting", { reason: "renewal_unconfirmed", resumeAt: patch.resumeAt, owner }, d);
      return { claimed: false, action: "waiting", resumeAt: patch.resumeAt };
    }
    const patch = { status: "resuming", wake: { ...state.wake, owner, epoch: ctx.epoch, claimPid: process.pid, claimedAt: iso(now) } };
    await ctx.appendEvent({ type: "capacity_state", data: { patch } });
    await ctx.writeState({ ...state, ...patch });
    if (activate) {
      const active = { status: "active", status_reason: null, resumeAt: null };
      await ctx.appendEvent({ type: "capacity_state", data: { patch: active } });
      await ctx.writeState({ ...state, ...patch, ...active });
    }
    capacityAudit(project, state, "resumed", { reason: "wake_claimed", resumeAt: state.resumeAt, owner }, d);
    return { claimed: true, action: "resuming", generation: state.wake.generation };
  }, intent => intent);
}
