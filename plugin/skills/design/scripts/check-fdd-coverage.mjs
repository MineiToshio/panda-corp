#!/usr/bin/env node
/**
 * FDD <-> oracle coverage (DR-130): an FDD may only specify UI that the frozen prototype's captured states draw.
 * The oracle of a UI FRD is its shard, `docs/frds/<frd>/mocks/*.html`: one `<section class="mock-screen" id="<state>">`
 * per captured state (fidelity/shard.mjs), or, for hand-drawn mocks without sections, one state per file named by
 * its stem. The blocking fidelity gate compares the build with exactly those states, so UI the FDD names outside
 * them can never pass it (funko-tracker FRD-06/07, 2026-10-17: thirteen "GAP, no picture" states and a whole
 * operator console the prototype never drew, while check-design-gate.mjs said READY).
 *
 * Per UI FRD (frd.md has `ui: true`), fail-closed:
 *  1. states    every table row under `## Screens` and `## States` cites, in backticks, the id of a captured state of
 *               this FRD (`operator`, or `mocks/<file>.html#operator`); a row with none (a pictureless GAP) fails.
 *  2. oracle    when docs/design/prototype/reference/oracle-states.json exists, every cited state has an entry there
 *               for this FRD (the fidelity gate renders that table).
 *  3. copy      every microcopy key the FDD names in backticks, and every quoted label equal to a microcopy value,
 *               is drawn in this FRD's captured states (visible text and aria-label/placeholder/title/alt/value;
 *               `hidden`, demo-only, script, style and svg content excluded; `{placeholders}` and tags ignored).
 *  4. overrides the FDD does not declare the prototype wrong ("the prototype's ... is a demonstration", "unlike the
 *               prototype", ...): the prototype wins for visuals, so the FDD or the prototype is amended before freeze.
 * --plan (architecture readiness, step 9) adds:
 *  5. plan      every microcopy key or quoted label in the FRD's blueprint.md and work-orders/*.md is drawn there too.
 * Copy file: docs/design/microcopy*.json (the copywriter's keyed strings, nested or flat; every locale is read).
 *
 * Usage (from the project root): node check-fdd-coverage.mjs [--json] [--plan] [--frd <folder>]
 *   -> exit 0 when every check passes, 1 otherwise. Imported by check-design-gate.mjs (fddCoverage).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exists = p => fs.existsSync(p);
const read = p => (exists(p) ? fs.readFileSync(p, "utf8") : "");
const readJson = p => { try { return JSON.parse(read(p)); } catch { return null; } };
const listDir = (p, filter = () => true) => (exists(p) ? fs.readdirSync(p).filter(filter).sort() : []);
const head = (list, n = 8) => (list.length > n ? [...list.slice(0, n), `... and ${list.length - n} more`] : list);

// ---------------------------------------------------------------- text normalization

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·", laquo: "«", raquo: "»", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  const accent = /^([a-z])(acute|grave|circ|uml|tilde|cedil)$/i.exec(e);
  if (accent) return (accent[1] + { acute: "\u0301", grave: "\u0300", circ: "\u0302", uml: "\u0308", tilde: "\u0303", cedil: "\u0327" }[accent[2].toLowerCase()]).normalize("NFC");
  return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
});
/** Case-, whitespace- and typography-insensitive form used on both sides of every comparison. */
const squeeze = s => decode(String(s)).normalize("NFC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\.\.\./g, "…").toLowerCase().replace(/\s+/g, "");

/** The literal fragments of a copy value: HTML tags and balanced `{...}` placeholder/ICU groups removed. */
function fragments(value) {
  const text = String(value).replace(/<[^>]+>/g, " ");
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "{") { if (depth === 0) { parts.push(cur); cur = ""; } depth++; continue; }
    if (ch === "}" && depth > 0) { depth--; continue; }
    if (depth === 0) cur += ch;
  }
  parts.push(cur);
  return parts.map(squeeze).filter(f => /[\p{L}\p{N}]/u.test(f));
}

// ---------------------------------------------------------------- the oracle: captured states of one FRD

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);
const SKIP = new Set(["script", "style", "template", "svg", "noscript", "head", "title"]);
const TEXT_ATTRS = ["aria-label", "placeholder", "title", "alt", "value", "aria-description", "aria-valuetext"];
const SHARD_CHROME = /\b(mock-title|mock-note|mock-shots)\b/;

function parseAttrs(src) {
  const attrs = {};
  for (const m of src.matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

/**
 * The text each captured state shows, keyed by state id: `mock-screen` sections, else the file stem. Shard chrome
 * (the section heading, overlay notes), hidden or demo-only subtrees and non-rendered elements are skipped.
 * @returns {Map<string, string>} state id -> squeezed text
 */
export function mockStates(html, fileStem) {
  const chunks = new Map();
  const add = (id, text) => { if (text && id) chunks.set(id, (chunks.get(id) || "") + squeeze(text)); };
  const stack = [];
  const top = () => stack[stack.length - 1] || { skip: false, state: null };
  let sawSection = false;
  const tagRe = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  let last = 0;
  const pending = [];
  for (let m = tagRe.exec(html); m; m = tagRe.exec(html)) {
    pending.push({ text: html.slice(last, m.index), at: top() });
    last = tagRe.lastIndex;
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const attrs = parseAttrs(m[3]);
    const parent = top();
    const cls = attrs.class || "";
    let state = parent.state;
    if (tag === "section" && /\bmock-screen\b/.test(cls) && attrs.id) { state = attrs.id; sawSection = true; }
    const skip = parent.skip || SKIP.has(tag) || "hidden" in attrs || "data-demo-only" in attrs || SHARD_CHROME.test(cls);
    if (!skip) for (const a of TEXT_ATTRS) if (attrs[a]) pending.push({ text: ` ${attrs[a]} `, at: { skip: false, state } });
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}`, tagRe.lastIndex);
      tagRe.lastIndex = end < 0 ? html.length : end;
      last = tagRe.lastIndex;
      continue;
    }
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push({ tag, skip, state });
  }
  pending.push({ text: html.slice(last), at: top() });
  for (const p of pending) if (!p.at.skip) add(p.at.state ?? (sawSection ? null : fileStem), p.text.replace(/<[^>]*>/g, " "));
  if (!sawSection && !chunks.has(fileStem)) chunks.set(fileStem, "");
  return chunks;
}

/** Every captured state of one FRD: Map id -> text, plus the mock file each came from. */
function oracleOf(root, dir) {
  const mocks = path.join(root, "docs/frds", dir, "mocks");
  const states = new Map();
  for (const f of listDir(mocks, f => f.endsWith(".html"))) {
    for (const [id, text] of mockStates(read(path.join(mocks, f)), f.replace(/\.html$/, ""))) {
      states.set(id, (states.get(id) || "") + text);
    }
  }
  return { states, corpus: [...states.values()].join("\u0001") };
}

/** The oracle-states.json state ids per FRD folder (entries carry frd_slug, key "<frd>/<id>", or frd "FRD-NN"). */
function oracleTable(root) {
  const data = readJson(path.join(root, "docs/design/prototype/reference/oracle-states.json"));
  if (!data) return null;
  const list = Array.isArray(data) ? data : Array.isArray(data.states) ? data.states : [];
  return list.filter(s => s && typeof s === "object").map(s => {
    const key = typeof s.key === "string" ? s.key : "";
    return { slug: s.frd_slug || (key.includes("/") ? key.split("/")[0] : ""), frd: String(s.frd || "").toUpperCase(), id: s.state_id || s.id || (key.includes("/") ? key.split("/").pop() : key) };
  });
}
const frdNumber = dir => (/^frd-(\d+)/i.exec(dir)?.[1] ?? "").padStart(2, "0");
const tableIdsFor = (table, dir) => new Set(table.filter(s => s.slug === dir || (!s.slug && s.frd === `FRD-${frdNumber(dir)}`)).map(s => s.id));

// ---------------------------------------------------------------- the copy file

/** Flattened microcopy: Map key -> string[] (one value per locale file). */
export function loadCopy(root) {
  const dir = path.join(root, "docs/design");
  const files = listDir(dir, f => /^microcopy.*\.json$/i.test(f));
  const copy = new Map();
  const walk = (o, prefix) => {
    if (typeof o === "string") { copy.set(prefix, [...(copy.get(prefix) || []), o]); return; }
    if (o && typeof o === "object" && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) walk(v, prefix ? `${prefix}.${k}` : k);
  };
  for (const f of files) walk(readJson(path.join(dir, f)), "");
  const byValue = new Map();
  for (const [key, values] of copy) for (const v of values) { const s = squeeze(v.replace(/<[^>]+>/g, " ")); if (s && !byValue.has(s)) byValue.set(s, key); }
  return { files, copy, byValue };
}

// ---------------------------------------------------------------- reading a doc

/** The frontmatter blanked line for line, so reported line numbers are the file's. */
const stripFrontmatter = text => text.replace(/^---\n[\s\S]*?\n---(?=\n|$)/, m => m.replace(/[^\n]/g, ""));

/** `## Heading` sections: [{title, start (line index), lines}]. */
function sections(text) {
  const out = [];
  let cur = { title: "", start: 0, lines: [] };
  text.split("\n").forEach((line, i) => {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { out.push(cur); cur = { title: h[1], start: i, lines: [] }; return; }
    cur.lines.push({ n: i + 1, line });
  });
  out.push(cur);
  return out;
}

/** Data rows of every markdown table in a section (header and separator rows excluded). */
function tableRows(lines) {
  const rows = [];
  let inTable = false;
  let heading = "";
  for (const { n, line } of lines) {
    const t = line.trim();
    if (/^#{3,}\s/.test(t)) heading = t;
    if (!t.startsWith("|")) { inTable = false; continue; }
    if (!inTable) { inTable = true; continue; }
    const cells = t.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
    rows.push({ n, line: t, gap: /\bGAP\b/.test(t) || /\bGAP\b/.test(heading), label: (cells.find(Boolean) || "").replace(/[*`]/g, "").slice(0, 60) });
  }
  return rows;
}

const backticks = text => [...text.matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim());
const quotes = text => [...text.matchAll(/"([^"\n]{2,160})"|“([^”\n]{2,160})”/g)].map(m => m[1] ?? m[2]);

/** The UI copy a doc names: microcopy keys in backticks and quoted labels equal to a microcopy value. */
function namedCopy(lines, copy) {
  const named = new Map();
  for (const { n, line } of lines) {
    for (const tok of backticks(line)) if (copy.copy.has(tok) && !named.has(tok)) named.set(tok, { key: tok, n, shown: copy.copy.get(tok)[0] });
    for (const q of quotes(line)) {
      const key = copy.byValue.get(squeeze(q));
      if (key && !named.has(key)) named.set(key, { key, n, shown: q });
    }
  }
  return [...named.values()];
}

const drawn = (values, corpus) => values.some(v => { const fr = fragments(v); return fr.length === 0 || fr.every(f => corpus.includes(f)); });

const OVERRIDES = [
  /\bprototype(?:'s)?\b[^.\n|]{0,80}?\b(?:is|are) (?:only |just )?(?:a )?(?:demonstration|illustrative|wrong|outdated|stale|not the (?:initial|real|final|actual) state)\b/i,
  /\b(?:unlike|contrary to|differs? from|deviat(?:es|ing|ion) from|diverg(?:es|ing|ence) from|overrides?) the prototype\b/i,
  /\bnot (?:as|like) (?:in |on )?the prototype\b/i,
  /\bthe prototype (?:is wrong|got it wrong|should be ignored|is not binding)\b/i,
];

// ---------------------------------------------------------------- the checks

const uiFrds = root => listDir(path.join(root, "docs/frds"), d => d.startsWith("frd-")).filter(d => /^ui:\s*true/m.test(read(path.join(root, "docs/frds", d, "frd.md"))));

/**
 * @returns {{status: "OK"|"FAIL", label: string, details: string[]}[]}
 */
export function fddCoverage({ root = ".", plan = false, only = null } = {}) {
  const results = [];
  const push = (label, problems) => results.push({ status: problems.length ? "FAIL" : "OK", label, details: head(problems) });
  const frds = uiFrds(root).filter(d => !only || d === only || d.startsWith(`${only}-`));
  if (!frds.length) return results;
  const copy = loadCopy(root);
  push("machine-readable copy file (docs/design/microcopy.<locale>.json) for the FDD coverage check", copy.copy.size ? [] : ["none found: the copywriter's keyed strings are what the FDDs and the oracle are compared on"]);
  const table = oracleTable(root);
  const oracles = new Map(uiFrds(root).map(d => [d, oracleOf(root, d)]));
  const protoDir = path.join(root, "docs/design/prototype");
  const protoText = listDir(protoDir, f => f.endsWith(".html") && f !== "components.html").map(f => squeeze(read(path.join(protoDir, f)).replace(/<[^>]+>/g, " "))).join("\u0001");
  /**
   * The named copy this FRD's captured states do not draw, each with the reason. A string captured only in another
   * FRD passes when the same line names that FRD (an explicit cross-reference, e.g. "FRD-04's Exportar faltantes").
   */
  const uncovered = (named, dir, lines) => named.filter(e => !drawn(copy.copy.get(e.key), oracles.get(dir).corpus)).flatMap(e => {
    const other = [...oracles].filter(([d, o]) => d !== dir && drawn(copy.copy.get(e.key), o.corpus)).map(([d]) => d);
    const line = lines.find(l => l.n === e.n)?.line || "";
    if (other.some(d => new RegExp(`\\b(?:FRD|FDD)-0*${Number(frdNumber(d))}\\b|\\b${d.slice(0, 6)}`, "i").test(line))) return [];
    const why = other.length ? `captured only in ${other.join(", ")}: name that FRD on this line, or capture it here`
      : drawn(copy.copy.get(e.key), protoText) ? "in the prototype but in no captured state: add a configured state that shows it (fidelity.config.json states), re-shard, cite it"
        : "not in the prototype at all: draw it in a design round before freeze, or take it out of this FDD";
    return [{ ...e, why: `\`${e.key}\` "${e.shown}" (${why})` }];
  });

  for (const dir of frds) {
    const fddFile = path.join(root, "docs/frds", dir, "fdd.md");
    if (!exists(fddFile)) continue; // its absence is the design gate's MISSING, not a coverage finding
    const oracle = oracles.get(dir);
    const fdd = stripFrontmatter(read(fddFile));
    const secs = sections(fdd);
    if (!oracle.states.size) { push(`${dir}: FDD <-> oracle coverage`, ["no captured state in mocks/*.html: nothing for the FDD to cite"]); continue; }

    // 1. every screen/state row cites a captured state
    const rowSections = secs.filter(s => /^(Screens|States)\b/i.test(s.title));
    const rows = rowSections.flatMap(s => tableRows(s.lines));
    const tableIds = table ? tableIdsFor(table, dir) : new Set();
    const known = id => oracle.states.has(id) || tableIds.has(id);
    const unlisted = [];
    const uncited = [];
    for (const row of rows) {
      const ids = [...new Set(backticks(row.line).flatMap(t => [t, t.split("#").pop()]).filter(known))];
      if (ids.length) { if (table && !ids.some(id => tableIds.has(id))) unlisted.push(`line ${row.n} "${row.label}": cites ${ids.join(", ")}, none of which is an oracle-states.json entry for ${dir}`); }
      else uncited.push(`line ${row.n} "${row.label}": cites no captured state${row.gap ? " (a GAP with no capture: draw it in the prototype as a configured state, or take it out of this FRD)" : ""}`);
    }
    const stateProblems = [...uncited];
    if (!rowSections.length) stateProblems.push('no "## Screens" / "## States" section');
    else if (!rows.length) stateProblems.push("the Screens/States sections hold no table row: declare each screen and state in a table that cites its captured state id");
    push(`${dir}: every FDD screen and state row cites a captured oracle state`, stateProblems);

    // 2. the cited states are in the oracle table the fidelity gate renders
    if (table) push(`${dir}: every FDD screen and state row cites an oracle-states.json entry`, unlisted);

    // 3. every named UI string is drawn in this FRD's captured states
    const lines = secs.filter(s => !/^Fidelity references\b/i.test(s.title)).flatMap(s => s.lines);
    push(`${dir}: every UI string the FDD names is drawn in its captured states`, uncovered(namedCopy(lines, copy), dir, lines).map(e => `line ${e.n} ${e.why}`));

    // 4. the FDD does not overrule the prototype
    const overrides = lines.filter(({ line }) => OVERRIDES.some(re => re.test(line))).map(({ n, line }) => `line ${n}: ${line.trim().slice(0, 140)}`);
    push(`${dir}: the FDD does not overrule the prototype (amend the FDD or the prototype before freeze)`, overrides);

    // 5. the plan names only drawn UI
    if (plan) {
      const docs = [path.join(root, "docs/frds", dir, "blueprint.md"), ...listDir(path.join(root, "docs/frds", dir, "work-orders"), f => f.endsWith(".md") && f !== "README.md").map(f => path.join(root, "docs/frds", dir, "work-orders", f))].filter(exists);
      const planned = docs.flatMap(f => {
        const docLines = stripFrontmatter(read(f)).split("\n").map((line, i) => ({ n: i + 1, line }));
        return uncovered(namedCopy(docLines, copy), dir, docLines).map(e => `${path.relative(path.join(root, "docs/frds", dir), f)} line ${e.n} ${e.why}`);
      });
      push(`${dir}: blueprint and work orders plan only UI its captured states draw`, planned);
    }
  }
  return results;
}

// ---------------------------------------------------------------- CLI

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const onlyAt = args.indexOf("--frd");
  const results = fddCoverage({ root: ".", plan: args.includes("--plan"), only: onlyAt >= 0 ? args[onlyAt + 1] : null });
  const bad = results.filter(r => r.status !== "OK").length;
  if (args.includes("--json")) console.log(JSON.stringify({ ok: bad === 0, failing: bad, checks: results }, null, 2));
  else {
    for (const r of results) {
      console.log(`${r.status.padEnd(7)} ${r.label}`);
      for (const d of r.details) console.log(`          - ${d}`);
    }
    console.log(bad ? `NOT COVERED: ${bad} failing` : results.length ? "COVERED" : "COVERED (no UI FRD)");
  }
  process.exit(bad ? 1 : 0);
}
