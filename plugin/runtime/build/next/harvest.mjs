// (1) Harvest: finished CLI workers (reports, reviews, consult answers, limits), G2 verdicts pinned to their snapshot
// sha (B5) and the land job; a refused report is routed, never swallowed.
import { atomicWriteJson, readJson } from "../fsx.mjs";
import { readJournal } from "../journal.mjs";
import { REVIEW_TYPE_KINDS, findUnit, newUnit } from "../state.mjs";
import { ENV_WORKER_OUTCOMES, FRD_WORK_KINDS, G2_BOOTSTRAP_EXIT, MAX_ATTEMPTS, PLANNED_KINDS, SETTLED_OUTCOME_CODES } from "./constants.mjs";
import { admissionCtx, cellOf, err, fenceOf, fresh, gitOk, isLive, maxZone, mutate, sibling, unionWos, unitEvent } from "./context.mjs";
import { g2PinOf, removeG2Snapshot } from "./g2.mjs";
import { reviewZone } from "./landing.mjs";

export async function harvest(run, state, notes) {
  for (const job of state.jobs.filter((j) => j.state === "running")) {
    if (job.kind === "worker") await harvestWorker(run, job, notes);
    else if (job.kind === "g2") await harvestG2(run, job, notes);
  }
  if (state.jobs.some((j) => j.kind === "land" && j.state === "running")) await harvestLand(run, notes);
}

async function finishJob(run, job, { state: jobState, exit }) {
  await mutate(run, (s) => {
    const cur = s.jobs.find((j) => j.id === job.id);
    if (!cur || cur.state !== "running") return {};
    return {
      state: { ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, state: jobState, exit: exit ?? null } : j)) },
      events: [{ type: "job_finished", data: { id: job.id, state: jobState, exit: exit ?? null } }],
    };
  });
}

/** One CLI-launched worker (`via:"cli"`): poll it with `read`; a sealed result is ingested like a session report. */
async function harvestWorker(run, job, notes) {
  const { d, ref, paths } = run;
  const state0 = await fresh(run);
  const unit0 = findUnit(state0, job.unit);
  const reviewType = unit0 ? REVIEW_TYPE_KINDS.includes(unit0.kind) && unit0.kind !== "doubt-consult" : false;
  const consult = unit0?.kind === "doubt-consult";
  const reportFile = !unit0 ? null : consult ? paths.unitAnswerFile(unit0.id) : reviewType ? paths.reviewFile(unit0.id) : paths.reportFile(unit0.id);
  const schemaFile = !unit0 ? null : paths.schemaFile(consult ? "doubt-answer" : reviewType ? "review-report" : "report");
  const h = await (await sibling(d, "workers", "pollWorker"))({ project: ref.project, workerId: job.worker_id, unit: job.unit, schemaFile, reportFile, epoch: ref.epoch }, d);
  if (!["running", "done", "error"].includes(h?.state)) throw err("ENGINE_FAILURE", `workers.pollWorker returned no worker state for ${job.worker_id}`);
  if (h.state === "running") return;
  if (h.state === "error") {
    // The `read` itself failed (timeout, unreadable seal): the worker is not settled; the next pass polls again.
    d.log(`next: worker ${job.worker_id} could not be read (${h.kind ?? "error"}): ${h.detail ?? ""}`);
    return;
  }
  const state = await fresh(run);
  const unit = findUnit(state, job.unit);
  const jobEnd = { state: h.outcome === "worker_error" && h.kind === "dead" ? "dead" : "done", exit: Number.isInteger(h.exit) ? h.exit : null };
  if (!unit || !isLive(unit)) return finishJob(run, job, jobEnd);

  if (h.outcome === "limit") {
    await requeueAfterLimit(run, unit, job, jobEnd);
    notes.push(h.limit === "usage_limit" ? `Codex llegó a su límite de uso; ${unit.id} vuelve a la cola sin gastar intento.` : `Codex limitó la frecuencia; ${unit.id} vuelve a la cola sin gastar intento.`);
    return;
  }
  if (consult) {
    if (h.outcome === "report" && h.report && typeof h.report === "object") await atomicWriteJson(reportFile, { ...h.report, consulted: cellOf(unit.worker) }, { fs: d.fs });
    else await atomicWriteJson(reportFile, { decision: null, rationale: "consultant returned no answer", consulted: cellOf(unit.worker), confidence: "low", reversible: false }, { fs: d.fs });
    await settle(run, unit.id, async () => (await sibling(d, "doubts", "answerDoubt"))({ ...fenceOf(run), id: unit.doubt_id, file: reportFile, token: null }, d));
    return finishJob(run, job, jobEnd);
  }
  if (h.outcome !== "report" || !h.report || typeof h.report !== "object") {
    const cause = ENV_WORKER_OUTCOMES.includes(h.outcome) ? "env-infra" : "code";
    await finishJob(run, job, jobEnd);
    // A failed execution, not a hand-back: the D21 policy decides (attempt 1 -> attempt 2 on the same unit).
    const detail = `el worker de Codex no entregó un informe válido (${h.outcome ?? "?"}${h.kind ? `: ${h.kind}` : ""})${h.detail ? `: ${String(h.detail).slice(0, 300)}` : ""}`;
    await (await sibling(d, "failure", "failUnit"))({ ...fenceOf(run), unit: unit.id, attempt: unit.attempt, cause, detail, command: null, tail: String(h.detail ?? "") }, d);
    return;
  }
  if (!h.reportFile) await atomicWriteJson(reportFile, h.report, { fs: d.fs });
  await finishJob(run, job, jobEnd);
  const call = reviewType ? await sibling(d, "review", "reviewRecord") : await sibling(d, "report", "ingestReport");
  // A `via:"cli"` worker has no shell to run `doubt open`: the engine opens its doubt (B2). `openDoubt` asks the sibling to
  // do it right after settling; `openReportedDoubt` covers whatever is still `reported` without an open doubt.
  const res = await settle(run, unit.id, () => call({ ...fenceOf(run), unit: unit.id, token: typeof h.report.token === "string" ? h.report.token : "", file: reportFile, openDoubt: true }, d));
  notes.push(...doubtNotes(unit.id, res?.doubt_opened, res?.handback));
  await openReportedDoubt(run, unit.id, h.report, notes);
}

/** Open doubt-ladder steps (`doubt.schema.json` `step`); `parked` and `decided` are closed. */
const OPEN_DOUBT_STEPS = Object.freeze(["sources", "consult1", "consult2"]);

/**
 * A unit left `reported` by a worker or reviewer doubt with no open doubt record (B2): open it through
 * `failure.openUnitDoubt` (fenced; it hands the unit back when the doubt cannot be built or the ladder refuses it), so
 * the unit never stays `reported` for good. The doubt object is the report's own; a diagnosis-only report (a `blocked`
 * worker whose policy action was `doubt`/`dispute`) is synthesized from its diagnosis by failure.mjs.
 */
async function openReportedDoubt(run, unitId, report, notes) {
  const { d } = run;
  const unit = findUnit(await fresh(run), unitId);
  if (!unit || unit.state !== "reported") return;
  if (unit.doubt_id) {
    const record = await readJson(run.paths.doubtFile(unit.doubt_id), { fs: d.fs });
    if (record && OPEN_DOUBT_STEPS.includes(record.step)) return;
  }
  const doubt = report && typeof report.doubt === "object" && report.doubt !== null ? report.doubt : null;
  const diagnosis = report && typeof report.diagnosis === "object" && report.diagnosis !== null ? report.diagnosis : null;
  const opened = await (await sibling(d, "failure", "openUnitDoubt"))({ ...fenceOf(run), unit: unitId, doubt, diagnosis, actor: run.ref.actor }, d);
  if (opened?.opened === false) notes.push(...doubtNotes(unitId, null, opened.handback));
  else if (opened?.opened) notes.push(...doubtNotes(unitId, opened, null));
}

/** Owner-facing lines for a doubt the engine opened (or the hand-back that replaced it). */
function doubtNotes(unitId, opened, handback) {
  if (handback) return [handback.notice_es ?? `${unitId} se devuelve: su duda no se pudo abrir.`];
  if (!opened?.doubt_id || opened.applied === false) return [];
  if (opened.notice_es) return [opened.notice_es];
  if (opened.step === "sources") return [`${unitId} planteó la duda ${opened.doubt_id}: falta el paso de fuentes (doubt answer con el archivo ${opened.doubt_id}.sources.json).`];
  return [`${unitId} planteó la duda ${opened.doubt_id}: se consulta (${opened.step}).`];
}

// A sibling that rejects a report with a thrown exit-6/7 class code has usually settled the unit (a verdict recorded,
// the unit parked or re-queued). The exception is a refusal raised BEFORE anything was written (a rejected token, an
// invalid review report): the unit is then still live with its job already closed, and swallowing it would leave the
// unit running forever. Such a refusal is routed, never ignored: a unit the D21 policy can fail (docs, tests, build,
// patch) is failed through `failure.failUnit` (worker_failed, cause `code`); any other kind raises ENGINE_FAILURE.
// Fences and faults propagate.
async function settle(run, unitId, fn) {
  try { return await fn(); } catch (error) {
    if (!SETTLED_OUTCOME_CODES.includes(error?.code)) throw error;
    const unit = findUnit(await fresh(run), unitId);
    if (!unit || !isLive(unit)) return { settled: error.code };
    const detail = `el informe de ${unit.id} fue rechazado sin registrarse (${error.code}): ${String(error.message ?? "").slice(0, 300)}`;
    if (!PLANNED_KINDS.includes(unit.kind)) throw err("ENGINE_FAILURE", `next: ${detail}; the ${unit.kind} unit is still ${unit.state} and nothing settled it`, { cause: error });
    await (await sibling(run.d, "failure", "failUnit"))({ ...fenceOf(run), unit: unit.id, attempt: unit.attempt, cause: "code", detail, command: null, tail: String(error.message ?? "") }, run.d);
    return { refused: error.code, failed: unit.id };
  }
}

/** A usage or rate limit consumes no attempt: the unit returns to the queue with its token released (pollWorker already recorded the reading). */
async function requeueAfterLimit(run, unit, job, jobEnd) {
  const { d } = run;
  d.admission.releaseToken(unit.id, admissionCtx(run));
  await mutate(run, (s) => {
    const u = findUnit(s, unit.id);
    const events = [{ type: "job_finished", data: { id: job.id, state: jobEnd.state, exit: jobEnd.exit } }];
    let units = s.units;
    if (u && isLive(u)) {
      events.push(unitEvent(u.id, u.state, "queued"));
      // Same attempt, no previous cell: a limit consumes no attempt and must not raise the effort.
      units = s.units.map((x) => (x.id === u.id ? { ...x, state: "queued", token_hash: null, worker: null, worktree: null, branch: null } : x));
    }
    return { state: { ...s, units, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, ...jobEnd } : j)) }, events };
  });
}

/**
 * One finished G2 job. Its verdict belongs to the integration sha its snapshot was pinned at (B5): it applies to the FRD
 * units whose integrated sha is contained in that pin; when one of them is not (it was integrated after the pin), the
 * verdict is stale and dropped, and the G2 rule re-spawns the gate at the current tip. Merges of OTHER FRDs after the pin
 * never invalidate it. A job without a pin (spawned before snapshots) keeps the old rule. The snapshot is removed here.
 */
async function harvestG2(run, job, notes) {
  const { d, ref } = run;
  const polled = await (await sibling(d, "jobs", "pollJob"))(ref.project, job, d);
  if (!["running", "done", "dead"].includes(polled?.state)) throw err("ENGINE_FAILURE", `jobs.pollJob returned no job state for ${job.id}`);
  if (polled.state === "running") return;
  const exit = Number.isInteger(polled.exit) ? polled.exit : null;
  const judged = polled.state === "done" && exit !== null && exit !== G2_BOOTSTRAP_EXIT;
  const pin = g2PinOf(run.paths, job);
  const before = await fresh(run);
  const checked = judged && pin ? await staleCheck(run, before, job.frd, pin.sha) : { stale: false, units: null };
  const green = judged && !checked.stale && exit === 0;
  let handback = null;
  const zone = green ? await reviewZone(run, before, pin?.sha) : null;
  await mutate(run, (s) => {
    const cur = s.jobs.find((j) => j.id === job.id);
    if (!cur || cur.state !== "running") return {};
    const ended = polled.state === "dead" ? "dead" : "done";
    const events = [{ type: "job_finished", data: { id: job.id, state: ended, exit } }];
    let next = { ...s, jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, state: ended, exit } : j)) };
    const work = next.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === job.frd && u.state === "integrated");
    if (polled.state === "done" && exit === G2_BOOTSTRAP_EXIT) {
      // The snapshot could not be prepared: the environment failed, not the code (D21 env-infra hand-back, no patch).
      handback = work[0] ? { unit: work[0].id, reason: `G2 de ${job.frd} no pudo preparar su copia de trabajo (worktree-bootstrap.sh falló)`, cause: "env-infra" } : null;
      return { state: next, events };
    }
    if (!judged) return { state: next, events }; // dead: re-spawned by the G2 rule at this or the next pass
    const stale = checked.stale || (checked.units !== null && work.some((u) => !checked.units.includes(u.id)));
    events.push({ type: "gate", data: { tier: "G2", exit, frd: job.frd, ...(pin ? { sha: pin.sha } : {}), ...(stale ? { stale: true } : {}) } });
    if (stale) return { state: next, events }; // judged an older tree of this FRD: the G2 rule re-runs it at the tip
    if (green) {
      for (const u of work) events.push(unitEvent(u.id, u.state, "reviewing"));
      next = { ...next, units: next.units.map((u) => (work.includes(u) ? { ...u, state: "reviewing" } : u)) };
      const reviewId = `u-review-${job.frd}`;
      const existing = findUnit(next, reviewId);
      if (!existing) {
        const review = newUnit({ id: reviewId, kind: "review", frd: job.frd, wos: unionWos(work), zone: maxZone(work.map((u) => u.zone).concat(zone?.zone ?? "none")), risk_rules: zone?.rules ?? [] });
        next = { ...next, units: [...next.units, review] };
        events.push({ type: "unit_queued", data: review });
      } else if (existing.state === "verified") {
        // The FRD changed after its last pass (a G3 patch): the review re-runs.
        events.push(unitEvent(existing.id, existing.state, "queued"));
        next = { ...next, units: next.units.map((u) => (u.id === reviewId ? { ...u, state: "queued", token_hash: null } : u)) };
      }
      return { state: next, events };
    }
    const attempt = Math.max(0, ...work.map((u) => u.attempt)) + 1;
    if (attempt > MAX_ATTEMPTS || work.length === 0) {
      handback = work[0] ? { unit: work[0].id, reason: `G2 en rojo en ${job.frd} tras agotar los ${MAX_ATTEMPTS} intentos`, cause: "code" } : null;
      return { state: next, events };
    }
    const patchId = `u-patch-${job.frd}`;
    const existing = findUnit(next, patchId);
    if (existing) {
      events.push(unitEvent(patchId, existing.state, "queued"));
      next = { ...next, units: next.units.map((u) => (u.id === patchId ? { ...u, state: "queued", attempt, token_hash: null } : u)) };
    } else {
      const patch = newUnit({ id: patchId, kind: "patch", frd: job.frd, wos: unionWos(work), zone: maxZone(work.map((u) => u.zone)), attempt });
      next = { ...next, units: [...next.units, patch] };
      events.push({ type: "unit_queued", data: patch });
    }
    return { state: next, events };
  });
  if (pin) await removeG2Snapshot(run, pin.dir);
  if (handback) await (await sibling(d, "failure", "handbackCommand"))({ ...fenceOf(run), ...handback }, d);
  if (checked.stale) notes.push(`G2 de ${job.frd} juzgó ${pin.sha.slice(0, 12)}, pero el FRD cambió después: se repite sobre la rama actual.`);
  else if (judged && exit !== 0) notes.push(`G2 en rojo en ${job.frd}: se encola una corrección.`);
}

/**
 * Is a G2 verdict pinned at `pin` stale for `frd`? Stale iff an integrated unit of the FRD has an `integrated` journal sha
 * that is not contained in `pin` (pure sha comparison, B5). Returns the unit ids it checked so the harvest can treat a
 * unit integrated in between as stale too.
 */
async function staleCheck(run, state, frd, pin) {
  const units = state.units.filter((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === frd && u.state === "integrated");
  const shaOf = new Map();
  for (const ev of (await readJournal(run.paths.journalFile, run.d)).events) {
    if (ev.type === "integrated" && typeof ev.data?.unit === "string" && typeof ev.data.sha === "string") shaOf.set(ev.data.unit, ev.data.sha);
  }
  for (const u of units) {
    const sha = shaOf.get(u.id);
    if (sha && sha !== pin && !(await gitOk(run.ref.project, ["merge-base", "--is-ancestor", sha, pin]))) return { stale: true, units: units.map((x) => x.id) };
  }
  return { stale: false, units: units.map((x) => x.id) };
}

/** The land job is harvested by land.mjs itself (job_finished, D24 exit map, card archive) under its own fence. */
async function harvestLand(run, notes) {
  const { d, ref } = run;
  const res = await (await sibling(d, "land", "harvestLand"))({ project: ref.project, epoch: ref.epoch, actor: ref.actor }, d);
  if (res?.harvested && res.output?.notes_es) notes.push(...res.output.notes_es);
}
