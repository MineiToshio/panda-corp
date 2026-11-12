// (6) Candidates and cells: the ordered dispatch candidates (deferred reviews, consults, FRD reviews, the audit, then
// the planner's ready units) with the routing cell each one runs on.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { findUnit } from "../state.mjs";
import { FRD_WORK_KINDS, PLANNED_KINDS } from "./constants.mjs";
import { availabilityOf, cellOf, err, integrationProductRoot, isAssumed, mutate, routingDeps, shapeOf, sibling } from "./context.mjs";
import { deferredUnitId } from "./planning.mjs";
import { depsMet, inScope } from "./scope.mjs";

/** reopen_count per WO id (lowercase), from the integration worktree frontmatter. */
async function readReopenCounts(root, fs = fsp) {
  const out = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds = [];
  try { frds = await fs.readdir(frdsDir); } catch (error) { if (error.code === "ENOENT") return out; throw error; }
  for (const frd of frds) {
    let names = [];
    try { names = await fs.readdir(path.join(frdsDir, frd, "work-orders")); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const name of names.filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md")) {
      const text = await fs.readFile(path.join(frdsDir, frd, "work-orders", name), "utf8");
      const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const id = (block.match(/^id:[ \t]*["']?([^"'\s]+)/m)?.[1] ?? name.replace(/\.md$/, "")).toLowerCase();
      const reopen = Number(block.match(/^reopen_count:[ \t]*(\d+)/m)?.[1] ?? 0);
      out.set(id, reopen);
      // A WO file is usually named `<id>-<slug>.md`: index the id prefix too.
      const prefix = name.match(/^(wo-\d+-\d+)/i)?.[1]?.toLowerCase();
      if (prefix && !out.has(prefix)) out.set(prefix, reopen);
    }
  }
  return out;
}

const authorOf = (worker) => ({ runtime: worker.runtime, model: worker.model, effort: worker.effort, origin: worker.via === "session" ? "session" : "unit", via: worker.via });

/**
 * Ordered dispatch candidates with their cells: deferred reviews, doubt consults, FRD reviews, the audit, then the
 * planner's ready build-type units (tests units first; units on a reversible pending answer last).
 */
export async function buildCandidates(run, state, pol, plan, params, deferredEntries) {
  const { d } = run;
  const ctx = { label: state.label, quota: pol, shape: shapeOf(state), coordinator: state.coordinator, sessionModel: params.sessionModel };
  const avail = availabilityOf(pol);
  const out = [];
  let quotaBlocked = false;
  const toParkNoReviewer = [];
  const toUnpark = [];
  const queued = (u) => u.state === "queued" && (!u.parked || isAssumed(u)) && inScope(state, u);

  for (const u of state.units.filter((x) => x.kind === "deferred-review" && queued(x))) {
    const entry = deferredEntries.find((e) => deferredUnitId(e.id) === u.id);
    if (!entry) continue;
    const cell = entry.kind === "audit"
      ? d.routing.builderCell({ kind: "audit", size: state.size, zone: u.zone, attempt: 1 }, { ...ctx, zone: u.zone, attempt: 1, sessionModel: null }, routingDeps(d))
      : d.routing.reviewCell({ authors: [entry.author], kind: state.size === "touch" ? "touch" : "frd", zone: u.zone, availability: avail, shape: ctx.shape }, routingDeps(d)).used;
    if (!cell || cell.deferred || cell.paused || cell.runtime !== entry.needed) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: viaOf(cell), review: { deferred_entry: entry.id } });
  }

  // A consult is dispatched exactly once, with the cell, via and brief its doubt record announced (CLI 3.12).
  for (const u of state.units.filter((x) => x.kind === "doubt-consult" && queued(x))) {
    const consult = await (await sibling(d, "doubts", "pendingConsult"))(run.ref.project, u, d);
    if (!consult || typeof consult.runtime !== "string" || typeof consult.model !== "string" || !["agent", "cli"].includes(consult.via)) {
      throw err("INVALID_STATE", `consult unit ${u.id} has no consult in its doubt record`, { hint: "rebuild-state" });
    }
    if (consult.answered) continue;
    out.push({ unit: u, cell: { runtime: consult.runtime, model: consult.model, effort: consult.effort ?? null }, via: consult.via, consult });
  }

  for (const u of state.units.filter((x) => x.kind === "review" && (queued(x) || x.parked === "no_reviewer") && inScope(state, x))) {
    const work = state.units.filter((x) => FRD_WORK_KINDS.includes(x.kind) && x.frd === u.frd && x.state !== "blocked");
    if (!work.length || !work.every((x) => x.state === "reviewing")) continue;
    const authors = dedupeCells(work.filter((x) => x.worker).map((x) => authorOf(x.worker)));
    if (!authors.length) throw err("INVALID_STATE", `review ${u.id}: no author cell among its units`, { hint: "rebuild-state" });
    const rc = d.routing.reviewCell({ authors, kind: state.size === "touch" ? "touch" : "frd", zone: u.zone, availability: avail, shape: ctx.shape }, routingDeps(d));
    if (rc.parked) { if (u.parked !== "no_reviewer") toParkNoReviewer.push(u.id); continue; }
    if (u.parked === "no_reviewer") toUnpark.push(u.id);
    out.push({ unit: { ...u, parked: null, state: "queued" }, cell: cellOnly(rc.used), via: viaOf(rc.used), review: { primary: rc.primary, degraded: rc.degraded, deferred: rc.deferred } });
  }

  for (const u of state.units.filter((x) => x.kind === "audit" && queued(x))) {
    const cell = d.routing.builderCell({ kind: "audit", size: state.size, zone: u.zone, attempt: u.attempt }, { ...ctx, zone: u.zone, attempt: u.attempt, sessionModel: null }, routingDeps(d));
    if (cell.paused || cell.deferred) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: cell.via });
  }

  const readyIds = new Set(plan.ready);
  const planned = plan.ready.map((id) => findUnit(state, id)).filter((u) => u && PLANNED_KINDS.includes(u.kind) && queued(u) && readyIds.has(u.id) && depsMet(state, u));
  const ordered = [...planned.filter((u) => u.kind === "tests"), ...planned.filter((u) => u.kind !== "tests")];
  const last = ordered.filter((u) => u.pending_answer && !(u.pending_answer in state.answers));
  const first = ordered.filter((u) => !last.includes(u));
  const reopen = ordered.some((u) => u.kind === "build" || u.kind === "patch") ? await readReopenCounts(await integrationProductRoot(run, state), d.fs) : new Map();
  for (const u of [...first, ...last]) {
    const reopenCount = Math.max(0, ...u.wos.map((w) => reopen.get(String(w).toLowerCase()) ?? 0));
    const previousCell = u.attempt > 1 ? cellOf(u.worker) : null;
    const cell = d.routing.builderCell({ kind: u.kind, size: state.size, zone: u.zone, attempt: u.attempt }, { ...ctx, zone: u.zone, attempt: u.attempt, reopen_count: reopenCount, previousCell }, routingDeps(d));
    if (cell.paused || cell.deferred) { quotaBlocked = true; continue; }
    out.push({ unit: u, cell: cellOnly(cell), via: cell.via, pendingDefault: last.includes(u) && !isAssumed(u) ? u.pending_answer : null });
  }

  let next = state;
  if (toParkNoReviewer.length || toUnpark.length) {
    next = await mutate(run, (s) => {
      const events = [];
      const units = s.units.map((u) => {
        if (toParkNoReviewer.includes(u.id) && u.parked !== "no_reviewer") { events.push({ type: "parked", data: { unit: u.id, reason: "no_reviewer", question: null } }); return { ...u, parked: "no_reviewer" }; }
        if (toUnpark.includes(u.id) && u.parked === "no_reviewer") { events.push({ type: "parked", data: { unit: u.id, reason: null, question: null } }); return { ...u, parked: null }; }
        return u;
      });
      return events.length ? { state: { ...s, units }, events } : {};
    });
  }
  return { list: out, quotaBlocked, state: next };
}

const cellOnly = (c) => ({ runtime: c.runtime, model: c.model, effort: c.effort ?? null });
const viaOf = (c) => (c.via ?? (c.runtime === "codex" ? "cli" : "agent"));
function dedupeCells(cells) {
  const seen = new Set();
  return cells.filter((c) => { const key = `${c.runtime}/${c.model}/${c.effort}/${c.origin}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
