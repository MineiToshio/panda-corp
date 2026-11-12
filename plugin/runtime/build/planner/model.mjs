// Planner model (BUILD-9): the normalized input shared by `plan` and `lint-plan`, plus routing cells and unit artifacts.
import { builderCell } from "../routing.mjs";
import {
  DEFAULT_CEILING, DOCS_GLOBS, PENDING, PLANNED_KINDS, SLOT_STATES, STALLED_STATES, WRITE_STATES, ZONE_RANK, isAssumed, maxZone, naturalCompare, norm, normGlob, uniq,
} from "./common.mjs";
import { isBarrierPath } from "./pathRules.mjs";

// ---------------------------------------------------------------------------------------------------------------
// Model: the normalized input shared by plan and lint
// ---------------------------------------------------------------------------------------------------------------

function buildNodes(wos) {
  const nodes = new Map();
  const duplicates = [];
  (wos ?? []).forEach((w, index) => {
    const id = norm(w.id);
    if (!id) return;
    if (nodes.has(id)) { duplicates.push(id); return; }
    const declared = Array.isArray(w.artifacts);
    const artifacts = declared ? w.artifacts.map(normGlob).filter(Boolean) : [];
    nodes.set(id, {
      id, index, frd: norm(w.frd), status: String(w.status ?? "").trim().toUpperCase(),
      deps: uniq((w.deps ?? w.depends_on ?? w.dependsOn ?? []).map(norm).filter(Boolean)),
      artifacts: artifacts.length > 0 ? artifacts : null, artifactsDeclared: declared,
      order: Number.isFinite(w.order) ? w.order : index,
      reopen: Number.isInteger(w.reopen_count) ? w.reopen_count : 0,
      zone: Object.hasOwn(ZONE_RANK, w.zone) ? w.zone : "none",
      riskRules: uniq((w.risk_rules ?? []).map(String)),
      acs: uniq((w.acs ?? []).map((a) => String(a).toUpperCase())),
      sourceChange: (w.source_change ?? []).map(norm),
      barrier: artifacts.some(isBarrierPath),
    });
  });
  return { nodes, duplicates };
}

const matchesQuestion = (q, n) => {
  const a = q.affects ?? {};
  return a.all === true || (a.frds ?? []).map(norm).includes(n.frd) || (a.wos ?? []).map(norm).includes(n.id);
};

/** Map id -> root id for every node reachable below `roots` (roots included). */
function closureBelow(children, roots) {
  const out = new Map();
  for (const root of roots) {
    if (out.has(root)) continue;
    out.set(root, root);
    const stack = [root];
    while (stack.length) for (const c of children.get(stack.pop()) ?? []) if (!out.has(c)) { out.set(c, root); stack.push(c); }
  }
  return out;
}

export function buildModel(input = {}, deps = {}) {
  const { nodes, duplicates } = buildNodes(input.wos);
  const scope = {
    frds: (input.scope?.frds ?? []).map(norm), wos: (input.scope?.wos ?? []).map(norm),
    card: input.scope?.card ? norm(input.scope.card) : null, out: (input.scope?.out_of_scope ?? []).map(norm),
  };
  const inScope = (n) => !scope.out.includes(n.id) && !scope.out.includes(n.frd) && (
    scope.wos.includes(n.id) || (scope.card !== null && n.sourceChange.includes(scope.card)) || (scope.card === null && scope.wos.length === 0 && scope.frds.includes(n.frd)));
  const units = input.units ?? [];
  const frdOrder = uniq([...nodes.values()].map((n) => n.frd)).sort(naturalCompare);
  const children = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const n of nodes.values()) for (const d of n.deps) children.get(d)?.push(n.id);

  const unitOfWo = new Map();
  for (const u of units) if (u.kind === "build" || u.kind === "patch") for (const w of u.wos ?? []) unitOfWo.set(norm(w), u.id);
  const claimed = new Set(unitOfWo.keys());
  // Work built on an unaccepted assumption lives on `lane/<run>/assume-<doubt>`, not on the integration branch: its WOs are
  // roots that hold new dependents until the owner answers (they would be built without that code).
  const stalled = units.filter((u) => (STALLED_STATES.has(u.state) || isAssumed(u)) && PLANNED_KINDS.has(u.kind));
  const blockedRoots = uniq([...stalled.flatMap((u) => u.wos ?? []).map(norm), ...[...nodes.values()].filter((n) => n.status === "BLOCKED").map((n) => n.id)]).filter((id) => nodes.has(id));

  const open = input.questions ?? null;
  const irreversibleRoots = [];
  const answerOf = new Map();
  for (const n of nodes.values()) {
    const hits = (open ?? []).filter((q) => matchesQuestion(q, n)).sort((a, b) => naturalCompare(a.id, b.id));
    if (hits.some((q) => q.reversible === false)) irreversibleRoots.push(n.id);
    else if (hits.length) answerOf.set(n.id, hits[0].id);
  }
  const verified = new Set((input.verified_frds ?? []).map(norm));
  for (const u of units) if (u.kind === "review" && u.frd && (u.state === "verified" || u.state === "landed")) verified.add(norm(u.frd));
  for (const frd of frdOrder) {
    const mine = [...nodes.values()].filter((n) => n.frd === frd && inScope(n));
    if (mine.length > 0 && mine.every((n) => n.status === "VERIFIED")) verified.add(frd);
  }
  const floorFrds = new Set(input.floor_frds ? input.floor_frds.map(norm) : [...nodes.values()].filter((n) => n.zone !== "none").map((n) => n.frd));
  const frdAcs = new Map(Object.entries(input.frd_acs ?? {}).map(([frd, list]) => [norm(frd), new Set(list.map((a) => String(a).toUpperCase()))]));
  const ceiling = Number.isInteger(input.ceiling) && input.ceiling >= 1 ? input.ceiling : DEFAULT_CEILING;
  const liveSlots = units.filter((u) => SLOT_STATES.has(u.state)).length + (Number(input.reserved) || 0);

  const m = {
    deps, nodes, duplicates, scope, inScope, units, unitById: new Map(units.map((u) => [u.id, u])), frdOrder, children, unitOfWo, claimed,
    blockedBy: closureBelow(children, blockedRoots), irrevBy: closureBelow(children, irreversibleRoots), answerOf, openQuestions: open,
    initialVerified: verified, floorFrds, frdAcs, cardType: input.card_type ?? null, ceiling,
    capacity: Number.isInteger(input.capacity) ? Math.max(0, input.capacity) : Math.max(0, ceiling - liveSlots),
    liveWrite: units.filter((u) => WRITE_STATES.has(u.state) && PLANNED_KINDS.has(u.kind)),
    route: { label: input.label ?? null, size: input.size ?? "feature", quota: input.quota, shape: input.shape, coordinator: input.coordinator, sessionModel: input.session_model },
  };
  m.depth = makeDepth(m);
  m.cellKeyOf = memoize((n) => cellKey(routeCell(m, "build", [n])));
  return m;
}

const memoize = (fn) => { const seen = new Map(); return (x) => { if (!seen.has(x)) seen.set(x, fn(x)); return seen.get(x); }; };

/** Longest downstream path (in WOs) among the open in-scope WOs below each node; cycle-safe. */
function makeDepth(m) {
  const memo = new Map();
  const visiting = new Set();
  const depth = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = 0;
    for (const c of m.children.get(id) ?? []) {
      const n = m.nodes.get(c);
      if (n && PENDING.has(n.status) && m.inScope(n)) best = Math.max(best, 1 + depth(c));
    }
    visiting.delete(id);
    memo.set(id, best);
    return best;
  };
  return depth;
}

// ---------------------------------------------------------------------------------------------------------------
// Routing cells (chain cut) and unit artifacts
// ---------------------------------------------------------------------------------------------------------------

export function routeCell(m, kind, wos) {
  const { label, size, quota, shape, coordinator, sessionModel } = m.route;
  if (!label && !m.deps.cellOf) return null;
  const zone = maxZone(wos.map((n) => n.zone));
  const reopen = Math.max(0, ...wos.map((n) => n.reopen));
  const unit = { kind, size, zone, reopen_count: reopen, attempt: 1, wos: wos.map((n) => n.id) };
  const ctx = { label, zone, reopen_count: reopen, attempt: 1, quota, shape, coordinator, sessionModel };
  return m.deps.cellOf ? m.deps.cellOf(unit, ctx) : builderCell(unit, ctx, m.deps.routing);
}

function cellKey(cell) {
  if (!cell) return "none";
  if (cell.runtime) return `${cell.runtime}/${cell.model}/${cell.effort}`;
  return cell.paused ? `paused:${cell.paused}` : `deferred:${cell.deferred?.runtime}/${cell.deferred?.model}`;
}

export function unitArtifacts(m, kind, woIds) {
  if (kind === "docs") return [...DOCS_GLOBS];
  if (!PLANNED_KINDS.has(kind)) return [];
  const lists = woIds.map((id) => m.nodes.get(norm(id))?.artifacts ?? null);
  return lists.some((l) => l === null) ? null : uniq(lists.flat());
}
