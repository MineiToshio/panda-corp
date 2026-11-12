// Planner stuck classification (BUILD-9): dependency cycles, and what the simulation leaves behind (held vs deadlock).
import { PENDING, STALLED_STATES, naturalCompare, norm } from "./common.mjs";
import { depStatus } from "./readiness.mjs";
import { pendingIrreversible, unitDep } from "./rounds.mjs";

export function findCycles(nodes) {
  const cycles = [];
  const seen = new Set();
  const state = new Map();
  const walk = (id, trail) => {
    state.set(id, 1);
    for (const d of nodes.get(id).deps) {
      if (!nodes.has(d)) continue;
      if (state.get(d) === 1) {
        const cycle = trail.slice(trail.indexOf(d));
        const key = [...cycle].sort().join(",");
        if (!seen.has(key)) { seen.add(key); cycles.push([...cycle, d]); }
      } else if (!state.has(d)) walk(d, [...trail, d]);
    }
    state.set(id, 2);
  };
  for (const id of [...nodes.keys()].sort(naturalCompare)) if (!state.has(id)) walk(id, [id]);
  return cycles;
}

/** What is left after the simulation: WOs and queued units that will never run, split into held (owner/blocked cause) and deadlock. */
export function classifyStuck(m, { sim, pool }) {
  const left = [...m.nodes.values()].filter((n) => PENDING.has(n.status) && m.inScope(n) && !m.claimed.has(n.id) && !sim.claimed.has(n.id));
  const held = new Map();
  const hold = (id, reason, by) => held.set(id, { wo: id, reason, by });
  for (const n of left) {
    if (m.blockedBy.has(n.id)) hold(n.id, "blocked_by", m.blockedBy.get(n.id));
    else if (m.irrevBy.has(n.id)) hold(n.id, "pending_irreversible_answer", m.irrevBy.get(n.id));
  }
  const unmet = (n) => n.deps.map((d) => ({ wo: n.id, dep: d, why: depStatus(m, sim, d, n) })).filter((x) => x.why !== true);
  const holdsFrd = (frd) => [...m.nodes.values()].some((o) => o.frd === frd && (m.blockedBy.has(o.id) || m.irrevBy.has(o.id) || held.has(o.id) || o.status === "BLOCKED"));
  for (let changed = true; changed;) {
    changed = false;
    for (const n of left) {
      if (held.has(n.id)) continue;
      for (const w of unmet(n)) {
        const dep = m.nodes.get(w.dep);
        const cause = (w.why === "not_built" && dep && (held.has(dep.id) || m.blockedBy.has(dep.id) || m.irrevBy.has(dep.id) || dep.status === "BLOCKED" || stalledUnitOf(m, dep.id)))
          || (w.why === "floor_wait" && holdsFrd(dep.frd));
        if (cause) { hold(n.id, w.why === "floor_wait" ? "floor_wait_held" : "dep_held", w.dep); changed = true; break; }
      }
    }
  }
  const stuckUnits = [];
  const heldUnits = [];
  for (const c of pool.filter((p) => !p.picked)) {
    const u = c.unit;
    const wos = (u.wos ?? []).map(norm);
    const byUnit = u.depends_on.some((d) => unitDep(m, sim, d) === "held" || heldUnits.includes(d));
    const byWo = wos.some((w) => m.blockedBy.has(w) || m.irrevBy.has(w) || held.has(w))
      || wos.some((w) => m.nodes.get(w)?.deps.some((d) => { const dn = m.nodes.get(d); return dn && (held.has(d) || m.blockedBy.has(d) || m.irrevBy.has(d) || stalledUnitOf(m, d)); }));
    if (byUnit || byWo || pendingIrreversible(m, u)) heldUnits.push(u.id); else stuckUnits.push(u.id);
  }
  const rest = left.filter((n) => !held.has(n.id));
  const waits = rest.flatMap(unmet);
  return { held: [...held.values()], rest, waits, stuckUnits, heldUnits };
}

const stalledUnitOf = (m, woId) => { const id = m.unitOfWo.get(woId); const u = id && m.unitById.get(id); return Boolean(u && STALLED_STATES.has(u.state)); };
