// review-record (CLI doc 3.10, BUILD-10, D23, D11, A8, A19): ingest a reviewer's report for a `review`,
// `deferred-review` or `audit` unit. Validates it against review-report.schema.json, stores the failed-first probes
// (committed on `lane/<run_id>`, hashed into the review unit's `probe_hashes`, within the probe budget), applies the
// verdict (pass / reopen -> patch unit / blocked -> hand-back / doubt), queues a deferred re-review when the review was
// degraded (other company out of quota or unreachable, N7, Sol at capacity) and journals `review_recorded` with
// `data.verdict`. Reviewer selection is never hardcoded: the matrix lives in model-tiers.json behind routing.mjs.
//
// Two-phase rule (D5): phase 1 verifies fence, unit, token and report; the work phase hashes files read-only; phase 2
// (mutex held) commits probes and work-order transitions in the integration worktree, writes the deferred ledger,
// appends the journal events, then the state, then releases the token. Never writes a tracked file in the main checkout.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken, verifyToken } from "./admission.mjs";
import { completeDeferred, enqueueDeferred, entryForUnit, readDeferred } from "./deferred.mjs";
import { atomicWriteJson, defaultExec, nowIso, sha256Hex } from "./fsx.mjs";
import { buildPaths, resolveInside } from "./paths.mjs";
import { fencedTwoPhase, findUnit } from "./state.mjs";
import { BLOCKING_SEVERITIES, RECORDABLE_STATES, REVIEWED_FROM, REVIEW_RECORD_KINDS, err, unique } from "./review/common.mjs";
import { asSchemaCell, authorsOf, inferDegradation, normalizeHint, reviewedUnits, strongestAuthor } from "./review/degradation.mjs";
import { commitStaged, git, productRootIn, repoPrefix, stageTrackedChanges } from "./review/git.mjs";
import { extraProbesUsed, hashFile, selectProbes } from "./review/probes.mjs";
import { countFindings, loadReport, validateReviewReport } from "./review/report.mjs";
import { reviewRange } from "./review/range.mjs";
import { applyReopen, fileBugCard, handBackReviewed } from "./review/verdictEffects.mjs";

export { REVIEW_RECORD_KINDS } from "./review/common.mjs";
export { authorsOf, inferDegradation, reviewedUnits } from "./review/degradation.mjs";
export { fromRepoPath, productRootIn, repoPrefix, toRepoPath } from "./review/git.mjs";
export { PROBE_EXTRA_PER_FRD } from "./review/probes.mjs";
export { countFindings, isProbePath, validateReviewReport } from "./review/report.mjs";
export { pickReopenWos, scanWorkOrders } from "./review/workOrders.mjs";

/** DR-161: does `company` have < 15 % left (conserved, or out of quota at >= quota_stop)? Any read error: false. */
async function neededConserved(project, state, company, deps) {
  try {
    const quota = deps.quota ?? await import("./quota.mjs");
    const p = buildPaths(project, deps);
    const q = await quota.readQuota({ file: p.quotaFile, codexHome: p.codexHome, coordinator: state.coordinator }, deps);
    const pol = quota.policy({ claude: q.effective.claude, codex: q.effective.codex, coordinator: state.coordinator, deps });
    return pol[`${company}_conserve`] === true || pol[`${company}_new_units`] === false;
  } catch { return false; }
}

/**
 * Record a reviewer's verdict (CLI `review-record`).
 * @param {{project: string, epoch: number|string, unit: string, token: string, file?: string, report?: object, deferredId?: string}} input
 *   `file` is the review.json path; `report` (already parsed) replaces it; `deferredId` names the ledger entry a
 *   `deferred-review` unit serves (default: matched from the unit id, then by FRD)
 * @param {{fs?: object, exec?: Function, env?: object, clock?: Function, buildState?: object, tiers?: object,
 *   availability?: {claude?: string, codex?: string}, handback?: Function, createCard?: Function, admissionFs?: object}} [deps]
 *   `handback(ctx, {units, reason, review_unit, findings, workOrders, root, transition})` -> `{paths}` replaces the minimal
 *   built-in hand-back; `availability` is the quota picture at dispatch, tried before the inferred ones
 * @returns {Promise<{ok: true, cmd: "review-record", verdict: string, deferred_review_id: string|null, probes_committed: string[],
 *   reviewer: object, degraded: string|null, reviewed_units: string[], patch_unit: string|null, handed_back: string[],
 *   bug_card: string|null, doubt_file: string|null, probes_skipped: object[], last_safe_point: object}>}
 * @throws INVALID_INPUT (exit 6: bad report, token, probe), INVALID_STATE (5), FENCE / QUIESCED (3), USAGE (2)
 */
export async function reviewRecord(input, deps = {}) {
  const { project, epoch, unit: unitId, token } = input ?? {};
  if (typeof project !== "string" || !project || !Number.isInteger(Number(epoch)) || typeof unitId !== "string" || !unitId) throw err("USAGE", "review-record needs project, epoch and unit");
  const fs = deps.fs ?? fsp;
  const exec = deps.exec ?? defaultExec;

  const phase1 = async (ctx) => {
    const state = await ctx.readState();
    const unit = state && findUnit(state, unitId);
    if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
    if (!REVIEW_RECORD_KINDS.includes(unit.kind)) throw err("INVALID_STATE", `review-record takes review, deferred-review and audit units, not ${unit.kind}`);
    if (!RECORDABLE_STATES.includes(unit.state)) throw err("INVALID_STATE", `unit ${unitId} is ${unit.state}, not awaiting a review`);
    const check = verifyToken(unitId, token, { file: ctx.paths.admissionFile, fs: deps.admissionFs });
    if (!check.ok) throw err("INVALID_INPUT", `unit token rejected (${check.reason})`);
    const report = await validateReviewReport(await loadReport(input, fs), { unit: unitId, token }, deps);
    const w = unit.worker;
    if (w && (w.runtime !== report.reviewer.runtime || w.model !== report.reviewer.model)) throw err("INVALID_INPUT", "report reviewer differs from the dispatch cell");
    if (unit.kind === "review") {
      const authors = authorsOf(reviewedUnits(state, unit));
      const rv = w ?? report.reviewer;
      if (authors.some((a) => a.runtime === rv.runtime && a.model === rv.model)) {
        const d = inferDegradation({
          authors, kind: state.size === "touch" ? "touch" : "frd", zone: unit.zone,
          reviewer: { runtime: rv.runtime, model: rv.model, effort: rv.effort ?? report.reviewer.effort },
          hint: normalizeHint(deps.availability), shapes: state.coordinator === "drive" ? ["drive", undefined] : [undefined],
        }, deps);
        if (d.degraded !== "same_model") throw err("INVALID_INPUT", "an author never reviews its own unit outside the N7 exception");
      }
    }
    return { report };
  };

  const work = async ({ report }, ctx) => {
    const state = await ctx.readState();
    const review = findUnit(state, unitId);
    const root = state.integration.worktree;
    const branch = await git(exec, root, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch !== state.integration.branch) throw err("INVALID_STATE", `integration worktree is on ${branch}, not ${state.integration.branch}`);
    const tip = await git(exec, root, ["rev-parse", "HEAD"]);
    const probeRoot = productRootIn(review.worktree ?? ctx.paths.unitWorktree(review.id, review.attempt), await repoPrefix(exec, root));
    const hashes = {};
    for (const p of report.probes.filter((x) => x.failed_first)) hashes[p.path] = await hashFile(fs, resolveInside(probeRoot, p.path));
    const range = await reviewRange({ state, review, tip, briefFile: ctx.paths.briefFile(review.id) }, deps);
    // BL-0323: the checkout the reviewer judged. A HEAD that is not the range end means the verdict judged another tree.
    const checkout = review.worktree ?? ctx.paths.unitWorktree(review.id, review.attempt);
    const headOf = async (rev) => { const r = await exec("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { cwd: checkout }); return r.code === 0 ? r.stdout.trim() : null; };
    const checkoutHead = await headOf("HEAD");
    const pin = checkoutHead ? await headOf(range.split("..")[1]) : null;
    const checkoutMismatch = Boolean(checkoutHead && pin && checkoutHead !== pin);
    return { tip, probeRoot, hashes, range, checkoutMismatch, checkoutHead, pin };
  };

  const phase2 = async (found, { report }, ctx) => {
    const state = await ctx.readState();
    const review = findUnit(state, unitId);
    if (!review || !RECORDABLE_STATES.includes(review.state)) throw err("INVALID_STATE", `unit ${unitId} is no longer awaiting a review`);
    const root = state.integration.worktree;
    const at = nowIso(deps);
    const reviewed = reviewedUnits(state, review);
    const authors = review.kind === "audit" ? [] : authorsOf(reviewed);
    const dispatch = review.worker;
    const reviewer = { runtime: dispatch?.runtime ?? report.reviewer.runtime, model: dispatch?.model ?? report.reviewer.model, effort: dispatch?.effort ?? report.reviewer.effort };

    // 1. Probes: budget, then commit on the integration branch with the review unit's trailer.
    const { kept, skipped } = selectProbes(report, await extraProbesUsed(ctx.paths, review.frd, deps));
    const probeHashes = {};
    for (const rel of kept) {
      const sourceAbs = resolveInside(found.probeRoot, rel);
      const targetAbs = resolveInside(root, rel);
      const hash = await hashFile(fs, sourceAbs);
      if (hash !== found.hashes[rel]) throw err("INVALID_INPUT", `probe changed while the review was recorded (hash mismatch): ${rel}`);
      if (review.probe_hashes?.[rel] && review.probe_hashes[rel] !== hash) throw err("INVALID_INPUT", `probe ${rel} was already recorded with another hash`);
      const existing = await fs.readFile(targetAbs).then((b) => sha256Hex(b), () => null);
      if (existing !== null && existing !== hash) throw err("INVALID_INPUT", `probe ${rel} would overwrite an existing file on ${state.integration.branch}`);
      if (existing === null) {
        await fs.mkdir(path.dirname(targetAbs), { recursive: true });
        await fs.copyFile(sourceAbs, targetAbs);
      }
      probeHashes[rel] = hash;
    }
    const probeFiles = Object.keys(probeHashes);
    if (probeFiles.length > 0) {
      await git(exec, root, ["add", "--", ...probeFiles]);
      await commitStaged(exec, root, `test(${review.frd ?? "review"}): failed-first probes from review ${review.id}`, [`Unit: ${review.id}`]);
    }

    // 2. Degradation and the deferred ledger.
    const events = [];
    const next = structuredClone(state);
    const nextReview = findUnit(next, review.id);
    let degradation = { matched: true, degraded: null, deferred: null, primary: null, row: null };
    if (review.kind === "review") {
      degradation = inferDegradation({
        authors, kind: state.size === "touch" ? "touch" : "frd", zone: review.zone, reviewer, hint: normalizeHint(deps.availability),
        shapes: state.coordinator === "drive" ? ["drive", undefined] : [undefined],
      }, deps);
    }
    let deferredId = null;
    let bugCard = null;
    let resultEntry = null;
    // DR-161: while the company a deferred re-review would need has < 15 % left, it is not queued (never blocks landing).
    const skipDeferred = review.kind === "review" && degradation.deferred ? await neededConserved(project, state, degradation.deferred.needed, deps) : false;
    if (review.kind === "review" && degradation.degraded && degradation.deferred && !skipDeferred && authors.length > 0) {
      const { entry } = await enqueueDeferred(project, {
        unit: review.id, kind: "review", frd: review.frd, sha_range: found.range, author: asSchemaCell(strongestAuthor(authors)),
        reviewer_used: asSchemaCell(reviewer), degraded: degradation.degraded, needed: degradation.deferred.needed, created_at: at,
      }, deps);
      deferredId = entry.id;
      events.push({ type: "deferred_review_queued", data: { id: entry.id, unit: review.id, frd: review.frd, needed: entry.needed, degraded: entry.degraded, reviewer_used: entry.reviewer_used } });
    }
    if (review.kind === "deferred-review" && report.verdict !== "doubt") {
      const entry = entryForUnit(await readDeferred(project, deps), review, input.deferredId ?? null);
      if (entry) {
        deferredId = entry.id;
        const grave = report.verdict === "reopen" || report.verdict === "blocked" || report.findings.some((f) => BLOCKING_SEVERITIES.includes(f.severity));
        if (grave) bugCard = await fileBugCard(project, entry, review, report, deps);
        resultEntry = await completeDeferred(project, entry.id, { result: { verdict: report.verdict, findings: countFindings(report.findings), review_unit: review.id, reviewer: asSchemaCell(reviewer), recorded_at: at, bug_card: bugCard } }, deps);
        events.push({ type: "deferred_review_done", data: { id: entry.id, unit: review.id, verdict: report.verdict, findings: countFindings(report.findings), bug_card: bugCard } });
      }
    }

    // 3. Verdict effects. A deferred re-review judges code already handled: it never changes the reviewed units.
    const effects = { patch_unit: null, handed_back: [], doubt_file: null };
    const touchesUnits = review.kind !== "deferred-review";
    const setState = (u, to) => {
      const target = findUnit(next, u.id);
      events.push({ type: "unit_state", data: { unit: u.id, from: target.state, to } });
      target.state = to;
    };
    const transition = deps.buildState?.transitionWorkOrderAt ?? (await import("../build-state.mjs")).transitionWorkOrderAt;
    if (report.verdict === "pass" && touchesUnits) {
      for (const u of reviewed.filter((x) => ["integrated", "reviewing"].includes(x.state))) setState(u, "verified");
    } else if (report.verdict === "reopen" && touchesUnits) {
      await applyReopen({ state, next, review, reviewed, report, root, fs, transition, events, effects, setState, deps, ctx, kept: probeFiles });
    } else if (report.verdict === "blocked" && touchesUnits) {
      const targets = reviewed.filter((x) => REVIEWED_FROM.includes(x.state));
      // BL-0323: a block issued on the wrong checkout says nothing about the work: env-infra, lifted by `unblock`.
      const wrongCheckout = found.checkoutMismatch === true;
      const reason = wrongCheckout
        ? `checkout de revisión en ${found.checkoutHead}, no en el pin ${found.pin}`
        : report.findings.map((f) => f.summary).join("; ").slice(0, 300);
      await handBackReviewed({ ctx, next, events, review, units: targets, reason, reasonCode: wrongCheckout ? "review_checkout" : "review_blocked", cause: wrongCheckout ? "env-infra" : "owner", findings: report.findings, effects, deps });
      next.handbacks_in_a_row = 0;
      await stageTrackedChanges(exec, root);
      await commitStaged(exec, root, `chore(engine): hand back ${targets.map((u) => u.id).join(", ")} after review ${review.id}`, [`Unit: ${review.id}`, ...unique(targets.flatMap((u) => u.wos)).map((w) => `WO: ${w}`)]);
    } else if (report.verdict === "doubt") {
      effects.doubt_file = ctx.paths.unitDoubtFile(review.id);
      await atomicWriteJson(effects.doubt_file, report.doubt, { fs });
    }

    // 4. Review unit, events, state.
    nextReview.review = { verdict: report.verdict, reviewer: asSchemaCell(reviewer), degraded: degradation.degraded, deferred_id: deferredId };
    nextReview.probe_hashes = { ...(review.probe_hashes ?? {}), ...probeHashes };
    nextReview.token_hash = null;
    const finalState = report.verdict === "doubt" ? "reported" : "verified";
    events.push({ type: "unit_state", data: { unit: review.id, from: review.state, to: finalState } });
    nextReview.state = finalState;
    const tip = await git(exec, root, ["rev-parse", "HEAD"]);
    const reviewerCompany = reviewer.runtime;
    events.unshift({
      type: "review_recorded",
      data: {
        unit: review.id, frd: review.frd, kind: review.kind, verdict: report.verdict, reviewer: asSchemaCell(reviewer), authors: authors.map(asSchemaCell),
        cross: authors.length > 0 && authors.every((a) => a.runtime !== reviewerCompany), degraded: degradation.degraded, findings: countFindings(report.findings),
        pair_id: deferredId, deferred_id: deferredId, probe_hashes: nextReview.probe_hashes, probes_committed: probeFiles, reviewed: reviewed.map((u) => u.id),
        ...(degradation.matched ? {} : { off_matrix: true }),
      },
    });
    next.last_safe_point = { sha: tip, kind: "review-record", at };
    events.push({ type: "safe_point", data: { kind: "review-record", sha: tip } });
    for (const event of events) await ctx.appendEvent(event);
    await ctx.writeState(next);
    releaseToken(unitId, { file: ctx.paths.admissionFile, fs: deps.admissionFs });
    return {
      ok: true, cmd: "review-record", verdict: report.verdict, deferred_review_id: deferredId, probes_committed: probeFiles, reviewer: asSchemaCell(reviewer),
      degraded: degradation.degraded, reviewed_units: reviewed.map((u) => u.id), patch_unit: effects.patch_unit, handed_back: effects.handed_back,
      bug_card: bugCard, doubt_file: effects.doubt_file, probes_skipped: skipped, last_safe_point: next.last_safe_point, ...(resultEntry ? { deferred_result: resultEntry.result } : {}),
      // DR-161: the optional cross-company follow-up that was NOT queued while its company was conserved.
      ...(skipDeferred ? { deferred_skipped: { needed: degradation.deferred.needed, reason: "quota_conserve" } } : {}),
    };
  };

  return fencedTwoPhase({ project, epoch, actor: deps.actor ?? "cli", deps }, phase1, work, phase2);
}
