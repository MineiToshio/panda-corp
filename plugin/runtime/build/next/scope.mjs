// Pure state queries of the `next` scheduler: the run scope (CLI 4), dependency readiness (D16), the owner-blocked
// closure and whether the batch is complete (CLI 3.11).
import { findUnit, isTerminalUnit } from "../state.mjs";
import { FRD_WORK_KINDS, OWNER_PARKS } from "./constants.mjs";
import { assumedRunnable } from "./context.mjs";

/**
 * Is a unit inside the run scope? Never when it touches an out-of-scope WO or FRD. With a card, everything else is in.
 * Without a card, each of its WOs must be listed in `scope.wos` or belong to an FRD of `scope.frds` (a WO a docs unit
 * created inside an in-scope FRD); units without WOs (reviews, the audit, consults) are in scope.
 */
export function inScope(state, unit) {
  const scope = state.scope ?? { card: null, wos: [], frds: [], out_of_scope: [] };
  const out = new Set((scope.out_of_scope ?? []).map((x) => String(x).toLowerCase()));
  const wos = (unit.wos ?? []).map((w) => String(w).toLowerCase());
  if (wos.some((w) => out.has(w)) || (unit.frd && out.has(String(unit.frd).toLowerCase()))) return false;
  if (scope.card) return true;
  const allowed = new Set((scope.wos ?? []).map((w) => String(w).toLowerCase()));
  const frds = new Set((scope.frds ?? []).map((f) => String(f).toLowerCase()));
  const frdIn = unit.frd && frds.has(String(unit.frd).toLowerCase());
  return wos.every((w) => allowed.has(w) || frdIn);
}

/** The state restricted to the units of the run scope: out-of-scope units are never pending work (CLI 4). */
export const scopedState = (state) => ({ ...state, units: state.units.filter((u) => inScope(state, u)) });

const DEPS_DONE = Object.freeze(["integrated", "reviewing", "patching", "verified", "landed"]);
/** Every `depends_on` unit is integrated or later (D16: a build unit waits for its tests unit). Unknown ids are not met. */
export const depsMet = (state, unit) => (unit.depends_on ?? []).every((id) => DEPS_DONE.includes(findUnit(state, id)?.state));

/**
 * Units that wait on the owner or have no reviewer, plus everything that depends on them (transitively through
 * `depends_on`, and the FRD units of a parked review). They are out of the batch and out of the progress test.
 * @returns {{all: Set<string>, ownerRoots: object[]}}
 */
export function blockedClosure(state) {
  // Work built on an assumption is progress while it can still run; it becomes an owner root once integrated (C10).
  const roots = state.units.filter((u) => !isTerminalUnit(u) && ((u.parked && !assumedRunnable(u)) || u.state === "waiting_gate" || u.state === "parked"));
  const blocked = new Set(roots.map((u) => u.id));
  for (const review of roots.filter((u) => u.kind === "review" && u.frd)) {
    for (const u of state.units) if (FRD_WORK_KINDS.includes(u.kind) && u.frd === review.frd && !isTerminalUnit(u)) blocked.add(u.id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of state.units) {
      if (blocked.has(u.id) || isTerminalUnit(u)) continue;
      if ((u.depends_on ?? []).some((dep) => blocked.has(dep))) { blocked.add(u.id); grew = true; }
    }
  }
  const ownerRoots = roots.filter((u) => OWNER_PARKS.includes(u.parked) || u.state === "waiting_gate" || (u.state === "parked" && u.parked !== "no_reviewer"));
  return { all: blocked, ownerRoots };
}

const landReady = (u) => (FRD_WORK_KINDS.includes(u.kind) && u.state === "verified") || (u.kind === "docs" && (u.state === "integrated" || u.state === "verified"));

/**
 * Is the batch complete (CLI 3.11: every non-parked unit of the run, or tranche, is ready to land)?
 * @returns {{complete: boolean, ready: string[]}}
 */
export function batchState(state) {
  state = scopedState(state);
  const { all } = blockedClosure(state);
  const active = state.units.filter((u) => !isTerminalUnit(u) && !all.has(u.id));
  const ready = active.filter(landReady);
  return { complete: ready.length > 0 && active.every(landReady), ready: ready.map((u) => u.id) };
}
