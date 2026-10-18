#!/usr/bin/env node
/**
 * Context packs for the architecture planning pipeline (read once, write many; DR-131 v3).
 * The lead runs it ONCE after the platform architecture (and again after the work-order map exists); every later
 * agent (blueprint authors, the reconciler, the gates, the fix pass) reads its pack plus the files it owns instead of
 * the whole doc set. Read-only on docs/: it writes only into the packs folder (gitignored runtime scaffolding).
 * A pack is a digest of the cross-cutting facts, NOT a replacement for an FRD: whoever plans or judges an FRD still
 * reads its frd.md in full (scope, business rules, edge cases, contracts live outside the AC bullets).
 *
 * Per FRD, `frd-NN.md` holds, extracted deterministically:
 *   - the REQ heading lines and every live AC bullet VERBATIM from frd.md (with its id, continuation lines kept)
 *   - the route-map rows of docs/product/architecture.md whose FRD column cites this FRD (or "all")
 *   - the data-model.json entities the FRD names (whole word, PascalCase or spaced form), with their attributes
 *   - the oracle states of docs/design/prototype/reference/oracle-states.json with this `frd_slug`
 *   - the microcopy keys the FDD cites (backticked keys, or quoted labels equal to a microcopy value)
 *   - the FRD's slice of the work-order map (§2 catalogue and §5 author notes), when the map exists
 * `_global.md` holds: the architecture.md outline with line numbers (open a section by offset, never the whole
 * file), the ADR index (ACCEPTED = binding; PROPOSED apart; SUPERSEDED omitted), the route rows owned by no single FRD, the "Pinned versions" section, and the map's global
 * sections (§0 rules incl. shared-file owners, §1 foundation, §3 DAG, §8 binding resolutions).
 *
 * Usage (from the project root, or pass it):
 *   node build-packs.mjs [root] [--out <dir>] [--map <wo-map.md>] [--frd frd-NN] [--json]
 *   --out defaults to <root>/.pandacorp/run/architecture/packs, --map to <root>/.pandacorp/run/architecture/wo-map.md.
 * Prints each pack's size next to the full doc set an agent would otherwise read.
 * Exit 0 when every pack is complete, 1 when an FRD yields no live AC (an unrecognised shape, never a silent empty
 * pack, DR-078), 2 when a source cannot be read or parsed.
 */
import fs from "node:fs";
import path from "node:path";
import { loadCopy } from "../../design/scripts/check-fdd-coverage.mjs";
import { emit, parseArgs, reporter, runCli } from "./lib-plan.mjs";

const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, "utf8");
const listDir = (p, filter = () => true) => (exists(p) ? fs.readdirSync(p).filter(filter).sort() : []);
const readJson = (p) => {
  try {
    return JSON.parse(read(p));
  } catch (err) {
    throw new Error(`${p}: unreadable JSON (${err.message})`);
  }
};

const AC_DEF = /^\s*[-*]\s+(~~)?\s*\*\*(AC-\d{2}-\d{3}\.\d+)\b/;
const REQ_LINE = /^(#{2,5}\s+.*|\s*\*\*)REQ-\d{2}-\d{3}\b/;

/**
 * The REQ heading lines and live AC bullets of an FRD, verbatim, in document order.
 * @param {string} text frd.md
 * @returns {{lines: string[], acIds: string[], removed: number}}
 */
export function frdCriteria(text) {
  const src = text.split(/\r?\n/);
  const lines = [];
  const acIds = [];
  let removed = 0;
  for (let i = 0; i < src.length; i++) {
    if (REQ_LINE.test(src[i])) {
      lines.push("", src[i].trim());
      continue;
    }
    const m = AC_DEF.exec(src[i]);
    if (!m) continue;
    const block = [src[i]];
    while (i + 1 < src.length && /^\s{2,}\S/.test(src[i + 1]) && !/^\s*[-*]\s/.test(src[i + 1])) block.push(src[++i]);
    if (m[1]) {
      removed++;
      continue;
    }
    acIds.push(m[2]);
    lines.push(...block);
  }
  return { lines: lines[0] === "" ? lines.slice(1) : lines, acIds, removed };
}

/** `## Heading` sections of a markdown text: [{title, line (1-based), body lines}]. */
function h2Sections(text) {
  const out = [];
  let cur = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      cur = { title: h[1], line: i + 1, lines: [line] };
      out.push(cur);
    } else if (cur) cur.lines.push(line);
  });
  return out;
}

/** The body under the first `##`/`###` heading matching `re`, up to the next heading of the same or a higher level. */
function headingBlock(text, re) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{2,3}\s/.test(l) && re.test(l));
  if (at < 0) return [];
  const level = /^#+/.exec(lines[at])[0].length;
  const end = lines.findIndex((l, i) => i > at && /^#+\s/.test(l) && /^#+/.exec(l)[0].length <= level);
  return lines.slice(at + 1, end < 0 ? undefined : end);
}

/**
 * The ADR index by status: ACCEPTED ones are binding; PROPOSED (or unlabelled) ones are listed apart with their
 * status; SUPERSEDED/DEPRECATED/REJECTED ones are omitted and only counted.
 * @param {{file: string, text: string}[]} adrs
 * @returns {{accepted: string[], other: string[], superseded: number}}
 */
export function adrIndex(adrs) {
  const out = { accepted: [], other: [], superseded: 0 };
  for (const { file, text } of adrs) {
    const title = (/^title:\s*(.+)$/m.exec(text)?.[1] ?? /^#\s+(.+)$/m.exec(text)?.[1] ?? file).replace(/^["']|["']$/g, "");
    const status = (/^status:\s*(\S+)/m.exec(text)?.[1] ?? "").toUpperCase();
    if (/^(SUPERSEDED|DEPRECATED|REJECTED)/.test(status)) out.superseded++;
    else if (status === "ACCEPTED") out.accepted.push(`- \`${file}\` · ${title}`);
    else out.other.push(`- \`${file}\` · ${status || "NO STATUS"} · ${title}`);
  }
  return out;
}

/** `### FRD-NN ...` subsections inside a section's lines, keyed by FRD number. */
function frdSubsections(lines) {
  const out = new Map();
  let cur = null;
  for (const line of lines) {
    const h = /^###\s+FRD-(\d{2})\b/.exec(line);
    if (h) {
      cur = [line];
      out.set(h[1], cur);
    } else if (/^##?#?\s/.test(line) && !/^####/.test(line)) cur = null;
    else if (cur) cur.push(line);
  }
  return out;
}

/** FRD numbers a route-map FRD cell cites: `01`, `03, 04`, `FRD-05`; "all" → "*"; anything else → none. */
export function frdsInCell(cell) {
  const c = cell.replace(/[`*]/g, "").trim();
  if (/^all\b/i.test(c)) return ["*"];
  const head = c.split(/[(;]/)[0];
  return [...new Set([...head.matchAll(/\b(?:FRD-)?(\d{1,2})\b/gi)].map((m) => m[1].padStart(2, "0")))];
}

/**
 * The route map tables of architecture.md (any `## ...Route map...` section), with the index of the FRD column.
 * @returns {{header: string, sep: string, rows: {line: string, frds: string[]}[], hasFrdColumn: boolean}[]}
 */
export function routeTables(archText) {
  const sec = h2Sections(archText).find((s) => /route map/i.test(s.title));
  if (!sec) return [];
  const tables = [];
  let cur = null;
  const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  for (const line of sec.lines) {
    if (!/^\s*\|/.test(line)) {
      cur = null;
      continue;
    }
    if (!cur) {
      const header = cells(line).map((c) => c.toLowerCase());
      cur = { header: line.trim(), sep: "", frdCol: header.findIndex((h) => /^frds?$|feature/.test(h)), rows: [] };
      tables.push(cur);
    } else if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) cur.sep = line.trim();
    else cur.rows.push({ line: line.trim(), frds: cur.frdCol >= 0 ? frdsInCell(cells(line)[cur.frdCol] ?? "") : [] });
  }
  return tables.map((t) => ({ header: t.header, sep: t.sep, rows: t.rows, hasFrdColumn: t.frdCol >= 0 }));
}

const spaced = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
const wordRe = (w, flags = "") => new RegExp(`(^|[^A-Za-z0-9_])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?(?=$|[^A-Za-z0-9_])`, flags);

/**
 * The data-model entities a text names: the entity name as a whole word, case-sensitive (plural `s` allowed), or,
 * for a compound name, its spaced form in any case (`CompletionGoal` → "completion goal"). A one-word name is not
 * matched in lower case, so prose like "your account" does not pull in `Account`.
 */
export function namedEntities(text, model) {
  const entities = Array.isArray(model?.entities) ? model.entities : [];
  return entities.filter((e) => {
    if (typeof e.name !== "string" || !e.name) return false;
    if (wordRe(e.name).test(text)) return true;
    const words = spaced(e.name);
    return words.includes(" ") && wordRe(words, "i").test(text);
  });
}

const entityLine = (e) => {
  const attrs = (e.attributes ?? []).map((a) => `${a.name}${a.optional ? "?" : ""}:${a.type}${a.keys?.length ? ` [${a.keys.join(",")}]` : ""}`);
  return `- \`${e.name}\`: ${attrs.join(", ") || "(no attributes)"}`;
};

/** Oracle states of one FRD folder (entries carry `frd_slug`, or a `key` "<folder>/<id>"). */
export function oracleStatesFor(oracle, folder) {
  const states = Array.isArray(oracle?.states) ? oracle.states : [];
  return states.filter((s) => (s.frd_slug || (typeof s.key === "string" ? s.key.split("/")[0] : "")) === folder);
}

const stateLine = (s) => {
  const route = s.build?.route ? `${s.build.route}${s.build.query ? `?${typeof s.build.query === "string" ? s.build.query : JSON.stringify(s.build.query)}` : ""}` : "(no build route)";
  return `- \`${s.state_id ?? s.id ?? s.key}\` · ${s.kind ?? "state"} · ${s.title ?? ""} · build ${route}${s.gallery_only ? " · gallery only" : ""}`;
};

const backticks = (t) => [...t.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
const quotes = (t) => [...t.matchAll(/"([^"\n]{2,160})"|“([^”\n]{2,160})”/g)].map((m) => m[1] ?? m[2]);
const squeeze = (s) => s.replace(/\s+/g, " ").trim();

/** Microcopy keys an FDD cites (backticked keys, or a quoted label equal to a microcopy value), in first-use order. */
export function citedCopyKeys(fddText, copy) {
  const norm = (v) => v.replace(/<[^>]+>/g, " ").normalize("NFC").toLowerCase().replace(/\s+/g, "");
  const byValue = new Map();
  for (const [key, values] of copy.copy) for (const v of values) if (norm(v) && !byValue.has(norm(v))) byValue.set(norm(v), key);
  const keys = [];
  for (const line of fddText.split(/\r?\n/)) {
    for (const tok of backticks(line)) if (copy.copy.has(tok)) keys.push(tok);
    for (const q of quotes(line)) {
      const k = byValue.get(norm(q));
      if (k) keys.push(k);
    }
  }
  return [...new Set(keys)];
}

const docSetFiles = (root) => {
  const files = [];
  const add = (rel) => exists(path.join(root, rel)) && files.push(rel);
  for (const f of ["DESIGN.md", "docs/product/prd.md", "docs/product/architecture.md", "docs/product/research.md", "docs/product/data-model.json", "docs/analytics/events.md", "docs/design/prototype/reference/oracle-states.json"]) add(f);
  for (const dir of ["docs/adr", "docs/design", "docs/rules"])
    for (const f of listDir(path.join(root, dir), (n) => /\.(md|json)$/.test(n) && !/history/.test(n))) add(`${dir}/${f}`);
  for (const frd of listDir(path.join(root, "docs/frds"), (n) => /^frd-\d{2}-/.test(n))) for (const f of ["frd.md", "fdd.md"]) add(`docs/frds/${frd}/${f}`);
  return files;
};

const bytes = (root, rels) => rels.reduce((n, rel) => n + fs.statSync(path.join(root, rel)).size, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB (~${Math.round(n / 4 / 1000)}k tokens)`;
const none = (why) => [`_none (${why})_`];

/**
 * Builds every pack. Pure apart from reading `root` and writing `out`.
 * @returns {{results: object[], packs: {file: string, bytes: number}[], docSet: {files: number, bytes: number}}}
 */
export function buildPacks({ root = ".", out, map, only = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const frdsDir = path.join(root, "docs/frds");
  if (!exists(frdsDir)) throw new Error(`no docs/frds folder under ${root}`);
  const outDir = out ?? path.join(root, ".pandacorp/run/architecture/packs");
  const mapFile = map ?? path.join(root, ".pandacorp/run/architecture/wo-map.md");
  const archFile = path.join(root, "docs/product/architecture.md");
  const modelFile = path.join(root, "docs/product/data-model.json");
  const oracleFile = path.join(root, "docs/design/prototype/reference/oracle-states.json");
  const arch = exists(archFile) ? read(archFile) : "";
  const model = exists(modelFile) ? readJson(modelFile) : null;
  const oracle = exists(oracleFile) ? readJson(oracleFile) : null;
  const copy = loadCopy(root);
  const mapText = exists(mapFile) ? read(mapFile) : "";
  const mapSecs = h2Sections(mapText);
  const mapSec = (n) => mapSecs.find((s) => new RegExp(`^${n}\\.\\s`).test(s.title));
  const catalogue = frdSubsections(mapSec(2)?.lines ?? []);
  const authorNotes = frdSubsections(mapSec(5)?.lines ?? []);
  const routes = routeTables(arch);
  const r = reporter();
  const header = `_Generated by build-packs.mjs on ${today}. Read-only digest: never edit it, regenerate it. The sources stay authoritative (FRD > FDD > design-tokens > blueprint > work order)._`;
  fs.mkdirSync(outDir, { recursive: true });
  const packs = [];
  const write = (name, lines) => {
    const file = path.join(outDir, name);
    const text = `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
    fs.writeFileSync(file, text);
    const rel = path.relative(root, file);
    packs.push({ file: rel.startsWith("..") ? file : rel, bytes: Buffer.byteLength(text) });
  };
  const routeBlock = (pred) => {
    const lines = [];
    for (const t of routes) {
      const rows = t.rows.filter(pred);
      if (rows.length) lines.push(t.header, t.sep || "|---|", ...rows.map((x) => x.line), "");
    }
    return lines;
  };

  const empty = [];
  const folders = listDir(frdsDir, (n) => /^frd-\d{2}-/.test(n)).filter((f) => !only || f.startsWith(only));
  if (only && !folders.length) throw new Error(`no FRD folder matches --frd ${only}`);
  for (const folder of folders) {
    const num = folder.slice(4, 6);
    const frdFile = path.join(frdsDir, folder, "frd.md");
    const fddFile = path.join(frdsDir, folder, "fdd.md");
    const frdText = exists(frdFile) ? read(frdFile) : "";
    const fddText = exists(fddFile) ? read(fddFile) : "";
    const crit = frdCriteria(frdText);
    if (!crit.acIds.length) empty.push(`${folder}: ${frdText ? "frd.md defines no live `- **AC-NN-MMM.K**` bullet" : "no frd.md"}`);
    const title = /^#\s+(.+)$/m.exec(frdText)?.[1] ?? `FRD-${num}`;
    const rows = routeBlock((x) => x.frds.includes(num) || x.frds.includes("*"));
    const ents = namedEntities(`${frdText}\n${fddText}`, model);
    const states = oracleStatesFor(oracle, folder);
    const keys = fddText ? citedCopyKeys(fddText, copy) : [];
    const slice = [...(catalogue.get(num) ?? []), "", ...(authorNotes.get(num) ?? [])];
    write(`frd-${num}.md`, [
      `# Pack FRD-${num}: ${title.replace(/^FRD-\d{2}\s*[·:—-]?\s*/, "")}`,
      "",
      header,
      `Sources: \`docs/frds/${folder}/frd.md\`${fddText ? `, \`docs/frds/${folder}/fdd.md\`` : ""}, \`docs/product/architecture.md\`, \`docs/product/data-model.json\`, \`oracle-states.json\`, \`docs/design/microcopy*.json\`${mapText ? `, \`${path.relative(root, mapFile)}\`` : ""}. Global facts: \`_global.md\`.`,
      "",
      `## Requirements and acceptance criteria (verbatim, ${crit.acIds.length} live ACs${crit.removed ? `, ${crit.removed} struck out and omitted` : ""})`,
      "",
      ...(crit.lines.length ? crit.lines : none("no REQ/AC lines found")),
      "",
      `## Routes (architecture.md route map rows citing FRD-${num} or all)`,
      "",
      ...(rows.length ? rows : none(arch ? (routes.length ? "no route-map row cites this FRD" : "architecture.md has no Route map section") : "no docs/product/architecture.md yet")),
      "",
      `## Entities named in this FRD/FDD (data-model.json, ${ents.length})`,
      "",
      ...(ents.length ? ents.map(entityLine) : none(model ? "the FRD names no data-model entity" : "no docs/product/data-model.json yet")),
      "",
      `## Oracle states (frd_slug ${folder}, ${states.length})`,
      "",
      ...(states.length ? states.map(stateLine) : none(oracle ? "no oracle state for this FRD (non-UI FRD?)" : "no oracle-states.json")),
      "",
      `## Microcopy keys the FDD cites (${keys.length})`,
      "",
      ...(keys.length ? keys.map((k) => `- \`${k}\`: "${squeeze(copy.copy.get(k)[0].replace(/<[^>]+>/g, " "))}"`) : none(fddText ? (copy.copy.size ? "the FDD cites no microcopy key" : "no docs/design/microcopy*.json") : "no fdd.md")),
      "",
      "## Work-order map slice (§2 catalogue, §5 author notes)",
      "",
      ...(slice.join("").trim() ? slice : none(mapText ? "the map has no `### FRD-NN` section for this FRD" : "no work-order map yet; regenerate the packs after it is written")),
    ]);
  }
  r.check("every FRD yields live acceptance criteria (DR-078: an empty pack is a read failure, not a pass)", empty);

  const outline = h2Sections(arch).map((s) => `- L${s.line} ${s.title}`);
  const adrDir = path.join(root, "docs/adr");
  const adrs = adrIndex(listDir(adrDir, (n) => n.endsWith(".md")).map((f) => ({ file: `docs/adr/${f}`, text: read(path.join(adrDir, f)) })));
  const platformRows = routeBlock((x) => !x.frds.length);
  const pinned = headingBlock(arch, /pinned versions/i);
  const mapGlobal = [0, 1, 3, 8].flatMap((n) => mapSec(n)?.lines ?? []);
  write("_global.md", [
    "# Pack: global (every agent of the architecture phase reads this)",
    "",
    header,
    "",
    "## docs/product/architecture.md outline (open a section by its line, never the whole file)",
    "",
    ...(outline.length ? outline : none("no architecture.md yet")),
    "",
    `## Locked decisions (docs/adr, ACCEPTED, ${adrs.accepted.length}): binding, never contradict them`,
    "",
    ...(adrs.accepted.length ? adrs.accepted : none("no ACCEPTED ADR yet")),
    "",
    `## Proposed decisions (docs/adr, not yet binding, ${adrs.other.length})`,
    "",
    ...(adrs.other.length ? adrs.other : none("no PROPOSED or unlabelled ADR")),
    ...(adrs.superseded ? ["", `_${adrs.superseded} SUPERSEDED/DEPRECATED ADR(s) omitted: history, not plan._`] : []),
    "",
    "## Routes owned by no single FRD (platform, gate-only, shared)",
    "",
    ...(platformRows.length ? platformRows : none(routes.some((t) => !t.hasFrdColumn) ? "the route map has no FRD column: read it in architecture.md" : "every route row cites an FRD")),
    "",
    "## Pinned versions (architecture.md)",
    "",
    ...(pinned.length ? pinned : none("architecture.md has no `Pinned versions` heading; read the versions record named in the brief")),
    "",
    "## Work-order map: global rules, foundation, DAG, binding resolutions (§0, §1, §3, §8)",
    "",
    ...(mapGlobal.length ? mapGlobal : none("no work-order map yet; regenerate the packs after it is written")),
  ]);
  const docs = docSetFiles(root);
  return { results: r.results, packs, docSet: { files: docs.length, bytes: bytes(root, docs) } };
}

runCli(import.meta.url, () => {
  const args = parseArgs(process.argv.slice(2), ["json"]);
  const root = args._[0] ?? ".";
  const res = buildPacks({ root, out: args.out ? path.resolve(args.out) : undefined, map: args.map ? path.resolve(args.map) : undefined, only: args.frd ?? null });
  if (args.json) {
    console.log(JSON.stringify({ ok: !res.results.some((x) => x.status === "FAIL"), packs: res.packs, docSet: res.docSet, checks: res.results }, null, 2));
    return res.results.some((x) => x.status === "FAIL") ? 1 : 0;
  }
  const largest = Math.max(0, ...res.packs.filter((p) => !p.file.endsWith("_global.md")).map((p) => p.bytes));
  const global = res.packs.find((p) => p.file.endsWith("_global.md"))?.bytes ?? 0;
  const header = [
    ...res.packs.map((p) => `${p.file}: ${kb(p.bytes)}`),
    `full doc set (${res.docSet.files} files: PRD, architecture, data model, ADRs, design docs, rules, every FRD+FDD, oracle): ${kb(res.docSet.bytes)}`,
    `one author's pack + _global.md (largest FRD): ${kb(largest + global)}, ${res.docSet.bytes ? Math.round(((largest + global) / res.docSet.bytes) * 100) : 0}% of the full set`,
  ];
  return emit(res.results, { header, verdictOk: "PACKS OK", verdictBad: "PACKS NOT OK" });
});
