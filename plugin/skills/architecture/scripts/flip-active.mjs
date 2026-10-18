#!/usr/bin/env node
/**
 * The DRAFT -> ACTIVE flip with its evidence stamp (architecture step 9b2).
 * Refuses unless ALL of these hold, then flips and stamps in one pass:
 *  1. the three gate reports exist and their LAST verdict is PASS. A report ends PASS either because the gate passed,
 *     or because the lead appended a "## Resolution addendum" after the one fix pass that closes with
 *     "Verdict after resolution: PASS" (whitespace and markdown emphasis are ignored when reading verdicts);
 *  2. the deterministic plan checks are green: waves.mjs, ac-matrix.mjs and plan-consistency.mjs (re-verification).
 * Then, for every FRD: the blueprint's frontmatter (blueprint.md, or a blueprints/*.md part that carries `status:`)
 * gets `status: ACTIVE` (from DRAFT) plus `readiness_gate` / `grounding_gate` / `consistency_gate: passed <date>` and
 * `last_updated: <date>`; every DRAFT work order gets `status: ACTIVE`. ACTIVE, BLOCKED and SUPERSEDED docs keep their
 * status. Only frontmatter lines are rewritten; bodies are untouched. Re-running is a no-op.
 *
 * Usage (from the project root, or pass it):
 *   node flip-active.mjs [root] [--dry-run] [--date YYYY-MM-DD] [--reports docs/reviews] [--json]
 * Report names: architecture-readiness-gate.md, architecture-grounding-gate.md, architecture-consistency-gate.md.
 * Exit 0 flipped (or would flip, with --dry-run), 1 refused, 2 when the plan cannot be read.
 */
import fs from "node:fs";
import path from "node:path";
import { analyzeAcs } from "./ac-matrix.mjs";
import { emit, loadPlan, parseArgs, parseFrontmatter, reporter, runCli, splitFrontmatter } from "./lib-plan.mjs";
import { analyzeConsistency } from "./plan-consistency.mjs";
import { analyzeWaves } from "./waves.mjs";

export const GATE_REPORTS = {
  readiness_gate: "architecture-readiness-gate.md",
  grounding_gate: "architecture-grounding-gate.md",
  consistency_gate: "architecture-consistency-gate.md",
};

/**
 * The last verdict a gate report states (PASS / FAIL / BLOCKED), or null when it states none.
 * @param {string} text report markdown
 */
export function lastVerdict(text) {
  const flat = text.replace(/[*_`#]/g, " ").replace(/\s+/g, " ");
  const all = [...flat.matchAll(/\bverdict\b(?:\s+after\s+resolution)?\s*:?\s*(PASS|FAIL|BLOCKED)\b/gi)];
  return all.length ? all.at(-1)[1].toUpperCase() : null;
}

/** Sets (or appends) `key: value` in frontmatter text. */
function setKey(raw, key, value) {
  const re = new RegExp(`^${key}:[^\\n]*$`, "m");
  return re.test(raw) ? raw.replace(re, `${key}: ${value}`) : `${raw}\n${key}: ${value}`;
}

/**
 * Plans (and with `write`, applies) the flip.
 * @param {string} root project root
 * @param {{date: string, reportsDir?: string, write?: boolean}} opts
 */
export function flipActive(root, { date, reportsDir = "docs/reviews", write = false }) {
  const plan = loadPlan(root);
  const r = reporter();
  const gateProblems = [];
  for (const [field, name] of Object.entries(GATE_REPORTS)) {
    const p = path.join(root, reportsDir, name);
    if (!fs.existsSync(p)) {
      gateProblems.push(`${field}: ${path.join(reportsDir, name)} is missing`);
      continue;
    }
    const v = lastVerdict(fs.readFileSync(p, "utf8"));
    if (v !== "PASS") gateProblems.push(`${field}: ${path.join(reportsDir, name)} ends with verdict ${v ?? "(none stated)"}; a FAIL needs the fix pass plus a resolution addendum ending "Verdict after resolution: PASS"`);
  }
  r.check("the three gate reports end with a PASS verdict", gateProblems);
  const checks = [...analyzeWaves(plan).results, ...analyzeAcs(plan).results, ...analyzeConsistency(plan).results];
  r.check(
    "the deterministic plan checks are green (waves, ac-matrix, plan-consistency)",
    checks.filter((c) => c.status === "FAIL").flatMap((c) => [c.label, ...c.details.map((d) => `  ${d}`)]),
  );

  const changes = [];
  const edits = [];
  if (!r.failed()) {
    for (const frd of plan.frds) {
      const blueprints = frd.blueprintFiles.filter((f) => {
        const fm = splitFrontmatter(fs.readFileSync(f, "utf8"));
        return fm && "status" in parseFrontmatter(fm.raw);
      });
      if (frd.woIds.length && !blueprints.length) changes.push(`WARN ${frd.folder}: no blueprint frontmatter with a status to stamp`);
      for (const f of blueprints) {
        const text = fs.readFileSync(f, "utf8");
        const fm = splitFrontmatter(text);
        const data = parseFrontmatter(fm.raw);
        let raw = fm.raw;
        if (data.status === "DRAFT") raw = setKey(raw, "status", "ACTIVE");
        if (data.status === "DRAFT" || data.status === "ACTIVE") {
          for (const field of Object.keys(GATE_REPORTS)) if (!String(data[field] ?? "").startsWith("passed")) raw = setKey(raw, field, `passed ${date}`);
        }
        if (raw !== fm.raw) {
          raw = setKey(raw, "last_updated", date);
          changes.push(`${path.relative(root, f)}: ${data.status} -> ${parseFrontmatter(raw).status}, gates stamped`);
          edits.push([f, `---\n${raw}\n---\n${text.slice(fm.length)}`]);
        }
      }
    }
    for (const wo of plan.wos.values()) {
      if (wo.status !== "DRAFT") continue;
      const text = fs.readFileSync(wo.abs, "utf8");
      const fm = splitFrontmatter(text);
      changes.push(`${wo.file}: DRAFT -> ACTIVE`);
      edits.push([wo.abs, `---\n${setKey(fm.raw, "status", "ACTIVE")}\n---\n${text.slice(fm.length)}`]);
    }
    if (write) for (const [f, content] of edits) fs.writeFileSync(f, content);
  }
  return { results: r.results, changes, refused: r.failed(), edits: edits.length };
}

runCli(import.meta.url, () => {
  const args = parseArgs(process.argv.slice(2), ["json", "dry-run"]);
  const date = args.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD (got ${date})`);
  const dry = Boolean(args["dry-run"]);
  const out = flipActive(args._[0] ?? ".", { date, reportsDir: args.reports, write: !dry });
  const header = out.refused ? [] : [...out.changes, `${out.edits} file(s) ${dry ? "would change (dry run, nothing written)" : "changed"}`];
  return emit(out.results, {
    json: args.json,
    header,
    verdictOk: dry ? "FLIP READY (dry run)" : "FLIPPED",
    verdictBad: "FLIP REFUSED",
  });
});
