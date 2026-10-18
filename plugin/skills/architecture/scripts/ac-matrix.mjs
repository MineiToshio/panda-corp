#!/usr/bin/env node
/**
 * AC -> work-order matrix (architecture readiness gate, DR-100: every AC is covered by exactly one work order).
 * An AC is DEFINED by a bullet `- **AC-NN-MMM.K** ...` (or `- **AC-NN-MMM.K:** ...`) in an FRD's frd.md; a struck-out
 * bullet (`- ~~**AC-...**`) and an id only mentioned in prose ("AC-06-008.1 removed with it") are not live.
 * A work order OWNS an AC when it copies that bullet into its body (the work-order skill: ACs copied inline).
 * Fail-closed:
 *  1. unique    no FRD defines the same AC twice
 *  2. covered   every live AC is owned by exactly one live work order (none = gap, two = duplicate)
 *  3. live      no work order owns an AC that no FRD defines (removed or mistyped ids)
 *  4. verbatim  the owned bullet's text equals the FRD's (whitespace and `**` aside): no stale criteria in a WO.
 *               A `(drawn in FRD-NN's ...)` note is allowed: DR-130's plan check asks a WO to name the FRD whose
 *               captured state draws a string, on the same line.
 *  5. readme    when a work-orders/README.md has an AC coverage table, it maps each AC to the same work order
 *
 * Usage (from the project root, or pass it): node ac-matrix.mjs [root] [--json] [--matrix]
 *   --matrix prints the AC -> WO table per FRD. Exit 0 when every check passes, 1 otherwise, 2 on a read error.
 */
import fs from "node:fs";
import path from "node:path";
import { acIdsIn, emit, liveWos, loadPlan, parseArgs, reporter, runCli, tablesUnder, woIdsIn } from "./lib-plan.mjs";

const DEF = /^\s*[-*]\s+(~~)?\s*\*\*(AC-\d{2}-\d{3}\.\d+)\b/;

/**
 * Extracts AC definition bullets (with continuation lines) from markdown.
 * @param {string} text
 * @returns {{id: string, text: string, removed: boolean}[]}
 */
export function acDefinitions(text) {
  const lines = text.split(/\r?\n/);
  const defs = [];
  for (let i = 0; i < lines.length; i++) {
    const m = DEF.exec(lines[i]);
    if (!m) continue;
    let body = lines[i];
    while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*[-*]\s/.test(lines[i + 1])) body += ` ${lines[++i].trim()}`;
    defs.push({ id: m[2], text: normalizeAc(body, m[2]), removed: Boolean(m[1]) });
  }
  return defs;
}

/** The criterion text after its id, without markdown emphasis or spacing differences. */
function normalizeAc(line, id) {
  const after = line.slice(line.indexOf(id) + id.length);
  return after
    .replace(/\*\*|~~/g, "")
    .replace(/^\s*:\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drops DR-130 cross-FRD notes (`(drawn in FRD-02's ficha)`) that a work order adds to a copied criterion. */
const withoutDrawnNotes = (text) => text.replace(/\s*\(drawn in [^()]*\)/g, "").replace(/\s+/g, " ").trim();

/**
 * Builds the matrix and its checks.
 * @param {ReturnType<typeof loadPlan>} plan
 */
export function analyzeAcs(plan) {
  const r = reporter();
  const live = new Map();
  const dupDefs = [];
  for (const frd of plan.frds) {
    if (!frd.frdFile) continue;
    for (const d of acDefinitions(fs.readFileSync(frd.frdFile, "utf8"))) {
      if (d.removed) continue;
      if (live.has(d.id)) dupDefs.push(`${d.id} defined twice (${live.get(d.id).frd} and ${frd.folder})`);
      else live.set(d.id, { frd: frd.folder, text: d.text });
    }
  }
  const missingFrd = plan.frds.filter((f) => !f.frdFile && f.woIds.length).map((f) => `${f.folder} has work orders but no frd.md`);
  r.check("every FRD with work orders has its frd.md", missingFrd);
  r.check("no AC is defined twice", dupDefs);

  const owners = new Map();
  const drift = [];
  for (const wo of liveWos(plan)) {
    for (const d of acDefinitions(wo.body)) {
      if (d.removed) continue;
      owners.set(d.id, [...(owners.get(d.id) ?? []), wo.id]);
      const src = live.get(d.id);
      if (src && src.text !== withoutDrawnNotes(d.text)) drift.push(`${wo.id} ${d.id}: the copied criterion differs from ${src.frd}/frd.md`);
    }
  }
  const gaps = [...live.keys()].filter((id) => !owners.has(id)).map((id) => `${id} (${live.get(id).frd}) is owned by no work order`);
  const dups = [...owners].filter(([, wos]) => wos.length > 1).map(([id, wos]) => `${id} is owned by ${wos.length} work orders: ${wos.join(", ")}`);
  const stale = [...owners].filter(([id]) => !live.has(id)).map(([id, wos]) => `${wos.join(", ")} owns ${id}, which no FRD defines (removed or mistyped)`);
  r.check("every live AC is owned by exactly one work order", [...gaps, ...dups]);
  r.check("no work order owns an AC the FRDs no longer define", stale);
  r.check("every owned AC is copied verbatim from its FRD", drift);

  const readmeProblems = [];
  const readmeAbsent = [];
  for (const frd of plan.frds) {
    if (!frd.readme) continue;
    const tables = tablesUnder(fs.readFileSync(frd.readme, "utf8"), /\bAC\b/);
    if (!tables.length) continue;
    const mapped = new Map();
    for (const t of tables)
      for (const row of t.rows) {
        const acs = acIdsIn(row.join(" "));
        const wos = woIdsIn(row.join(" "));
        if (!acs.length || !wos.length) continue;
        if (wos.length > 1 && acs.length === 1) readmeProblems.push(`${path.relative(plan.root, frd.readme)}: ${acs[0]} mapped to several WOs (${wos.join(", ")})`);
        for (const ac of acs) mapped.set(ac, wos);
      }
    for (const [ac, wos] of mapped) {
      const own = owners.get(ac) ?? [];
      if (wos.length === 1 && (own.length !== 1 || own[0] !== wos[0]))
        readmeProblems.push(`${path.relative(plan.root, frd.readme)}: ${ac} -> ${wos[0]}, but owned by ${own.join(", ") || "no work order"}`);
    }
    for (const [ac, src] of live) if (src.frd === frd.folder && !mapped.has(ac)) readmeAbsent.push(`${path.relative(plan.root, frd.readme)}: ${ac} missing from the AC table`);
  }
  r.check("each work-orders README AC table agrees with the work orders", readmeProblems);
  r.warn("each work-orders README AC table lists every AC of its FRD", readmeAbsent);

  const matrix = new Map();
  for (const [id, src] of [...live].sort()) matrix.set(src.frd, [...(matrix.get(src.frd) ?? []), `${id} -> ${(owners.get(id) ?? ["(none)"]).join(", ")}`]);
  return { results: r.results, live, owners, matrix };
}

runCli(import.meta.url, () => {
  const args = parseArgs(process.argv.slice(2), ["json", "matrix"]);
  const plan = loadPlan(args._[0] ?? ".");
  const { results, live, owners, matrix } = analyzeAcs(plan);
  const header = [];
  if (args.matrix) for (const [frd, rows] of matrix) header.push(`${frd}:`, ...rows.map((x) => `  ${x}`));
  const byFrd = new Map();
  for (const src of live.values()) byFrd.set(src.frd, (byFrd.get(src.frd) ?? 0) + 1);
  header.push(`${live.size} live ACs across ${byFrd.size} FRDs (${[...byFrd].map(([f, n]) => `${f.slice(0, 6)} ${n}`).join(" · ")}); ${[...owners.keys()].filter((k) => live.has(k)).length} owned`);
  return emit(results, { json: args.json, header, verdictOk: "AC MATRIX OK", verdictBad: "AC MATRIX NOT OK" });
});
