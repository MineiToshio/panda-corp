// Planner lint (BUILD-9): the `lint-plan` rules over the model and the stuck classification.
import { PENDING, naturalCompare } from "./common.mjs";
import { artifactsOverlap } from "./pathRules.mjs";
import { findCycles } from "./stuck.mjs";

function reachable(m, from) {
  const out = new Set();
  const stack = [from];
  while (stack.length) for (const c of m.children.get(stack.pop()) ?? []) if (!out.has(c)) { out.add(c); stack.push(c); }
  return out;
}

export function lintModel(m, stuck) {
  const issues = [];
  const add = (rule, wo, severity, detail) => issues.push({ rule, wo, severity, detail });
  for (const id of m.duplicates) add("duplicate_wo", id, "error", `work order id ${id} appears more than once`);
  for (const n of [...m.nodes.values()].sort((a, b) => naturalCompare(a.id, b.id))) {
    for (const d of n.deps) if (!m.nodes.has(d)) add("dangling_dep", n.id, "error", `dependsOn names ${d}, which does not exist`);
  }
  for (const cycle of findCycles(m.nodes)) add("cycle", cycle[0], "error", `dependency cycle: ${cycle.join(" -> ")}`);
  const live = [...m.nodes.values()].filter((n) => PENDING.has(n.status) && m.inScope(n)).sort((a, b) => naturalCompare(a.id, b.id));
  for (const n of live) {
    if (n.artifacts !== null) continue;
    if (n.artifactsDeclared) add("artifacts_empty", n.id, "error", "artifacts is empty: list every path this work order writes");
    else add("artifacts_missing", n.id, "warn", "legacy work order without artifacts: it runs serially");
  }
  const reach = new Map(live.map((n) => [n.id, reachable(m, n.id)]));
  for (let i = 0; i < live.length; i += 1) for (let j = i + 1; j < live.length; j += 1) {
    const a = live[i];
    const b = live[j];
    if (a.artifacts === null || b.artifacts === null || reach.get(a.id).has(b.id) || reach.get(b.id).has(a.id)) continue;
    if (artifactsOverlap(a.artifacts, b.artifacts)) add("artifacts_overlap", a.id, "error", `${a.id} and ${b.id} have no dependency path and overlap artifacts`);
  }
  for (const n of live) for (const d of n.deps) {
    const dn = m.nodes.get(d);
    if (dn && !m.inScope(dn) && dn.status !== "VERIFIED") add("dep_out_of_scope", n.id, "warn", `${n.id} depends on ${d}, which is out of scope and not verified`);
  }
  for (const frd of m.frdOrder) {
    const known = m.frdAcs.get(frd);
    if (!known || !m.scope.frds.includes(frd)) continue;
    const cited = new Set([...m.nodes.values()].filter((n) => n.frd === frd).flatMap((n) => n.acs));
    for (const ac of [...known].sort(naturalCompare)) if (!cited.has(ac)) add("unowned_ac", null, "warn", `${ac} of ${frd} is cited by no work order`);
  }
  if (stuck.rest.length > 0 || stuck.stuckUnits.length > 0) {
    add("deadlock", stuck.rest[0]?.id ?? null, "error", `no progress possible: ${[...stuck.rest.map((n) => n.id), ...stuck.stuckUnits].join(", ")}`);
  }
  return issues;
}
