// review-record verdict effects: hand the reviewed units back, file the bug card of a grave deferred review, and the reopen patch unit.
import { createCard } from "../card.mjs";
import { handBack as failureHandBack } from "../failure.mjs";
import { defaultExec } from "../fsx.mjs";
import { findUnit, newUnit } from "../state.mjs";
import { BLOCKING_SEVERITIES, REVIEWED_FROM, err, unique } from "./common.mjs";
import { commitStaged, stageTrackedChanges } from "./git.mjs";
import { pickReopenWos, scanWorkOrders } from "./workOrders.mjs";

/**
 * Hand the reviewed units back through the one real hand-back (failure.mjs `handBack`: `handback/<unit>.md`, the pending
 * `decisions.md` entry, WO `BLOCKED` + a commit, the unit and every non-terminal dependent `blocked`, R4). `handBack`
 * works on the ctx's state, but review phase 2 keeps its own working copy (`next`) and writes it once at the end, so the
 * ctx handed to `handBack` is a view over that copy: it reads `next`, applies the plan's unit changes to it in place
 * (the review unit's own state is review's to set) and collects the plan's events into `events`.
 * @param {{ctx: object, next: object, events: object[], review: object, units: object[], reason: string, reasonCode: string, findings: object[], cause: string, effects: {handed_back: string[]}, deps: object}} c
 *   `deps.handback` replaces `failure.handBack` (same `(ctx, input, deps)` shape)
 */
export async function handBackReviewed(c) {
  const { ctx, next, events, review, units, reason, reasonCode, cause, findings, effects, deps } = c;
  const handBack = deps.handback ?? failureHandBack;
  const view = {
    ...ctx,
    readState: async () => next,
    writeState: async (plan) => {
      for (const u of plan.units) if (u.id !== review.id) Object.assign(findUnit(next, u.id), u);
      next.handbacks_in_a_row = plan.handbacks_in_a_row;
    },
    appendEvent: async (event) => { if (!(event.type === "unit_state" && event.data?.unit === review.id)) events.push(event); },
  };
  const tail = findings.map((f) => `[${f.severity}] ${f.file}${f.line === null ? "" : `:${f.line}`}: ${f.summary}`).join("\n");
  for (const u of units) {
    await handBack(view, { unitId: u.id, cause, reasonCode, reason, failure: { command: null, tail } }, deps);
    effects.handed_back.push(u.id);
  }
}

// The card check demands a quoted citation in every Dentro item; the finding summary is the quote.
const quote = (text) => String(text).replace(/["\r\n]+/g, " ").trim();
const slugify = (s) => String(s ?? "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

export async function fileBugCard(project, entry, review, report, deps) {
  const grave = report.findings.filter((f) => BLOCKING_SEVERITIES.includes(f.severity) || report.verdict === "blocked" || report.verdict === "reopen");
  const slug = `review-${slugify(entry.frd ?? entry.unit)}-${entry.id}`;
  const create = deps.createCard ?? createCard;
  try {
    await create(project, {
      slug, type: "bug", class: "standard", frd: entry.frd ?? undefined, affected_frds: entry.frd ? [entry.frd] : [], origin: "deferred-review",
      title: `Hallazgo grave en la revisión diferida de ${entry.frd ?? entry.unit}`,
      dentro: grave.slice(0, 10).map((f) => `Corregir "${quote(f.summary)}" en ${f.file}${f.line === null ? "" : `:${f.line}`}`),
      fuera: [], dudas: [],
    }, deps);
  } catch (error) {
    if (!/already exists/.test(error?.message ?? "")) throw error;
  }
  return slug;
}

/**
 * `reopen`: queue (or re-queue, ids carry no attempt suffix) the patch unit `u-patch-<first wo>` with
 * attempt = max attempt of the units it fixes + 1, move the reopened WOs IN_REVIEW -> PLANNED -> IN_PROGRESS on the
 * integration branch (bumping `reopen_count`), commit, and set the fixed units `patching`. When the 3-execution
 * budget is spent the units are handed back instead. Mutates `next`, `events` and `effects`.
 */
export async function applyReopen(c) {
  const { next, review, reviewed, report, root, fs, transition, events, effects, setState, deps, ctx } = c;
  const exec = deps.exec ?? defaultExec;
  const workOrders = await scanWorkOrders(root, fs);
  const wanted = pickReopenWos(reviewed, report.findings, workOrders);
  const fixed = reviewed.filter((u) => u.wos.some((w) => wanted.includes(w.toLowerCase())) && REVIEWED_FROM.includes(u.state));
  if (fixed.length === 0) throw err("INVALID_STATE", `review ${review.id} reopens nothing: no reviewed unit owns a reopenable work order`);
  const attempt = Math.max(...fixed.map((u) => u.attempt)) + 1;
  if (attempt > 3) {
    const reason = "presupuesto de 3 ejecuciones agotado; la revisión sigue encontrando fallos";
    await handBackReviewed({ ctx, next, events, review, units: fixed, reason, reasonCode: "budget_exhausted", cause: "code", findings: report.findings, effects, deps });
    next.handbacks_in_a_row = 0;
  } else {
    const wos = wanted.filter((id) => fixed.some((u) => u.wos.some((w) => w.toLowerCase() === id)));
    for (const id of wos) {
      const found = workOrders.find((w) => w.id === id);
      if (!found) throw err("INVALID_STATE", `work order ${id} has no file in the integration worktree`);
      await transition(root, { file: found.rel, to: "PLANNED", reason: `review ${review.id}` });
      await transition(root, { file: found.rel, to: "IN_PROGRESS" });
    }
    const patchId = `u-patch-${wos[0]}`;
    const patch = newUnit({
      id: patchId, kind: "patch", wos: unique(fixed.flatMap((u) => u.wos).filter((w) => wos.includes(w.toLowerCase()))), frd: review.frd ?? fixed[0].frd,
      zone: review.zone, risk_rules: [...(review.risk_rules ?? [])], attempt,
    });
    const at = next.units.findIndex((u) => u.id === patchId);
    if (at >= 0) next.units[at] = patch; else next.units.push(patch);
    events.push({ type: "unit_queued", data: patch });
    events.push({ type: "patch", data: { unit: patchId, source_review: review.id, wos: patch.wos, attempt, findings: report.findings, probes: c.kept } });
    // A re-reopen of the same WO re-queues `patchId` itself (it is among `fixed`, A13): it must stay `queued` to be dispatched.
    for (const u of fixed.filter((x) => x.id !== patchId)) setState(u, "patching");
    effects.patch_unit = patchId;
  }
  await stageTrackedChanges(exec, root);
  const touched = unique(fixed.flatMap((u) => u.wos));
  await commitStaged(exec, root, `chore(engine): ${effects.patch_unit ? "reopen" : "hand back"} ${touched.join(", ")} after review ${review.id}`, [`Unit: ${review.id}`, ...touched.map((w) => `WO: ${w}`)]);
}
