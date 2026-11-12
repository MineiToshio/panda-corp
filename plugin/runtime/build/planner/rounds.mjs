// Planner rounds (BUILD-9): unit readiness, the greedy round selection and the whole-plan simulation.
import { PLANNED_KINDS, STALLED_STATES, UNIT_DONE, isAssumed, naturalCompare, norm } from "./common.mjs";
import { routeCell, unitArtifacts } from "./model.mjs";
import { artifactsOverlap } from "./pathRules.mjs";
import { depsMet, floorTools, isIntegrated } from "./readiness.mjs";
import { existingCandidate, formChains, makeUnits } from "./units.mjs";

// ---------------------------------------------------------------------------------------------------------------

/** Is the unit-level dependency `dep` satisfied: `true`, `false` (not yet) or "held" (stalled/blocked unit). */
export function unitDep(m, sim, depId) {
  if (sim.unitDone.has(depId)) return true;
  const u = m.unitById.get(depId);
  if (u && UNIT_DONE.has(u.state)) return true;
  return u && STALLED_STATES.has(u.state) ? "held" : false;
}

function candidateReady(m, sim, cand) {
  const { unit } = cand;
  if ((unit.parked && !isAssumed(unit)) || (cand.existing && pendingIrreversible(m, unit))) return false;
  if (!unit.depends_on.every((d) => unitDep(m, sim, d) === true)) return false;
  if (!cand.existing || !["build", "patch", "tests"].includes(unit.kind)) return true;
  const inside = new Set((unit.wos ?? []).map(norm));
  // A unit built on an assumption also counts the WOs already built on the SAME assumption branch as done.
  if (isAssumed(unit)) for (const id of m.unitOfWo.keys()) if (assumedDoneOn(m, sim, id, unit.pending_answer)) inside.add(id);
  return [...(unit.wos ?? []).map(norm)].every((id) => { const n = m.nodes.get(id); return n !== undefined && depsMet(m, sim, n, inside); });
}


/** Is WO `woId` built (unit integrated-or-later) by a unit on the assumption branch of `doubt`? */
function assumedDoneOn(m, sim, woId, doubt) {
  const id = m.unitOfWo.get(woId);
  const u = id && m.unitById.get(id);
  return Boolean(u && isAssumed(u) && u.pending_answer === doubt && (UNIT_DONE.has(u.state) || sim.unitDone.has(u.id)));
}

export function pendingIrreversible(m, unit) {
  if (!unit.pending_answer || m.openQuestions === null) return false;
  return m.openQuestions.some((q) => q.id === unit.pending_answer && q.reversible === false);
}

const pendingAnswerOf = (m, cand) => {
  const id = cand.unit.pending_answer ?? null;
  return id !== null && (m.openQuestions === null || m.openQuestions.some((q) => q.id === id));
};

function selectRound(m, ready, liveArtifacts, capacity) {
  const order = [...ready].sort((a, b) => Number(pendingAnswerOf(m, a)) - Number(pendingAnswerOf(m, b)) || Number(b.barrier) - Number(a.barrier)
    || b.downstream - a.downstream || a.frdIndex - b.frdIndex || a.order - b.order || naturalCompare(a.unit.id, b.unit.id));
  const taken = [...liveArtifacts];
  const picked = [];
  for (const cand of order) {
    if (picked.length >= capacity) break;
    if (taken.some((t) => artifactsOverlap(t, cand.artifacts))) continue;
    picked.push(cand);
    taken.push(cand.artifacts);
  }
  return picked;
}

function complete(sim, unit) {
  sim.unitDone.add(unit.id);
  if (unit.kind === "build" || unit.kind === "patch") for (const w of unit.wos ?? []) sim.done.add(norm(w));
}

function refreshVerified(m, sim) {
  for (const frd of m.frdOrder) {
    const mine = [...m.nodes.values()].filter((n) => n.frd === frd && m.inScope(n));
    if (mine.length > 0 && mine.every((n) => isIntegrated(m, sim, n))) sim.verified.add(frd);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Simulation and stuck classification
// ---------------------------------------------------------------------------------------------------------------

export function simulate(m) {
  const sim = {
    done: new Set(), verified: new Set(m.initialVerified), claimed: new Set(), unitOf: new Map(m.unitOfWo), unitDone: new Set(),
    planned: [], meta: {}, cells: {}, why: {}, floorWaived: [], floor: null,
  };
  const existing = m.units.filter((u) => u.state === "queued" && PLANNED_KINDS.has(u.kind)).map((u) => existingCandidate(m, u));
  for (const c of existing) {
    sim.meta[c.unit.id] = { artifacts: c.artifacts, barrier: c.barrier, downstream: c.downstream, new_acs: [], tests_first: null, cut: null, floor_waived: [], existing: true };
    sim.why[c.unit.id] = "already queued";
    sim.cells[c.unit.id] = c.unit.kind === "build" || c.unit.kind === "tests" ? routeCell(m, c.unit.kind, (c.unit.wos ?? []).map((w) => m.nodes.get(norm(w))).filter(Boolean)) : null;
  }
  const pool = [...existing];
  const rounds = [];
  let nowIds = [];
  let roundIds = [];
  let readyIds = [];
  const limit = m.nodes.size + pool.length + 3;
  for (let r = 0; r <= limit; r += 1) {
    sim.floor = floorTools(m, sim);
    const created = formChains(m, sim).flatMap((chain) => makeUnits(m, sim, chain));
    pool.push(...created);
    sim.floor = floorTools(m, sim);
    const ready = pool.filter((c) => !c.picked && candidateReady(m, sim, c));
    const live = r === 0 ? m.liveWrite : [];
    const picked = selectRound(m, ready, live.map((u) => unitArtifacts(m, u.kind, u.wos ?? [])), r === 0 ? m.capacity : m.ceiling);
    if (r === 0) {
      nowIds = created.map((c) => c.unit.id);
      roundIds = picked.map((c) => c.unit.id);
      readyIds = ready.map((c) => c.unit.id);
    }
    if (picked.length === 0 && live.length === 0) break;
    for (const c of picked) { c.picked = true; complete(sim, c.unit); }
    for (const u of live) complete(sim, u);
    if (picked.length > 0) rounds.push(picked.map((c) => c.unit.id));
    refreshVerified(m, sim);
  }
  sim.floor = floorTools(m, sim);
  return { sim, pool, rounds, nowIds, roundIds, readyIds };
}
