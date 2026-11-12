/**
 * Pandacorp build engine v2: the planner (BUILD-9, D30, PLAN 3.6, 3.16 A13). Pure and self-contained: it imports nothing
 * from the default engine's `build-mech-*` files. It reads no repository and spawns nothing; the caller hands it the work
 * orders (as read from the integration worktree), the run's scope and the state units, and gets back units to queue and a
 * dispatch round. The only reader here is `readPlanWorkOrders`, which feeds `plan` / `lint-plan` / `next` from disk.
 *
 * Rules (standard BUILD-9):
 *  - a WO is ready when it is PLANNED|IN_PROGRESS, in scope, unclaimed by a build/patch unit, not below a parked or blocked
 *    unit/WO, not pending the answer to an irreversible question, and every `dependsOn` is INTEGRATED (IN_REVIEW on the
 *    run's integration branch, or VERIFIED); a dependency on another FRD's integrated-but-unverified WO of a floor FRD waits
 *    for that FRD's review unless the dependent is one the floor FRD itself needs (DR-132 waiver);
 *  - rounds are greedy: barrier first, then longest downstream path, up to the round width, adding a unit only when its
 *    `artifacts` do not overlap a live or already chosen unit (literal-prefix rule: conservative);
 *  - a chain is at most 3 WOs of one FRD on a linear stretch, cut when the routing cell changes;
 *  - a tests unit precedes a build unit that adds ACs on the floor/r1 zone, or any build unit of a `type: bug` card (A13);
 *  - nothing can ever become ready and nothing is held by an owner/parked/blocked cause: `deadlock`.
 *
 * Every function takes the injected `deps` as its LAST optional argument.
 */
import path from "node:path";
import { frontmatterList, parseYamlSubset, resolveDeps, splitFrontmatter } from "./card.mjs";
import { builderCell } from "./routing.mjs";
import { newUnit } from "./state.mjs";

/** Longest chain of WOs one build unit may hold (BUILD-9). */
export const CHAIN_MAX = 3;
/** Default round width: the admission ceiling K_TECHO (BUILD-9). */
export const DEFAULT_CEILING = 2;
/** Files a `docs` unit may write (A2); used as its `artifacts` for overlap. */
export const DOCS_GLOBS = Object.freeze(["docs/**", "README.md", ".env.example"]);

// Barrier paths are constants (D30): schema, migrations, the package manifest and lockfiles.
const BARRIER_RES = Object.freeze([
  /(^|\/)prisma\//, /\.(sql|prisma)$/i, /(^|\/)migrations?\//, /(^|\/)drizzle\//,
  /(^|\/)package\.json$/, /(^|\/)(pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/,
]);
const AC_RE = /\bAC-\d+-\d+\.\d+\b/gi;
const ZONE_RANK = Object.freeze({ none: 0, floor: 1, r1: 2 });
const PENDING = new Set(["PLANNED", "IN_PROGRESS"]);
const SLOT_STATES = new Set(["admitted", "running"]);
const WRITE_STATES = new Set(["admitted", "running", "reported", "committed"]);
const UNIT_DONE = new Set(["integrated", "reviewing", "patching", "verified", "landed"]);
const STALLED_STATES = new Set(["parked", "blocked", "waiting_gate"]);
const PLANNED_KINDS = new Set(["docs", "tests", "build", "patch"]);

const norm = (s) => String(s ?? "").trim().toLowerCase();
const uniq = (list) => [...new Set(list)];
const maxZone = (zones) => zones.reduce((a, z) => (ZONE_RANK[z] > ZONE_RANK[a] ? z : a), "none");
const normGlob = (g) => String(g ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
const naturalCompare = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });

// ---------------------------------------------------------------------------------------------------------------
// Path rules
// ---------------------------------------------------------------------------------------------------------------

/**
 * The literal prefix of a glob: everything before the first wildcard (`*`, `?`, `[`, `{`).
 * @param {string} glob
 * @returns {string}
 */
export function literalPrefix(glob) {
  const g = normGlob(glob);
  const i = g.search(/[*?[{]/);
  return i < 0 ? g : g.slice(0, i);
}

/** Conservative overlap of two globs: one literal prefix is a prefix of the other. */
export const globsOverlap = (a, b) => {
  const pa = literalPrefix(a);
  const pb = literalPrefix(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
};

/**
 * Do two `artifacts` lists overlap? `null` means unknown (legacy WO without `artifacts`) and overlaps everything.
 * @param {string[]|null} a
 * @param {string[]|null} b
 */
export const artifactsOverlap = (a, b) => a === null || b === null || a.some((x) => b.some((y) => globsOverlap(x, y)));

/** Is this path/glob one of the constant barrier paths (schema, migrations, package manifest, lockfiles)? */
export const isBarrierPath = (p) => BARRIER_RES.some((re) => re.test(normGlob(p)));

/** Normalized (upper-case, unique) AC ids (`AC-NN-MMM.K`) found in a text. */
export const extractAcIds = (text) => uniq([...String(text ?? "").matchAll(AC_RE)].map((m) => m[0].toUpperCase()));

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

function buildModel(input = {}, deps = {}) {
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

function routeCell(m, kind, wos) {
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

function unitArtifacts(m, kind, woIds) {
  if (kind === "docs") return [...DOCS_GLOBS];
  if (!PLANNED_KINDS.has(kind)) return [];
  const lists = woIds.map((id) => m.nodes.get(norm(id))?.artifacts ?? null);
  return lists.some((l) => l === null) ? null : uniq(lists.flat());
}

// ---------------------------------------------------------------------------------------------------------------
// Readiness (dependency satisfaction incl. the DR-132 floor wait)
// ---------------------------------------------------------------------------------------------------------------

const isIntegrated = (m, sim, n) => n.status === "VERIFIED" || sim.done.has(n.id) || (n.status === "IN_REVIEW" && m.inScope(n));
const isOpen = (n, sim) => PENDING.has(n.status) && !sim.done.has(n.id);

/** Floor-wait helpers over the current simulated state: `waits(n)` FRDs, `needsOf(frd)`, `waived(dep, of)`. */
function floorTools(m, sim) {
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
function depStatus(m, sim, depId, of) {
  const dep = m.nodes.get(depId);
  if (!dep) return "dangling";
  if (dep.status === "VERIFIED") return true;
  if (!isIntegrated(m, sim, dep)) return m.inScope(dep) ? "not_built" : "out_of_scope";
  if (dep.frd === of.frd || !m.floorFrds.has(dep.frd) || sim.verified.has(dep.frd)) return true;
  return sim.floor.waived(dep, of) ? true : "floor_wait";
}

const plannable = (m, sim, n) => PENDING.has(n.status) && m.inScope(n) && !m.claimed.has(n.id) && !sim.claimed.has(n.id)
  && !m.blockedBy.has(n.id) && !m.irrevBy.has(n.id);
const depsMet = (m, sim, n, inside = new Set()) => n.deps.every((d) => inside.has(d) || depStatus(m, sim, d, n) === true);

// ---------------------------------------------------------------------------------------------------------------
// Chains and units
// ---------------------------------------------------------------------------------------------------------------

function formChains(m, sim) {
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

function makeUnits(m, sim, { nodes: chain, cut }) {
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

function existingCandidate(m, unit) {
  const woIds = (unit.wos ?? []).map(norm);
  const chain = woIds.map((id) => m.nodes.get(id)).filter(Boolean);
  return {
    unit, existing: true, artifacts: unitArtifacts(m, unit.kind, woIds), barrier: chain.some((n) => n.barrier),
    downstream: Math.max(0, ...chain.map((n) => m.depth(n.id))), frdIndex: Math.max(0, m.frdOrder.indexOf(norm(unit.frd))),
    order: Math.min(Infinity, ...chain.map((n) => n.order)), picked: false,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------------------------------------------

/** Is the unit-level dependency `dep` satisfied: `true`, `false` (not yet) or "held" (stalled/blocked unit). */
function unitDep(m, sim, depId) {
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

/** A unit built on an assumption (BUILD-12): dispatchable from its assume branch, never landed until the owner answers. */
const isAssumed = (u) => u?.parked === "built_on_assumption";

/** Is WO `woId` built (unit integrated-or-later) by a unit on the assumption branch of `doubt`? */
function assumedDoneOn(m, sim, woId, doubt) {
  const id = m.unitOfWo.get(woId);
  const u = id && m.unitById.get(id);
  return Boolean(u && isAssumed(u) && u.pending_answer === doubt && (UNIT_DONE.has(u.state) || sim.unitDone.has(u.id)));
}

function pendingIrreversible(m, unit) {
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

function simulate(m) {
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

function findCycles(nodes) {
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
function classifyStuck(m, { sim, pool }) {
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

// ---------------------------------------------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------------------------------------------

function reachable(m, from) {
  const out = new Set();
  const stack = [from];
  while (stack.length) for (const c of m.children.get(stack.pop()) ?? []) if (!out.has(c)) { out.add(c); stack.push(c); }
  return out;
}

function lintModel(m, stuck) {
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

// ---------------------------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------------------------

/**
 * Plan the run: new units to queue, the dispatch round, a simulated schedule, held work and deadlock.
 *
 * @param {object} input
 * @param {{id: string, frd: string, status: string, deps?: string[], artifacts?: string[]|null, order?: number, reopen_count?: number,
 *   zone?: "none"|"floor"|"r1", risk_rules?: string[], acs?: string[], source_change?: string[]}[]} input.wos every WO known (all FRDs,
 *   every status: dependencies outside the scope are read from here); `status` is the frontmatter on the integration worktree;
 *   `artifacts` absent = legacy (serial), `[]` = declared empty; `zone` = the static risk zone of its artifacts (risk.mjs)
 * @param {{card?: string|null, frds?: string[], wos?: string[], out_of_scope?: string[]}} input.scope `state.scope`
 * @param {object[]} [input.units] `state.units` (claimed WOs, live units, queued candidates, parked/blocked roots)
 * @param {string} [input.label] "claude"|"codex": builder label; without it no routing cell is computed
 * @param {"touch"|"feature"|"giant"} [input.size]
 * @param {number} [input.ceiling] round width including live units (default 2); `input.reserved` extra live slots; `input.capacity` overrides
 * @param {string[]} [input.floor_frds] FRDs held to the floor rule; default: FRDs with a WO in zone floor/r1
 * @param {string[]} [input.verified_frds] FRDs whose review passed (also derived from `review` units and all-VERIFIED FRDs)
 * @param {Record<string, string[]>} [input.frd_acs] AC ids of each FRD at `integration.base_sha` (tests-first; unknown = all cited ACs are new)
 * @param {string|null} [input.card_type] "bug" makes every build unit tests-first
 * @param {{id: string, affects: object, reversible: boolean}[]} [input.questions] open owner questions (D19)
 * @param {object} [input.quota] [input.shape] [input.coordinator] [input.session_model] forwarded to `routing.builderCell`
 * @param {{cellOf?: Function, routing?: object}} [deps] `cellOf(unit, ctx)` replaces the routing call
 * @returns {{units: object[], now: string[], ready: string[], round: string[], rounds: string[][], cells: object, why: object, meta: object,
 *   held: {wo: string, reason: string, by: string}[], held_units: string[], integration_paused_by: string|null, capacity: number,
 *   floor_waived: {wo: string, frd: string, floors: string[]}[], progress: boolean, deadlock: null|{wos: string[], units: string[],
 *   waits: {wo: string, dep: string, why: string}[], cycles: string[][]}, issues: object[]}}
 *   `units` = every NEW unit of the plan (state-shaped, `queued`), in plan order, future rounds included; `now` = the new units to
 *   queue now (chains ready now, a tests unit always with its build unit); `ready` = queued candidates (new and existing) whose
 *   dependencies are met; `round` = what to dispatch now within the capacity and without artifact overlap; `rounds` = the simulated
 *   schedule (round 0 equals `round`); `deadlock` is non-null when WOs or queued units can never run and no owner/parked/blocked cause holds them
 */
export function plan(input, deps = {}) {
  const m = buildModel(input, deps);
  const run = simulate(m);
  const stuck = classifyStuck(m, run);
  const { sim } = run;
  const liveBarrier = m.liveWrite.find((u) => (u.wos ?? []).some((w) => m.nodes.get(norm(w))?.barrier));
  const roundBarrier = run.roundIds.find((id) => sim.meta[id]?.barrier);
  const deadlock = stuck.rest.length === 0 && stuck.stuckUnits.length === 0 ? null : {
    wos: stuck.rest.map((n) => n.id), units: stuck.stuckUnits, waits: stuck.waits,
    cycles: findCycles(m.nodes).filter((c) => c.some((id) => stuck.rest.some((n) => n.id === id))),
  };
  return {
    units: sim.planned, now: run.nowIds, ready: run.readyIds, round: run.roundIds, rounds: run.rounds,
    cells: sim.cells, why: sim.why, meta: sim.meta, held: stuck.held, held_units: stuck.heldUnits,
    integration_paused_by: liveBarrier?.id ?? roundBarrier ?? null, capacity: m.capacity, floor_waived: sim.floorWaived,
    progress: run.roundIds.length > 0 || m.liveWrite.length > 0, deadlock, issues: lintModel(m, stuck),
  };
}

/**
 * `lint-plan`: dependency cycles/dangling deps, empty or missing `artifacts`, `artifacts` overlap between WOs with no dependency path,
 * unowned AC lines, out-of-scope dependencies and deadlock. Same input as `plan` plus `strict`.
 * @param {object} input see `plan`; `input.strict` promotes every warning to an error
 * @param {object} [deps]
 * @returns {{ok: boolean, strict: boolean, issues: {rule: string, wo: string|null, severity: "error"|"warn", detail: string}[]}}
 *   `ok` false when any issue is an error (after strict promotion); the CLI exits 6 on `!ok`
 */
export function lintPlan(input, deps = {}) {
  const strict = input?.strict === true;
  const issues = plan(input, deps).issues.map((i) => (strict ? { ...i, severity: "error" } : i));
  return { ok: !issues.some((i) => i.severity === "error"), strict, issues };
}

/**
 * The `plan` CLI output shape (build-engine-cli 3.6): `{units, rounds, issues}`. With `explain`, `why` carries the reasoning.
 * @param {ReturnType<typeof plan>} result
 * @param {{explain?: boolean, queued?: object[]}} [options] `queued` = already queued units to list first
 */
export function planView(result, { explain = false, queued = [] } = {}) {
  const view = (u) => {
    const cell = result.cells[u.id];
    return {
      id: u.id, kind: u.kind, wos: u.wos, frd: u.frd, chain: u.chain, depends_on: u.depends_on,
      cell: cell?.runtime ? { runtime: cell.runtime, model: cell.model, effort: cell.effort } : null, why: explain ? result.why[u.id] ?? null : null,
    };
  };
  return { units: [...queued, ...result.units].map(view), rounds: result.rounds, issues: result.issues };
}

// ---------------------------------------------------------------------------------------------------------------
// Reading work orders from disk
// ---------------------------------------------------------------------------------------------------------------

/**
 * Read every work order under `<root>/docs/frds/<frd>/work-orders/` into planner nodes, plus the AC ids each `frd.md` defines.
 * @param {string} root the integration worktree (or any checkout)
 * @param {{fs?: object, readFrd?: (frd: string) => Promise<string|null>}} [deps] `readFrd` returns an FRD's text at another revision
 *   (the CLI passes `git show <base_sha>:...`); default: the working tree's `frd.md`
 * @returns {Promise<{wos: object[], frds: string[], frd_acs: Record<string, string[]>, errors: {file: string, reason: string}[]}>}
 *   `wos` items: `{id, frd, file, status, deps, artifacts (array or null when the key is absent), order, reopen_count, acs, source_change}`
 */
export async function readPlanWorkOrders(root, deps = {}) {
  const { fs } = resolveDeps(deps);
  const wos = [];
  const errors = [];
  const frdAcs = {};
  const base = path.join(root, "docs", "frds");
  let frds;
  try { frds = (await fs.readdir(base)).filter((n) => /^frd-/i.test(n)).sort(naturalCompare); } catch (error) {
    if (error.code === "ENOENT") return { wos, frds: [], frd_acs: frdAcs, errors };
    throw error;
  }
  for (const frd of frds) {
    const frdName = frd.toLowerCase();
    const text = deps.readFrd ? await deps.readFrd(frd) : await fs.readFile(path.join(base, frd, "frd.md"), "utf8").catch(() => null);
    if (text !== null) frdAcs[frdName] = extractAcIds(text);
    let names;
    try { names = (await fs.readdir(path.join(base, frd, "work-orders"))).filter((n) => /^wo-.*\.md$/i.test(n)).sort(naturalCompare); } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const name of names) {
      const file = `docs/frds/${frd}/work-orders/${name}`;
      const raw = await fs.readFile(path.join(base, frd, "work-orders", name), "utf8").catch(() => null);
      const parts = raw === null ? null : splitFrontmatter(raw);
      if (!parts) { errors.push({ file, reason: raw === null ? "unreadable" : "missing frontmatter" }); continue; }
      const { data } = parseYamlSubset(parts.fm);
      const status = typeof data.implementation_status === "string" ? data.implementation_status : "";
      if (!status) { errors.push({ file, reason: "implementation_status missing" }); continue; }
      const id = (typeof data.id === "string" && /^wo-/i.test(data.id) ? data.id : name.replace(/^(wo-\d+-\d+).*$/i, "$1")).toLowerCase();
      wos.push({
        id, frd: frdName, file, status, deps: frontmatterList(data.dependsOn ?? data.depends_on).map(norm),
        artifacts: Object.hasOwn(data, "artifacts") ? frontmatterList(data.artifacts) : null,
        order: Number(/(\d+)$/.exec(id)?.[1] ?? wos.length), reopen_count: Number.parseInt(String(data.reopen_count ?? 0), 10) || 0,
        acs: extractAcIds(parts.body), source_change: frontmatterList(data.source_change).map(norm),
      });
    }
  }
  return { wos, frds: frds.map((f) => f.toLowerCase()), frd_acs: frdAcs, errors };
}
