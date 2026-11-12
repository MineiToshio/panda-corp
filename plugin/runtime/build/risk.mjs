/**
 * Pandacorp build engine v2 — risk zone of a unit or a diff (BUILD-10 §Risk zone, D8, PLAN §3.9, §3.16 A6).
 *
 * One function, `computeRisk`, answers: is this change `none`, `floor` or `r1`?
 *   r1    ⇔ the PRODUCT floor fires (P1 auth/session, P2 payments, P3 personal-data persistence, P4 secrets,
 *           P5 destructive data operations): `productFloor(ctx).floor` imported from product-floor.mjs. The only
 *           zone that routes to the frontier reviewer.
 *   floor ⇔ not r1 and (classify-change.mjs reports a CRITICAL floor hit in {S5,S6,S7,S8,S9,S17}, or a `risk`
 *           glob of `.pandacorp/risk-paths` matches). A `normal`-level hit (S17 "madge is not installed") is
 *           reported in signals.classify but never raises the zone.
 *   none  ⇔ otherwise.
 * Anything that cannot be read or computed (classifier exit 3, a FAILCLOSED signal, an unparsable classifier
 * answer, a timeout, an unreadable git diff, a product-floor throw) fails CLOSED: zone `r1`, `failclosed: true`.
 *
 * classify-change.mjs runs `main()` and exits at import time, so it is never imported: it is run as a
 * subprocess through the injected `exec`. product-floor.mjs is a pure module and is imported.
 *
 * Pure with respect to its inputs: every side effect (subprocess, file read) goes through `deps`.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productFloor, securityDeltaTriggers } from "../../scripts/product-floor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Zones in increasing severity. */
export const ZONES = Object.freeze(["none", "floor", "r1"]);
/** Classifier signals whose CRITICAL hits make the zone `floor` (rule R2, §3.16 A6). */
export const R2_SIGNALS = Object.freeze(["S5", "S6", "S7", "S8", "S9", "S17"]);
/** Classifier signals that make a change irreversible (login, stored data, deletions). */
export const IRREVERSIBLE_SIGNALS = Object.freeze(["S5", "S8"]);
/** Repo-relative path of the optional per-project manifest. */
export const RISK_PATHS_FILE = ".pandacorp/risk-paths";
/** Classifier subprocess timeout (ms). */
export const CLASSIFY_TIMEOUT_MS = 60_000;
const GIT_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 512 * 1024 * 1024;

/**
 * The more severe of the given zones (review zone = max(static zone, diff zone)).
 * @param {...("none"|"floor"|"r1")} zones
 * @returns {"none"|"floor"|"r1"}
 */
export function maxZone(...zones) {
  let best = 0;
  for (const z of zones) {
    const i = ZONES.indexOf(z);
    if (i < 0) throw new RangeError(`unknown risk zone: ${z}`);
    if (i > best) best = i;
  }
  return ZONES[best];
}

// ── default dependencies ───────────────────────────────────────────────────────────────────────

/**
 * Default `exec`: runs a file without a shell and resolves (never rejects) with the exit status.
 * @param {string} file
 * @param {string[]} args
 * @param {{cwd?: string, timeout?: number, maxBuffer?: number}} [opts]
 * @returns {Promise<{code: number|null, stdout: string, stderr: string, timedOut?: boolean, error?: string}>}
 */
export function defaultExec(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { encoding: "utf8", cwd: opts.cwd, timeout: opts.timeout, maxBuffer: opts.maxBuffer ?? MAX_BUFFER }, (err, stdout, stderr) => {
      if (!err) return resolve({ code: 0, stdout, stderr });
      resolve({
        code: typeof err.code === "number" ? err.code : null,
        stdout: stdout || "",
        stderr: stderr || "",
        timedOut: Boolean(err.killed),
        error: String(err.message || err).split("\n")[0],
      });
    });
  });
}

/**
 * The real dependency set. Tests override any member.
 * @returns {{exec: Function, readFile: (abs: string) => string, classifyScript: string, productFloor: Function, securityDeltaTriggers: Function}}
 */
export function defaultDeps() {
  return {
    exec: defaultExec,
    readFile: (abs) => readFileSync(abs, "utf8"),
    classifyScript: path.resolve(HERE, "../../scripts/classify-change.mjs"),
    productFloor,
    securityDeltaTriggers,
  };
}

/** Normalizes whatever an injected `exec` returned or threw into `{code, stdout, stderr, timedOut, error}`. */
function normalizeExec(r) {
  const code = r && (r.code ?? r.status);
  return {
    code: typeof code === "number" ? code : null,
    stdout: String((r && r.stdout) ?? ""),
    stderr: String((r && r.stderr) ?? ""),
    timedOut: Boolean(r && (r.timedOut || r.killed)),
    error: r && r.error ? String(r.error) : "",
  };
}

async function run(deps, file, args, opts) {
  try {
    return normalizeExec(await deps.exec(file, args, opts));
  } catch (e) {
    return normalizeExec({ code: e && (e.status ?? e.code), stdout: e && e.stdout, stderr: e && e.stderr, killed: e && e.killed, error: String((e && e.message) || e).split("\n")[0] });
  }
}

// ── paths, globs, risk-paths manifest ──────────────────────────────────────────────────────────

/** Repo-relative, forward-slash, no leading `./`. */
export function normalizePath(p) {
  return String(p).trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Accepts `["a","b"]` or `"a,b"` (newlines also split) and returns the unique normalized paths. */
export function parseFileList(files) {
  const raw = Array.isArray(files) ? files : String(files).split(/[,\n]/);
  return [...new Set(raw.map(normalizePath).filter(Boolean))];
}

/**
 * Glob → RegExp. `**` crosses directories (`a/**` matches `a/b/c`), `*` and `?` stay inside a segment,
 * `{x,y}` alternates. A glob with no `/` matches the basename at any depth (`*.css`); a trailing `/`
 * means the whole directory. Anchored at the repo root otherwise.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let g = normalizePath(glob);
  if (!g) throw new RangeError("empty glob");
  if (g.endsWith("/")) g += "**";
  const anchored = g.includes("/");
  let re = "";
  let braces = 0;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      if (g[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "{") { braces++; re += "(?:"; }
    else if (c === "}" && braces > 0) { braces--; re += ")"; }
    else if (c === "," && braces > 0) re += "|";
    else re += c.replace(/[.+^$()|[\]\\{}]/g, "\\$&");
  }
  if (braces > 0) throw new RangeError(`unbalanced { in glob: ${glob}`);
  return new RegExp(`^${anchored ? "" : "(?:.*/)?"}${re}$`);
}

/**
 * Parses the `.pandacorp/risk-paths` manifest: one glob per line, `#` comments and blank lines ignored.
 * Line forms: `risk <glob>`, `risk: <glob>`, `low <glob>`, `low: <glob>`; a bare glob counts as `risk`
 * (conservative). `risk` globs raise the zone to `floor`; `low` globs only mark a file as classified.
 * @param {string} text
 * @returns {Array<{kind: "risk"|"low", glob: string}>}
 */
export function parseRiskPaths(text) {
  const out = [];
  for (const rawLine of String(text).split("\n")) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(risk|low)\s*:?\s+(\S.*)$/i);
    const entry = m ? { kind: m[1].toLowerCase(), glob: m[2].trim() } : { kind: "risk", glob: line };
    globToRegExp(entry.glob); // fails loud on a malformed glob (DR-078)
    out.push(entry);
  }
  return out;
}

// ── diff context ───────────────────────────────────────────────────────────────────────────────

/** Added lines per file from `git diff -U0` output (same shape classify-change.mjs builds). */
function parseAddedLines(diff) {
  const byFile = new Map();
  let current = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = line.match(/ b\/(.*)$/);
      current = m ? normalizePath(m[1]) : null;
      if (current && !byFile.has(current)) byFile.set(current, []);
      continue;
    }
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+") && current) byFile.get(current).push(line.slice(1));
  }
  return byFile;
}

/**
 * Builds the product-floor context. `--files`: paths only (`linesKnown: false`). `--range`: the paths and the
 * added lines of `git diff -U0` (`linesKnown: true`).
 * @returns {Promise<{ok: true, ctx: object, paths: string[], prefix?: string} | {ok: false, detail: string}>}
 */
async function buildContext(input, deps) {
  const readBody = (rel) => {
    try { return deps.readFile(path.join(input.root, rel)); } catch { return null; }
  };
  if (input.files) {
    const paths = parseFileList(input.files);
    if (!paths.length) return { ok: false, detail: "nothing to classify: empty file list" };
    return { ok: true, paths, ctx: { files: paths.map((p) => ({ path: p })), addedByFile: new Map(), linesKnown: false, readFile: readBody } };
  }
  const git = (args) => run(deps, "git", ["-C", input.root, ...args], { timeout: GIT_TIMEOUT_MS });
  const names = await git(["diff", "--name-only", input.range, "--"]);
  if (names.code !== 0) return { ok: false, detail: `git diff --name-only ${input.range} failed (${names.error || names.stderr.split("\n")[0] || `exit ${names.code}`})` };
  const body = await git(["diff", "-U0", input.range, "--"]);
  if (body.code !== 0) return { ok: false, detail: `git diff -U0 ${input.range} failed (${body.error || body.stderr.split("\n")[0] || `exit ${body.code}`})` };
  const paths = parseFileList(names.stdout.split("\n"));
  if (!paths.length) return { ok: false, detail: `nothing to classify: range ${input.range} changes no file` };
  // A project nested below the git top-level (Mission Control inside the factory repo) sees top-level-relative
  // diff paths; its risk-paths globs are project-relative, so the prefix is kept to match both frames.
  const top = await git(["rev-parse", "--show-prefix"]);
  const prefix = top.code === 0 ? normalizePath(top.stdout.trim()).replace(/\/*$/, "/") : "";
  return { ok: true, paths, prefix: prefix === "/" ? "" : prefix, ctx: { files: paths.map((p) => ({ path: p })), addedByFile: parseAddedLines(body.stdout), linesKnown: true, readFile: readBody } };
}

// ── classifier subprocess ──────────────────────────────────────────────────────────────────────

/**
 * Runs classify-change.mjs and returns its floor hits.
 * @returns {Promise<{ok: true, floorHits: Array<{signal: string, level: string, detail: string}>} | {ok: false, detail: string}>}
 */
async function runClassifier(input, deps) {
  const selector = input.files ? ["--files", parseFileList(input.files).join(",")] : ["--range", input.range];
  const r = await run(deps, process.execPath, [deps.classifyScript, "--repo", input.root, ...selector], { cwd: input.root, timeout: CLASSIFY_TIMEOUT_MS });
  if (r.timedOut) return { ok: false, detail: `classify-change timed out after ${CLASSIFY_TIMEOUT_MS} ms` };
  if (r.code === 3) return { ok: false, detail: "classify-change failed closed (exit 3)" };
  if (r.code !== 0) return { ok: false, detail: `classify-change exited ${r.code}${r.error ? ` (${r.error})` : ""}` };
  const line = r.stdout.split("\n").map((l) => l.trim()).filter(Boolean).pop();
  let parsed;
  try { parsed = JSON.parse(line); } catch { return { ok: false, detail: "classify-change printed no parsable JSON line" }; }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.floor_hits)) return { ok: false, detail: "classify-change JSON has no floor_hits array" };
  const floorHits = parsed.floor_hits.map((h) => ({ signal: String(h && h.signal), level: String(h && h.level), detail: String((h && h.detail) ?? "") }));
  if (floorHits.some((h) => h.signal === "FAILCLOSED")) return { ok: false, detail: floorHits.find((h) => h.signal === "FAILCLOSED").detail || "classify-change reported FAILCLOSED" };
  return { ok: true, floorHits };
}

// ── production-file filter (for `unclassified`) ────────────────────────────────────────────────

const NON_PRODUCTION = [
  /\.(md|mdx|mdc|txt|rst|adoc)$/i,
  /(^|\/)docs\//,
  /(^|\/)\.(agents|claude|cursor|codex)\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)_?_?tests?_?_?\//,
  /(^|\/)src\/test\//,
  /(^|\/)e2e\//,
  /(^|\/)(fixtures?|__mocks__|__snapshots__)\//,
  /\.stories\.[jt]sx?$/,
];
const isProductionPath = (p) => !NON_PRODUCTION.some((re) => re.test(p));

// ── the zone ───────────────────────────────────────────────────────────────────────────────────

/**
 * Computes the risk zone of a set of paths or a diff.
 *
 * @param {{root: string, files?: string[]|string, range?: string}} input
 *   `root` = project root (absolute); exactly one of `files` (paths or globs, `linesKnown:false`) or `range`
 *   (`base..head`, the added lines are read with `git diff -U0`).
 * @param {Partial<ReturnType<typeof defaultDeps>>} [deps]
 *   `exec(file, args, {cwd, timeout, maxBuffer})` → `{code, stdout, stderr, timedOut?}` (sync or Promise; a throw
 *   is read as a failure); `readFile(absPath)` → string (throws `ENOENT` when missing); `classifyScript` = abs path
 *   of classify-change.mjs; `productFloor`/`securityDeltaTriggers` replace the imported functions (tests).
 * @returns {Promise<{
 *   zone: "none"|"floor"|"r1", rules: string[],
 *   signals: {product_floor: object[], classify: object[], security: object[], risk_paths: Array<{glob: string, path: string}>},
 *   irreversible: boolean, audit: boolean, failclosed: boolean, unclassified: string[]
 * }>}
 */
export async function computeRisk(input, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  if (!input || typeof input.root !== "string" || !input.root) throw new TypeError("computeRisk: input.root is required");
  if (Boolean(input.files) === Boolean(input.range)) throw new TypeError("computeRisk: exactly one of input.files or input.range is required");

  const signals = { product_floor: [], classify: [], security: [], risk_paths: [] };
  const failures = [];
  const fail = (list, detail) => {
    failures.push(detail);
    signals[list].push({ signal: "FAILCLOSED", level: "critical", detail });
  };
  let paths = [];

  const built = await buildContext(input, d);
  let pfHit = false;
  let securityHit = false;
  if (!built.ok) fail("product_floor", built.detail);
  else {
    paths = built.paths;
    try {
      const pf = d.productFloor(built.ctx);
      pfHit = Boolean(pf.floor);
      signals.product_floor = pf.floor_hits.map((h) => ({ signal: h.signal, level: h.level, detail: h.detail }));
    } catch (e) {
      fail("product_floor", `product-floor threw: ${String((e && e.message) || e).split("\n")[0]}`);
    }
    try {
      const sec = d.securityDeltaTriggers(built.ctx);
      signals.security = sec.hits.map((h) => ({ trigger: h.trigger, kind: h.kind, detail: h.detail }));
      securityHit = sec.hits.length > 0;
    } catch (e) {
      fail("security", `securityDeltaTriggers threw: ${String((e && e.message) || e).split("\n")[0]}`);
    }
  }

  let r2Hit = false;
  let irreversibleSignal = false;
  if (built.ok) {
    const cls = await runClassifier(input, d);
    if (!cls.ok) fail("classify", cls.detail);
    else {
      signals.classify = cls.floorHits;
      const critical = cls.floorHits.filter((h) => h.level === "critical");
      r2Hit = critical.some((h) => R2_SIGNALS.includes(h.signal));
      irreversibleSignal = critical.some((h) => IRREVERSIBLE_SIGNALS.includes(h.signal));
    }
  }

  let manifest = [];
  if (built.ok) {
    try {
      manifest = parseRiskPaths(d.readFile(path.join(input.root, RISK_PATHS_FILE)));
    } catch (e) {
      if (!(e && e.code === "ENOENT")) fail("risk_paths", `${RISK_PATHS_FILE} is unreadable or malformed: ${String((e && e.message) || e).split("\n")[0]}`);
    }
  }
  const claimedByGlob = new Set();
  for (const { kind, glob } of manifest) {
    const re = globToRegExp(glob);
    for (const p of paths) {
      const rel = built.prefix && p.startsWith(built.prefix) ? p.slice(built.prefix.length) : p;
      if (!re.test(p) && !re.test(rel)) continue;
      claimedByGlob.add(p);
      if (kind === "risk") signals.risk_paths.push({ glob, path: p });
    }
  }
  const r11Hit = signals.risk_paths.length > 0;

  const failclosed = failures.length > 0;
  const zone = failclosed || pfHit ? "r1" : r2Hit || r11Hit ? "floor" : "none";
  const rules = [];
  if (zone === "r1") rules.push("R1");
  if (r2Hit) rules.push("R2");
  if (securityHit) rules.push("R3");
  if (r11Hit) rules.push("R11");

  const details = [...signals.product_floor, ...signals.classify.filter((h) => h.level === "critical"), ...signals.security].map((h) => h.detail);
  const unclassified = paths.filter((p) => isProductionPath(p) && !claimedByGlob.has(p) && !details.some((t) => t.includes(p)));

  return {
    zone,
    rules,
    signals,
    irreversible: zone === "r1" || irreversibleSignal,
    audit: securityHit || zone === "r1",
    failclosed,
    unclassified,
  };
}

const STATIC_ZONE_CONCURRENCY = 4;

/**
 * Attach the static risk zone of each work order's artifacts (the planner expects `zone` and `risk_rules`).
 * A work order without artifacts is returned unchanged; a classifier failure is zone r1 with rule R1.
 * @param {Array<{artifacts?: string[]}>} wos work orders (not mutated)
 * @param {string} root product root the artifacts are relative to
 * @param {{computeRisk?: Function}} [deps] injected last (R7); `computeRisk` overrides the classifier
 * @returns {Promise<object[]>} copies of `wos` with `zone`/`risk_rules` set where artifacts exist
 */
export async function staticZones(wos, root, deps = {}) {
  const run = deps.computeRisk ?? computeRisk;
  const out = wos.map((w) => ({ ...w }));
  let at = 0;
  const worker = async () => {
    while (at < out.length) {
      const wo = out[at++];
      if (!Array.isArray(wo.artifacts) || wo.artifacts.length === 0) continue;
      try {
        const r = await run({ root, files: wo.artifacts }, {});
        wo.zone = r.zone; wo.risk_rules = r.rules ?? [];
      } catch { wo.zone = "r1"; wo.risk_rules = ["R1"]; }
    }
  };
  await Promise.all(Array.from({ length: STATIC_ZONE_CONCURRENCY }, worker));
  return out;
}
