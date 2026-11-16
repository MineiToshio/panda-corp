// BL-0327: owner-approved artifact repair, using an ordinary isolated architect docs unit.
// Never resets the blocked checkout or weakens the protected test set. All state writes are fenced/journaled.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { frontmatterList, parseYamlSubset, splitFrontmatter } from "./card.mjs";
import { readJournal } from "./journal.mjs";
import { fencedTwoPhase, findUnit, newUnit } from "./state.mjs";
import { readUnitWorkOrders, productPrefix, productRoot, matchesArtifact } from "./units.mjs";
import { applyUnblock } from "./failure/unblock.mjs";
import { openUnitDoubt } from "./failure/unitDoubt.mjs";
import { defaultExec } from "./fsx.mjs";
import { inScope } from "./next/scope.mjs";

const err = (code, message) => Object.assign(new Error(message), { code });
const norm = (id) => String(id).toLowerCase();
const list = (value) => frontmatterList(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lastHandback = (events, id) =>
  events.filter((e) => e.type === "handback" && e.data?.blocked?.includes(id)).at(-1);
export const protectedPaths = (state) =>
  new Set(state.units.flatMap((u) => [...Object.keys(u.test_hashes ?? {}), ...Object.keys(u.probe_hashes ?? {})]));

/** Legacy workers used dependency for ownership. Only explicit out-of-allowlist evidence changes that meaning. */
export function scopeDiagnosis(report, hashed = new Set()) {
  const diagnosis = report?.diagnosis;
  if (report?.status !== "blocked" || !["dependency", "scope"].includes(diagnosis?.cause)) return diagnosis ?? null;
  const text = [diagnosis.detail, ...(report.pending ?? [])].join("\n");
  if (
    diagnosis.cause !== "scope" &&
    !/(?:fuera del|outside (?:the )?)\s*(?:write )?allowlist|out[- ]of[- ](?:scope|allowlist)/i.test(text)
  )
    return diagnosis;
  const protectedFile = [...hashed].find((file) => text.includes(file));
  return {
    cause: protectedFile ? "test-defective" : "scope",
    detail: protectedFile ? `Protected test dispute (${protectedFile}): ${diagnosis.detail}` : diagnosis.detail,
  };
}

function approvalFiles(files) {
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.some(
      (f) =>
        typeof f !== "string" ||
        !f ||
        f.startsWith("/") ||
        f.includes("\\") ||
        f.split("/").some((x) => !x || [".", ".."].includes(x)) ||
        /[*?{}\n\r]/.test(f) ||
        /^(?:\.git|\.pandacorp|docs)(?:\/|$)/.test(f) ||
        /(^|\/)[^/]*-snapshots\//.test(f),
    )
  ) {
    throw err(
      "USAGE",
      "scope-repair needs --files JSON: nonempty concrete product-relative file paths (no globs, docs, state or snapshots)",
    );
  }
  return [...new Set(files)];
}

/** Strict exception to claimed-WO protection: only this approved architect, only artifacts/dependency additions. */
export function scopeAmendmentProblem({ unit, rel, before, after, targets, hashed }) {
  const repair = unit.scope_repair;
  if (!repair || unit.kind !== "docs" || unit.role !== "architect" || rel !== repair.wo_file)
    return "scope repair may only write its approved work order";
  const target = targets.find((u) => u.id === repair.target);
  if (!target || target.state !== "blocked" || target.attempt !== repair.attempt)
    return "scope repair target must remain blocked at its approved attempt";
  const otherWriter = targets.some(
    (u) =>
      u.id !== target.id &&
      ["build", "patch"].includes(u.kind) &&
      u.wos.some((w) => target.wos.some((t) => norm(t) === norm(w))) &&
      ["queued", "admitted", "running", "reported", "suspended"].includes(u.state),
  );
  if (otherWriter) return "scope repair cannot amend a work order with another active build/patch claimant";
  const a = splitFrontmatter(before ?? ""),
    b = splitFrontmatter(after ?? "");
  if (!a || !b) return "scope repair cannot delete work-order frontmatter";
  const x = parseYamlSubset(a.fm),
    y = parseYamlSubset(b.fm);
  if ([...x.errors, ...x.unsupported, ...y.errors, ...y.unsupported].length)
    return "scope repair requires unambiguous supported YAML";
  const old = x.data,
    next = y.data;
  if (
    !target.wos.some((w) => norm(w) === norm(unit.wos[0])) ||
    norm(old.id) !== norm(unit.wos[0]) ||
    old.status !== "ACTIVE" ||
    old.implementation_status !== "BLOCKED"
  )
    return "scope repair requires the approved ACTIVE, BLOCKED work order";
  for (const key of new Set([...Object.keys(old), ...Object.keys(next)]))
    if (!["artifacts", "dependsOn", "depends_on"].includes(key) && !same(old[key], next[key]))
      return `scope repair cannot change ${key}`;
  if (!b.body.startsWith(a.body))
    return "scope repair must preserve the work-order body (an appended status note is allowed)";
  const expected = [...new Set([...list(old.artifacts), ...repair.files])].sort();
  if (!same([...list(next.artifacts)].sort(), expected))
    return "scope repair must add exactly the owner-approved files, retaining existing artifacts";
  const added = list(next.artifacts).filter((f) => !list(old.artifacts).includes(f));
  if ([...hashed].some((f) => added.some((a) => matchesArtifact(a, f))))
    return "protected test changes require the existing dispute/doubt path";
  if (next.dependsOn && next.depends_on && !same(next.dependsOn, next.depends_on))
    return "scope repair cannot introduce conflicting dependency aliases";
  for (const key of ["dependsOn", "depends_on"])
    if (list(old[key]).some((d) => !list(next[key]).includes(d)))
      return "scope repair cannot remove existing dependencies";
  return null;
}

/** Validate added WO dependency edges without pulling work outside the frozen run scope. */
export async function scopeDependencyUnits(root, wo, targets, deps = {}) {
  const { readPlanWorkOrders } = await import("./planner/readWorkOrders.mjs");
  const read = await readPlanWorkOrders(root, deps);
  if (read.errors.length) throw err("INVALID_INPUT", "scope repair requires a readable work-order graph");
  const data = parseYamlSubset(splitFrontmatter(wo.text)?.fm ?? "").data;
  const nodes = new Map(read.wos.map((w) => [norm(w.id), w]));
  const id = norm(wo.id),
    edges = list(data.dependsOn ?? data.depends_on).map(norm);
  nodes.set(id, { ...nodes.get(id), deps: edges });
  const seen = new Set(),
    active = new Set();
  const visit = (key) => {
    if (active.has(key)) throw err("INVALID_INPUT", "scope repair dependency cycle");
    if (seen.has(key)) return;
    const node = nodes.get(key);
    if (!node) throw err("INVALID_INPUT", `scope repair missing dependency ${key}`);
    active.add(key);
    for (const dep of node.deps ?? []) visit(norm(dep));
    active.delete(key);
    seen.add(key);
  };
  visit(id);
  const units = [];
  for (const dep of edges) {
    if (nodes.get(dep)?.status === "VERIFIED") continue;
    const candidates = targets.filter((u) => ["build", "patch"].includes(u.kind) && u.wos.some((w) => norm(w) === dep));
    if (!candidates.length)
      throw err(
        "INVALID_INPUT",
        `scope repair dependency ${dep} must already have an in-scope build unit or be VERIFIED`,
      );
    units.push(...candidates.map((u) => u.id));
  }
  return [...new Set(units)];
}

/** Owner decision command. Legacy dependency hand-backs qualify only with the saved report's explicit scope evidence. */
export async function scopeRepairCommand(
  { project, epoch, unit: unitId, wo: woId, files, reason, ownerApproved = false },
  deps = {},
) {
  if (!ownerApproved)
    throw err("INVALID_INPUT", "scope-repair requires --owner-approved after the owner approves these files");
  const approved = approvalFiles(files);
  if (!String(reason ?? "").trim()) throw err("USAGE", "scope-repair requires --reason (the owner decision)");
  const result = await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_r, _i, ctx) => {
    const state = await ctx.readState(),
      unit = findUnit(state, unitId);
    if (
      !unit ||
      !["build", "patch"].includes(unit.kind) ||
      !unit.wos.length ||
      unit.state !== "blocked" ||
      !inScope(state, unit)
    )
      throw err("INVALID_INPUT", "scope-repair requires an in-scope blocked build/patch unit with work orders");
    if (
      state.status !== "active" ||
      state.run_id !== ctx.runId ||
      state.jobs.some((j) => j.state === "running" && j.kind === "land")
    )
      throw err("INVALID_STATE", "resume the matching run at a safe point before scope-repair");
    const { events } = await readJournal(ctx.paths.journalFile, deps),
      hb = lastHandback(events, unitId);
    if (!hb || hb.data.unit !== unitId || hb.data.attempt !== unit.attempt)
      throw err("INVALID_INPUT", "scope-repair requires the latest root hand-back at the same attempt");
    const chosen = woId === undefined ? unit.wos[0] : unit.wos.find((w) => norm(w) === norm(woId));
    if (!chosen) throw err("INVALID_INPUT", "scope-repair --wo must belong to the blocked unit");
    const id = `u-scope-${unitId}-h${hb.seq}`;
    const existing = findUnit(state, id);
    if (existing) {
      if (
        !same(
          [...(existing.scope_repair?.files ?? []), ...(existing.scope_repair?.protected_files ?? [])].sort(),
          [...approved].sort(),
        ) ||
        norm(existing.wos[0]) !== norm(chosen) ||
        existing.scope_repair?.reason !== reason
      )
        throw err("INVALID_INPUT", "a different scope repair decision is already recorded");
      return { ok: true, cmd: "scope-repair", applied: false, docs: id, action: "docs" };
    }
    const fs = deps.fs ?? fsp;
    const saved = JSON.parse(await fs.readFile(ctx.paths.reportFile(unitId), "utf8"));
    if (
      saved.unit !== unitId ||
      saved.status !== "blocked" ||
      !["dependency", "scope"].includes(saved.diagnosis?.cause) ||
      !["scope", "test-defective"].includes(scopeDiagnosis(saved, protectedPaths(state))?.cause) ||
      !["scope", "dependency"].includes(hb.data.cause)
    )
      throw err("INVALID_INPUT", "the saved blocked report does not establish an allowlist hand-back");
    const hashed = protectedPaths(state);
    const protectedFiles = approved.filter((a) => [...hashed].some((f) => matchesArtifact(a, f)));
    const ordinary = approved.filter((a) => !protectedFiles.includes(a));
    const protectedFile = protectedFiles[0];
    const prefix = await productPrefix(project, deps),
      root = productRoot(path.resolve(project, state.integration.worktree), prefix);
    const wo = (await readUnitWorkOrders(root, [chosen], deps))[0];
    const realRoot = await fs.realpath(root);
    for (const file of approved) {
      const absolute = path.join(root, file);
      const stat = await fs.lstat(absolute).catch(() => null);
      const real = stat?.isFile() ? await fs.realpath(absolute) : null;
      if (!real || !real.startsWith(`${realRoot}${path.sep}`))
        throw err("INVALID_INPUT", `scope repair requires an existing regular product file: ${file}`);
    }
    // Record the decision before taking either path; neither spends a build/patch execution.
    await ctx.appendEvent({
      type: "scope_repair_approved",
      data: {
        unit: unitId,
        attempt: unit.attempt,
        files: approved,
        wo: chosen,
        reason,
        handback_seq: hb.seq,
        owner_approved: true,
        action: ordinary.length ? "docs" : "dispute",
      },
    });
    if (!ordinary.length) {
      await applyUnblock(ctx, { unitId, reason, scopeResolution: { handback_seq: hb.seq, dispute: true } }, deps);
      return {
        ok: true,
        cmd: "scope-repair",
        applied: true,
        action: "dispute",
        protected_file: protectedFile,
        diagnosis: { cause: "test-defective", detail: disputeDetail(protectedFiles, reason) },
      };
    }
    const docs = newUnit({
      id,
      kind: "docs",
      role: "architect",
      complexity: "normal",
      wos: [chosen],
      frd: unit.frd,
      scope_repair: {
        target: unitId,
        attempt: unit.attempt,
        wo_file: wo.file,
        files: ordinary,
        reason,
        handback_seq: hb.seq,
        ...(protectedFiles.length ? { protected_files: protectedFiles } : {}),
      },
    });
    await ctx.writeState({ ...state, units: [...state.units, docs] });
    await ctx.appendEvent({ type: "unit_queued", data: docs });
    return {
      ok: true,
      cmd: "scope-repair",
      applied: true,
      action: "docs",
      docs: id,
      unit: unitId,
      attempt: unit.attempt,
    };
  });
  if (result.action === "dispute" && result.applied)
    result.doubt = await openUnitDoubt({ project, epoch, unit: unitId, diagnosis: result.diagnosis }, deps);
  return result;
}

/** Called every next pass after integration; retryable after a crash between docs integration and re-admission. */
export async function settleScopeRepairs(ctx, deps = {}) {
  const state = await ctx.readState();
  for (const docs of state.units.filter((u) => u.scope_repair && u.state === "integrated")) {
    const repair = docs.scope_repair,
      target = findUnit(await ctx.readState(), repair.target);
    if (target?.state !== "blocked" || target.attempt !== repair.attempt) continue;
    const current = await ctx.readState();
    const { events } = await readJournal(ctx.paths.journalFile, deps),
      hb = lastHandback(events, target.id);
    if (hb?.seq !== repair.handback_seq) continue; // A newer hand-back/decision always wins.
    const prefix = await productPrefix(ctx.project, deps),
      root = productRoot(path.resolve(ctx.project, current.integration.worktree), prefix);
    const exec = deps.exec ?? defaultExec;
    const integrated = events
      .filter((e) => e.type === "integrated" && e.data?.unit === docs.id && !e.data?.assumption)
      .at(-1)?.data?.sha;
    if (!integrated) throw err("INVALID_STATE", "scope repair has no integrated journal revision");
    const wo = (await readUnitWorkOrders(root, docs.wos, { ...deps, ref: integrated }))[0];
    const old = (await readUnitWorkOrders(root, docs.wos, { ...deps, ref: `${integrated}^` }))[0];
    const why = scopeAmendmentProblem({
      unit: docs,
      rel: wo.file,
      before: old.text,
      after: wo.text,
      targets: current.units,
      hashed: protectedPaths(current),
    });
    if (why) throw err("INVALID_INPUT", why);
    const dependencies = await scopeDependencyUnits(root, wo, current.units, deps);
    const externalDependencies = dependencies.filter((id) => id !== target.id); // A sibling WO in the same chain is already owned.
    if (externalDependencies.some((id) => !inScope(current, findUnit(current, id))))
      throw err("INVALID_INPUT", "scope repair cannot add a dependency outside run scope");
    const revision = await exec("git", ["rev-parse", integrated], { cwd: root });
    if (revision.code !== 0) throw err("INVALID_STATE", "scope repair revision is missing");
    await applyUnblock(
      ctx,
      {
        unitId: target.id,
        reason: repair.reason,
        scopeResolution: {
          handback_seq: hb.seq,
          docs: docs.id,
          revision: revision.stdout.trim(),
          depends_on: externalDependencies,
          dispute: Boolean(repair.protected_files?.length),
        },
      },
      deps,
    );
  }
}

const disputeDetail = (files, reason) => `Owner requests correction of protected tests ${files.join(", ")}: ${reason}`;

/** Outside the lease mutex: the ordinary repair must integrate before the protected dispute can open. */
export async function openScopeDisputes({ project, epoch }, deps = {}) {
  const { readState } = await import("./state.mjs");
  const { buildPaths } = await import("./paths.mjs");
  const state = await readState(project, deps);
  const { events } = await readJournal(buildPaths(project, deps).journalFile, deps);
  for (const docs of state.units.filter((u) => u.state === "integrated" && u.scope_repair?.protected_files?.length)) {
    const repair = docs.scope_repair;
    const target = findUnit(state, repair.target);
    if (target?.state !== "reported" || target.attempt !== repair.attempt || !target.depends_on.includes(docs.id))
      continue;
    const unblocked = events
      .filter(
        (e) => e.type === "unblocked" && e.data?.unit === target.id && e.data.handback_seq === repair.handback_seq,
      )
      .at(-1);
    if (!unblocked || lastHandback(events, target.id)?.seq !== repair.handback_seq) continue;
    // Opening is durable evidence of service, even after that dispute was decided and another doubt is reported.
    if (events.some((e) => e.type === "doubt_opened" && e.data?.unit === target.id && e.seq > unblocked.seq)) continue;
    await openUnitDoubt(
      {
        project,
        epoch,
        unit: target.id,
        diagnosis: { cause: "test-defective", detail: disputeDetail(repair.protected_files, repair.reason) },
      },
      deps,
    );
  }
}
