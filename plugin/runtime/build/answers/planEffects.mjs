// The per-kind effects of a first answer: `ask` (unblock, rework patch or hand-back), `parked` (doubt decided by the
// owner, assumption accepted or discarded) and `gate` (released or refused).
import { assumptionOf, releaseParked, releasedUnit, withoutAssumedOn } from "../park.mjs";
import { findUnit, isTerminalUnit, newUnit } from "../state.mjs";
import { GATE_REFUSED_REASON, MAX_EXECUTIONS, NOT_DISPATCHED } from "./constants.mjs";
import { replace } from "./common.mjs";
import { discardAssumption } from "./assumption.mjs";
import { matchesDefault } from "./questions.mjs";

const patchIdFor = (unit) => {
  if (unit.wos?.length) return `u-patch-${String(unit.wos[0]).toLowerCase()}`;
  if (unit.frd) return `u-patch-${unit.frd}`;
  return `u-patch-${String(unit.id).replace(/^u-/, "")}`;
};

export function planAsk({ state, question, value, q }) {
  const changed = new Map();
  const events = [];
  const units = [];
  const handbacks = [];
  const added = [];
  for (const u of state.units) {
    if (u.pending_answer !== question || isTerminalUnit(u)) continue;
    if (u.state === "parked" && u.parked === "owner_question") {
      const released = releasedUnit(u);
      changed.set(u.id, released.unit);
      events.push(...released.events);
      units.push({ unit: u.id, effect: "released" });
    } else if (NOT_DISPATCHED.includes(u.state)) {
      changed.set(u.id, { ...u, pending_answer: null });
      units.push({ unit: u.id, effect: "unblocked" });
    } else if (matchesDefault(value, q)) {
      changed.set(u.id, { ...u, pending_answer: null });
      units.push({ unit: u.id, effect: "none_default_matches" });
    } else if (u.attempt >= MAX_EXECUTIONS) {
      changed.set(u.id, { ...u, pending_answer: null });
      handbacks.push({ unitId: u.id, reason: `la respuesta del owner a ${question} difiere de la opción por defecto con la que ya se construyó y no quedan ejecuciones` });
      units.push({ unit: u.id, effect: "handed_back" });
    } else {
      changed.set(u.id, { ...u, pending_answer: null });
      const id = patchIdFor(u);
      const existing = findUnit(state, id) ?? added.find((a) => a.id === id);
      if (!existing || isTerminalUnit(existing)) {
        const patch = newUnit({
          id, kind: "patch", wos: [...(u.wos ?? [])], frd: u.frd ?? null, zone: u.zone ?? "none", risk_rules: [...(u.risk_rules ?? [])],
          attempt: u.attempt + 1, depends_on: [u.id],
        });
        added.push(patch);
        events.push({ type: "unit_queued", data: patch });
        events.push({ type: "patch", data: { unit: id, source_answer: question, source_unit: u.id, wos: patch.wos, attempt: patch.attempt } });
      }
      units.push({ unit: u.id, effect: "rework_queued" });
    }
  }
  let next = replace(state, changed);
  if (added.length) {
    const ids = new Set(added.map((a) => a.id));
    next = { ...next, units: [...next.units.filter((u) => !ids.has(u.id)), ...added] };
  }
  return { state: next, events, units, handbacks };
}

export function planParked({ state, question, value, record }) {
  const decided = { ...record, step: "decided", decision: { value, why: "owner answer", decided_by: "owner" } };
  const changed = new Map();
  const events = [];
  const units = [];
  if (record.assumption) {
    const accepted = value === record.assumption.option;
    const assumption = { accepted, branch: record.assumption.branch, option: record.assumption.option };
    const discarded = [];
    // Every unit whose code is built on this assumption, including one parked meanwhile on another question (B6).
    for (const u of state.units) {
      if (assumptionOf(u) !== question || isTerminalUnit(u)) continue;
      if (!accepted) { discarded.push(u); continue; }
      const next = u.assumed_on === question ? withoutAssumedOn(u) : { ...withoutAssumedOn(u), parked: null, pending_answer: null };
      changed.set(u.id, next);
      events.push({ type: "parked", data: { unit: u.id, reason: next.parked, question: next.pending_answer } });
      units.push({ unit: u.id, effect: "assumption_accepted" });
    }
    const plan = accepted ? { state: replace(state, changed), events, units, handbacks: [], release: [], stop: [] } : discardAssumption(state, discarded, question);
    // A unit parked owner_question on this doubt (an assumed root that could not nest a second assumption) is released.
    const released = releaseParked(plan.state, question);
    return {
      state: released.state, events: [...plan.events, ...released.events], handbacks: plan.handbacks, release: plan.release, stop: plan.stop,
      units: [...plan.units, ...released.units.map((unit) => ({ unit, effect: "released" }))], record: decided, assumption,
    };
  }
  const released = releaseParked(state, question);
  return { state: released.state, events: released.events, units: released.units.map((unit) => ({ unit, effect: "released" })), handbacks: [], record: decided, assumption: null };
}

export function planGate({ state, unit, value }) {
  if (value === false) {
    return { state, events: [], units: [{ unit: unit.id, effect: "refused" }], handbacks: [{ unitId: unit.id, reason: GATE_REFUSED_REASON }] };
  }
  const next = replace(state, new Map([[unit.id, { ...unit, state: "queued", waiting_gate: null, pending_answer: null, token_hash: null }]]));
  return {
    state: next,
    events: [
      { type: "unit_state", data: { unit: unit.id, from: "waiting_gate", to: "queued" } },
      { type: "waiting_gate", data: { unit: unit.id, kind: null } },
    ],
    units: [{ unit: unit.id, effect: "released" }],
    handbacks: [],
  };
}
