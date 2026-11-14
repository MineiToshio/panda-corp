import { logCapacityDecision } from "../../capacity.mjs";
// (6)(7) Admission and dispatch: one fenced two-phase transaction (admit, prepare and launch, record), the G2 jobs
// on their snapshots, the dispatch output and its one-line Spanish announcement.
import { existsSync } from "node:fs";
import path from "node:path";
import { releaseToken } from "../admission.mjs";
import { notify } from "../notify.mjs";
import { readJson } from "../fsx.mjs";
import { reviewRange } from "../review/range.mjs";
import { readDeferred } from "../deferred.mjs";
import { REVIEW_TYPE_KINDS, fencedTwoPhase, findUnit } from "../state.mjs";
import { dispatchOf } from "../workers.mjs";
import { AGENT_TYPE, ENV_INFRA_STOP, G2_SCRIPT, VERB_ES } from "./constants.mjs";
import { admissionCtx, err, fresh, integrationProductRoot, isAssumed, isLive, nowIsoOf, nowMs, routingDeps, shapeOf, sibling, unitEvent } from "./context.mjs";
import { createG2Snapshot, g2Needed, removeG2Snapshot, trackG2SnapshotFailures } from "./g2.mjs";
import { readQuestions } from "./planning.mjs";
import { capacityAudit, pinOf } from "../../capacity/scheduler.mjs";

export async function readSignalsSafe(run) {
  const { d } = run;
  try {
    return { value: await d.admission.readSignals({ signalsFile: d.env.PANDACORP_SIGNALS_FILE || null, exec: d.signalExec }), error: null };
  } catch (error) {
    if (error?.name !== "SignalError") throw error;
    return { value: null, error: error.message };
  }
}

async function reservationsOf(run, state) {
  const { d } = run;
  const adm = (await readJson(run.paths.admissionFile, { fs: d.fs })) ?? { tokens: {} };
  const startedOf = (unitId) => {
    const entry = Object.values(adm.tokens ?? {}).find((t) => t.unit === unitId);
    const ms = entry ? Date.parse(entry.at) : NaN;
    return Number.isFinite(ms) ? ms : nowMs(d);
  };
  const rss = (pid) => (Number.isInteger(pid) ? d.admission.rssTreeGib(pid, { exec: d.signalExec }) : null);
  const out = [];
  for (const u of state.units.filter(isLive)) {
    if (u.worker?.via === "cli") out.push({ class: "B", origin: "cli", runtime: "codex", started_ms: startedOf(u.id), rss_gib: (await rss(u.worker.pid)) ?? 0 });
    else out.push({ class: "B", origin: "agent", started_ms: startedOf(u.id) });
  }
  for (const j of state.jobs.filter((x) => x.kind === "g2" && x.state === "running")) out.push({ class: "H", origin: "cli", started_ms: Date.parse(j.started_at), rss_gib: (await rss(j.pid)) ?? 0 });
  return out;
}

const motivoToWait = (motivo) => (motivo === "disco" ? "disk" : motivo === "cpu_H" ? "cpu_H" : "ram");

export async function dispatchRound(run, state, candidates, params, signals, quota) {
  const { d, ref, paths } = run;
  const blockedDispatch = state.handbacks_in_a_row >= ENV_INFRA_STOP;
  const g2 = blockedDispatch ? [] : g2Needed(state);
  const list = blockedDispatch ? [] : candidates.list;
  if (!g2.length && !list.length) return { state, units: [], admit: null, admissionBlocked: null, g2Failed: [], g2Fails: {} };
  const diskFreeGib = d.admission.readDiskFreeGib(ref.project, d);
  const existing = new Set(list.filter((c) => c.unit.kind === "doubt-consult" || existsSync(path.join(paths.unitWorktree(c.unit.id, c.unit.attempt), ".git"))).map((c) => c.unit.id));
  const reservations = await reservationsOf(run, state);
  const hostHeld = d.admission.countHostSlots({ host: paths.hostDir }).held;

  const result = await fencedTwoPhase(ref,
    (ctx) => admitPhase(run, ctx, { g2, list, reservations, hostHeld, signals, params, diskFreeGib, existing, reactive: quota.policy }),
    (intent) => launchPhase(run, intent),
    (work, intent, ctx) => recordPhase(run, work, intent, ctx, quota));

  if (result.notifyDisk) {
    const note = { title: "Build esperando espacio", message: "No hay espacio suficiente para otra copia de trabajo. El trabajo en curso sigue; libera disco para continuar." };
    try { await (d.notify ?? ((n) => notify(n, { env: d.env, ...(d.notifyExec ? { exec: d.notifyExec } : {}) })))(note); } catch { /* notification bulkhead */ }
  }
  for (const p of (result.prepared ?? []).filter(p => !p.disk)) emit(run, state, "agent.working", { role: AGENT_TYPE[p.unit.kind], model: p.cell.model, unit: p.unit.id });
  const anyGrant = (result.prepared ?? []).some(p => !p.disk) || (result.g2 ?? 0) > 0;
  const admit = result.lastDecision ? { decision: anyGrant ? "grant" : "wait", motivo_limite: result.lastDecision.motivo_limite } : null;
  if (admit) emit(run, state, "admit.decision", { ...admit, unit: result.prepared?.[0]?.unit.id ?? null });
  const units = (result.prepared ?? []).filter(p => !p.disk).map((p) => unitOutput(state, p));
  return { state: await fresh(run), units, admit, admissionBlocked: result.blocked ? motivoToWait(result.blocked) : null, g2Failed: result.g2Failed ?? [], g2Fails: result.g2Fails ?? {}, diskBlocked: result.diskBlocked === true };
}

/** Phase 1 of a dispatch round (mutex): one admission decision per candidate, a token per granted unit, units -> admitted. */
async function admitPhase(run, ctx, { g2, list, reservations, hostHeld, signals, params, diskFreeGib, existing, reactive }) {
  const { d } = run;
  const s = await ctx.readState();
  if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
  const adm = admissionCtx(run);
  const history = d.admission.readHistory(adm);
  const prior = run.recorded && signals.value ? history.slice(0, -1) : history;
  const live = { B: s.units.filter(isLive).length, H: hostHeld, R: s.units.filter((u) => isLive(u) && REVIEW_TYPE_KINDS.includes(u.kind)).length };
  const res = [...reservations];
  const base = { signals: signals.value, history: prior, reservations: res, step: run.reading?.step ?? d.admission.readAdaptive(adm).step, caps: { kOwner: params.k ?? undefined, kReactive: reactive?.kReactive, kReactiveReason: reactive?.kReactiveReason }, runtimeShape: shapeOf(s), nowMs: nowMs(d) };
  const events = [];
  const grants = [];
  const g2Grants = [];
  const granted = new Set();
  let lastDecision = null;
  let blocked = null;
  let diskBlocked = false;
  let diskLeft = diskFreeGib;
  const disk = (needsWorktree) => d.admission.diskDecision({ project: run.ref.project, freeGib: diskLeft, needsWorktree });
  const admitEvent = (unitId, decision, cls) => {
    events.push({ type: "admit", data: { unit: unitId, class: cls, decision: decision.grant ? "grant" : "wait", motivo_limite: decision.motivo_limite, techo: decision.techo, suelo: decision.suelo, A_ef: decision.A_ef, P: decision.P, signals: signals.value, safe_mode: decision.safe_mode === true } });
  };
  for (let i = 0; i < g2.length; i++) {
    let decision = d.admission.decide({ ...base, live, heavyQueued: g2.length - i, readyWidth: list.length, want: "H" });
    lastDecision = decision;
    if (decision.grant === "H" && !disk(true).ok) { diskBlocked = true; decision = { ...decision, grant: null, motivo_limite: "disco" }; lastDecision = decision; }
    admitEvent(`g2-${g2[i]}`, decision, "H");
    if (decision.grant !== "H") { blocked = decision.motivo_limite; break; }
    diskLeft -= d.admission.ADMISSION.WT_NEED_GIB;
    g2Grants.push(g2[i]);
    live.H += 1;
    res.push({ class: "H", origin: "cli", started_ms: nowMs(d), rss_gib: 0 });
  }
  const heavyLeft = g2.length - g2Grants.length;
  let units = s.units;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (granted.has(c.unit.id)) continue;
    const cur = findUnit(s, c.unit.id);
    const eligible = cur && (cur.state === "queued" || c.resume && cur.state === "suspended") && (!cur.parked || isAssumed(cur) || (c.unit.kind === "review" && cur.parked === "no_reviewer"));
    if (!eligible) continue;
    let decision = d.admission.decide({ ...base, live, heavyQueued: heavyLeft, readyWidth: list.length - i, want: "B", candidate: REVIEW_TYPE_KINDS.includes(c.unit.kind) ? "reviewer" : "builder" });
    lastDecision = decision;
    const needsWorktree = !c.resume && !existing.has(c.unit.id);
    if (decision.grant === "B" && !disk(needsWorktree).ok) { diskBlocked = true; decision = { ...decision, grant: null, motivo_limite: "disco" }; lastDecision = decision; }
    admitEvent(c.unit.id, decision, "B");
    if (decision.grant !== "B") { blocked = blocked ?? decision.motivo_limite; if (decision.motivo_limite === "disco") continue; break; }
    if (needsWorktree) diskLeft -= d.admission.ADMISSION.WT_NEED_GIB;
    if (c.capacity) logCapacityDecision(c.task, c.capacity, { env: d.env, log: run.paths.capacityDecisionsFile, now: reactive?.now });
    const issued = c.resume ? { token: null, token_hash: cur.token_hash } : d.admission.issueToken(c.unit.id, "B", adm);
    granted.add(c.unit.id);
    grants.push({ ...c, unit: { ...cur, ...(c.unit.kind === "review" ? { parked: null } : {}) }, token: issued.token, token_hash: issued.token_hash });
    events.push(unitEvent(c.unit.id, cur.state, "admitted"));
    units = units.map((u) => (u.id === c.unit.id ? { ...u, state: "admitted", parked: isAssumed(u) ? u.parked : null, token_hash: issued.token_hash } : u));
    live.B += 1;
    if (REVIEW_TYPE_KINDS.includes(c.unit.kind)) live.R += 1;
    res.push(c.via === "cli" ? { class: "B", origin: "cli", runtime: "codex", started_ms: nowMs(d), rss_gib: 0 } : { class: "B", origin: "agent", started_ms: nowMs(d) });
  }
  for (const ev of events) await ctx.appendEvent(ev);
  if (grants.length) await ctx.writeState({ ...s, units });
  return { grants, g2Grants, blocked, lastDecision, diskBlocked, notifyDisk: (diskBlocked || diskFreeGib >= d.admission.ADMISSION.DISK_FLOOR_GIB + d.admission.ADMISSION.WT_NEED_GIB) ? d.admission.recordDiskWait(diskBlocked, adm) : false };
}

/** Work of a dispatch round (no mutex): WO IN_PROGRESS on lane/<run_id>, unit worktree, brief, Codex launch, G2 jobs. */
async function launchPhase(run, intent) {
  const { d, ref } = run;
  if (!intent.grants.length && !intent.g2Grants.length) return { prepared: [] };
  const current = await fresh(run);
  const prepared = [];
  for (const g of intent.grants) prepared.push(await prepareGrant(run, current, g));
  // Each G2 judges its own detached snapshot of the integration tip (B5): never the integration worktree that later
  // merges move, never a directory another G2 uses. A snapshot that cannot be made skips this G2 (retried next pass).
  let g2 = 0;
  const g2Failed = [];
  const g2Ok = [];
  for (const frd of intent.g2Grants) {
    let snap;
    try { snap = await createG2Snapshot(run, current, frd); } catch (error) {
      d.log(`next: G2 of ${frd} not started, its snapshot could not be created: ${error?.message ?? error}`);
      g2Failed.push(frd);
      continue;
    }
    try {
      await (await sibling(d, "jobs", "startJob"))({
        project: ref.project, epoch: ref.epoch, actor: ref.actor, kind: "g2",
        cmd: ["bash", "-c", G2_SCRIPT, "pandacorp-g2", current.integration.base_sha], cwd: snap.cwd, frd, unit: null,
      }, d);
    } catch (error) {
      await removeG2Snapshot(run, snap.dir);
      throw error;
    }
    g2 += 1;
    g2Ok.push(frd);
  }
  const g2Fails = await trackG2SnapshotFailures(run, g2Ok, g2Failed);
  return { prepared, g2, g2Failed, g2Fails, diskBlocked: intent.diskBlocked || prepared.some(p => p.disk) };
}

/** Phase 2 of a dispatch round (mutex, epoch re-verified): admitted -> running, dispatch journal, worker jobs. */
async function recordPhase(run, work, intent, ctx, quota) {
  const { d } = run;
  if (!work.prepared.length) return { ...intent, ...work };
  const s = await ctx.readState();
  const events = [];
  let units = s.units;
  let jobs = s.jobs;
  const quotaAtUnit = { ...s.quota_at_unit };
  const startQuota = { claude: quota.out.claude.pct, codex: quota.out.codex.pct, at: nowIsoOf(d) };
  for (const p of work.prepared) {
    const cur = findUnit(s, p.unit.id);
    if (!cur || cur.state !== "admitted" || cur.token_hash !== p.token_hash) throw err("INVALID_STATE", `unit ${p.unit.id} changed during dispatch`, { hint: "rebuild-state" });
    if (p.disk) {
      releaseToken(cur.id, admissionCtx(run));
      units = units.map(u => u.id === cur.id ? { ...u, state: "queued", token_hash: null, worker: null } : u);
      events.push(unitEvent(cur.id, "admitted", "queued"));
      continue;
    }
    const worker = { ...p.cell, via: p.via, pid: p.launched?.pid ?? null, worker_id: p.launched?.workerId ?? null };
    if (p.resume) {
      Object.assign(worker, cur.worker, { pid: p.launched?.pid ?? null });
      capacityAudit(run.ref.project, s, "resumed", { unit: cur.id, reason: cur.suspension.reason, resumeAt: cur.suspension.resumeAt, cell: pinOf(cur) }, d);
    }
    const pin = { tool: p.cell.runtime, model: p.cell.model, effort: p.cell.effort };
    units = units.map((u) => (u.id === cur.id ? { ...u, state: "running", worker, pin, ...(p.resume ? {} : { suspension: null }), worktree: p.worktree, branch: p.branch } : u));
    events.push(unitEvent(cur.id, "admitted", "running"));
    events.push({ type: "unit_dispatched", data: { unit: cur.id, cell: p.cell, via: p.via, worktree: p.worktree, branch: p.branch, token_hash: p.token_hash, worker_id: worker.worker_id, pid: worker.pid, resume: p.resume === true, ...(worker.session_id ? { session_id: worker.session_id } : {}) } });
    if (p.launched) {
      const job = { ...p.launched.job, kind: "worker", unit: cur.id, h_slot: false, state: "running", exit: null, worker_id: p.launched.workerId };
      jobs = [...jobs.filter((j) => j.id !== job.id), job];
      events.push({ type: "job_started", data: job });
    }
    quotaAtUnit[cur.id] = { ...(quotaAtUnit[cur.id] ?? {}), start: startQuota };
  }
  for (const ev of events) await ctx.appendEvent(ev);
  await ctx.writeState({ ...s, units, jobs, quota_at_unit: quotaAtUnit });
  return { ...intent, ...work };
}

/** Work phase of one granted unit: WO IN_PROGRESS commit, unit worktree, brief (with the token), Codex launch for `via:"cli"`. */
async function prepareGrant(run, current, g) {
  const { d, ref, paths } = run;
  const unit = findUnit(current, g.unit.id);
  const files = unitFiles(paths, unit, g.via);
  const slug = g.via === "cli" ? (g.consult?.model_slug ?? (g.cell.runtime === "codex" ? d.routing.modelSlug(g.cell, routingDeps(d)) : g.cell.model)) : null;
  if (g.resume) {
    if (g.via !== "cli" && !unit.worker.session_id) throw err("INVALID_STATE", `native continuation ${unit.id} has no saved session id`);
    const launched = g.via === "cli" ? await (await sibling(d, "workers", "resumeWorker"))({
      project: ref.project, workerId: unit.worker.worker_id, unit: unit.id, frd: unit.frd,
      cell: g.cell, dir: unit.worktree, sequence: unit.suspension.sequence,
    }, d) : null;
    if (g.via === "cli" && !launched?.ok) throw err("ENGINE_FAILURE", `could not resume ${unit.id}: ${launched?.detail ?? "unknown worker"}`);
    return { ...g, unit, slug, worktree: unit.worktree, branch: unit.branch, files, launched };
  }
  let worktree = null;
  let branch = null;
  if (unit.kind !== "doubt-consult") {
    const gateFailure = unit.kind === "patch" ? await readJson(path.join(paths.unitDir(unit.id), "gate-failure.json"), { fs: d.fs }) : null;
    if (["build", "patch"].includes(unit.kind) && unit.wos.length && gateFailure?.attributed !== false) {
      await (await sibling(d, "integrate", "transitionWorkOrders"))({ integration: current.integration, runId: current.run_id, wos: unit.wos, to: "IN_PROGRESS", reason: "dispatch", unitId: unit.id }, { ...d, project: ref.project });
    }
    // Work built on an assumption forks from (and integrates into) lane/<run_id>/assume-<doubt> (BUILD-12).
    const base = isAssumed(unit) ? paths.assumeBranch(current.run_id, unit.pending_answer) : undefined;
    const wt = await (await sibling(d, "units", "prepareUnitWorktree"))({ project: ref.project, runId: current.run_id, unit: unit.id, attempt: unit.attempt, ...(base ? { base } : {}) }, d);
    worktree = wt?.worktree ?? null;
    branch = wt?.branch ?? null;
    if (wt?.bootstrap?.exit === 4) return { ...g, unit, worktree, branch, disk: true };
    // BL-0323: a review judges exactly the end of its diff range; a reused checkout is moved there and verified.
    if (["review", "deferred-review"].includes(unit.kind) && worktree) {
      const range = await reviewRangeOf(run, current, { ...g, unit });
      await (await sibling(d, "units", "pinReviewWorktree"))({ project: ref.project, runId: current.run_id, worktree, sha: range.split("..")[1] }, d);
      g = { ...g, review: { ...g.review, pinned_range: range } };
    }
  }
  let briefPath = g.consult?.brief_path ?? null;
  if (!briefPath) {
    const brief = await (await sibling(d, "units", "writeUnitBrief"))({
      project: ref.project, state: current, unit: { ...unit, worktree }, cell: g.cell, agentType: AGENT_TYPE[unit.kind], token: g.token,
      schemaPath: files.schema_path, worktree, reportPath: files.report_path, extra: await briefExtra(run, current, g),
    }, d);
    briefPath = brief?.brief_path ?? paths.briefFile(unit.id);
  }
  let launched = null;
  if (g.via === "cli") {
    const dir = worktree ?? await integrationProductRoot(run, current);
    const res = await (await sibling(d, "workers", "launchWorker"))({
      project: ref.project, runId: current.run_id, unit: unit.id, attempt: unit.attempt, frd: unit.frd ?? null,
      cell: g.cell, schemaFile: files.schema_path || null, dir, briefFile: briefPath, dispatch: dispatchOf(g.token_hash),
    }, d);
    if (!res?.ok) throw err("ENGINE_FAILURE", `the Codex worker of ${unit.id} did not start (${res?.kind ?? "unknown"}): ${res?.detail ?? ""}`);
    launched = res;
  }
  return { ...g, unit, slug, worktree, branch, files: { ...files, brief_path: briefPath }, launched };
}

/** The diff range a review-type grant judges: its deferred ledger entry's range, else the computed one. */
async function reviewRangeOf(run, state, g) {
  const entry = g.review?.deferred_entry ? (await readDeferred(run.ref.project, run.d)).find((e) => e.id === g.review.deferred_entry) : null;
  return entry?.sha_range ?? await reviewRange({ state, review: g.unit }, run.d);
}

/** Extra brief sections: the review routing facts, and the default each pending reversible answer runs on (D19). */
async function briefExtra(run, state, g) {
  const extra = {};
  if (g.review || g.unit.kind === "audit") {
    const { pinned_range: pinned, ...review } = g.review ?? {};
    extra.review = { ...review, range: pinned ?? await reviewRangeOf(run, state, g), scopeLens: Boolean(state.scope?.card) };
  }
  if (g.pendingDefault) {
    const q = (await readQuestions(run)).get(g.pendingDefault);
    extra.decision = { question: g.pendingDefault, default_es: q?.default_es ?? null, default_action: q?.default_action ?? null, provisional: true };
  }
  if (g.unit.kind === "doubt-consult") extra.doubt = { id: g.unit.doubt_id };
  // The owner's recorded answers that concern the unit (the gate OK of `g-<unit>`, answered first-minute asks): CLI 3.13.
  const notes = (await sibling(run.d, "answers", "answerNotes"))(state, g.unit, { questions: await readQuestions(run) });
  if (["review", "deferred-review", "audit"].includes(g.unit.kind)) notes.push("Owner policy DR-162 supersedes historical cross-company/N7 paragraphs in the role file: review in a fresh independent context, even on the author's model/company. Keep the allocated cell and effort; same-model/capacity fallback is not degraded and owes no mandatory cross-company re-review. Never inherit the author's conversation.");
  if (notes.length) extra.notes = notes;
  return extra;
}

function unitFiles(paths, unit, via) {
  const reviewType = ["review", "audit", "deferred-review"].includes(unit.kind);
  const consult = unit.kind === "doubt-consult";
  return {
    brief_path: paths.briefFile(unit.id),
    report_path: consult ? paths.unitAnswerFile(unit.id) : reviewType ? paths.reviewFile(unit.id) : paths.reportFile(unit.id),
    schema_path: consult ? (via === "cli" ? paths.schemaFile("doubt-answer") : "") : paths.schemaFile(reviewType ? "review-report" : "report"),
  };
}

function unitOutput(state, p) {
  const u = p.unit;
  return {
    unit: u.id, kind: u.kind, attempt: u.attempt, token: p.token,
    runtime: p.cell.runtime, model: p.cell.model, model_slug: p.via === "cli" ? p.slug : null, effort: p.cell.effort ?? null,
    budget_calls: u.kind === "review" && state.size === "touch" ? 10 : null,
    worktree: p.worktree, brief_path: p.files.brief_path, report_path: p.files.report_path, schema_path: p.files.schema_path,
    agent_type: AGENT_TYPE[u.kind], via: p.via, dispatch_line: dispatchLine(u, p.cell, p.slug),
    ...(p.resume ? { resume: true, session_id: u.worker?.session_id ?? null, worker_id: u.worker?.worker_id ?? null } : {}),
  };
}

/** The one-line Spanish announcement of a dispatch (no dashes; the middle dot is the separator). */
export function dispatchLine(unit, cell, slug = null) {
  const who = cell.runtime === "codex" ? `Codex ${slug ?? cell.model}` : `Claude ${cell.model}`;
  const target = unit.kind === "audit" ? "la corrida"
    : unit.kind === "doubt-consult" ? (unit.doubt_id ?? unit.id)
      : ["review", "deferred-review"].includes(unit.kind) && unit.frd ? unit.frd.toUpperCase()
        : unit.wos?.length ? unit.wos.map((w) => String(w).toUpperCase()).join(", ") : (unit.frd ?? unit.id).toUpperCase();
  return `→ ${who} · ${cell.effort ?? "sesión"} · ${VERB_ES[unit.kind] ?? unit.kind} ${target}`;
}

/** Telemetry is a bulkhead: emitted in the background to the coordinator company's events file, never fatal. */
function emit(run, state, name, data) {
  const runtime = run.leaseRuntime ?? (state.coordinator === "codex-session" ? "codex" : "claude");
  Promise.resolve()
    .then(async () => (await sibling(run.d, "telemetry", "emitEvent"))(run.ref.project, { runtime, runId: state.run_id, name, data }, run.d))
    .catch((error) => run.d.log(`next: telemetry ${name} failed: ${error?.message ?? error}`));
}
