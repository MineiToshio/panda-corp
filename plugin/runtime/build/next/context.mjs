// Shared plumbing of the `next` scheduler: deps resolution, clock, lazy sibling modules, fenced state access, unit
// predicates, read-only git checks and the small unit/zone helpers every step uses.
import { execFile } from "node:child_process";
import path from "node:path";
import * as admissionModule from "../admission.mjs";
import * as quotaModule from "../quota.mjs";
import * as riskModule from "../risk.mjs";
import * as routingModule from "../routing.mjs";
import { fencedTwoPhase, readState } from "../state.mjs";
import { productPrefix, productRoot } from "../units.mjs";
import { GIT_SHOW_TIMEOUT_MS, LIVE_STATES, WATCH_POLL_MS } from "./constants.mjs";

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

export function resolveDeps(deps) {
  const env = deps.env ?? process.env;
  return {
    ...deps,
    env,
    quota: deps.quota ?? quotaModule,
    admission: deps.admission ?? admissionModule,
    routing: deps.routing ?? routingModule,
    risk: deps.risk ?? riskModule,
    monotonic: deps.monotonic ?? (() => performance.now()),
    sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    isAlive: deps.isAlive ?? defaultIsAlive,
    pollMs: deps.pollMs ?? WATCH_POLL_MS,
    log: deps.log ?? ((line) => process.stderr.write(`${line}\n`)),
  };
}

const defaultIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
};

export function nowMs(d) {
  const forced = d.env.PANDACORP_NOW;
  if (forced) return Date.parse(forced);
  return d.clock ? d.clock().getTime() : Date.now();
}
export const nowIsoOf = (d) => new Date(nowMs(d)).toISOString();

/** The sibling function `<stem>.<fn>`: `deps.<stem>` when injected, else the real module (imported on first use). */
export async function sibling(d, stem, fn) {
  let ns = d[stem];
  if (!ns) {
    try { ns = await import(`../${stem}.mjs`); } catch (error) {
      throw err("ENGINE_FAILURE", `next: sibling module ${stem}.mjs cannot be loaded: ${String(error?.message ?? error).split("\n")[0]}`);
    }
    d[stem] = ns;
  }
  const f = ns[fn];
  if (typeof f !== "function") throw err("ENGINE_FAILURE", `next: sibling ${stem}.${fn} is not a function`);
  if (stem === "planner" && fn === "plan") return (input, deps) => f({ ...input, ceiling: d.adaptiveStep ?? admissionModule.ADMISSION.K_START_DEFAULT }, deps);
  return f;
}

export const quotaDeps = (d) => ({ env: d.env, homedir: d.homedir, thresholds: d.thresholds });
export const routingDeps = (d) => (d.tiers ? { tiers: d.tiers } : undefined);
export const admissionCtx = (run) => ({ file: run.paths.admissionFile, now: () => nowMs(run.d) });

/**
 * One fenced step: phase 1 (renews the lease) reads the state, `fn(state, ctx)` returns `{state?, events?, value?}`;
 * events are journaled first (the journal is the replay source), then the state is written.
 */
export async function mutate(run, fn) {
  return fencedTwoPhase(run.ref, async (ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no build/state.json for this run", { hint: "rebuild-state" });
    if (state.run_id !== ctx.runId) throw err("FENCE", `state run ${state.run_id} is not the lease run ${ctx.runId}`);
    const out = (await fn(state, ctx)) ?? {};
    for (const event of out.events ?? []) await ctx.appendEvent(event);
    if (out.state) await ctx.writeState(out.state);
    return out.value !== undefined ? out.value : (out.state ?? state);
  }, passIntent);
}

// `fencedTwoPhase` returns the work step's result when phase 2 is omitted: a phase-1-only mutation passes its intent through.
export const passIntent = (intent) => intent;

export async function fresh(run) {
  const state = await readState(run.ref.project, run.d);
  if (!state) throw err("INVALID_STATE", "build/state.json disappeared during next", { hint: "rebuild-state" });
  return state;
}

export const unitEvent = (unit, from, to) => ({ type: "unit_state", data: { unit, from, to } });
export const integrationRoot = (run, state) => path.resolve(run.ref.project, state.integration?.worktree ?? run.paths.integrationWorktree);
export const isLive = (u) => LIVE_STATES.includes(u.state);
/** A unit built on an assumption the owner has not answered (BUILD-12): dispatchable, never landed until accepted. */
export const isAssumed = (u) => u?.parked === "built_on_assumption";
/** Built-on-assumption work that can still run (not integrated on its assume branch yet). */
export const assumedRunnable = (u) => isAssumed(u) && !["integrated", "reviewing", "patching", "verified", "landed"].includes(u.state);

export const fenceOf = (run) => ({ project: run.ref.project, epoch: run.ref.epoch });

/** `git <args>` exit 0? (read-only checks; a git error reads as false). */
export function gitOk(cwd, args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, timeout: GIT_SHOW_TIMEOUT_MS }, (error) => resolve(!error));
  });
}

export const cellOf = (worker) => (worker ? { runtime: worker.runtime, model: worker.model, effort: worker.effort } : null);

export const availabilityOf = (pol) => ({
  claude: pol.claude_new_units ? (pol.claude_conserve ? "conserve" : "ok") : "quota",
  codex: pol.codex_new_units ? (pol.codex_conserve ? "conserve" : "ok") : "quota",
});
export const shapeOf = (state) => (state.coordinator === "codex-session" ? "R-B" : state.coordinator === "drive" ? "drive" : state.label === "codex" ? "R-C" : "R-A");

/** Product root of the integration worktree (the project may live under a prefix of its git repository). */
export async function integrationProductRoot(run, state) {
  // `state.integration.worktree` is already the PRODUCT root (lifecycle stores `<git worktree>/<prefix>`); the prefix is still
  // computed because repo-relative reads (`git show <base>:<prefix>docs/...`) need it.
  if (run.prefix === undefined) run.prefix = await productPrefix(run.ref.project, { env: run.d.env });
  return state.integration?.worktree
    ? path.resolve(run.ref.project, state.integration.worktree)
    : productRoot(run.paths.integrationWorktree, run.prefix);
}

export function unionWos(units) {
  return [...new Set(units.flatMap((u) => u.wos ?? []))];
}

export function maxZone(zones) {
  const order = ["none", "floor", "r1"];
  return zones.reduce((acc, z) => (order.indexOf(z) > order.indexOf(acc) ? z : acc), "none");
}
