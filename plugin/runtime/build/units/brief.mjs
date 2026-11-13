// units/brief.mjs: gather everything a brief needs and write `build/units/<unit>/brief.md`.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { readCard } from "../card.mjs";
import { atomicWriteText, nowIso } from "../fsx.mjs";
import { assertSafeId, buildPaths } from "../paths.mjs";
import { allowlistPatterns } from "./allowlist.mjs";
import { err, REVIEW_KINDS } from "./common.mjs";
import { productPrefix, productRoot } from "./git.mjs";
import { agentRoleFile, renderBrief } from "./render.mjs";
import { AC_ID_RE, artifactsOf, extractAcLines, readUnitWorkOrders } from "./workOrders.mjs";

/**
 * Remove the stale `report.json`/`review.json` of an earlier attempt so a wait on the report file cannot return early.
 */
async function archiveStaleReports(project, unitId, attempt, deps) {
  const fs = deps.fs ?? fsp;
  const p = buildPaths(project, deps);
  for (const [file, stem] of [[p.reportFile(unitId), "report"], [p.reviewFile(unitId), "review"]]) {
    const target = path.join(path.dirname(file), `${stem}-before-a${attempt}.json`);
    try { await fs.rename(file, target); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
}

const frdDir = (workOrders) => (workOrders[0] ? path.posix.dirname(path.posix.dirname(workOrders[0].file)) : null);

async function readIfExists(fs, file) {
  try { return await fs.readFile(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
}

/**
 * BL-0312: an attempt re-admitted by `unblock` after an environment fix resumes where it stopped. The note is read only
 * for the attempt it was written for (a later attempt starts fresh and never sees it).
 */
async function unblockedNote(fs, unitDir, attempt) {
  const raw = await readIfExists(fs, path.join(unitDir, "unblocked.json"));
  if (raw === null) return [];
  let note;
  try { note = JSON.parse(raw); } catch { return []; }
  if (note?.attempt !== attempt) return [];
  return [
    `Resumed attempt ${attempt}: your previous run of this attempt stopped on an environment failure that the coordinator has now fixed (${note.reason}). Do not redo the work: continue from what is already in your working directory${Number.isInteger(note.worktree_changes) ? ` (${note.worktree_changes} uncommitted changes kept)` : ""}, re-run the verification that failed and finish.`,
    ...(note.previous_report ? [`Your previous report of this attempt (read-only, for context; write a NEW report to report_path): ${note.previous_report}`] : []),
  ];
}

/** The decision (or assumption) of the unit's doubt, as the brief states it; `null` when the unit has no doubt. */
async function decidedDoubt(project, unit, deps) {
  if (!unit.doubt_id) return null;
  const { briefDecision, readDoubt } = await import("../doubts.mjs");
  const record = await readDoubt(project, unit.doubt_id, deps);
  const picked = briefDecision(record);
  if (!picked) return null;
  return { question: record.question ?? "", decision: picked.text || picked.value, rationale: picked.why };
}

/**
 * Gather everything a brief needs and write `build/units/<unit>/brief.md` (mode 0600: it holds the unit token).
 * The unit worktree is normally created first (see {@link prepareUnitWorktree}); without one, a worker unit's brief names
 * the worktree path of its attempt and the documents are read from the integration worktree.
 * @param {object} input
 * @param {string} input.project absolute project root
 * @param {object} input.state current `state.json` object
 * @param {object} input.unit the state unit (with its final `attempt`)
 * @param {{runtime: string, model: string, effort: string|null}} input.cell resolved routing cell
 * @param {string} input.agentType
 * @param {string} input.token the raw unit token returned by `issueToken`
 * @param {string} input.schemaPath absolute schema path ("" for a doubt-consult)
 * @param {string} [input.worktree] git worktree root (default: `unit.worktree`)
 * @param {string} [input.reportPath] default: `report.json` (`review.json` for review kinds, `answer.json` for consults)
 * @param {object} [input.extra] `{findings, decision, notes, review, doubt, sourcesSkipped, verification}` passed through
 * @param {{exec?: Function, fs?: object, env?: object, pluginRoot?: string}} [deps]
 * @returns {Promise<{brief_path: string, report_path: string, text: string}>}
 */
export async function writeUnitBrief({ project, state, unit, cell, agentType, token, schemaPath, worktree, reportPath, extra = {} }, deps = {}) {
  assertSafeId(unit.id, "unit id");
  const fs = deps.fs ?? fsp;
  const p = buildPaths(project, deps);
  const prefix = await productPrefix(project, deps);
  const wt = worktree ?? unit.worktree ?? (REVIEW_KINDS.includes(unit.kind) || unit.kind === "doubt-consult" ? null : p.unitWorktree(unit.id, unit.attempt));
  if (!wt) throw err("INVALID_STATE", `unit ${unit.id} has no worktree yet`);
  const root = productRoot(wt, prefix);
  const isReview = REVIEW_KINDS.includes(unit.kind);
  const outPath = reportPath ?? (isReview ? p.reviewFile(unit.id) : unit.kind === "doubt-consult" ? p.unitAnswerFile(unit.id) : p.reportFile(unit.id));

  // A brief regenerated before its worktree exists (or for a dry run) reads the documents from the integration worktree.
  const readRoot = (await fs.stat(root).then(() => true, () => false)) || !state.integration?.worktree ? root : productRoot(path.resolve(project, state.integration.worktree), prefix);
  const workOrders = unit.kind === "doubt-consult" ? [] : await readUnitWorkOrders(readRoot, unit.wos, { ...deps, bootstrap: false });
  const artifacts = artifactsOf(workOrders);
  const dir = frdDir(workOrders);
  const acIds = [...new Set(workOrders.flatMap((w) => w.text.match(AC_ID_RE) ?? []))];
  const frdText = dir ? await readIfExists(fs, path.join(readRoot, dir, "frd.md")) : null;
  const acLines = frdText ? extractAcLines(frdText, acIds) : [];

  let card = null;
  if (state.scope?.card) {
    const parsed = await readCard(project, state.scope.card, { where: "any" }, deps);
    if (parsed) card = { dentro: parsed.dentro.map((i) => i.text), fuera: parsed.fuera.map((i) => i.text) };
  }

  const abs = (rel) => path.join(readRoot, rel);
  const contextPack = [];
  if (dir) for (const f of ["frd.md", "fdd.md", "blueprint.md"]) if ((await readIfExists(fs, abs(path.posix.join(dir, f)))) !== null) contextPack.push(abs(path.posix.join(dir, f)));
  for (const w of workOrders) contextPack.push(abs(w.file));
  for (const f of ["docs/design/design-tokens.json", "DESIGN.md", "docs/rules/README.md"]) if ((await readIfExists(fs, abs(f))) !== null) contextPack.push(abs(f));

  const hashed = new Set();
  for (const u of state.units) if (u.id !== unit.id) for (const f of [...Object.keys(u.test_hashes ?? {}), ...Object.keys(u.probe_hashes ?? {})]) hashed.add(f);

  const previous = [];
  for (let n = 1; n < unit.attempt; n += 1) {
    const raw = await readIfExists(fs, path.join(p.unitDir(unit.id), `attempt-${n}.json`));
    if (raw !== null) previous.push(JSON.parse(raw));
  }
  await archiveStaleReports(project, unit.id, unit.attempt, deps);
  const gateRaw = unit.kind === "patch" ? await readIfExists(fs, path.join(p.unitDir(unit.id), "gate-failure.json")) : null;
  const gateFailure = gateRaw === null ? null : JSON.parse(gateRaw);

  const decision = extra.decision ?? await decidedDoubt(project, unit, deps);
  const resumed = await unblockedNote(fs, p.unitDir(unit.id), unit.attempt);
  const notes = [...resumed, ...(extra.notes ?? []), ...(extra.questionDefaults ?? []).map((q) => `Owner question pending, working default: ${typeof q === "string" ? q : JSON.stringify(q)}`)];
  const text = renderBrief({
    unit, cell, agentType, roleFile: agentRoleFile(agentType, deps.pluginRoot), card, acLines,
    allowlist: allowlistPatterns(unit.kind, artifacts), contextPack, root, reportPath: outPath, schemaPath, token,
    verification: extra.verification ?? ["bash .pandacorp/verify.sh --light", "bash .pandacorp/verify.sh --light --tests=<the test files you changed>"],
    readOnlyPaths: [...hashed].sort(), previous, findings: extra.findings, decision, notes,
    review: extra.review, doubt: extra.doubt, sourcesSkipped: extra.sourcesSkipped, gateFailure,
  });
  await atomicWriteText(p.briefFile(unit.id), text, { fs });
  return { brief_path: p.briefFile(unit.id), report_path: outPath, text, written_at: nowIso(deps) };
}
