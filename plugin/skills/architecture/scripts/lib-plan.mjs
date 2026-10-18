/**
 * Shared reader for the architecture phase's deterministic plan checks (waves, ac-matrix, plan-consistency,
 * flip-active). It reads a Pandacorp project's planning docs as they are written by the architecture skill:
 *   docs/frds/frd-NN-<slug>/frd.md                 the FRD (AC definitions are `- **AC-NN-MMM.K** ...` bullets)
 *   docs/frds/frd-NN-<slug>/blueprint.md           the per-FRD blueprint (frontmatter + `## Build Plan` DAG table);
 *                                                  a large feature may add blueprints/*.md parts
 *   docs/frds/frd-NN-<slug>/work-orders/README.md  the readable WO index (Depends on column, AC coverage table)
 *   docs/frds/frd-NN-<slug>/work-orders/wo-*.md    one work order each (frontmatter is the source of truth)
 * Fail-loud (DR-078): a work order without frontmatter or a usable id is reported as a read error, never skipped.
 */
import fs from "node:fs";
import path from "node:path";

export const WO_ID = /^WO-\d{2}-\d{3}$/;
const WO_ID_G = /WO-\d{2}-\d{3}/g;
const AC_ID_G = /AC-\d{2}-\d{3}\.\d+/g;

const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, "utf8");
const listDir = (p, filter = () => true) => (exists(p) ? fs.readdirSync(p).filter(filter).sort() : []);

/** Splits a markdown file into its YAML frontmatter text and body; null when the file has no frontmatter. */
export function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return null;
  return { raw: m[1], body: text.slice(m[0].length), length: m[0].length };
}

/** A YAML scalar with its quotes removed and a trailing ` # comment` dropped. */
function scalar(value) {
  const v = value.trim();
  if (v.startsWith('"') || v.startsWith("'")) {
    const close = v.indexOf(v[0], 1);
    return close > 0 ? v.slice(1, close) : v.slice(1);
  }
  return v.replace(/\s+#.*$/, "").trim();
}

/** An inline YAML list `[a, b]` as an array of scalars; commas inside quotes or `{a,b}` globs do not split. */
function inlineList(value) {
  const inner = value.trim().replace(/^\[/, "").replace(/\]\s*(#.*)?$/, "");
  const items = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      items.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  items.push(cur);
  return items.map((s) => scalar(s)).filter(Boolean);
}

/**
 * Parses the frontmatter subset the planning templates use: `key: scalar`, `key: [inline, list]` and
 * `key:` followed by `  - item` lines. Unknown shapes are kept as their raw scalar text.
 * @param {string} raw frontmatter text without the `---` fences
 * @returns {Record<string, string | string[]>}
 */
export function parseFrontmatter(raw) {
  const out = {};
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, key, rest] = m;
    const value = rest.trim();
    if (value.startsWith("[")) {
      out[key] = inlineList(value);
    } else if (value === "" || value.startsWith("#")) {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) items.push(scalar(lines[++i].replace(/^\s+-\s+/, "")));
      out[key] = items.length ? items : "";
    } else {
      out[key] = scalar(rest);
    }
  }
  return out;
}

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** `wo-01-002-slug.md` → `WO-01-002` (the fallback when the frontmatter has no id). */
const idFromFile = (file) => {
  const m = /^wo-(\d{2})-(\d{3})/i.exec(file);
  return m ? `WO-${m[1]}-${m[2]}` : "";
};

/**
 * Reads every FRD folder and work order of a project.
 * @param {string} root project root
 * @returns {{root: string, frds: object[], wos: Map<string, object>, errors: string[]}}
 */
export function loadPlan(root) {
  const frdsDir = path.join(root, "docs/frds");
  if (!exists(frdsDir)) throw new Error(`no docs/frds folder under ${root}`);
  const frds = [];
  const wos = new Map();
  const errors = [];
  for (const folder of listDir(frdsDir, (f) => /^frd-\d{2}-/.test(f))) {
    const dir = path.join(frdsDir, folder);
    const woDir = path.join(dir, "work-orders");
    const parts = listDir(path.join(dir, "blueprints"), (f) => f.endsWith(".md")).map((f) => path.join(dir, "blueprints", f));
    const frd = {
      folder,
      num: folder.slice(4, 6),
      id: `FRD-${folder.slice(4, 6)}`,
      dir,
      frdFile: exists(path.join(dir, "frd.md")) ? path.join(dir, "frd.md") : null,
      blueprintFiles: [path.join(dir, "blueprint.md"), ...parts].filter(exists),
      readme: exists(path.join(woDir, "README.md")) ? path.join(woDir, "README.md") : null,
      woIds: [],
    };
    frds.push(frd);
    for (const file of listDir(woDir, (f) => /^wo-.*\.md$/i.test(f))) {
      const abs = path.join(woDir, file);
      const rel = path.relative(root, abs);
      const fm = splitFrontmatter(read(abs));
      if (!fm) {
        errors.push(`${rel}: no frontmatter`);
        continue;
      }
      const data = parseFrontmatter(fm.raw);
      const id = typeof data.id === "string" && data.id ? data.id : idFromFile(file);
      if (!WO_ID.test(id)) {
        errors.push(`${rel}: no usable work-order id (got "${id}")`);
        continue;
      }
      if (wos.has(id)) {
        errors.push(`${rel}: duplicate id ${id} (also ${wos.get(id).file})`);
        continue;
      }
      wos.set(id, {
        id,
        file: rel,
        abs,
        frd: folder,
        data,
        body: fm.body,
        deps: asList(data.dependsOn),
        artifacts: asList(data.artifacts),
        foundation: String(data.foundation) === "true",
        status: typeof data.status === "string" ? data.status : "",
        superseded: data.status === "SUPERSEDED",
      });
      frd.woIds.push(id);
    }
  }
  return { root, frds, wos, errors };
}

/** The work orders that are part of the live plan (a SUPERSEDED one is history, not plan). */
export const liveWos = (plan) => [...plan.wos.values()].filter((w) => !w.superseded);

/**
 * Computes the global build waves from `dependsOn` (wave = 1 + max(dependency waves); W0 without dependencies).
 * Never throws: unknown ids and cycles are returned so the caller can report every problem at once.
 * @returns {{wave: Map<string, number>, unknown: {from: string, to: string}[], cycles: string[][]}}
 */
export function computeWaves(plan) {
  const live = new Map(liveWos(plan).map((w) => [w.id, w]));
  const wave = new Map();
  const unknown = [];
  const cycles = [];
  const state = new Map(); // 1 = visiting, 2 = done
  const stack = [];
  const visit = (id) => {
    if (state.get(id) === 2) return wave.get(id) ?? null;
    if (state.get(id) === 1) {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return null;
    }
    state.set(id, 1);
    stack.push(id);
    let w = 0;
    let broken = false;
    for (const dep of live.get(id).deps) {
      if (!live.has(dep)) {
        unknown.push({ from: id, to: dep });
        continue;
      }
      const dw = visit(dep);
      if (dw === null) broken = true;
      else w = Math.max(w, dw + 1);
    }
    stack.pop();
    state.set(id, 2);
    if (!broken) wave.set(id, w);
    return broken ? null : w;
  };
  for (const id of [...live.keys()].sort()) visit(id);
  return { wave, unknown, cycles };
}

/** Expands `{a,b}` brace groups (nested too) into every concrete glob. */
export function expandBraces(glob) {
  const m = /\{([^{}]*)\}/.exec(glob);
  if (!m) return [glob];
  return [...new Set(m[1].split(",").flatMap((alt) => expandBraces(glob.slice(0, m.index) + alt + glob.slice(m.index + m[0].length))))];
}

const WILD = /[*?]/;
const escapeRe = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
const segRegex = (seg) => new RegExp(`^${escapeRe(seg).replace(/\*/g, ".*").replace(/\?/g, ".")}$`);

/** Can one path segment pattern and another match the same name? (`[id]`, `(group)` are literal route folders.) */
function segOverlap(a, b) {
  const wa = WILD.test(a);
  const wb = WILD.test(b);
  if (!wa && !wb) return a === b;
  if (wa && !wb) return segRegex(a).test(b);
  if (!wa && wb) return segRegex(b).test(a);
  const pa = a.split(/[*?]/)[0];
  const pb = b.split(/[*?]/)[0];
  const sa = a.split(/[*?]/).at(-1);
  const sb = b.split(/[*?]/).at(-1);
  return (pa.startsWith(pb) || pb.startsWith(pa)) && (sa.endsWith(sb) || sb.endsWith(sa));
}

function segsOverlap(a, b) {
  if (!a.length && !b.length) return true;
  if (a[0] === "**") return segsOverlap(a.slice(1), b) || (b.length > 0 && segsOverlap(a, b.slice(1)));
  if (b[0] === "**") return segsOverlap(a, b.slice(1)) || (a.length > 0 && segsOverlap(a.slice(1), b));
  if (!a.length || !b.length) return false;
  return segOverlap(a[0], b[0]) && segsOverlap(a.slice(1), b.slice(1));
}

const normalizeGlob = (g) => {
  let s = g.trim().replace(/^`|`$/g, "").replace(/^\.\//, "");
  if (s.endsWith("/")) s += "**";
  return s;
};

/**
 * Could two artifact globs ever touch the same file? Brace groups are expanded first, so
 * `src/app/{a,b}/**` and `src/app/c/**` do not collide.
 * @returns {string | null} the first colliding concrete pair (`x <-> y`), or null when disjoint
 */
export function globsOverlap(a, b) {
  for (const x of expandBraces(normalizeGlob(a)))
    for (const y of expandBraces(normalizeGlob(b))) if (segsOverlap(x.split("/"), y.split("/"))) return `${x} <-> ${y}`;
  return null;
}

/**
 * Parses every markdown table under a `## <heading>` whose text matches `headingRe` (until the next `## `).
 * @returns {{header: string[], rows: string[][]}[]}
 */
export function tablesUnder(text, headingRe) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let inSection = false;
  let current = null;
  const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = headingRe.test(line.replace(/^##\s+/, ""));
      current = null;
      continue;
    }
    if (!inSection) continue;
    if (/^\s*\|/.test(line)) {
      if (!current) {
        current = { header: cells(line).map((c) => c.toLowerCase()), rows: [] };
        tables.push(current);
      } else if (!/^\s*\|[\s:|-]+\|\s*$/.test(line)) current.rows.push(cells(line));
    } else current = null;
  }
  return tables;
}

/** Every WO id named in a table cell (`—`, `-`, `none` → none). */
export const woIdsIn = (cell) => [...new Set(cell.match(WO_ID_G) ?? [])];
/** Every AC id named in a text. */
export const acIdsIn = (text) => [...new Set(text.match(AC_ID_G) ?? [])];
/** The backticked items of a cell (artifact globs are written in backticks). */
export const backticked = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());

/** Sorted, comma-joined set, for stable diffs in messages. */
export const fmtSet = (list) => [...new Set(list)].sort().join(", ") || "(none)";
export const sameSet = (a, b) => fmtSet(a) === fmtSet(b);

/** Collects check results in the format the design checks use (OK / FAIL / WARN + details). */
export function reporter() {
  const results = [];
  return {
    results,
    check(label, problems) {
      results.push({ status: problems.length ? "FAIL" : "OK", label, details: problems });
    },
    warn(label, details) {
      if (details.length) results.push({ status: "WARN", label, details });
    },
    failed: () => results.some((r) => r.status === "FAIL"),
  };
}

/** Prints results (or JSON) and returns the exit code: 0 clean, 1 when any check failed. */
export function emit(results, { json = false, header = [], verdictOk = "OK", verdictBad = "NOT OK", limit = 25 } = {}) {
  const failing = results.filter((r) => r.status === "FAIL").length;
  if (json) {
    console.log(JSON.stringify({ ok: failing === 0, header, checks: results }, null, 2));
  } else {
    for (const h of header) console.log(h);
    for (const r of results) {
      console.log(`${r.status.padEnd(4)}  ${r.label}`);
      const shown = r.details.length > limit ? [...r.details.slice(0, limit), `... and ${r.details.length - limit} more`] : r.details;
      for (const d of shown) console.log(`          ${d}`);
    }
    console.log(failing ? `${verdictBad}: ${failing} failing` : verdictOk);
  }
  return failing ? 1 : 0;
}

/** Parses `--flag value` / `--flag` CLI arguments; positional args land in `_`. */
export function parseArgs(argv, booleans = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (booleans.includes(a.slice(2))) out[a.slice(2)] = true;
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

/** Runs `main` when the module is the entry point; a read error exits 2 with its message (fail loud). */
export function runCli(metaUrl, main) {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (entry !== new URL(metaUrl).pathname) return;
  Promise.resolve()
    .then(main)
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.error(`error: ${err.message}`);
      process.exit(2);
    });
}
