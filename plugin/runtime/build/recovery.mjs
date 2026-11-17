// Causal oracle repair: an independent tests execution, never permission for a builder to change its own oracle.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "./fsx.mjs";
import { readJournal } from "./journal.mjs";
import { releaseParked } from "./park.mjs";
import { findUnit, newUnit } from "./state.mjs";
import { git, isTestSurface, productPrefix, productRoot } from "./units.mjs";

const err = message => Object.assign(new Error(message), { code: "INVALID_INPUT" });
export const doubtBasis = (state, unit, doubt) => {
  const text = [doubt.question, doubt.why, ...(doubt.options ?? []).map(o => o.text)].join(" ");
  const hashes = Object.assign({}, ...state.units.map(u => ({ ...u.test_hashes, ...u.probe_hashes })));
  // Only a replacement of a disputed oracle is causal. Tests of another contract and scope-only edits do not count.
  return JSON.stringify(Object.entries(hashes).filter(([f]) => text.includes(f)).sort());
};

export function planTestRepair(state, record) {
  const target = findUnit(state, record.unit);
  if (!target || !["build", "patch"].includes(target.kind)) throw err("fix-test requires a builder with an independent protected oracle");
  const body = [record.question, record.why, ...record.options.map(o => o.text)].join("\n");
  const old = Object.assign({}, ...state.units.map(u => ({ ...u.test_hashes, ...u.probe_hashes })));
  const files = Object.keys(old).filter(f => isTestSurface(f) && body.includes(f));
  if (!files.length) throw err("fix-test must cite concrete protected test files and the incompatible contract in the dispute");
  const id = `u-test-repair-${record.id}`;
  if (findUnit(state, id)) throw err("this fix-test already has a repair execution; it cannot requeue without new evidence");
  const repair = newUnit({ id, kind: "tests", frd: target.frd, wos: target.wos, zone: target.zone,
    risk_rules: target.risk_rules, complexity: target.complexity ?? "normal",
    test_repair: { target: target.id, doubt: record.id, reason: body, old_hashes: Object.fromEntries(files.map(f => [f, old[f]])) } });
  const released = releaseParked(state, record.id);
  const units = released.state.units.map(u => u.id === target.id
    ? { ...u, state: "queued", parked: null, pending_answer: null, token_hash: null, depends_on: [...new Set([...u.depends_on, id])] } : u);
  const changed = units.find(u => u.id === target.id);
  return { state: { ...released.state, units: [...units, repair] }, events: [...released.events,
    { type: "unit_queued", data: changed }, { type: "unit_queued", data: repair }],
    units: [{ unit: target.id, effect: "rework_queued" }], handbacks: [] };
}

/** Called inside the fenced integration phase, before a target can become dispatchable; safe to replay after a crash. */
export async function settleTestRepairs(ctx, deps = {}) {
  let state = await ctx.readState();
  const fs = deps.fs ?? fsp;
  for (const repair of state.units.filter(u => u.test_repair && u.state === "integrated")) {
    const target = findUnit(state, repair.test_repair.target);
    if (!target?.depends_on.includes(repair.id) || target.state !== "queued") continue;
    const files = Object.keys(repair.test_repair.old_hashes);
    if (files.some(f => !repair.test_hashes[f] || repair.test_hashes[f] === repair.test_repair.old_hashes[f])) throw err("oracle repair has no causal hash replacement");
    const { events } = await readJournal(ctx.paths.journalFile, deps);
    const sha = events.filter(e => e.type === "integrated" && e.data?.unit === repair.id && !e.data.assumption).at(-1)?.data.sha;
    if (!sha) throw err("oracle repair is not integrated on the run branch");
    const prefix = await productPrefix(ctx.project, deps);
    const root = productRoot(path.resolve(ctx.project, state.integration.worktree), prefix);
    for (const rel of files) {
      if (sha256Hex(await fs.readFile(path.join(root, rel))) !== repair.test_hashes[rel]) throw err(`integrated oracle hash differs: ${rel}`);
    }
    if (target.worktree) {
      const work = productRoot(target.worktree, prefix);
      for (const rel of files) {
        const hash = sha256Hex(await fs.readFile(path.join(work, rel)));
        if (![repair.test_repair.old_hashes[rel], repair.test_hashes[rel]].includes(hash)) throw err(`builder altered protected oracle: ${rel}`);
      }
      // Merge only verified integration history. Git preserves unrelated dirty implementation or refuses the merge.
      await git(deps, work, ["merge", "--no-edit", sha]);
      for (const rel of files) if (sha256Hex(await fs.readFile(path.join(work, rel))) !== repair.test_hashes[rel]) throw err(`builder did not receive repaired oracle: ${rel}`);
    }
    const rescueBase = target.rescue && target.worktree
      ? (await git(deps, productRoot(target.worktree, prefix), ["rev-parse", "HEAD"])).stdout.trim() : null;
    // Hash ownership moves to the new oracle version; the predecessor remains in test_repair.old_hashes and git.
    const units = state.units.map(u => {
      const strip = hashes => Object.fromEntries(Object.entries(hashes ?? {}).filter(([f]) => !files.includes(f)));
      if (u.id === repair.id) return u;
      return { ...u, test_hashes: strip(u.test_hashes), probe_hashes: strip(u.probe_hashes),
        ...(u.id === target.id ? { scope_revision: sha, depends_on: u.depends_on.filter(id => id !== repair.id), ...(u.rescue ? { state: "rescue", rescue: { ...u.rescue, base: rescueBase ?? u.rescue.base, credential: null, worker: null, protected: { ...u.rescue.protected, ...repair.test_hashes }, oracle_repair: { reason: repair.test_repair.reason, sha, old_hashes: repair.test_repair.old_hashes, new_hashes: repair.test_hashes } } } : {}) } : {}) };
    });
    for (const u of units.filter(u => u.id !== repair.id)) await ctx.appendEvent({ type: "unit_queued", data: u });
    state = { ...state, units };
    await ctx.writeState(state);
  }
  return state;
}
