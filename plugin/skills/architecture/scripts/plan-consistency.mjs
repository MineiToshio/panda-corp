#!/usr/bin/env node
/**
 * Plan consistency (architecture readiness gate): the three places a work order's place in the plan is written agree.
 *   work-order frontmatter (the source of truth, DR-050)  ==  the blueprint's `## Build Plan` DAG table row
 *                                                          ==  the work-orders/README.md `## Work orders` table row
 * Per FRD, fail-closed:
 *  1. table      the blueprint (blueprint.md or a blueprints/*.md part) has a Build Plan table with WO and Depends on columns
 *  2. rows       every live work order has exactly one Build Plan row and one README row; no row names an unknown WO
 *  3. dependsOn  frontmatter `dependsOn` == Build Plan "Depends on" == README "Depends on" (as sets; `—` = none)
 *  4. artifacts  frontmatter `artifacts` == the Build Plan's backticked "Artifacts" globs (as sets), when that column exists
 *  5. foundation frontmatter `foundation` == the Build Plan "Foundation" column, when it exists
 *  6. wave       a "Wave" column (or a `W<n>` in "Parallel with") matches the wave computed from dependsOn
 *
 * Usage (from the project root, or pass it): node plan-consistency.mjs [root] [--json]
 *   -> exit 0 when every check passes, 1 otherwise, 2 when the plan cannot be read.
 */
import fs from "node:fs";
import path from "node:path";
import { backticked, computeWaves, emit, fmtSet, liveWos, loadPlan, parseArgs, reporter, runCli, sameSet, tablesUnder, woIdsIn } from "./lib-plan.mjs";

const col = (header, re) => header.findIndex((h) => re.test(h));

/** Reads the rows of the first table under a heading that has WO + Depends on columns. */
function planRows(file, headingRe) {
  const tables = tablesUnder(fs.readFileSync(file, "utf8"), headingRe);
  for (const t of tables) {
    const wo = col(t.header, /^wo\b|work order/);
    const deps = col(t.header, /depends/);
    if (wo < 0 || deps < 0) continue;
    // A blank line inside a markdown table ends it: the rows after it render as a broken table of their own.
    // Such a fragment has no header row: its first line is already a work-order row.
    const stray = tables
      .filter((x) => x !== t && /^wo-\d{2}-\d{3}$/.test(x.header[0] ?? ""))
      .flatMap((x) => [x.header[0].toUpperCase(), ...x.rows.flatMap((row) => woIdsIn(row[0] ?? ""))]);
    return {
      file,
      stray,
      rows: t.rows.map((row) => ({
        ids: woIdsIn(row[wo] ?? ""),
        deps: woIdsIn(row[deps] ?? ""),
        artifacts: col(t.header, /artifact/) >= 0 ? backticked(row[col(t.header, /artifact/)] ?? "") : null,
        foundation: col(t.header, /foundation/) >= 0 ? (row[col(t.header, /foundation/)] ?? "").replace(/[`*]/g, "").trim().toLowerCase() : null,
        wave: col(t.header, /^wave$/) >= 0 ? row[col(t.header, /^wave$/)] : col(t.header, /parallel/) >= 0 ? row[col(t.header, /parallel/)] : null,
      })),
    };
  }
  return null;
}

/**
 * Compares frontmatter, Build Plan and README for every FRD.
 * @param {ReturnType<typeof loadPlan>} plan
 */
export function analyzeConsistency(plan) {
  const r = reporter();
  const { wave } = computeWaves(plan);
  const live = new Set(liveWos(plan).map((w) => w.id));
  const missingTable = [];
  const rowProblems = [];
  const depProblems = [];
  const artProblems = [];
  const foundProblems = [];
  const waveProblems = [];
  const rel = (f) => path.relative(plan.root, f);

  for (const frd of plan.frds) {
    const own = frd.woIds.filter((id) => live.has(id));
    if (!own.length) continue;
    let bp = null;
    for (const f of frd.blueprintFiles) {
      bp = planRows(f, /build plan/i);
      if (bp) break;
    }
    const readme = frd.readme ? planRows(frd.readme, /work orders/i) : null;
    if (!bp) missingTable.push(`${frd.folder}: no Build Plan DAG table (WO + Depends on columns) in ${frd.blueprintFiles.map(rel).join(", ") || "any blueprint"}`);
    if (!readme) missingTable.push(`${frd.folder}: no "## Work orders" table (WO + Depends on columns) in work-orders/README.md`);

    for (const [label, src] of [["Build Plan", bp], ["README", readme]]) {
      if (!src) continue;
      const seen = new Map();
      for (const id of src.stray) rowProblems.push(`${rel(src.file)}: the ${label} row for ${id} sits outside the table (a blank line splits it)`);
      for (const row of src.rows) {
        if (row.ids.length !== 1) continue;
        const id = row.ids[0];
        if (!plan.wos.has(id) || !live.has(id)) rowProblems.push(`${rel(src.file)}: ${label} row ${id} names no live work order`);
        else if (plan.wos.get(id).frd !== frd.folder) rowProblems.push(`${rel(src.file)}: ${label} row ${id} belongs to ${plan.wos.get(id).frd}`);
        seen.set(id, [...(seen.get(id) ?? []), row]);
      }
      for (const id of own) {
        const rows = seen.get(id) ?? [];
        if (rows.length !== 1) {
          if (!rows.length && src.stray.includes(id)) continue;
          rowProblems.push(`${rel(src.file)}: ${rows.length ? `${rows.length} ${label} rows` : `no ${label} row`} for ${id}`);
          continue;
        }
        const row = rows[0];
        const wo = plan.wos.get(id);
        if (!sameSet(row.deps, wo.deps)) depProblems.push(`${id}: frontmatter dependsOn [${fmtSet(wo.deps)}] != ${label} [${fmtSet(row.deps)}]`);
        if (label !== "Build Plan") continue;
        if (row.artifacts !== null && !sameSet(row.artifacts, wo.artifacts)) {
          const onlyFm = wo.artifacts.filter((a) => !row.artifacts.includes(a));
          const onlyBp = row.artifacts.filter((a) => !wo.artifacts.includes(a));
          artProblems.push(`${id}: frontmatter only [${fmtSet(onlyFm)}]; Build Plan only [${fmtSet(onlyBp)}]`);
        }
        if (row.foundation !== null && row.foundation !== String(wo.foundation)) foundProblems.push(`${id}: frontmatter foundation ${wo.foundation} != Build Plan "${row.foundation}"`);
        const label2 = /\bW(\d+)\b/.exec(row.wave ?? "");
        if (label2 && wave.has(id) && Number(label2[1]) !== wave.get(id)) waveProblems.push(`${id}: Build Plan says W${label2[1]}, dependsOn puts it in W${wave.get(id)}`);
      }
    }
  }
  r.check("every FRD with work orders has a Build Plan table and a README work-orders table", missingTable);
  r.check("every live work order has exactly one Build Plan row and one README row", rowProblems);
  r.check("dependsOn agrees across frontmatter, Build Plan and README", depProblems);
  r.check("artifacts agree between frontmatter and Build Plan", artProblems);
  r.check("foundation agrees between frontmatter and Build Plan", foundProblems);
  r.check("Build Plan wave labels match the waves computed from dependsOn", waveProblems);
  return { results: r.results };
}

runCli(import.meta.url, () => {
  const args = parseArgs(process.argv.slice(2), ["json"]);
  const plan = loadPlan(args._[0] ?? ".");
  const { results } = analyzeConsistency(plan);
  const header = [`${liveWos(plan).length} live work orders in ${plan.frds.filter((f) => f.woIds.length).length} FRDs`];
  return emit(results, { json: args.json, header, verdictOk: "PLAN CONSISTENT", verdictBad: "PLAN INCONSISTENT" });
});
