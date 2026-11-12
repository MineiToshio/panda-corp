// Planner readiness (BUILD-9): dependency satisfaction, including the DR-132 floor wait and its waiver.
import { PENDING, uniq } from "./common.mjs";

// ---------------------------------------------------------------------------------------------------------------
// Readiness (dependency satisfaction incl. the DR-132 floor wait)
// ---------------------------------------------------------------------------------------------------------------

export const isIntegrated = (m, sim, n) => n.status === "VERIFIED" || sim.done.has(n.id) || (n.status === "IN_REVIEW" && m.inScope(n));
const isOpen = (n, sim) => PENDING.has(n.status) && !sim.done.has(n.id);

/** Floor-wait helpers over the current simulated state: `waits(n)` FRDs, `needsOf(frd)`, `waived(dep, of)`. */
export function floorTools(m, sim) {
  const waits = (n) => uniq(n.deps.map((d) => m.nodes.get(d)).filter((d) => d && d.frd !== n.frd && isIntegrated(m, sim, d) && d.status !== "VERIFIED" && m.floorFrds.has(d.frd) && !sim.verified.has(d.frd)).map((d) => d.frd));
  const memo = new Map();
  const needsOf = (frd) => {
    if (memo.has(frd)) return memo.get(frd);
    const seen = new Set();
    const stack = [...m.nodes.values()].filter((n) => n.frd === frd && isOpen(n, sim)).map((n) => n.id);
    const floors = new Set([frd]);
    while (stack.length) {
      const n = m.nodes.get(stack.pop());
      for (const d of n.deps) { const dn = m.nodes.get(d); if (dn && isOpen(dn, sim) && !seen.has(dn.id)) { seen.add(dn.id); stack.push(dn.id); } }
      for (const f of waits(n)) {
        if (floors.has(f)) continue;
        floors.add(f);
        for (const o of m.nodes.values()) if (o.frd === f && isOpen(o, sim) && !seen.has(o.id)) { seen.add(o.id); stack.push(o.id); }
      }
    }
    memo.set(frd, seen);
    return seen;
  };
  const waived = (dep, of) => dep.frd !== of.frd && m.floorFrds.has(dep.frd) && needsOf(dep.frd).has(of.id);
  return { waits, needsOf, waived };
}

/** Is dependency `depId` satisfied for WO `of`? Returns true, or a reason: dangling | out_of_scope | floor_wait | not_built. */
export function depStatus(m, sim, depId, of) {
  const dep = m.nodes.get(depId);
  if (!dep) return "dangling";
  if (dep.status === "VERIFIED") return true;
  if (!isIntegrated(m, sim, dep)) return m.inScope(dep) ? "not_built" : "out_of_scope";
  if (dep.frd === of.frd || !m.floorFrds.has(dep.frd) || sim.verified.has(dep.frd)) return true;
  return sim.floor.waived(dep, of) ? true : "floor_wait";
}

export const plannable = (m, sim, n) => PENDING.has(n.status) && m.inScope(n) && !m.claimed.has(n.id) && !sim.claimed.has(n.id)
  && !m.blockedBy.has(n.id) && !m.irrevBy.has(n.id);
export const depsMet = (m, sim, n, inside = new Set()) => n.deps.every((d) => inside.has(d) || depStatus(m, sim, d, n) === true);
