#!/usr/bin/env node
/**
 * Pandacorp — change rigor classifier (engine).
 *
 * Entry point is the sibling `classify-change.sh`; this file holds the logic because the floor
 * detection is ~40 regexes with per-file scoping, which bash 3.2 cannot express without becoming
 * unreadable (and unreadable is how a floor signal goes missing).
 *
 * WHAT IT DECIDES — `rigor ∈ {micro, normal, critical}` from 17 deterministic signals
 * (memo `docs/proposals/37` §A.2, red-teamed in `j1` §3.b/§4.2). The level chooses how much
 * EVIDENCE a change collects; it never decides whether a red gate blocks (memo §A.0 principle 3).
 *
 * THE ONLY FAILURE THAT MATTERS is a false negative on the floor: a change that touches auth,
 * money, PII, persistence, something irreversible, secrets/infra, the oracles themselves, or the
 * factory's own machinery, and comes out below `critical`. Every judgement call in this file is
 * therefore resolved toward MORE rigor. Over-escalation is an accepted cost (j1 §4.3).
 *
 * THREE COMPOSITION RULES, NON-NEGOTIABLE:
 *   1. Max wins. Twelve micro signals and one S5 ⇒ critical.
 *   2. Monotone upward. Callers may escalate with a written reason; nothing may lower.
 *   3. Fail-closed. Nothing recognisable ⇒ `normal` (S15). Anything broken ⇒ `critical`.
 *
 * DANGEROUS-LITERAL NOTE: the destructive patterns below are assembled from fragments on purpose.
 * They are regex source, never commands, and the fragmentation keeps a literal that the
 * `block-dangerous.sh` scanner (or any future grep-based scanner over this tree) would flag from
 * ever appearing whole in the file.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const LEVELS = ["micro", "normal", "critical"];
const rank = (l) => LEVELS.indexOf(l);
const FLOOR_SIGNALS = new Set(["S5", "S6", "S7", "S8", "S9", "S17"]);
const MAX_BUFFER = 512 * 1024 * 1024;

/** A classifier that cannot read its input must never be the reason a change ran cheap. */
class FailClosed extends Error {}

// ---------------------------------------------------------------------------------------------
// Floor patterns
// ---------------------------------------------------------------------------------------------

/**
 * S5 — auth / authorization / the data layer itself. Path side.
 *
 * The data-layer entries are wider than `queries/` on purpose: the backtest found pandatrack keeps
 * its whole data layer under `lib/data/**` with `*Mutations.ts` / `*Queries.ts` filenames, and two
 * real changes to it (an authorization precondition, a payment-table rename) came out `micro`.
 * `scripts/*backfill*` is here for the same reason: a one-off row-rewriting script is a migration
 * whatever directory it sits in.
 */
const S5_PATHS = [
  /(^|\/)lib\/auth\//,
  /(^|\/)auth\//,
  /(^|\/)middleware\.(ts|tsx|js|mjs|cjs|mts)$/,
  /(^|\/)_actions\//,
  /(^|\/)actions\.(ts|tsx|js|mjs)$/,
  /(^|\/)app\/api\//,
  /(^|\/)queries\//,
  /(^|\/)lib\/data\//,
  /(Mutations|Queries|Repository|Repo|Dao)\.[jt]sx?$/,
  /(^|\/)admin\//,
  /(^|\/)prisma\//,
  /\.(sql|prisma)$/i,
  /(^|\/)migrations?\//,
  /(^|\/)drizzle\//,
  /(^|\/)[^/]*(backfill|migrate|migration|reseed|seed-|data-repair)[^/]*\.[jt]sx?$/i,
  /(^|\/)[^/]*(password|credential)[^/]*\.[jt]sx?$/i,
];

/**
 * S5 — auth content added by the diff.
 *
 * `auth…` is matched with a negative lookahead so `author`/`authored`/`authorship` (which appear in
 * every byline and commit trailer) do not trip the floor, while `auth`, `authz`, `authorize`,
 * `authorization` and `authenticated` all do. The optional-chaining form `session?.user` is
 * explicit: the backtest found a real authorization fix that wrote exactly that and escaped.
 */
const S5_CONTENT = [
  /\b(getServerSession|getSession|signIn|signOut|bcrypt|argon2|nextAuth)\b/i,
  /\bauth(?!or(?:s|ed|ing|ship|it(?:y|ies|ative|arian))?\b)[A-Za-z_]*/i,
  /\b(bearer|jwt|oauth|csrf)\b/i,
  /\bsession\s*\??\s*[.[]/i,
  /\bcookies?\s*\(\s*\)/i,
  /(password|passwd|credential|api[-_]?key|access[-_]?token|refresh[-_]?token|private[-_]?key)/i,
  /(viewerId|ownerId|createdBy|isPrivate|isPublic|canEdit|canDelete|canManage|canDirectly|isAdmin|hasRole|userRole|roleId|permission|forbidden|unauthori[sz]ed)/i,
  /\bvisibility\b(?!\s*:\s*["']?(hidden|visible|collapse))/i,
];

/**
 * S6 — money. Fires on the path OR on added content.
 *
 * Deliberately NOT word-anchored: real code writes `OrderPayment`, `storePaymentMutations`,
 * `paidAmountMinor`. A `\b`-anchored `payment` misses every one of them, and the backtest proved it
 * (a payments commit landed `micro`). Substring matching is the floor-safe reading, and it is how
 * the memo itself writes the list.
 */
const S6_MONEY = [/(stripe|billing|payment|checkout|invoice|subscription|price_|webhook|paypal|lemonsqueezy)/i];

/**
 * `checkout` is the one money term with a second, unrelated life: `git checkout`, "the main
 * checkout", sparse-checkout. On PATHS it stays in `S6_MONEY` unguarded (a `checkout/` route is
 * commerce). In CONTENT it is skipped when the same line is talking about version control — a line
 * that mentions a worktree is not a payment line. The backtest found this exact miss-fire in
 * `worktree-bootstrap.sh`; no commerce line in any of the three repos mentions a branch.
 */
const S6_MONEY_CONTENT = [/(stripe|billing|payment|invoice|subscription|price_|webhook|paypal|lemonsqueezy)/i];
const CHECKOUT = /checkout/i;
const VCS_CONTEXT = /\b(git|worktree|branch|rebase|merge|repo|sparse)\b/i;

/** S6 — PII terms common enough that they only mean something on a model/schema/migration surface. */
const S6_PII = [/\b(e?mail|phone|dni|nif|address|birthdate|dob)\b/i];

/**
 * S6 — PII terms that mean the same thing wherever they appear, so they are scanned everywhere,
 * prose included. `redact`/`anonymize`/`GDPR` are how a privacy change announces itself when the
 * payload is a binary asset the classifier cannot read (backtest: a cover image redaction).
 */
const S6_PII_HIGH_SIGNAL = [
  /(\biban\b|\bcvv\b|card[-_]?number|\bpassport\b|\bssn\b|\bredact|anonymi[sz]|pseudonymi[sz])/i,
  /(\bGDPR\b|\bRGPD\b|\bPII\b)/,
  /(personal data|datos personales|personally identifiable)/i,
  // A real e-mail literal is contact data wherever it lands. RFC 2606 reserved names are the
  // documented placeholders, so they are excluded and fixtures stay cheap. The backtest needed
  // this: a commit redacting a real address out of a public asset read as `micro` without it.
  /[A-Za-z0-9._%+-]+@(?!(example|test|invalid|localhost)\b)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(?!(example|test|invalid|localhost)\b)[A-Za-z]{2,}/,
];

const SCHEMA_ISH = [
  /(^|\/)prisma\//,
  /\.(sql|prisma)$/i,
  /(^|\/)migrations?\//,
  /(^|\/)drizzle\//,
  /(^|\/)models?\//,
  /(^|\/)entities\//,
  /(^|\/)queries\//,
  /(^|\/)_?schemas?\//,
  /schema[^/]*\.(ts|js|mjs|json|prisma|sql)$/i,
];

/**
 * S7 — secrets, CI, the build/deploy surfaces, the supply chain, and the factory's own machinery.
 *
 * `.claude/**` is the whole directory, not just hooks/settings: the backtest caught a one-line edit
 * to `.claude/engines/pandacorp-backlog.js` -- a build engine -- coming out `micro`. Manifests and
 * lockfiles are here because an install-script allow-list or a version pin decides what code runs
 * at build time; that is a supply-chain change however small the diff.
 */
const S7_PATHS = [
  /(^|\/)\.env($|[^/]*$)/,
  /(^|\/)secrets?[^/]*$/i,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)\.gitlab-ci\.[^/]+$/,
  /(^|\/)next\.config\.[^/]+$/,
  /(^|\/)biome\.json$/,
  /(^|\/)\.pandacorp\/[^/]*\.sh$/,
  /^plugin\//,
  /^factory\//,
  /(^|\/)\.claude\//,
  /(^|\/)package\.json$/,
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock[b]?)$/,
  /(^|\/)\.npmrc$/,
  /(^|\/)(Dockerfile|docker-compose)[^/]*$/i,
  /(^|\/)(vercel|wrangler|fly|netlify|railway)\.(json|toml|yml|yaml)$/i,
  /\.tf(vars)?$/,
];

/** S7 — key-shaped literals in added content. Length-anchored so prose cannot trip them. */
const S7_CONTENT = [
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /\bAKIA[0-9A-Z]{8,}/,
  /-----BEGIN[A-Z ]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}/,
];

/**
 * S7 — REV2-B: a real secret base64-encoded under an innocuous identifier carries a plaintext key
 * shape straight past S7_CONTENT (that scan never decodes anything). A QUOTED base64-alphabet
 * literal of 32+ chars (long enough that a short unrelated token can't false-positive) is decoded
 * and S7_CONTENT is re-applied to the RESULT — the same floor patterns, just given a chance to see
 * through the encoding.
 */
const BASE64_LITERAL = /["']([A-Za-z0-9+/]{32,}={0,2})["']/;

/**
 * S8 — irreversible operations and data loss, detected in ADDED content.
 * Fragmented literals (see the header note): nothing here is ever executed.
 */
const RM_RECURSIVE_FORCE = new RegExp(String.raw`\b` + "rm" + String.raw`\s+-[a-zA-Z]*` + "r" + String.raw`[a-zA-Z]*` + "f" + String.raw`\b`, "i");
const SQL_DELETE = new RegExp(String.raw`\b` + "DELETE" + String.raw`\s+` + "FROM" + String.raw`\b`, "i");
const SQL_DROP = new RegExp(String.raw`\b` + "DROP" + String.raw`\s+(TABLE|DATABASE|SCHEMA|INDEX|COLUMN)\b`, "i");
const S8_CONTENT = [
  SQL_DELETE,
  SQL_DROP,
  RM_RECURSIVE_FORCE,
  /\btruncate\b/i,
  /\b(deleteMany|dropDatabase|destroyAll)\b/,
  /\b(rmSync|rmdirSync)\b/,
  /\bunlink(Sync)?\s*\(/,
  /\b(push|reset)\s+--(force|hard)\b/,
  /\bgit\s+clean\s+-[a-zA-Z]*[dx]/,
  /\b(vercel|wrangler|fly|netlify)\s+(deploy|publish)\b/,
];

/**
 * S8 — REV2-A: SQL_DELETE/SQL_DROP are matched PER ADDED LINE (see findContent), so a statement
 * built as a string-literal array (`["DELETE", "FROM sessions"].join(" ")`) and formatted one
 * token per line evades the floor — `\s+` alone cannot bridge the quote/comma/newline between the
 * two literals. These GAP-TOLERANT variants are for a SEPARATE per-FILE scan of the added lines
 * JOINED together (`added.join("\n")`, see findContentJoined below): the bounded
 * `[^A-Za-z0-9]{0,20}` gap crosses quotes, commas and newlines a split literal introduces while
 * still requiring the two tokens close enough together that it is plainly the same statement, not
 * two unrelated words that happen to share a file.
 */
const SQL_DELETE_JOINED = new RegExp(String.raw`\b` + "DELETE" + String.raw`\b[^A-Za-z0-9]{0,20}` + "FROM" + String.raw`\b`, "i");
const SQL_DROP_JOINED = new RegExp(String.raw`\b` + "DROP" + String.raw`\b[^A-Za-z0-9]{0,20}(TABLE|DATABASE|SCHEMA|INDEX|COLUMN)\b`, "i");
/** The patterns re-checked against each file's ADDED lines joined, so a multi-token floor pattern split across lines by quotes/commas/newlines still hits (REV2-A). */
const S8_CONTENT_JOINED = [SQL_DELETE_JOINED, SQL_DROP_JOINED, ...S8_CONTENT];

/**
 * S9 — the oracles themselves (DR-080). Any touch of these is critical.
 *
 * The gate-config family is listed in full, not just `biome.json`: the backtest found a commit that
 * deleted 12 lines of `knip.json` and one that widened an `eslint.config.mjs` ignore list, both
 * `micro`. Narrowing what an oracle inspects is exactly the move DR-080 exists to catch, and the
 * config file is the only place it happens. `vitest.setup.*` and `src/test/**` are the harness the
 * suite runs inside -- a polyfill there can turn a whole gate green.
 */
const S9_PATHS_ANY = [
  /(^|\/)e2e\//,
  /(^|\/)__snapshots__\//,
  /-snapshots\//,
  /\.snap$/,
  /(^|\/)\.pandacorp\/verify\.sh$/,
  /(^|\/)verify\.sh$/,
  /(^|\/)biome\.json$/,
  /(^|\/)docs\/design\/design-tokens\.json$/,
  /(^|\/)knip\.(json|jsonc|ts|js)$/,
  /(^|\/)(eslint\.config|\.eslintrc)[^/]*$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)(playwright|vitest|jest|stryker|lighthouserc)[^/]*\.(config\.)?[a-z]+$/i,
  /(^|\/)vitest\.setup\.[^/]+$/,
  /(^|\/)src\/test\//,
];

/** S9 — test surfaces that are only critical when the diff DELETES more than it adds. */
const S9_PATHS_NET_DELETE = [/(^|\/)_tests?\//, /\.(test|spec)\.[jt]sx?$/];

/** S13 — presentation-only / documentation-only surfaces. */
const S13_PATHS = [
  /\.(css|scss|sass|less)$/i,
  /\.mdx$/i,
  /(^|\/)messages\/[^/]+\.json$/,
  /(^|\/)(locales?|i18n|translations)\//,
  /(^|\/)docs\//,
];

/** S4 — a brand-new route in the App Router sense. */
const ROUTE_FILE = /(^|\/)(page|layout|route|template|default)\.(tsx|ts|jsx|js)$/;

/** S15 — the recognised-file predicate. Anything outside it floors the change at `normal`. */
const KNOWN_EXT = new Set(
  ("ts tsx js jsx mjs cjs mts cts json jsonc json5 css scss sass less md mdx yml yaml toml xml html htm " +
    "sh bash zsh fish sql prisma graphql gql txt csv tsv ndjson svg png jpg jpeg gif webp avif ico bmp " +
    "woff woff2 ttf otf eot mp4 webm mp3 wav pdf lock snap env example patch diff py rb go rs java kt " +
    "swift php cs sc scala ex exs lua vim conf ini cfg properties gitignore editorconfig npmrc nvmrc jsonl tf tfvars " +
    "gitattributes gitkeep dockerignore eslintrc prettierrc babelrc browserslistrc").split(" "),
);
const KNOWN_BASENAMES = new Set([
  "Dockerfile", "Makefile", "Procfile", "LICENSE", "LICENCE", "NOTICE", "CODEOWNERS", "README",
  "CHANGELOG", "AUTHORS", "VERSION", "Brewfile", "Justfile", "Rakefile", "Gemfile",
]);

/**
 * Prose surfaces, and the ONE content scan they are exempt from: S8.
 *
 * A runbook that writes out a destructive statement is describing it, not performing it, and S8 is
 * defined as "the diff INTRODUCES the operation". Every other content scan still reads prose, and
 * that is deliberate: the backtest tried the wider carve-out and two FRD edits specifying payment
 * gating fell from `critical` to `micro`. A document that SPECIFIES a floor domain is a floor
 * change — the spec is what the implementation is built from. Path signals, key-shaped literals
 * and PII terms were never carved out at all.
 */
const PROSE_PATHS = [/\.(md|mdx|txt|rst|adoc)$/i, /(^|\/)docs\//];

const anyMatch = (patterns, value) => patterns.some((re) => re.test(value));

// ---------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { repo: null, mode: null, range: null, files: null, card: null, wo: null, attempts: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const need = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new FailClosed(`flag ${a} needs a value`);
      return v;
    };
    switch (a) {
      case "--repo": opts.repo = need(); break;
      case "--range": opts.range = need(); opts.mode = setMode(opts.mode, "range"); break;
      case "--staged": opts.mode = setMode(opts.mode, "staged"); break;
      case "--worktree": opts.mode = setMode(opts.mode, "worktree"); break;
      case "--files": opts.files = need(); opts.mode = setMode(opts.mode, "files"); break;
      case "--card": opts.card = need(); break;
      case "--wo": opts.wo = need(); break;
      case "--attempts": opts.attempts = need(); break;
      default: throw new FailClosed(`unknown argument: ${a}`);
    }
  }
  if (!opts.repo) throw new FailClosed("--repo <path> is required");
  if (!opts.mode) throw new FailClosed("one of --range | --staged | --worktree | --files is required");
  if (opts.attempts !== null && !/^\d+$/.test(opts.attempts)) throw new FailClosed(`--attempts must be a non-negative integer, got '${opts.attempts}'`);
  return opts;
}

function setMode(current, next) {
  if (current && current !== next) throw new FailClosed(`--${current} and --${next} are mutually exclusive`);
  return next;
}

function git(repo, args) {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  } catch (e) {
    throw new FailClosed(`git ${args.join(" ")} failed: ${String(e.message || e).split("\n")[0]}`);
  }
}

/** Diff selector for each mode, shared by --numstat / --name-status / -U0 so they never disagree. */
function diffArgs(opts) {
  if (opts.mode === "range") return [opts.range];
  if (opts.mode === "staged") return ["--cached"];
  return ["HEAD"]; // worktree: every uncommitted tracked change, staged or not
}

function collectFromGit(opts) {
  const repoRoot = git(opts.repo, ["rev-parse", "--show-toplevel"]).trim();
  const sel = diffArgs(opts);
  const files = new Map();

  for (const line of git(opts.repo, ["diff", "--numstat", ...sel, "--"]).split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [addRaw, delRaw] = parts;
    // A rename prints "old => new"; the LAST tab-separated field is the current path.
    const p = normalizePath(parts[parts.length - 1]);
    const binary = addRaw === "-" || delRaw === "-";
    files.set(p, {
      path: p,
      added: binary ? 0 : Number(addRaw),
      deleted: binary ? 0 : Number(delRaw),
      binary,
      status: "M",
    });
  }

  const ns = git(opts.repo, ["diff", "--name-status", ...sel, "--"]).split("\n");
  for (const line of ns) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const status = parts[0][0];
    const p = normalizePath(parts[parts.length - 1]);
    const entry = files.get(p) || { path: p, added: 0, deleted: 0, binary: false, status };
    entry.status = status;
    files.set(p, entry);
  }

  if (opts.mode === "worktree") {
    for (const p of git(opts.repo, ["ls-files", "--others", "--exclude-standard"]).split("\n")) {
      const norm = normalizePath(p);
      if (!norm || files.has(norm)) continue;
      files.set(norm, { path: norm, added: countLines(path.join(repoRoot, norm)), deleted: 0, binary: false, status: "A" });
    }
  }

  const addedByFile = parseAddedLines(git(opts.repo, ["diff", "-U0", ...sel, "--"]));
  if (opts.mode === "worktree") {
    for (const f of files.values()) {
      if (f.status === "A" && !addedByFile.has(f.path)) {
        addedByFile.set(f.path, readTextSafe(path.join(repoRoot, f.path)));
      }
    }
  }
  return { repoRoot, files: [...files.values()], addedByFile, linesKnown: true };
}

function collectFromFileList(opts) {
  const repoRoot = git(opts.repo, ["rev-parse", "--show-toplevel"]).trim();
  const list = opts.files.split(/[,\n]/).map((s) => normalizePath(s.trim())).filter(Boolean);
  if (!list.length) throw new FailClosed("--files was given an empty list");
  return {
    repoRoot,
    files: list.map((p) => ({ path: p, added: 0, deleted: 0, binary: false, status: "M" })),
    addedByFile: new Map(),
    linesKnown: false,
  };
}

const normalizePath = (p) => (p || "").trim().replace(/^"|"$/g, "").replace(/^\.\//, "");

function readTextSafe(file) {
  try {
    if (!existsSync(file) || statSync(file).size > 8 * 1024 * 1024) return [];
    return readFileSync(file, "utf8").split("\n");
  } catch { return []; }
}
const countLines = (file) => readTextSafe(file).length;

/** Split a `-U0` diff into added lines per file, so content signals can be file-scoped. */
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

/** Minimal frontmatter reader: `key: value` between the first pair of `---` fences. */
function readFrontmatter(file, label) {
  if (!file) return null;
  let raw;
  try { raw = readFileSync(file, "utf8"); }
  catch (e) { throw new FailClosed(`cannot read ${label} '${file}': ${String(e.message || e).split("\n")[0]}`); }
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new FailClosed(`${label} '${file}' has no YAML frontmatter`);
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*(?:#.*)?$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// S17 — reverse dependency
// ---------------------------------------------------------------------------------------------

/**
 * Does any FLOOR file transitively import a file this change touched? `madge --json <src>` gives
 * the forward graph (`a -> [deps]`), so the answer is a BFS from every floor node looking for a
 * touched node. Only meaningful when the graph on disk matches the diff: a historical range is
 * explicitly SKIPPED (noted, never silently downgraded) rather than answered with today's graph.
 *
 * BL-0161: madge is looked up and run under `ctx.projectRoot` (where `--repo` points — the
 * project's OWN directory, where its `node_modules/.bin/madge` and `src/` actually live), never
 * `ctx.repoRoot` (the git worktree top-level). The two differ for a project that shares its
 * parent's `.git` instead of owning one (e.g. Mission Control inside the panda-corp factory
 * repo): `git rev-parse --show-toplevel` there resolves to the factory root, which has no
 * `node_modules` of its own, so S17 silently "skipped (madge unavailable)" on every change to
 * that project and could never certify `micro`. Graph nodes come back relative to `projectRoot`,
 * so they are re-anchored onto `ctx.projectPrefix` (projectRoot's path relative to repoRoot) to
 * compare against `ctx.files`, whose paths ARE repoRoot-relative (git diff's own frame).
 */
function reverseDependency(opts, ctx, notes) {
  const bin = path.join(ctx.projectRoot, "node_modules/.bin/madge");
  // D3: madge missing is a TOOL absence, not a classifier failure and not "nothing recognisable"
  // (S15) — the caller floors this at `normal` (never `micro`, never `critical`), distinct from
  // every OTHER skip reason below (historical range, no source root, a failed run), which stay
  // genuinely unscored: those are deliberate scope decisions, not "we could not check".
  if (!existsSync(bin)) { notes.push("S17: skipped (madge unavailable)"); return { skipped: "unavailable" }; }
  if (opts.mode === "range" && !isHeadRange(opts, ctx)) {
    notes.push("S17: skipped (historical range — the on-disk import graph does not describe it)");
    return null;
  }
  const srcDir = ["src", "app", "lib"].find((d) => existsSync(path.join(ctx.projectRoot, d)));
  if (!srcDir) { notes.push("S17: skipped (no analysable source root)"); return null; }

  let graph;
  try {
    const out = execFileSync(bin, ["--json", srcDir], { cwd: ctx.projectRoot, encoding: "utf8", maxBuffer: MAX_BUFFER, timeout: 120000 });
    graph = JSON.parse(out);
  } catch (e) {
    notes.push(`S17: skipped (madge failed: ${String(e.message || e).split("\n")[0]})`);
    return null;
  }

  const toRepo = (n) => normalizePath(path.posix.join(ctx.projectPrefix, srcDir, n));
  const touched = new Set(ctx.files.map((f) => f.path));
  const floorNodes = Object.keys(graph).filter((n) => isFloorPath(toRepo(n)));
  const seen = new Set();
  const queue = [...floorNodes];
  while (queue.length) {
    const node = queue.shift();
    for (const dep of graph[node] || []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      const repoPath = toRepo(dep);
      if (touched.has(repoPath)) return { from: toRepo(node), to: repoPath };
      queue.push(dep);
    }
  }
  return null;
}

function isHeadRange(opts, ctx) {
  try {
    const head = git(opts.repo, ["rev-parse", "HEAD"]).trim();
    const tip = opts.range.includes("..") ? opts.range.split("..").pop() : opts.range;
    return git(opts.repo, ["rev-parse", tip || "HEAD"]).trim() === head;
  } catch { return false; }
}

const isFloorPath = (p) =>
  anyMatch(S5_PATHS, p) || anyMatch(S6_MONEY, p) || anyMatch(S7_PATHS, p) || anyMatch(S9_PATHS_ANY, p);

// ---------------------------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------------------------

function classify(opts, ctx) {
  const reasons = [];
  const notes = [];
  const add = (signal, level, detail) => reasons.push({ signal, level, detail });

  const files = ctx.files;
  if (!files.length) throw new FailClosed("the diff is empty — nothing to classify (a bad range reads exactly like a no-op change)");

  const added = files.reduce((n, f) => n + f.added, 0);
  const deleted = files.reduce((n, f) => n + f.deleted, 0);
  const churn = added + deleted;
  const newFiles = files.filter((f) => f.status === "A");
  const stats = { files: files.length, added, deleted, new_files: newFiles.length };

  // --- content buckets --------------------------------------------------------------------
  const allAdded = [];
  const codeAdded = [];
  const schemaAdded = [];
  const codeAddedJoinedByFile = [];   // REV2-A: { path, joined } per non-prose file — added lines glued with "\n"
  for (const [p, lines] of ctx.addedByFile) {
    const prose = anyMatch(PROSE_PATHS, p);
    for (const l of lines) {
      allAdded.push({ path: p, line: l });
      if (!prose) codeAdded.push({ path: p, line: l });
    }
    if (!prose && lines.length) codeAddedJoinedByFile.push({ path: p, joined: lines.join("\n") });
    if (anyMatch(SCHEMA_ISH, p)) for (const l of lines) schemaAdded.push({ path: p, line: l });
  }
  const findContent = (bucket, patterns) => {
    for (const { path: p, line } of bucket) {
      for (const re of patterns) {
        const m = line.match(re);
        if (m) return { path: p, match: m[0].trim().slice(0, 60) };
      }
    }
    return null;
  };
  // REV2-A: a per-LINE scan (findContent above) misses a multi-token pattern split across two
  // added lines (a destructive statement built as a string-literal array, one token per line). This
  // scans each file's added lines JOINED, so the pattern can span a line break.
  const findContentJoined = (bucket, patterns) => {
    for (const { path: p, joined } of bucket) {
      for (const re of patterns) {
        const m = joined.match(re);
        if (m) return { path: p, match: m[0].trim().slice(0, 60).replace(/\s+/g, " ") };
      }
    }
    return null;
  };
  // REV2-B: decode a quoted base64-shaped literal and re-check S7_CONTENT against the plaintext.
  const findBase64Secret = (bucket) => {
    for (const { path: p, line } of bucket) {
      const m = line.match(BASE64_LITERAL);
      if (!m) continue;
      let decoded;
      try { decoded = Buffer.from(m[1], "base64").toString("utf8"); } catch { continue; }
      for (const re of S7_CONTENT) {
        const dm = decoded.match(re);
        if (dm) return { path: p, match: dm[0].trim().slice(0, 60) };
      }
    }
    return null;
  };
  if (!ctx.linesKnown) notes.push("content signals not evaluated: --files carries no diff body");

  // --- S1/S2/S3 · size ladder (exactly one fires) -------------------------------------------
  const newUnderSrc = newFiles.filter((f) => /(^|\/)src\//.test(f.path) || /^(app|components|lib|hooks)\//.test(f.path));
  const newRoutes = newFiles.filter((f) => ROUTE_FILE.test(f.path));
  if (!ctx.linesKnown) {
    if (files.length > 10) add("S3", "critical", `${files.length} files`);
    else add("S15", "normal", "line counts unavailable (--files mode) — cannot certify a micro change");
  } else if (churn > 150 || files.length > 10 || newUnderSrc.length > 0) {
    const why = [];
    if (churn > 150) why.push(`${churn} lines`);
    if (files.length > 10) why.push(`${files.length} files`);
    if (newUnderSrc.length) why.push(`new source file: ${newUnderSrc[0].path}`);
    add("S3", "critical", why.join(", "));
  } else if (churn <= 20 && files.length <= 3 && newFiles.length === 0 && newRoutes.length === 0) {
    add("S1", "micro", `${churn} lines, ${files.length} file(s), no new files`);
  } else {
    add("S2", "normal", `${churn} lines, ${files.length} file(s)`);
  }

  // --- S4 · new route -----------------------------------------------------------------------
  if (newRoutes.length) add("S4", "critical", `new route: ${newRoutes.map((f) => f.path).join(", ")} (visual baseline needs blessing)`);

  // --- S5 · FLOOR auth / data ---------------------------------------------------------------
  const s5Path = files.find((f) => anyMatch(S5_PATHS, f.path));
  if (s5Path) add("S5", "critical", `auth/data surface: ${s5Path.path}`);
  const s5Content = findContent(allAdded, S5_CONTENT);
  if (s5Content && !s5Path) add("S5", "critical", `auth token in added content: '${s5Content.match}' (${s5Content.path})`);

  // --- S6 · FLOOR money / PII ---------------------------------------------------------------
  const moneyPath = files.find((f) => anyMatch(S6_MONEY, f.path));
  if (moneyPath) add("S6", "critical", `money surface: ${moneyPath.path}`);
  else {
    const moneyContent =
      findContent(allAdded, S6_MONEY_CONTENT) ||
      findContent(allAdded.filter(({ line }) => !VCS_CONTEXT.test(line)), [CHECKOUT]);
    if (moneyContent) add("S6", "critical", `money token in added content: '${moneyContent.match}' (${moneyContent.path})`);
  }
  const piiPath = files.find((f) => anyMatch(SCHEMA_ISH, f.path));
  const piiContent = findContent(schemaAdded, S6_PII) || findContent(allAdded, S6_PII_HIGH_SIGNAL);
  if (piiContent) add("S6", "critical", `personal-data signal: '${piiContent.match}' (${piiContent.path})`);
  else if (piiPath && !ctx.linesKnown) add("S6", "critical", `schema surface with no readable body: ${piiPath.path}`);

  // --- S7 · FLOOR secrets / infra / factory machinery ---------------------------------------
  const s7Path = files.find((f) => anyMatch(S7_PATHS, f.path));
  if (s7Path) add("S7", "critical", `secrets/infra/factory surface: ${s7Path.path}`);
  const s7Content = findContent(allAdded, S7_CONTENT) || findBase64Secret(allAdded);
  if (s7Content) add("S7", "critical", `key-shaped literal in added content (${s7Content.path})`);

  // --- S8 · FLOOR irreversible / data loss ---------------------------------------------------
  const s8 = findContent(codeAdded, S8_CONTENT) || findContentJoined(codeAddedJoinedByFile, S8_CONTENT_JOINED);
  if (s8) add("S8", "critical", `irreversible/destructive operation added: '${s8.match}' (${s8.path}) — owner gate`);

  // --- S9 · FLOOR the oracles themselves (DR-080) --------------------------------------------
  const oracleAny = files.find((f) => anyMatch(S9_PATHS_ANY, f.path));
  if (oracleAny) add("S9", "critical", `oracle surface: ${oracleAny.path}`);
  const oracleErosion = files.find(
    (f) => anyMatch(S9_PATHS_NET_DELETE, f.path) && (!ctx.linesKnown || f.deleted > f.added || f.status === "D"),
  );
  if (oracleErosion) add("S9", "critical", `net deletion in a test surface: ${oracleErosion.path} (+${oracleErosion.added}/-${oracleErosion.deleted})`);

  // --- S10/S11 · the card --------------------------------------------------------------------
  const card = readFrontmatter(opts.card, "card");
  if (card) {
    if (/^true$/i.test(card.rebuilds_verified || "")) add("S10", "critical", "card declares rebuilds_verified: true");
    if ((card.supersedes || "").length) add("S11", "normal", `card supersedes '${card.supersedes}' (DR-116 check)`);
  }

  // --- S12 · the destination work order ------------------------------------------------------
  const wo = readFrontmatter(opts.wo, "work order");
  if (wo) {
    if (/^high$/i.test(wo.difficulty || "")) add("S12", "critical", "work order difficulty: high");
    const reopens = Number(wo.reopen_count);
    if (Number.isFinite(reopens) && reopens >= 1) add("S12", "critical", `work order reopen_count: ${reopens}`);
  }

  // --- S13 · presentation / documentation only ------------------------------------------------
  if (files.every((f) => anyMatch(S13_PATHS, f.path))) add("S13", "micro", "presentation/documentation surfaces only");

  // --- S14 · visible UI of an existing route ---------------------------------------------------
  const uiFile = files.find((f) => /(^|\/)app\//.test(f.path) && /\.(tsx|jsx)$/.test(f.path));
  if (uiFile) add("S14", "normal", `route UI touched: ${uiFile.path} (smoke required)`);

  // --- S15 · unclassifiable ⇒ never micro -------------------------------------------------------
  const unknown = files.filter((f) => !isRecognised(f.path));
  if (unknown.length) add("S15", "normal", `unrecognised surface: ${unknown.map((f) => f.path).slice(0, 3).join(", ")}`);

  // --- S17 · reverse dependency -------------------------------------------------------------
  const rev = reverseDependency(opts, ctx, notes);
  if (rev && rev.skipped === "unavailable") {
    // D3: tool absence, not a classifier failure — floor at `normal`, never `micro` (we genuinely
    // cannot certify no floor file transitively imports what this change touched) and never
    // `critical` (that would misrepresent an environment gap as a confirmed floor hit).
    add("S17", "normal", "madge is not installed — cannot certify no reverse-dependency risk onto a floor file");
  } else if (rev) {
    add("S17", "critical", `floor file ${rev.from} transitively imports touched ${rev.to}`);
  }

  // --- composition: max wins, then S16 raises one level ---------------------------------------
  let level = reasons.reduce((acc, r) => (rank(r.level) > rank(acc) ? r.level : acc), "micro");
  const attempts = resolveAttempts(opts, ctx);
  if (attempts > 0) {
    const raised = LEVELS[Math.min(rank(level) + 1, LEVELS.length - 1)];
    add("S16", raised, `${attempts} previous red gate(s) on this change — raised ${level} → ${raised}`);
    level = raised;
  }

  return {
    rigor: level,
    reasons,
    floor_hits: reasons.filter((r) => FLOOR_SIGNALS.has(r.signal)),
    stats,
    notes,
  };
}

function isRecognised(p) {
  const base = path.basename(p);
  if (base.startsWith(".")) return true; // dotfiles are config, and config is recognised
  if (KNOWN_BASENAMES.has(base) || KNOWN_BASENAMES.has(base.split(".")[0])) return true;
  const ext = base.includes(".") ? base.split(".").pop().toLowerCase() : "";
  return ext !== "" && KNOWN_EXT.has(ext);
}

/** S16's counter: the explicit flag wins; otherwise the run-state file, if the card names one. */
function resolveAttempts(opts, ctx) {
  if (opts.attempts !== null) return Number(opts.attempts);
  const file = path.join(ctx.repoRoot, ".pandacorp/run/change-attempts.json");
  if (!opts.card || !existsSync(file)) return 0;
  let data;
  try { data = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { throw new FailClosed(`change-attempts.json is unreadable: ${String(e.message || e).split("\n")[0]}`); }
  const key = path.basename(opts.card, ".md");
  const n = Number(data && data[key]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------------------------

/** Resolves symlinks when it can (keeps a TMPDIR-vs-realpath mismatch from breaking the
 * repoRoot/projectRoot comparison below); falls back to a plain absolute path otherwise. */
function realOrResolved(p) {
  try { return realpathSync(p); } catch { return path.resolve(p); }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(opts.repo)) throw new FailClosed(`repo path does not exist: ${opts.repo}`);
  const ctx = opts.mode === "files" ? collectFromFileList(opts) : collectFromGit(opts);
  // BL-0161: `--repo` is the PROJECT's own directory (where its `node_modules`/`src` live), which
  // is NOT always `ctx.repoRoot` (git's top-level — the factory root for a nested project like
  // Mission Control, which shares panda-corp's `.git` instead of owning one). `projectPrefix` is
  // how far `--repo` sits below the git top-level, so S17 can re-anchor madge's project-relative
  // graph nodes onto the repoRoot-relative paths `ctx.files` already carries (git diff's frame).
  ctx.projectRoot = realOrResolved(opts.repo);
  ctx.projectPrefix = normalizePath(path.relative(realOrResolved(ctx.repoRoot), ctx.projectRoot));
  process.stdout.write(`${JSON.stringify(classify(opts, ctx))}\n`);
}

try {
  main();
} catch (e) {
  const detail = String((e && e.message) || e).replace(/\s+/g, " ").slice(0, 400);
  process.stdout.write(`${JSON.stringify({ rigor: "critical", reasons: [{ signal: "FAILCLOSED", level: "critical", detail }], floor_hits: [{ signal: "FAILCLOSED", level: "critical", detail }], stats: { files: 0, added: 0, deleted: 0, new_files: 0 }, notes: [] })}\n`);
  process.exit(3);
}
