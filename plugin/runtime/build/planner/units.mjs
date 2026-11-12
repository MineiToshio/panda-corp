// Planner chains and units (BUILD-9, A13): greedy chain formation, the unit(s) of a chain and queued-unit candidates.
import { newUnit } from "../state.mjs";
import { CHAIN_MAX, maxZone, naturalCompare, norm, uniq } from "./common.mjs";
import { routeCell, unitArtifacts } from "./model.mjs";
import { depsMet, isIntegrated, plannable } from "./readiness.mjs";

// ---------------------------------------------------------------------------------------------------------------
// Chains and units
// ---------------------------------------------------------------------------------------------------------------

export function formChains(m, sim) {
  const rank = (a, b) => Number(b.barrier) - Number(a.barrier) || m.depth(b.id) - m.depth(a.id)
    || m.frdOrder.indexOf(a.frd) - m.frdOrder.indexOf(b.frd) || a.order - b.order || naturalCompare(a.id, b.id);
  const ready = [...m.nodes.values()].filter((n) => plannable(m, sim, n) && depsMet(m, sim, n)).sort(rank);
  const taken = new Set();
  const chains = [];
  for (const head of ready) {
    if (taken.has(head.id)) continue;
    const chain = [head];
    taken.add(head.id);
    let cut = null;
    while (!head.barrier && chain.length < CHAIN_MAX) {
      const ids = new Set(chain.map((n) => n.id));
      const opened = [...m.nodes.values()].filter((n) => !taken.has(n.id) && plannable(m, sim, n) && n.deps.some((d) => ids.has(d)) && depsMet(m, sim, n, ids));
      if (opened.length !== 1) { cut = opened.length ? "fan_out" : "end"; break; }
      const next = opened[0];
      if (next.frd !== head.frd) cut = "frd_change";
      else if (next.barrier) cut = "barrier";
      else if (m.cellKeyOf(next) !== m.cellKeyOf(head)) cut = "cell_change";
      else if (m.answerOf.get(next.id) !== m.answerOf.get(head.id)) cut = "answer_change";
      if (cut) break;
      chain.push(next);
      taken.add(next.id);
    }
    cut ??= head.barrier ? "barrier" : chain.length >= CHAIN_MAX ? "max_length" : "end";
    chains.push({ nodes: chain, cut });
  }
  return chains;
}

const unitDepsOf = (m, sim, nodesOfChain) => {
  const inside = new Set(nodesOfChain.map((n) => n.id));
  const ids = [];
  for (const n of nodesOfChain) for (const d of n.deps) {
    if (inside.has(d)) continue;
    const dep = m.nodes.get(d);
    if (!dep || dep.status === "VERIFIED" || (dep.status === "IN_REVIEW" && m.inScope(dep))) continue;
    const owner = sim.unitOf.get(d);
    if (owner) ids.push(owner);
  }
  return uniq(ids).sort(naturalCompare);
};

export function makeUnits(m, sim, { nodes: chain, cut }) {
  const head = chain[0];
  const woIds = chain.map((n) => n.id);
  const zone = maxZone(chain.map((n) => n.zone));
  const upstream = unitDepsOf(m, sim, chain);
  const cited = uniq(chain.flatMap((n) => n.acs));
  const known = m.frdAcs.get(head.frd);
  const newAcs = cited.filter((a) => !known?.has(a));
  const reason = m.cardType === "bug" ? "bug_card" : zone !== "none" && newAcs.length > 0 ? "new_acs" : null;
  const pending = m.answerOf.get(head.id) ?? null;
  const common = { wos: woIds, frd: head.frd, zone, risk_rules: uniq(chain.flatMap((n) => n.riskRules)), pending_answer: pending };
  const artifacts = unitArtifacts(m, "build", woIds);
  const barrier = chain.some((n) => n.barrier);
  const downstream = Math.max(...chain.map((n) => m.depth(n.id)));
  const waived = uniq(chain.flatMap((n) => n.deps.map((d) => m.nodes.get(d)).filter((d) => d && d.status !== "VERIFIED" && d.frd !== n.frd && m.floorFrds.has(d.frd) && !sim.verified.has(d.frd) && isIntegrated(m, sim, d) && sim.floor.waived(d, n)).map((d) => d.frd))).sort();
  const out = [];
  const mk = (unit, kind, why) => {
    const cell = routeCell(m, kind, chain);
    sim.cells[unit.id] = cell;
    sim.why[unit.id] = why;
    sim.meta[unit.id] = { artifacts, barrier, downstream, new_acs: newAcs, tests_first: reason, cut: kind === "build" ? cut : null, floor_waived: waived, existing: false };
    sim.planned.push(unit);
    const cand = { unit, existing: false, artifacts, barrier, downstream, frdIndex: m.frdOrder.indexOf(head.frd), order: head.order, picked: false };
    out.push(cand);
    return cand;
  };
  let testsId = null;
  if (reason) {
    testsId = `u-tests-${head.id}`;
    mk(newUnit({ id: testsId, kind: "tests", chain: null, depends_on: upstream, ...common }), "tests",
      reason === "bug_card" ? "tests first: bug card" : `tests first: ${zone} zone adds ${newAcs.join(", ")}`);
  }
  const why = `ready: dependencies integrated; chain of ${chain.length} (${cut})${waived.length ? `; floor waiver on ${waived.join(", ")}` : ""}`;
  mk(newUnit({ id: `u-build-${head.id}`, kind: "build", chain: `c-${head.id}`, depends_on: testsId ? [...upstream, testsId] : upstream, ...common }), "build", why);
  for (const n of chain) sim.claimed.add(n.id);
  for (const n of chain) sim.unitOf.set(n.id, `u-build-${head.id}`);
  for (const f of waived) sim.floorWaived.push({ wo: head.id, frd: head.frd, floors: [f] });
  return out;
}

export function existingCandidate(m, unit) {
  const woIds = (unit.wos ?? []).map(norm);
  const chain = woIds.map((id) => m.nodes.get(id)).filter(Boolean);
  return {
    unit, existing: true, artifacts: unitArtifacts(m, unit.kind, woIds), barrier: chain.some((n) => n.barrier),
    downstream: Math.max(0, ...chain.map((n) => m.depth(n.id))), frdIndex: Math.max(0, m.frdOrder.indexOf(norm(unit.frd))),
    order: Math.min(Infinity, ...chain.map((n) => n.order)), picked: false,
  };
}
