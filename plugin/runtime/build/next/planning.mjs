// (3) Quota view and (4)(5) the units managed by `next`: deferred reviews, the planner round over the integration
// worktree's work orders (static risk zones), first-minute questions (D19) and the run parameters.
import { execFile } from "node:child_process";
import { readDeferred } from "../deferred.mjs";
import { readJson } from "../fsx.mjs";
import { readJournal } from "../journal.mjs";
import * as riskModule from "../risk.mjs";
import { findUnit, newUnit } from "../state.mjs";
import { FRD_WORK_KINDS, GIT_SHOW_TIMEOUT_MS } from "./constants.mjs";
import { availabilityOf, err, integrationProductRoot, maxZone, mutate, quotaDeps, shapeOf, sibling, unionWos, unitEvent } from "./context.mjs";
import { inScope } from "./scope.mjs";

export async function quotaView(run, state) {
  const { d, paths } = run;
  const q = await d.quota.readQuota({ file: paths.quotaFile, codexHome: paths.codexHome, coordinator: state.coordinator }, quotaDeps(d));
  const driveAlive = await driveStandbyAlive(run);
  const policy = d.quota.policy({ claude: q.effective.claude, codex: q.effective.codex, readings: q.readings, coordinator: state.coordinator, driveAlive, deps: quotaDeps(d), thresholds: d.thresholds });
  const view = (e) => ({ pct: e?.pct ?? null, state: e?.state ?? "unknown" });
  return {
    policy, driveAlive, raw: q,
    out: { claude: view(q.effective.claude), codex: view(q.effective.codex) },
    bothOut: !policy.claude_new_units && !policy.codex_new_units,
    resets: { claude: d.quota.resetsAtOf?.(q.claude) ?? null, codex: d.quota.resetsAtOf?.(q.codex) ?? null },
  };
}

/** Drive standby alive = `build/drive/standby.json` names a live pid in state `standby` (A11). */
async function driveStandbyAlive(run) {
  const standby = await readJson(run.paths.driveStandbyFile, { fs: run.d.fs }).catch((error) => {
    if (error.code === "LEDGER_CORRUPT") return null;
    throw error;
  });
  return Boolean(standby && standby.state === "standby" && run.d.isAlive(Number(standby.pid)));
}

/** The deferred-review ledger (missing file = empty; an invalid one fails loud through deferred.readDeferred). */
export async function listDeferred(run) {
  return readDeferred(run.ref.project, { fs: run.d.fs, env: run.d.env });
}

export const deferredUnitId = (entryId) => `u-deferred-review-${entryId}`;

/** Deferred reviews whose needed company is below the stop threshold become queued units first (BUILD-10, D11). */
export async function scheduleManagedUnits(run, state, pol, entries) {
  const avail = availabilityOf(pol);
  const servable = entries.filter((e) => e.status === "pending" && !pol.paused && !findUnit(state, deferredUnitId(e.id)));
  if (!servable.length) return state;
  return mutate(run, (s) => {
    const add = servable.filter((e) => !findUnit(s, deferredUnitId(e.id))).map((e) => newUnit({
      id: deferredUnitId(e.id), kind: "deferred-review", frd: e.frd ?? null,
      wos: unionWos(s.units.filter((u) => e.frd && u.frd === e.frd && FRD_WORK_KINDS.includes(u.kind))),
      zone: maxZone(s.units.filter((u) => e.frd && u.frd === e.frd).map((u) => u.zone)),
    }));
    if (!add.length) return {};
    return { state: { ...s, units: [...s.units, ...add] }, events: add.map((u) => ({ type: "unit_queued", data: u })) };
  });
}

/** `git show <rev>:<rel>` text, or null when the path does not exist at that revision. */
function gitShow(cwd, rev, rel) {
  return new Promise((resolve) => {
    execFile("git", ["show", `${rev}:${rel}`], { cwd, timeout: GIT_SHOW_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => resolve(error ? null : stdout));
  });
}

/**
 * (5) One planner round over the integration worktree's work orders: queue the new units that are ready now (in scope
 * only) and return the dispatchable round. The FRD AC ids come from `integration.base_sha` (A13 tests-first trigger).
 */
export async function planRound(run, state, pol) {
  const { d } = run;
  const root = await integrationProductRoot(run, state);
  const base = state.integration?.base_sha;
  const prefix = run.prefix ?? "";
  const readFrd = base ? (frd) => gitShow(root, base, `${prefix}docs/frds/${frd}/frd.md`) : undefined;
  const read = await (await sibling(d, "planner", "readPlanWorkOrders"))(root, { ...d, ...(readFrd ? { readFrd } : {}) });
  const wos = await withZones(run, state, read?.wos ?? [], root);
  const questions = [...(await readQuestions(run)).values()].filter((q) => !(q.id in (state.answers ?? {})));
  const params = await readRunParams(run);
  const plan = await (await sibling(d, "planner", "plan"))({
    wos, frd_acs: read?.frd_acs ?? {}, scope: state.scope, units: state.units, label: state.label, size: state.size,
    questions, quota: pol, shape: shapeOf(state), coordinator: state.coordinator, session_model: params.sessionModel,
  }, d);
  const nowIds = Array.isArray(plan?.now) ? new Set(plan.now) : null;
  const add = (plan?.units ?? []).filter((u) => u && (!nowIds || nowIds.has(u.id)) && inScope(state, u));
  let next = state;
  if (add.length) {
    next = await mutate(run, (s) => {
      const fresh = add.filter((u) => !findUnit(s, u.id)).map((u) => newUnit(u));
      if (!fresh.length) return {};
      return { state: { ...s, units: [...s.units, ...fresh] }, events: fresh.map((u) => ({ type: "unit_queued", data: u })) };
    });
  }
  const round = Array.isArray(plan?.round) ? plan.round : Array.isArray(plan?.ready) ? plan.ready : [];
  return { state: next, ready: [...new Set(round)], deadlock: Boolean(plan?.deadlock) };
}

/**
 * Static risk zones on the work orders the planner may still plan (floor/r1 chain cuts, `floor_frds`, A13 tests-first).
 * VERIFIED WOs never matter to the planner; a WO already in a build/patch unit reuses that unit's `zone`/`risk_rules`, so
 * the classifier (`risk.staticZones`, one spawn per WO) runs only on the rest.
 */
async function withZones(run, state, readWos, root) {
  const { d } = run;
  const covered = new Map(state.units.filter((u) => u.kind === "build" || u.kind === "patch")
    .flatMap((u) => (u.wos ?? []).map((w) => [String(w).toLowerCase(), u])));
  const isCovered = (w) => covered.has(String(w.id).toLowerCase());
  const need = readWos.filter((w) => w.status !== "VERIFIED" && !isCovered(w));
  let zoned = new Map();
  if (need.length) {
    const fn = typeof d.risk.staticZones === "function" ? d.risk.staticZones : riskModule.staticZones;
    if (typeof fn !== "function") throw err("ENGINE_FAILURE", "risk.staticZones is missing: work orders cannot get their static zones");
    const res = await fn(need, root, d.riskDeps ?? {});
    if (!Array.isArray(res)) throw err("ENGINE_FAILURE", "risk.staticZones returned no work-order list");
    zoned = new Map(res.map((w) => [w.id, w]));
  }
  return readWos.map((w) => {
    if (zoned.has(w.id)) return zoned.get(w.id);
    if (!isCovered(w)) return w;
    const u = covered.get(String(w.id).toLowerCase());
    return { ...w, zone: u.zone ?? "none", risk_rules: u.risk_rules ?? [] };
  });
}

/**
 * First-minute questions (D19), by id: `{id, reversible, affects, default_es, default_action}`. The source is the preflight
 * THIS run started from (`run_started.data.preflight` in its journal); `build/preflight.json` belongs to the latest
 * `--preflight` and is only the fallback for a journal without it (N5).
 */
export async function readQuestions(run) {
  if (run.preflight === undefined) {
    const started = (await readJournal(run.paths.journalFile, run.d)).events.find((ev) => ev.type === "run_started");
    const journaled = started?.data?.preflight;
    run.preflight = journaled && typeof journaled === "object" ? journaled : await readJson(run.paths.preflightFile, { fs: run.d.fs });
  }
  const preflight = run.preflight;
  const out = new Map();
  for (const q of preflight?.questions ?? []) if (q?.id) out.set(q.id, q);
  for (const check of preflight?.checks ?? []) if (check?.question?.id && !out.has(check.question.id)) out.set(check.question.id, check.question);
  return out;
}

/** Queued units waiting on an irreversible (or unknown) first-minute answer park as `owner_question` (D19). */
export async function parkIrreversiblePending(run, state) {
  const waiting = state.units.filter((u) => u.state === "queued" && u.pending_answer && !u.parked && !(u.pending_answer in state.answers));
  if (!waiting.length) return state;
  const questions = await readQuestions(run);
  const toPark = waiting.filter((u) => questions.get(u.pending_answer)?.reversible !== true);
  if (!toPark.length) return state;
  return mutate(run, (s) => {
    const ids = new Set(toPark.map((u) => u.id));
    const events = [];
    const units = s.units.map((u) => {
      if (!ids.has(u.id) || u.state !== "queued" || u.parked) return u;
      // `parked` carries the reason, `unit_state` the state: a rebuild-state replays both (N11b).
      events.push({ type: "parked", data: { unit: u.id, reason: "owner_question", question: u.pending_answer } });
      events.push(unitEvent(u.id, u.state, "parked"));
      return { ...u, parked: "owner_question", state: "parked" };
    });
    return events.length ? { state: { ...s, units }, events } : {};
  });
}

/** session_model / k: the call's overrides, else the last `run_started|run_resumed` data that carries them. */
export async function readRunParams(run) {
  const params = { sessionModel: run.overrides.sessionModel, k: run.overrides.k };
  if (params.sessionModel !== null && params.k !== null) return params;
  const { events } = await readJournal(run.paths.journalFile, run.d);
  for (const ev of events) {
    if (ev.type !== "run_started" && ev.type !== "run_resumed") continue;
    const data = ev.data ?? {};
    if (run.overrides.sessionModel === null && typeof data.session_model === "string") params.sessionModel = data.session_model;
    if (run.overrides.k === null && Number.isInteger(data.k) && data.k > 0) params.k = data.k;
  }
  return params;
}
