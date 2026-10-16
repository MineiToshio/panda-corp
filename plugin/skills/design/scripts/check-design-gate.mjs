#!/usr/bin/env node
/**
 * Step 9 deliverable check (DR-054 + DR-056 + DR-128): existence AND quality are checked, never self-asserted.
 * Usage (from the project root): node check-design-gate.mjs [--json]
 *   → exit 0 when every check passes (prints READY), 1 otherwise.
 * Line prefixes: OK, MISSING (an artifact is absent), FAIL (present but not good enough), WARN (does not block).
 * Optional config `docs/design/freeze/fidelity.config.json`, the SAME file the fidelity toolkit reads and validated
 * against its schema (fidelity/config.schema.json). The gate reads `widths` and `themes` (the toolkit's defaults when
 * omitted) and `states.<frd>[]` (every configured mock id, with its own `widths` narrowing the matrix). Without a config
 * the mock matrix is 375/1280 x light/dark. Measured styles are checked against the scope recorded in
 * computed-styles.json itself (pareto: the default state at the touch and primary widths in every theme).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_THEMES, DEFAULT_WIDTHS, loadSchema, validate } from "./fidelity/config.mjs";

const exists = p => fs.existsSync(p);
const nonEmpty = (p, min = 200) => exists(p) && fs.statSync(p).size >= min;
const read = p => (exists(p) ? fs.readFileSync(p, "utf8") : "");
const readJson = p => { try { return JSON.parse(read(p)); } catch { return null; } };
const listDir = (p, filter = () => true) => (exists(p) ? fs.readdirSync(p).filter(filter) : []);
const asJson = process.argv.includes("--json");

/** @type {{status: "OK"|"MISSING"|"FAIL"|"WARN", label: string, details: string[]}[]} */
const results = [];
/** Records one check; `failAs` is the status shown when it does not pass (MISSING for absent artifacts, FAIL for quality). */
function check(label, ok, { failAs = "MISSING", details = [] } = {}) {
  results.push({ status: ok ? "OK" : failAs, label, details: ok ? [] : details });
}
const warn = (label, details = []) => results.push({ status: "WARN", label, details });
const quality = (label, problems) => check(label, problems.length === 0, { failAs: "FAIL", details: problems });
const head = (list, n = 6) => (list.length > n ? [...list.slice(0, n), `... and ${list.length - n} more`] : list);

const tokens = readJson("docs/design/design-tokens.json");
const tokenText = JSON.stringify(tokens || {});
const CONFIG_FILE = "docs/design/freeze/fidelity.config.json";
const config = readJson(CONFIG_FILE);
const protoDir = "docs/design/prototype";
const protoHtml = listDir(protoDir, f => f.endsWith(".html") && f !== "components.html");
const designDecisions = read("docs/design/design-decisions.md");
const uiFrds = listDir("docs/frds", d => d.startsWith("frd-")).filter(d => /^ui:\s*true/m.test(read(`docs/frds/${d}/frd.md`)));

// ---------------------------------------------------------------- existing existence checks (kept as they were)

function existenceChecks() {
  check("DESIGN.md exists and is not marked DRAFT", nonEmpty("DESIGN.md") && !/\bDRAFT\b/.test(read("DESIGN.md").split("\n").slice(0, 5).join("\n")));
  check("design-tokens.json parses", tokens);
  check("typography uses web fonts (no system-only stack as the first family)", tokens && !/"--font-[a-z]+":\s*"(ui-sans-serif|system-ui|-apple-system|ui-serif|serif|sans-serif)/.test(tokenText));
  check("design-decisions.md", nonEmpty("docs/design/design-decisions.md"));
  check("components.md non-empty with an AppShell row or an explicit no-shell note", nonEmpty("docs/design/components.md", 1000) && /AppShell|no persistent shell/i.test(read("docs/design/components.md")));
  check("a11y-report.md", nonEmpty("docs/design/a11y-report.md"));
  check("whole-app prototype in docs/design/prototype/", protoHtml.length > 0);
  check("component catalogue (prototype/components.html)", exists(path.join(protoDir, "components.html")));
  check("measured styles (prototype/reference/computed-styles.json)", nonEmpty(path.join(protoDir, "reference/computed-styles.json")));
  check("exported logo SVGs (prototype/logo/)", exists(path.join(protoDir, "logo")) && fs.readdirSync(path.join(protoDir, "logo")).some(f => f.endsWith(".svg")));
  check("fidelity-checklist.md", nonEmpty("docs/design/fidelity-checklist.md"));
  check("technical-assumptions.md", nonEmpty("docs/design/technical-assumptions.md"));
  for (const dir of uiFrds) {
    const mocks = `docs/frds/${dir}/mocks`;
    check(`${dir}: fdd.md`, nonEmpty(`docs/frds/${dir}/fdd.md`, 1000));
    check(`${dir}: mocks html + screenshots`, exists(mocks) && fs.readdirSync(mocks).some(f => f.endsWith(".html")) && exists(`${mocks}/screenshots`) && fs.readdirSync(`${mocks}/screenshots`).length > 0);
  }
}

// ---------------------------------------------------------------- quality: measured styles

const LEGACY_MOCK_WIDTHS = [375, 1280];
const configWidths = () => (config ? [...(Array.isArray(config.widths) ? config.widths : DEFAULT_WIDTHS)].sort((a, b) => a - b) : []);
const configThemes = () => (config ? [...(Array.isArray(config.themes) ? config.themes : DEFAULT_THEMES)] : []);
const sameSet = (a, b) => a.length === b.length && a.every(v => b.includes(v));
const isZeroBox = size => /^0(\.0+)?x0(\.0+)?$/.test(String(size ?? ""));
const isDefaultState = name => /^default\b/i.test(name);

/**
 * The `<theme>-<width>` contexts every component's default state must hold. A reference written by the toolkit records
 * its scope: under pareto the default state is measured at the touch and primary widths in every theme (768 is
 * captured by the shard and screens stages, not measured). Without a recorded scope: config themes x widths, else the
 * legacy 1280 and 375 at any theme (null).
 * @returns {{wanted: string[]|null, problems: string[]}}
 */
function requiredContexts(data) {
  const widths = configWidths();
  const themes = configThemes();
  const problems = [];
  if (config && Array.isArray(data.widths) && !sameSet(data.widths, widths)) problems.push(`measured at widths ${data.widths.join("/")} but the config says ${widths.join("/")}: re-run freeze.mjs measure`);
  if (config && Array.isArray(data.themes) && !sameSet(data.themes, themes)) problems.push(`measured in themes ${data.themes.join("/")} but the config says ${themes.join("/")}: re-run freeze.mjs measure`);
  const scope = data.scope;
  const allThemes = Array.isArray(data.themes) ? data.themes : themes;
  if (scope?.mode === "pareto" && Number.isFinite(scope.touchWidth) && Number.isFinite(scope.primaryWidth) && allThemes.length) {
    const ws = [...new Set([scope.touchWidth, scope.primaryWidth])];
    return { wanted: allThemes.flatMap(t => ws.map(w => `${t}-${w}`)), problems };
  }
  return { wanted: widths.length && themes.length ? themes.flatMap(t => widths.map(w => `${t}-${w}`)) : null, problems };
}

/** Problems with computed-styles.json: no components, no non-default states, missing widths/themes, 0x0 roots. */
function computedStylesProblems(file) {
  const data = readJson(file);
  if (!data) return ["does not parse as JSON"];
  const entries = Object.entries(data.components || {});
  if (!entries.length) return ["has no components"];
  const { wanted, problems } = requiredContexts(data);
  if (!entries.some(([, c]) => Object.keys(c.states || {}).some(s => !isDefaultState(s)))) problems.push("no component records a non-default state (hover, focus, open, error...)");
  const unmeasured = [];
  const zeroRoots = [];
  for (const [name, comp] of entries) {
    const states = Object.entries(comp.states || {});
    if (comp.note) continue;
    const [, base] = states.find(([s]) => isDefaultState(s)) || states[0] || [null, {}];
    const keys = Object.keys(base || {});
    const missing = wanted ? wanted.filter(k => !keys.includes(k)) : [1280, 375].filter(w => !keys.some(k => k.endsWith(`-${w}`))).map(String);
    if (missing.length) unmeasured.push(`${name} (default state lacks ${missing.join(", ")})`);
    const zero = states.some(([, rec]) => Object.values(rec).some(r => r && (r.root === null || isZeroBox(r.root?.size))));
    if (zero) zeroRoots.push(name);
  }
  if (unmeasured.length) problems.push(`${unmeasured.length} component(s) not measured at the required widths${wanted ? "/themes" : " (1280 and 375)"}: ${head(unmeasured, 4).join("; ")}`);
  if (zeroRoots.length) problems.push(`${zeroRoots.length} component(s) have a 0x0 root and no "note" explaining it: ${head(zeroRoots, 4).join("; ")}`);
  return problems;
}

// ---------------------------------------------------------------- quality: per-FRD mocks

const SHOT = /^(.+)-(\d{3,4})-([a-z][a-z0-9]*)\.jpg$/;
const LEGACY_SHOT = /^(.+)-(\d{3,4})\.jpg$/;

/** The mock matrix for one FRD: the toolkit's widths x themes, each configured state id narrowed by its own `widths`. */
function mockPolicy(dir) {
  const states = Array.isArray(config?.states?.[dir]) ? config.states[dir] : [];
  return {
    widths: config ? configWidths() : LEGACY_MOCK_WIDTHS,
    themes: config ? configThemes() : [...DEFAULT_THEMES],
    widthsById: Object.fromEntries(states.filter(s => Array.isArray(s.widths)).map(s => [s.id, s.widths])),
    ids: states.map(s => s.id),
  };
}

/** Which `<id>-<width>-<theme>.jpg` files are missing (every configured id included), and which ids still use the legacy `<id>-<width>.jpg`. */
function screenshotCoverage(files, policy) {
  const seen = new Map();
  const legacy = new Set();
  for (const f of files) {
    const m = SHOT.exec(f);
    if (m) { seen.set(`${m[1]}|${m[2]}|${m[3]}`, true); continue; }
    const l = LEGACY_SHOT.exec(f);
    if (l) { legacy.add(l[1]); for (const t of policy.themes) seen.set(`${l[1]}|${l[2]}|${t}`, true); }
  }
  const seenIds = [...new Set([...seen.keys()].map(k => k.split("|")[0]))];
  const ids = [...new Set([...policy.ids, ...seenIds])];
  const missing = [];
  for (const id of ids) {
    const widths = policy.widthsById[id] || policy.widths;
    for (const w of widths) for (const t of policy.themes) if (!seen.has(`${id}|${w}|${t}`)) missing.push(`${id}-${w}-${t}.jpg`);
  }
  return { seenIds, missing, legacy: [...legacy] };
}

function mockChecks(dir) {
  const mocks = `docs/frds/${dir}/mocks`;
  const policy = mockPolicy(dir);
  const shots = listDir(`${mocks}/screenshots`);
  const cov = screenshotCoverage(shots, policy);
  const label = `${dir}: mock screenshots cover every id at ${policy.widths.join("/")} x ${policy.themes.join("/")} (<id>-<width>-<theme>.jpg)`;
  if (!cov.seenIds.length) check(label, false, { failAs: "FAIL", details: ["no screenshot follows the <id>-<width>-<theme>.jpg naming"] });
  else quality(label, cov.missing.length ? [`${cov.missing.length} missing: ${head(cov.missing, 5).join(", ")}`] : []);
  if (cov.legacy.length) warn(`${dir}: legacy screenshot names <id>-<width>.jpg (rename to <id>-<width>-<theme>.jpg)`, head(cov.legacy));
  const htmls = listDir(mocks, f => f.endsWith(".html"));
  const unresolved = [];
  const demo = [];
  for (const f of htmls) {
    const html = read(`${mocks}/${f}`);
    const ids = new Set([...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));
    for (const m of html.matchAll(/<use\b[^>]*?href\s*=\s*["']#([^"']+)["']/gi)) if (!ids.has(m[1])) unresolved.push(`${f}: #${m[1]}`);
    for (const marker of demoMarkers(html)) demo.push(`${f}: ${marker}`);
  }
  quality(`${dir}: mock <use href="#..."> all resolve (the sprite is present)`, unresolved.length ? [`${unresolved.length} unresolved: ${head([...new Set(unresolved)], 5).join(", ")}`] : []);
  quality(`${dir}: mock HTML has no demo-only markers`, demo.length ? head(demo) : []);
  const fdd = read(`docs/frds/${dir}/fdd.md`);
  check(`${dir}: fdd.md has "## Fidelity references"`, /^##\s+Fidelity references\b/m.test(fdd), { failAs: "FAIL" });
}

/** Demo scaffolding that must not survive into a mock: data-demo-only attributes, demo-* classes, "Solo demo" text. */
function demoMarkers(html) {
  const out = [];
  if (/<[a-z][^>]*\sdata-demo-only(?=[\s=>/])/i.test(html)) out.push("data-demo-only attribute");
  if (/<[a-z][^>]*\sclass\s*=\s*["'][^"']*\bdemo-[\w-]+/i.test(html)) out.push("demo-* class");
  if (/>[^<]*\b(solo demo|demo only)\b[^<]*</i.test(html)) out.push('"Solo demo" text');
  return out;
}

// ---------------------------------------------------------------- quality: contract documents

function sectionOf(text, headingPattern) {
  const m = new RegExp(`^##\\s+${headingPattern}[^\\n]*\\n`, "mi").exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  return next < 0 ? rest : rest.slice(0, next);
}

const NAV_FIELDS = ["Shell landmark selector", "Top-level destinations", "Shell-exempt routes", "Mobile drawer/toggle"];

function navContractProblems(components) {
  const section = sectionOf(components, "AppShell nav contract");
  if (!section) return ['no "## AppShell nav contract" section'];
  const problems = NAV_FIELDS.filter(f => !new RegExp(`${f.replace(/[/]/g, "\\/")}[^\\n]*?:`, "i").test(section)).map(f => `missing field "${f}"`);
  const landmark = /Shell landmark selector[^:]*:\*{0,2}\s*`?([^`\n]*)/i.exec(section)?.[1]?.trim().toLowerCase();
  const hasShell = landmark && !landmark.startsWith("none");
  if (hasShell && !/path:\s*["'`]\/[\w\-./[\]:]*["'`]/.test(section)) problems.push("a shell is declared but no top-level destination has a real { label, path }");
  return problems;
}

function contractChecks() {
  const hasReconciliation = /^##\s+Functional reconciliation \(DR-064\)/m.test(designDecisions);
  check('design-decisions.md has "## Functional reconciliation (DR-064)"', hasReconciliation, { failAs: "FAIL" });
  quality("components.md carries the AppShell nav contract fields (DR-075)", navContractProblems(read("docs/design/components.md")));
  const target = sectionOf(read("docs/design/fidelity-checklist.md"), "Fidelity target");
  check('fidelity-checklist.md states the layered targets ("## Fidelity target")', target !== null && target.trim().length >= 80, { failAs: "FAIL", details: target === null ? ['no "## Fidelity target" section'] : ["the section is empty or a stub"] });
}

// ---------------------------------------------------------------- quality: freeze tracker and preflight

const normStatus = s => s.replace(/[*`_\s]/g, "").toLowerCase();
const STAGE_OK = new Set(["done", "deferred(owner)"]);

/** Stage rows: every table whose header has a Status column (fallback: "- stage: status" bullets). Other tables are ignored. */
function trackerStages(text) {
  const rows = [];
  let col = -1;
  let inTable = false;
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) { inTable = false; continue; }
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    if (!inTable) { inTable = true; col = cells.findIndex(c => /^\**status\**$/i.test(c)); continue; }
    if (col < 0 || cells.every(c => /^:?-{2,}:?$/.test(c)) || cells.length <= col) continue;
    rows.push({ stage: cells.slice(0, 2).filter(Boolean).join(" "), status: normStatus(cells[col]) });
  }
  if (rows.length) return rows;
  for (const m of text.matchAll(/^\s*[-*]\s*(.+?)\s*[:\u2014-]\s*(done|deferred\s*\(owner\)|pending|planned|in[_ -]?progress|todo|blocked)\b/gim)) rows.push({ stage: m[1], status: normStatus(m[2]) });
  return rows;
}

/** Duration in minutes from "8h", "1h30m", "90 min", "2d"; a bare number counts as hours. */
function parseMinutes(text) {
  if (text == null) return null;
  let total = 0;
  let any = false;
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(d|days?|h|hrs?|hours?|m|mins?|minutes?)?(?![a-z])/gi)) {
    const unit = (m[2] || "h").toLowerCase();
    total += Number(m[1]) * (unit.startsWith("d") ? 1440 : unit.startsWith("h") ? 60 : 1);
    any = true;
  }
  return any ? total : null;
}

const field = (text, name) => new RegExp(`${name}\\W*?[:=|]\\W*([0-9][^\\n|]*)`, "i").exec(text)?.[1]?.trim() ?? null;

function trackerProblems(text) {
  const problems = [];
  const stages = trackerStages(text);
  if (!stages.length) return ["no stage rows found (expected a table with a Status column)"];
  const open = stages.filter(s => !STAGE_OK.has(s.status));
  if (open.length) problems.push(`${open.length} stage(s) not done or deferred(owner): ${head(open.map(s => `${s.stage} [${s.status || "empty"}]`), 4).join("; ")}`);
  const box = parseMinutes(field(text, "time[_ -]?box"));
  const elapsed = parseMinutes(field(text, "elapsed"));
  if (box == null) problems.push("time_box is not recorded");
  if (elapsed == null) problems.push("elapsed is not recorded");
  if (box != null && elapsed != null && elapsed > box && !/shipped with backlog/i.test(text)) problems.push('elapsed is over time_box but there is no "shipped with backlog" note');
  return problems;
}

const sha256 = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

function acknowledgedIds(tracker) {
  const ids = new Set();
  for (const m of tracker.matchAll(/preflight[_ -]?ack(?:nowledged)?\W*:[ \t]*([^\n]*)/gi)) m[1].split(/[,\s]+/).map(id => id.replace(/[`*[\]"']/g, "")).filter(Boolean).forEach(id => ids.add(id));
  return ids;
}

function preflightChecks(tracker) {
  const file = "docs/design/freeze/preflight.json";
  const label = "freeze/preflight.json (last preflight-round result)";
  if (!exists(file)) { check(label, false, { details: ["run preflight-round.mjs <prototype> --save"] }); return; }
  const report = readJson(file);
  if (!report || report.tool !== "preflight-round") { check(label, false, { failAs: "FAIL", details: ["does not parse as a preflight-round report"] }); return; }
  check(label, true);
  const proto = protoHtml.map(f => path.join(protoDir, f)).find(f => path.basename(f) === path.basename(report.prototype || "")) || protoHtml.map(f => path.join(protoDir, f))[0];
  const stale = [];
  if (!report.complete) stale.push("the browser checks did not run (complete: false)");
  if (proto) {
    if (report.prototypeSha256 ? report.prototypeSha256 !== sha256(proto) : fs.statSync(file).mtimeMs < fs.statSync(proto).mtimeMs) stale.push("the prototype changed after the preflight ran");
  }
  quality("preflight ran fully and is newer than the prototype", stale);
  const fails = (report.findings || []).filter(f => f.severity === "fail");
  quality("preflight has no failures", fails.length ? head(fails.map(f => `[${f.check}] ${f.message}`), 4) : []);
  const warned = [...new Set((report.findings || []).filter(f => f.severity === "warn").map(f => f.check))];
  const acked = acknowledgedIds(tracker);
  const unacked = warned.filter(id => !acked.has(id));
  quality("preflight warnings are none or acknowledged in tracker.md (preflight-ack: <check ids>)", unacked.length ? [`unacknowledged: ${unacked.join(", ")}`] : []);
}

function freezeChecks() {
  const trackerFile = "docs/design/freeze/tracker.md";
  const tracker = read(trackerFile);
  check("freeze/tracker.md exists", nonEmpty(trackerFile, 20));
  if (tracker) quality("freeze/tracker.md: every stage done or deferred(owner), time_box and elapsed recorded", trackerProblems(tracker));
  preflightChecks(tracker);
}

// ---------------------------------------------------------------- quality: the fidelity config

/** The config must be the toolkit's: one schema (fidelity/config.schema.json) for the toolkit, this gate and the preflight. */
function configChecks() {
  if (!exists(CONFIG_FILE)) return;
  if (!config) { check(`${CONFIG_FILE} parses as JSON`, false, { failAs: "FAIL", details: ["does not parse as JSON"] }); return; }
  const errors = validate(loadSchema(), config);
  quality(`${CONFIG_FILE} matches the toolkit schema (scripts/fidelity/config.schema.json)`, errors.length ? head(errors, 5) : []);
}

// ---------------------------------------------------------------- run

function qualityChecks() {
  configChecks();
  const csFile = path.join(protoDir, "reference/computed-styles.json");
  if (nonEmpty(csFile)) quality("measured styles are state-complete (non-default states, required widths/themes, no 0x0 roots)", computedStylesProblems(csFile));
  for (const dir of uiFrds) mockChecks(dir);
  contractChecks();
  freezeChecks();
}

existenceChecks();
qualityChecks();

const bad = results.filter(r => r.status === "MISSING" || r.status === "FAIL").length;
const warnings = results.filter(r => r.status === "WARN").length;
if (asJson) {
  console.log(JSON.stringify({ ready: bad === 0, missing: bad, warnings, checks: results }, null, 2));
} else {
  for (const r of results) {
    console.log(`${r.status.padEnd(7)} ${r.label}`);
    for (const d of r.details) console.log(`          - ${d}`);
  }
  console.log(bad ? `NOT READY: ${bad} missing` : "READY");
}
process.exit(bad ? 1 : 0);
