// units/brief.mjs: gather everything a brief needs and write `build/units/<unit>/brief.md`.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { readCard } from "../card.mjs";
import { designPaths, hasDesignSource } from "../incremental.mjs";
import { designRefPath, resolveVisualSource } from "../visual-source.mjs";
import { readPlanWorkOrders } from "../planner/readWorkOrders.mjs";
import { atomicWriteText, nowIso } from "../fsx.mjs";
import { assertSafeId, buildPaths } from "../paths.mjs";
import { allowlistPatterns } from "./allowlist.mjs";
import { err, REVIEW_KINDS } from "./common.mjs";
import { productPrefix, productRoot } from "./git.mjs";
import { PLUGIN_ROOT, agentRoleFile, renderBrief } from "./render.mjs";
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
    `Resumed attempt ${attempt}: your previous run of this attempt stopped on ${note.cause === "scope" ? "an owner-approved scope gap that the architect has now repaired" : "an environment failure that the coordinator has now fixed"} (${note.reason}). Do not redo the work: continue from what is already in your working directory${Number.isInteger(note.worktree_changes) ? ` (${note.worktree_changes} uncommitted changes kept)` : ""}, re-run the verification that failed and finish.`,
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
  const readRoot = !unit.scope_revision && (await fs.stat(root).then(() => true, () => false)) || !state.integration?.worktree ? root : productRoot(path.resolve(project, state.integration.worktree), prefix);
  const workOrders = unit.kind === "doubt-consult" ? [] : await readUnitWorkOrders(readRoot, unit.wos, { ...deps, bootstrap: false, ...(unit.scope_revision ? { ref: unit.scope_revision } : {}) });
  const artifacts = artifactsOf(workOrders);
  const dir = frdDir(workOrders);
  const acIds = [...new Set(workOrders.flatMap((w) => w.text.match(AC_ID_RE) ?? []))];
  const frdText = dir ? await readIfExists(fs, path.join(readRoot, dir, "frd.md")) : null;
  const acLines = frdText ? extractAcLines(frdText, acIds) : [];

  let card = null;
  let cardDesign = null;
  if (state.scope?.card) {
    const parsed = await readCard(project, state.scope.card, { where: "any" }, deps);
    cardDesign = parsed;
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
  // BL-0315: a card run plans only the WOs that name the card, so every new WO must carry it (report rejects it otherwise).
  const cardWoRule = unit.kind === "docs" && state.scope?.card
    ? [`Every NEW work order you create must have \`source_change: [${state.scope.card}]\` in its frontmatter (with \`implementation_status: PLANNED\`); without it the engine never builds that work order and your report is rejected.`]
    : [];
  const complexityRule = unit.kind === "docs" ? ["Every NEW work order must stamp complexity: trivial | normal | complex in frontmatter. Trivial: Hello World or small familiar single-module work; normal: a form with validation; complex: image ingestion, external integration or many modules. Risk is independent and can only raise the floor (DR-162 / BUILD-10)."] : [];
  const specialist = [];
  if (unit.kind === "docs") {
    specialist.push("This bounded incremental unit overrides phase-wide role SOPs: reuse the existing product, stack and visual system; do not start a full phase, request owner direction, run a global freeze or change project phase. Apply only this unit’s specialist delta contract. Never invoke skills.");
    if (unit.role === "product-manager") specialist.push("Own only the product delta: FRD and EARS acceptance criteria, PRD only if its facts change. Preserve an agreed design. Record the bounded change and pending construction in docs/decision-log.md. Do not create work orders or design visuals; the following specialist owns those. Never call another skill.");
    if (unit.role === "architect" && !unit.scope_repair) specialist.push(`Own the technical delta: blueprint, ADR when a technical decision changes, logical data model and README only when their facts change. Read ${path.join(deps.pluginRoot ?? PLUGIN_ROOT, "skills/work-orders/SKILL.md")} as the WORK-ORDER DOCUMENT CONTRACT, without invoking that skill. Apply the work-orders readiness contract before activation: ground each WO in the current FRD EARS ACs and blueprint, verify dependency IDs/acyclic order, artifact ownership, test/verification commands and matching Build Plan. Classify each WO independently: ui: false for backend, ui: true for UI. Reuse agreed/existing design_source and design_refs only for affected UI; otherwise stamp design_source: pending so the engine schedules its scoped designer after your plan integrates. This visual prerequisite is mandatory before UI construction, but never blocks independent backend work. Produce coarse ACTIVE WOs after the planning checks, with complexity and source_change. The PM owns FRD/ACs; the designer owns FDD/mock. Never invent or redo visuals. Existing ACTIVE WOs may be amended only by the report-compatible card amendment contract: PLANNED/VERIFIED/IN_REVIEW to PLANNED, retain identity/activation and all previous source_change entries, add this card, increment reopen_count only when reopening non-PLANNED, and add a Status Note citing the card and reason. Planning-only fields may change: artifacts, dependsOn/depends_on, source_requirements, complexity, last_updated, ui, design_source, design_refs and design_decision_by. Never amend a WO already claimed by build/patch. Never call another skill.`);
    if (unit.role === "designer") specialist.push(`Prepare lightweight design BEFORE any dependent UI construction: reuse existing DESIGN.md, tokens and components; produce only the scoped FDD and HTML mock at ${JSON.stringify(unit.design_refs ?? designPaths(unit.frd, state.scope?.card ?? unit.id))}. Include states, interactions, responsive behavior and component consumer impact. Record the visual decision in docs/decision-log.md as taken by the agent, reversible; the owner iterates afterwards. No owner visual approval, global freeze, phase change or skill invocation. Do not implement product code or edit work-order frontmatter.`);
  }
  if (unit.scope_repair) specialist.push(`Owner-approved scope repair: ${JSON.stringify(unit.scope_repair)}. Write ONLY ${unit.scope_repair.wo_file}. Add exactly the approved concrete files to artifacts, preserving previous artifacts and every other frontmatter field. You may only ADD dependsOn/depends_on edges to existing in-scope build units or VERIFIED WOs, without cycles. Preserve the body (an appended Status Note is allowed). Keep implementation_status BLOCKED; the engine re-admits the target after integration. Never edit product code or tests, change the protected hashed set, create new WOs, or invoke skills. The target checkout/branch and attempt are preserved. Read its saved report/handback: ${p.reportFile(unit.scope_repair.target)}, ${p.handbackFile(unit.scope_repair.target)}.`);
  const designNotes = [];
  if (["build", "patch"].includes(unit.kind) || isReview) {
    const read = await readPlanWorkOrders(readRoot, { ...deps, design: cardDesign, units: state.units });
    for (const w of read.wos.filter(w => unit.wos.some(id => id.toLowerCase() === w.id))) {
      const source = resolveVisualSource(w, { card: cardDesign, units: state.units, files: read.visual_files });
      if (!source.ui) continue;
      if (!hasDesignSource(source)) throw err("INVALID_STATE", `UI ${w.id} has no available design source in its consuming checkout; integrate its lightweight designer prerequisite before construction.`);
      for (const ref of source.design_refs) {
        const rel = designRefPath(ref);
        if (rel !== null && !contextPack.includes(abs(rel))) contextPack.push(abs(rel));
      }
      designNotes.push(`UI ${w.id}: design already ${source.design_source}; reproduce the recorded source ${JSON.stringify(source.design_refs)} without redesign. Do not improvise design while coding.`);
    }
  }
  const notes = [...specialist, ...designNotes, ...complexityRule, ...cardWoRule, ...resumed, ...(extra.notes ?? []), ...(extra.questionDefaults ?? []).map((q) => `Owner question pending, working default: ${typeof q === "string" ? q : JSON.stringify(q)}`)];
  const text = renderBrief({
    unit, cell, agentType, roleFile: agentRoleFile(agentType, deps.pluginRoot), card, acLines,
    allowlist: unit.scope_repair ? [unit.scope_repair.wo_file] : allowlistPatterns(unit.kind, artifacts), contextPack, root, reportPath: outPath, schemaPath, token,
    verification: extra.verification ?? ["bash .pandacorp/verify.sh --light", "bash .pandacorp/verify.sh --light --tests=<the test files you changed>"],
    readOnlyPaths: [...hashed].sort(), previous, findings: extra.findings, decision, notes,
    review: extra.review, doubt: extra.doubt, sourcesSkipped: extra.sourcesSkipped, gateFailure,
  });
  await atomicWriteText(p.briefFile(unit.id), text, { fs });
  return { brief_path: p.briefFile(unit.id), report_path: outPath, text, written_at: nowIso(deps) };
}
