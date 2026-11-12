// units.mjs: unit worktrees and branches `lane/<run_id>/<unit>[-a<n>]`, work-order reading at the unit's base,
// and the generation of the unit brief (PLAN 3.7, 3.16 A2/A13/A16, CLI doc section 11.1).
//
// The brief is the only thing a worker is told. It carries the unit token (never the lease token), the write
// allowlist, the card's Dentro/Fuera and the owned AC lines verbatim, and the report contract. State is never
// written here: `next` records worktree/branch/token in its own phase 2 from what these functions return.
//
// Nested projects (a product inside a larger git repo, e.g. Mission Control inside the factory repo): the git
// worktree root is `worktree`; the product root inside it is `root` (`worktree` + `git rev-parse --show-prefix`).
// Every path this engine compares with `artifacts` or the allowlist is relative to `root`.
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frontmatterList, parseYamlSubset, readCard, splitFrontmatter } from "./card.mjs";
import { atomicWriteText, nowIso } from "./fsx.mjs";
import { assertSafeId, buildPaths } from "./paths.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Absolute `plugin/` directory this module ships in (role files live under `agents/`). */
export const PLUGIN_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const BOOTSTRAP_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_TIMEOUT_MS = 2 * 60 * 1000;
const RELEASE_VAR = "PANDACORP_OWNER_RELEASE_OK";

// ---------------------------------------------------------------------------------------------------------------
// Process runner and git helpers
// ---------------------------------------------------------------------------------------------------------------

/**
 * Default process runner. Never rejects on a non-zero exit; a timeout kills the child and reports `timedOut`.
 * Messages are forced to English (`LC_ALL=C`) and the release variable is never inherited by a child.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{cwd?: string, env?: object, timeout?: number}} [opts]
 * @returns {Promise<{code: number, stdout: string, stderr: string, timedOut: boolean}>}
 */
export function defaultRun(cmd, args, { cwd, env, timeout = GIT_TIMEOUT_MS } = {}) {
  const childEnv = { ...(env ?? process.env), LC_ALL: "C" };
  delete childEnv[RELEASE_VAR];
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, env: childEnv, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      const timedOut = Boolean(error && (error.killed || error.signal === "SIGKILL") && timeout > 0);
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 127) : 0, stdout: stdout ?? "", stderr: stderr ?? "", timedOut });
    });
  });
}

/** The injected runner (`deps.exec`) or the default one. */
export const runnerOf = (deps = {}) => deps.exec ?? defaultRun;

/**
 * Run git in `cwd`. A non-zero exit throws INVALID_STATE unless `allowFail`.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
export async function git(deps, cwd, args, { allowFail = false, env } = {}) {
  const res = await runnerOf(deps)("git", args, { cwd, env: env ?? deps.env, timeout: GIT_TIMEOUT_MS });
  if (res.code !== 0 && !allowFail) {
    throw err("INVALID_STATE", `git ${args[0]} failed (exit ${res.code}) in ${cwd}: ${String(res.stderr).trim().split("\n")[0]}`);
  }
  return res;
}

/**
 * Path prefix of the project inside its git repository ("" when it is the repository root, else `dir/`).
 * @param {string} project absolute project root
 */
export async function productPrefix(project, deps = {}) {
  const res = await git(deps, project, ["rev-parse", "--show-prefix"]);
  const prefix = res.stdout.trim().replace(/\\/g, "/");
  return prefix === "" ? "" : `${prefix.replace(/\/+$/, "")}/`;
}

/**
 * The product root inside a git worktree root.
 * @param {string} worktree git worktree root (what `state.units[].worktree` stores)
 * @param {string} prefix result of {@link productPrefix}
 */
export const productRoot = (worktree, prefix) => (prefix ? path.join(worktree, prefix) : worktree);

const sameDir = async (fs, a, b) => {
  const real = async (p) => { try { return await fs.realpath(p); } catch { return path.resolve(p); } };
  return (await real(a)) === (await real(b));
};

/**
 * Branch and worktree of a unit attempt (pure, A13/A16).
 * @returns {{branch: string, worktree: string}}
 */
export function unitRefs({ project, runId, unitId, attempt = 1 }, deps = {}) {
  const p = buildPaths(project, deps);
  return { branch: p.unitBranch(runId, unitId, attempt), worktree: p.unitWorktree(unitId, attempt) };
}

// ---------------------------------------------------------------------------------------------------------------
// Worktrees
// ---------------------------------------------------------------------------------------------------------------

function parseWorktreeList(text) {
  const entries = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9), branch: null }; entries.push(cur); } else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7);
  }
  return entries;
}

/**
 * Create (or adopt) the registered git worktree of one unit attempt. Idempotent: an existing registered worktree on
 * the right branch is reused untouched (a `doubt` that was decided resumes in the same attempt and directory).
 * A fresh attempt (n >= 2) always starts a NEW branch `lane/<run>/<unit>-a<n>` from the integration tip; the failed
 * attempt's branch and worktree are preserved (BUILD-15).
 * @param {{project: string, runId: string, unit: string, attempt?: number, base?: string}} input
 *   `base` defaults to `paths.integrationBranch(runId)`
 * @param {{exec?: Function, fs?: object, env?: object, bootstrap?: boolean}} [deps] `bootstrap:false` skips the
 *   project's `.pandacorp/worktree-bootstrap.sh`
 * @returns {Promise<{worktree: string, root: string, branch: string, base_sha: string, created: boolean,
 *   bootstrap: {ran: boolean, exit: number|null, tail: string}}>}
 * @throws INVALID_STATE when the path exists but is not the registered worktree of that branch
 */
export async function prepareUnitWorktree({ project, runId, unit, attempt = 1, base }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const { branch, worktree } = unitRefs({ project, runId, unitId: unit, attempt }, deps);
  const p = buildPaths(project, deps);
  const baseRef = base ?? p.integrationBranch(runId);
  const prefix = await productPrefix(project, deps);
  const root = productRoot(worktree, prefix);
  const listed = parseWorktreeList((await git(deps, project, ["worktree", "list", "--porcelain"])).stdout);
  let known = null;
  for (const entry of listed) if (await sameDir(fs, entry.path, worktree)) known = entry;
  if (known) {
    if (known.branch !== `refs/heads/${branch}`) throw err("INVALID_STATE", `worktree ${worktree} is on ${known.branch}, not ${branch}`);
    return { worktree, root, branch, base_sha: await mergeBase(deps, root, baseRef), created: false, bootstrap: { ran: false, exit: null, tail: "" } };
  }
  const exists = await fs.stat(worktree).then(() => true, () => false);
  if (exists) throw err("INVALID_STATE", `${worktree} exists but is not a registered worktree`);
  await fs.mkdir(path.dirname(worktree), { recursive: true });
  // Register the on-disk spelling of the directory (git keeps the path as given; on a case-insensitive volume or behind a
  // symlink the spelling in `paths` can differ from the one `git worktree list` prints for the main checkout).
  const registered = path.join(await fs.realpath(path.dirname(worktree)), path.basename(worktree));
  const branchExists = (await git(deps, project, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { allowFail: true })).code === 0;
  if (branchExists) await git(deps, project, ["worktree", "add", registered, branch]);
  else await git(deps, project, ["worktree", "add", "-b", branch, registered, baseRef]);
  const bootstrap = await bootstrapWorktree(root, deps);
  return { worktree, root, branch, base_sha: await mergeBase(deps, root, baseRef), created: true, bootstrap };
}

async function mergeBase(deps, root, baseRef) {
  const res = await git(deps, root, ["merge-base", "HEAD", baseRef]);
  return res.stdout.trim();
}

async function bootstrapWorktree(root, deps) {
  const none = { ran: false, exit: null, tail: "" };
  if (deps.bootstrap === false) return none;
  const script = path.join(root, ".pandacorp", "worktree-bootstrap.sh");
  if (!(await (deps.fs ?? fsp).stat(script).then(() => true, () => false))) return none;
  const res = await runnerOf(deps)("bash", [".pandacorp/worktree-bootstrap.sh"], { cwd: root, env: deps.env, timeout: BOOTSTRAP_TIMEOUT_MS });
  return { ran: true, exit: res.code, tail: `${res.stdout}\n${res.stderr}`.trim().split("\n").slice(-10).join("\n") };
}

/**
 * Fork point of a unit worktree: the merge base of HEAD and the integration branch.
 * @param {string} root product root inside the unit worktree
 * @param {string} integrationBranch `state.integration.branch` (from `paths.integrationBranch`)
 */
export const unitBase = (root, integrationBranch, deps = {}) => mergeBase(deps, root, integrationBranch);

// ---------------------------------------------------------------------------------------------------------------
// Work orders at the unit's base
// ---------------------------------------------------------------------------------------------------------------

const WO_PATH_RE = /^docs\/frds\/([^/]+)\/work-orders\/([^/]+)\.md$/;
const AC_ID_RE = /AC-\d+-\d+\.\d+/g;

/** Is this repo-relative path a work-order file (`docs/frds/<frd>/work-orders/<file>.md`, not the README)? */
export const isWorkOrderPath = (rel) => {
  const m = WO_PATH_RE.exec(rel);
  return Boolean(m) && m[2].toLowerCase() !== "readme";
};

/** Frontmatter block text of a document (`null` when it has none). */
export const frontmatterBlock = (text) => splitFrontmatter(text)?.fm.replace(/\r\n/g, "\n").trimEnd() ?? null;

/**
 * Read the work orders of a unit from the BASE commit (HEAD of a fresh unit worktree), never from the worktree, so
 * a worker cannot widen its own allowlist by editing `artifacts`.
 * @param {string} root product root inside the unit worktree
 * @param {string[]} wos work order ids (`WO-05-002`)
 * @param {{ref?: string}} [deps] `ref` = the commit to read (default `HEAD`; `report` passes the unit's base sha)
 * @returns {Promise<{id: string, file: string, frd: string, artifacts: string[], text: string}[]>}
 * @throws INVALID_STATE when an id has no work order file
 */
export async function readUnitWorkOrders(root, wos, deps = {}) {
  if (!wos.length) return [];
  const ref = deps.ref ?? "HEAD";
  const tree = await git(deps, root, ["ls-tree", "-r", "--name-only", ref, "--", "docs/frds"]);
  const files = tree.stdout.split("\n").filter(isWorkOrderPath);
  const show = async (file) => (await git(deps, root, ["show", `${ref}:./${file}`])).stdout;
  const parse = (file, text) => {
    const fm = parseYamlSubset(splitFrontmatter(text)?.fm ?? "").data;
    return { id: String(fm.id ?? path.basename(file, ".md")), file, frd: WO_PATH_RE.exec(file)[1], artifacts: frontmatterList(fm.artifacts), text };
  };
  const out = [];
  for (const id of wos) {
    const key = String(id).toLowerCase();
    let file = files.find((f) => { const stem = path.basename(f, ".md").toLowerCase(); return stem === key || stem.startsWith(`${key}-`); });
    let found = file ? parse(file, await show(file)) : null;
    if (!found) {
      for (const f of files) {
        const candidate = parse(f, await show(f));
        if (candidate.id.toLowerCase() === key) { file = f; found = candidate; break; }
      }
    }
    if (!found) throw err("INVALID_STATE", `work order ${id} has no file under docs/frds/*/work-orders/`);
    out.push(found);
  }
  return out;
}

/** Union of the `artifacts` of work orders (order kept, unique). */
export const artifactsOf = (workOrders) => [...new Set(workOrders.flatMap((w) => w.artifacts))];

// ---------------------------------------------------------------------------------------------------------------
// Allowlists (A2)
// ---------------------------------------------------------------------------------------------------------------

const TEST_RES = [/(^|\/)_tests\//, /^[^/]*\.test\.[^/]*$|\/[^/]*\.test\.[^/]*$/, /^[^/]*\.spec\.[^/]*$|\/[^/]*\.spec\.[^/]*$/, /^e2e\//, /^src\/test\//];
const DOCS_RES = [/^docs\//, /^README\.md$/, /^\.env\.example$/];

/** Human-readable patterns per kind, as printed in the brief (A2). */
export function allowlistPatterns(kind, artifacts = []) {
  if (kind === "build" || kind === "patch") return [...artifacts];
  if (kind === "docs") return ["docs/**", "README.md", ".env.example", "new work orders docs/frds/*/work-orders/wo-*.md (implementation_status: PLANNED)"];
  if (kind === "tests" || kind === "review" || kind === "audit" || kind === "deferred-review") return ["**/_tests/**", "**/*.test.*", "**/*.spec.*", "e2e/**", "src/test/**"];
  return [];
}

/** Does a repo-relative path match the test-file globs of A2? */
export const isTestSurface = (rel) => TEST_RES.some((re) => re.test(rel));

function artifactRegExp(glob) {
  const g = glob.replace(/\\/g, "/").replace(/^\.\//, "");
  let re = "";
  for (let i = 0; i < g.length; i += 1) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") { if (g[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; } } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^$()|[\]\\{}]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/**
 * Does a changed path fall inside one `artifacts` entry? A plain path matches itself and, as a directory, everything
 * below it; a glob is anchored at the product root (`**` crosses directories, `*` stays inside a segment).
 */
export function matchesArtifact(artifact, rel) {
  const a = String(artifact).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!a) return false;
  if (!/[*?]/.test(a)) return rel === a || rel.startsWith(`${a.replace(/\/+$/, "")}/`);
  return artifactRegExp(a).test(rel);
}

/**
 * Is a product-root-relative path inside the write allowlist of a unit kind?
 * @param {string} kind unit kind
 * @param {string[]} artifacts union of the unit's WOs' `artifacts` (build/patch only)
 * @param {string} rel path relative to the product root
 */
export function isAllowedPath(kind, artifacts, rel) {
  if (kind === "build" || kind === "patch") return artifacts.some((a) => matchesArtifact(a, rel));
  if (kind === "docs") return DOCS_RES.some((re) => re.test(rel));
  if (kind === "tests" || kind === "review" || kind === "audit" || kind === "deferred-review") return isTestSurface(rel);
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------------------------------------------

const ROLE_FILES = {
  "pandacorp:implementer": "implementer.md",
  "pandacorp:reviewer": "reviewer.md",
  "pandacorp:test-writer": "test-writer.md",
  "pandacorp:security-auditor": "security-auditor.md",
};

/** Absolute role file of an agent type (`null` for `general-purpose`). */
export function agentRoleFile(agentType, pluginRoot = PLUGIN_ROOT) {
  const name = ROLE_FILES[agentType];
  return name ? path.join(pluginRoot, "agents", name) : null;
}

const bullets = (items, empty) => (items.length ? items.map((i) => `- ${i}`).join("\n") : empty);
const REVIEW_KINDS = ["review", "audit", "deferred-review"];

/**
 * Render a brief (pure). See the CLI doc section 11.1 for the template.
 * @param {object} input
 * @param {{id: string, kind: string, wos: string[], frd: string|null, attempt: number, zone: string, risk_rules: string[]}} input.unit
 * @param {{runtime: string, model: string, effort: string|null}} input.cell
 * @param {string} input.agentType
 * @param {string|null} input.roleFile absolute role file
 * @param {{dentro: string[], fuera: string[]}|null} input.card verbatim card lines (`null` when the run has no card)
 * @param {string[]} input.acLines owned acceptance criteria, verbatim
 * @param {string[]} input.allowlist patterns the unit may write
 * @param {string[]} input.contextPack absolute paths to read
 * @param {string} input.root absolute product root of the unit worktree (the only place to work)
 * @param {string} input.reportPath
 * @param {string} input.schemaPath
 * @param {string} input.token the UNIT token (never the lease token)
 * @param {string[]} [input.verification] commands to run, in order
 * @param {string[]} [input.readOnlyPaths] hashed test and probe files the unit must not edit
 * @param {object[]} [input.previous] evidence of earlier attempts `{attempt, outcome, reason, failing[], tail, diagnosis}`
 * @param {object[]} [input.findings] reviewer findings a patch must fix
 * @param {{question: string, decision: string, rationale: string}|null} [input.decision] a decided doubt
 * @param {string[]} [input.notes] extra owner answers or constraints
 * @param {{range: string, scopeLens: boolean}|null} [input.review] review inputs (review-type kinds)
 * @param {object|null} [input.doubt] the doubt object (doubt-consult)
 * @param {boolean} [input.sourcesSkipped] doubt-consult: the sources step was skipped
 * @returns {string} Markdown
 */
export function renderBrief(input) {
  const { unit, cell, token } = input;
  const effort = cell.effort ?? "session default";
  const out = [];
  out.push(`# Unit ${unit.id}: ${unit.kind}`, "");
  out.push("## 1. Role");
  out.push(input.roleFile
    ? `Act as \`${input.agentType}\` (read \`${input.roleFile}\` for the role rules). Runtime: ${cell.runtime}, model ${cell.model}, effort ${effort}.`
    : `Act as a general-purpose consultant (no role file). Runtime: ${cell.runtime}, model ${cell.model}, effort ${effort}.`, "");
  out.push("## 2. Unit");
  out.push(`- id: ${unit.id}`, `- kind: ${unit.kind}`, `- work orders: ${unit.wos.length ? unit.wos.join(", ") : "none"}`, `- FRD: ${unit.frd ?? "none"}`);
  out.push(`- attempt: ${unit.attempt}`, `- risk zone: ${unit.zone}${unit.risk_rules?.length ? ` (rules: ${unit.risk_rules.join(", ")})` : ""}`, "");
  if (unit.kind !== "doubt-consult") out.push(...scopeSection(input));
  out.push(...contextSection(input));
  if (REVIEW_KINDS.includes(unit.kind)) out.push(...reviewSections(input));
  else if (unit.kind === "doubt-consult") out.push(...consultSections(input));
  else out.push(...workSections(input));
  out.push("## 9. Identity", `unit: ${unit.id}`, `token: ${token}`, "(copy both verbatim into the report)", "");
  return out.join("\n");
}

function scopeSection({ unit, card, acLines, allowlist }) {
  const lines = ["## 3. Scope"];
  if (card) lines.push("Dentro (verbatim from the card):", bullets(card.dentro, "- (the card lists nothing)"), "", "Fuera (verbatim from the card):", bullets(card.fuera, "- (the card lists nothing)"), "");
  else lines.push("No card: the scope is this unit's work orders only.", "");
  lines.push("Owned acceptance criteria (verbatim):", bullets(acLines, "- (none cited)"), "");
  lines.push(`Write allowlist (\`artifacts\`): ${allowlist.length ? allowlist.map((a) => `\`${a}\``).join(", ") : "no repository files"}`, "");
  lines.push("Forbidden paths (never touch): `**/*-snapshots/**`, the frontmatter of every work order, hashed test files, anything listed in Fuera.");
  if (unit.kind === "tests") lines.push("", "RED-first acceptance tests: each new test must fail by assertion, never by an import or syntax error; touch no production code. The report carries no hashes; the engine computes them.");
  lines.push("");
  return lines;
}

function contextSection({ contextPack, readOnlyPaths = [], previous = [], findings = [], decision = null, notes = [] }) {
  const lines = ["## 4. Context pack", bullets(contextPack, "- (none)")];
  if (readOnlyPaths.length) lines.push("", "Read-only, hashed by the engine (a change gets your report rejected):", bullets(readOnlyPaths, ""));
  if (findings.length) lines.push("", "Findings to fix:", ...findings.map((f) => `- ${f.id ?? ""} [${f.severity ?? "?"}] ${f.file ?? ""}${f.line ? `:${f.line}` : ""} ${f.summary ?? ""}${f.probe ? ` (RED probe: ${f.probe})` : ""}`.replace(/\s+/g, " ").trim()));
  if (previous.length) {
    lines.push("", "Evidence of earlier attempts of this unit (the engine's own re-runs):");
    for (const a of previous) {
      lines.push(`- attempt ${a.attempt}: ${a.outcome}${a.reason ? ` (${a.reason})` : ""}${a.failing?.length ? `; failing: ${a.failing.join("; ")}` : ""}${a.diagnosis ? `; diagnosis: ${a.diagnosis.cause}: ${a.diagnosis.detail}` : ""}`);
      if (a.tail) lines.push("  ```", ...String(a.tail).split("\n").slice(-20).map((l) => `  ${l}`), "  ```");
    }
  }
  if (decision) lines.push("", `Decision on your earlier doubt: ${decision.decision} (${decision.rationale}). Question was: ${decision.question}`);
  if (notes.length) lines.push("", "Notes:", bullets(notes, ""));
  lines.push("");
  return lines;
}

function workSections({ root, verification = [], reportPath, schemaPath }) {
  const cmds = verification.length ? verification.map((c) => `- \`${c}\``).join("\n") : "- (none given)";
  return [
    "## 5. Working directory and git",
    `Work only in: ${root}`,
    "Never run `git commit`, `git push`, `git reset`, `git checkout`, `git stash` or `git add -A`. The engine commits.",
    `Never set \`${RELEASE_VAR}\`.`, "",
    "## 6. Verification",
    "Run, in this order, one heavy tool at a time, at most 3 fix cycles:", cmds,
    "Test budget: existing tests reached by the change always; at most one new behaviour spec per new or changed main flow; at most 5 cases per module for branching logic; cite the AC ids in test names.",
    "Record each command's exit code and the output tail in the report.", "",
    "## 7. Doubts",
    "Never ask the owner. If a decision needed to proceed is not answered by the documents, stop and return `status:\"doubt\"` with `question`, `options`, `preferred` and `why`.", "",
    "## 8. Output",
    `Write a JSON object valid against \`${schemaPath}\` to \`${reportPath}\`, and print the same JSON as your final message.`, "",
  ];
}

function reviewSections({ root, review, reportPath, schemaPath }) {
  return [
    "## 5. Review inputs",
    `Diff range: ${review?.range ?? "(not given)"}`,
    `Worktree for probes: ${root} (probe files only, under the test globs; never production code)`,
    `Scope lens: open a \`scope\` finding when the diff touches anything listed in Fuera${review?.scopeLens === false ? " (no card: not applicable)" : ""}.`,
    "Never run `git commit`, `git push`, `git reset`, `git checkout` or `git stash`.", "",
    "## 6. Verification",
    "Re-run the evidence yourself; never trust a claim of passing tests. One heavy tool at a time.", "",
    "## 7. Doubts",
    "Never ask the owner. Return `verdict:\"doubt\"` with a `doubt` object when a decision is missing.", "",
    "## 8. Output",
    `Write a JSON object valid against \`${schemaPath}\` to \`${reportPath}\`, and print the same JSON as your final message.`, "",
  ];
}

function consultSections({ doubt, sourcesSkipped, reportPath }) {
  return [
    "## 3. Doubt",
    "```json", JSON.stringify(doubt ?? {}, null, 2), "```",
    sourcesSkipped ? "The sources step was skipped: check the repository documents and the decision log first." : "The documents were already checked; answer from judgment.", "",
    "## 8. Output",
    `Write \`{"decision": string|null, "rationale": string, "confidence": "low|medium|high", "reversible": boolean}\` to \`${reportPath}\` and print the same JSON as your final message. Read-only: change no repository file.`, "",
  ];
}

/**
 * Remove the stale `report.json`/`review.json` of an earlier attempt so a wait on the report file cannot return early.
 */
async function archiveStaleReports(project, unitId, attempt, deps) {
  const fs = deps.fs ?? fsp;
  const p = buildPaths(project, deps);
  for (const [file, stem] of [[p.reportFile(unitId), "report"], [p.reviewFile(unitId), "review"]]) {
    const target = path.join(path.dirname(file), `${stem}-before-a${attempt}.json`);
    try { await fs.rename(file, target); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
}

const frdDir = (workOrders) => (workOrders[0] ? path.posix.dirname(path.posix.dirname(workOrders[0].file)) : null);

async function readIfExists(fs, file) {
  try { return await fs.readFile(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
}

/** AC lines (verbatim, with indented continuation lines) of an FRD text for the given AC ids. */
export function extractAcLines(frdText, ids) {
  const wanted = new Set(ids);
  const lines = String(frdText).split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const hit = (lines[i].match(AC_ID_RE) ?? []).some((id) => wanted.has(id));
    if (!hit) continue;
    let text = lines[i].trim().replace(/^[-*+]\s+/, "");
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) { i += 1; text += ` ${lines[i].trim()}`; }
    out.push(text);
  }
  return out;
}

/** The decision (or assumption) of the unit's doubt, as the brief states it; `null` when the unit has no doubt. */
async function decidedDoubt(project, unit, deps) {
  if (!unit.doubt_id) return null;
  const { briefDecision, readDoubt } = await import("./doubts.mjs");
  const record = await readDoubt(project, unit.doubt_id, deps);
  const picked = briefDecision(record);
  if (!picked) return null;
  return { question: record.question ?? "", decision: picked.text || picked.value, rationale: picked.why };
}

/**
 * Gather everything a brief needs and write `build/units/<unit>/brief.md` (mode 0600: it holds the unit token).
 * The unit worktree is normally created first (see {@link prepareUnitWorktree}); without one, a worker unit's brief names
 * the worktree path of its attempt and the documents are read from the integration worktree.
 * @param {object} input
 * @param {string} input.project absolute project root
 * @param {object} input.state current `state.json` object
 * @param {object} input.unit the state unit (with its final `attempt`)
 * @param {{runtime: string, model: string, effort: string|null}} input.cell resolved routing cell
 * @param {string} input.agentType
 * @param {string} input.token the raw unit token returned by `issueToken`
 * @param {string} input.schemaPath absolute schema path ("" for a doubt-consult)
 * @param {string} [input.worktree] git worktree root (default: `unit.worktree`)
 * @param {string} [input.reportPath] default: `report.json` (`review.json` for review kinds, `answer.json` for consults)
 * @param {object} [input.extra] `{findings, decision, notes, review, doubt, sourcesSkipped, verification}` passed through
 * @param {{exec?: Function, fs?: object, env?: object, pluginRoot?: string}} [deps]
 * @returns {Promise<{brief_path: string, report_path: string, text: string}>}
 */
export async function writeUnitBrief({ project, state, unit, cell, agentType, token, schemaPath, worktree, reportPath, extra = {} }, deps = {}) {
  assertSafeId(unit.id, "unit id");
  const fs = deps.fs ?? fsp;
  const p = buildPaths(project, deps);
  const prefix = await productPrefix(project, deps);
  const wt = worktree ?? unit.worktree ?? (REVIEW_KINDS.includes(unit.kind) || unit.kind === "doubt-consult" ? null : p.unitWorktree(unit.id, unit.attempt));
  if (!wt) throw err("INVALID_STATE", `unit ${unit.id} has no worktree yet`);
  const root = productRoot(wt, prefix);
  const isReview = REVIEW_KINDS.includes(unit.kind);
  const outPath = reportPath ?? (isReview ? p.reviewFile(unit.id) : unit.kind === "doubt-consult" ? p.unitAnswerFile(unit.id) : p.reportFile(unit.id));

  // A brief regenerated before its worktree exists (or for a dry run) reads the documents from the integration worktree.
  const readRoot = (await fs.stat(root).then(() => true, () => false)) || !state.integration?.worktree ? root : productRoot(path.resolve(project, state.integration.worktree), prefix);
  const workOrders = unit.kind === "doubt-consult" ? [] : await readUnitWorkOrders(readRoot, unit.wos, { ...deps, bootstrap: false });
  const artifacts = artifactsOf(workOrders);
  const dir = frdDir(workOrders);
  const acIds = [...new Set(workOrders.flatMap((w) => w.text.match(AC_ID_RE) ?? []))];
  const frdText = dir ? await readIfExists(fs, path.join(readRoot, dir, "frd.md")) : null;
  const acLines = frdText ? extractAcLines(frdText, acIds) : [];

  let card = null;
  if (state.scope?.card) {
    const parsed = await readCard(project, state.scope.card, { where: "any" }, deps);
    if (parsed) card = { dentro: parsed.dentro.map((i) => i.text), fuera: parsed.fuera.map((i) => i.text) };
  }

  const abs = (rel) => path.join(readRoot, rel);
  const contextPack = [];
  if (dir) for (const f of ["frd.md", "fdd.md", "blueprint.md"]) if ((await readIfExists(fs, abs(path.posix.join(dir, f)))) !== null) contextPack.push(abs(path.posix.join(dir, f)));
  for (const w of workOrders) contextPack.push(abs(w.file));
  for (const f of ["docs/design/design-tokens.json", "DESIGN.md", "docs/rules/README.md"]) if ((await readIfExists(fs, abs(f))) !== null) contextPack.push(abs(f));

  const hashed = new Set();
  for (const u of state.units) if (u.id !== unit.id) for (const f of [...Object.keys(u.test_hashes ?? {}), ...Object.keys(u.probe_hashes ?? {})]) hashed.add(f);

  const previous = [];
  for (let n = 1; n < unit.attempt; n += 1) {
    const raw = await readIfExists(fs, path.join(p.unitDir(unit.id), `attempt-${n}.json`));
    if (raw !== null) previous.push(JSON.parse(raw));
  }
  await archiveStaleReports(project, unit.id, unit.attempt, deps);

  const decision = extra.decision ?? await decidedDoubt(project, unit, deps);
  const notes = [...(extra.notes ?? []), ...(extra.questionDefaults ?? []).map((q) => `Owner question pending, working default: ${typeof q === "string" ? q : JSON.stringify(q)}`)];
  const text = renderBrief({
    unit, cell, agentType, roleFile: agentRoleFile(agentType, deps.pluginRoot), card, acLines,
    allowlist: allowlistPatterns(unit.kind, artifacts), contextPack, root, reportPath: outPath, schemaPath, token,
    verification: extra.verification ?? ["bash .pandacorp/verify.sh --light", "bash .pandacorp/verify.sh --light --tests=<the test files you changed>"],
    readOnlyPaths: [...hashed].sort(), previous, findings: extra.findings, decision, notes,
    review: extra.review, doubt: extra.doubt, sourcesSkipped: extra.sourcesSkipped,
  });
  await atomicWriteText(p.briefFile(unit.id), text, { fs });
  return { brief_path: p.briefFile(unit.id), report_path: outPath, text, written_at: nowIso(deps) };
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points used by `next` and the CLI
// ---------------------------------------------------------------------------------------------------------------

const AGENT_OF_KIND = Object.freeze({
  docs: "pandacorp:implementer", build: "pandacorp:implementer", patch: "pandacorp:implementer", tests: "pandacorp:test-writer",
  review: "pandacorp:reviewer", "deferred-review": "pandacorp:reviewer", audit: "pandacorp:security-auditor", "doubt-consult": "general-purpose",
});

/**
 * Create (or adopt) the unit worktree of one attempt: {@link prepareUnitWorktree} with the unit given as an object.
 * @param {{project: string, runId: string, unit: string|{id: string, attempt?: number}, attempt?: number, base?: string}} input
 * @param {object} [deps] see {@link prepareUnitWorktree}
 * @returns {Promise<{worktree: string, root: string, branch: string, base_sha: string, created: boolean, bootstrap: object}>}
 */
export function createUnitWorktree({ project, runId, unit, attempt, base }, deps = {}) {
  const id = typeof unit === "string" ? unit : unit.id;
  return prepareUnitWorktree({ project, runId, unit: id, attempt: attempt ?? (typeof unit === "string" ? 1 : unit.attempt ?? 1), base }, deps);
}

/**
 * Write the brief of a unit from the run's current `state.json` ({@link writeUnitBrief} with the agent type and schema
 * derived from the unit kind). The unit worktree may not exist yet: documents are then read from the integration worktree.
 * @param {{project: string, runId?: string, unit: object, token: string, cell: object, via?: string, agentType?: string,
 *   worktree?: string, reportPath?: string, extra?: object}} input `runId` and `via` are informational
 * @param {object} [deps] see {@link writeUnitBrief}; `readState` is imported lazily
 * @returns {Promise<{file: string, brief_path: string, report_path: string, text: string}>}
 */
export async function writeBrief({ project, unit, token, cell, agentType, worktree, reportPath, extra }, deps = {}) {
  const { readState } = await import("./state.mjs");
  const state = await readState(project, deps);
  if (!state) throw err("INVALID_STATE", "no build state: cannot write a brief", { hint: "rebuild-state" });
  const p = buildPaths(project, deps);
  const reviewType = REVIEW_KINDS.includes(unit.kind);
  const schemaPath = unit.kind === "doubt-consult" ? "" : p.schemaFile(reviewType ? "review-report" : "report");
  const out = await writeUnitBrief({ project, state, unit, cell, agentType: agentType ?? AGENT_OF_KIND[unit.kind], token, schemaPath, worktree, reportPath, extra }, deps);
  return { ...out, file: out.brief_path };
}

/**
 * The `units.prepare` sibling of `next` (NEXT_SIBLING_CONTRACT): worktree plus brief of one dispatched unit, outside the
 * mutex. A consult has no worktree (its brief was written by `doubt open`/`doubt answer`); a review-type unit reads the
 * integration tip's worktree for its probes.
 * @param {{project: string, state: object, unit: object, cell: object, via: string, token: string, attempt?: number,
 *   review?: object|null, consult_brief?: string|null, question_defaults?: object[]}} input
 * @param {object} [deps] see {@link writeUnitBrief}
 * @returns {Promise<{worktree: string|null, branch: string|null, brief_path: string, report_path: string, schema_path: string}>}
 */
export async function prepare({ project, state, unit, cell, via, token, attempt, review = null, consult_brief: consultBrief = null, question_defaults: questionDefaults = [] }, deps = {}) {
  const p = buildPaths(project, deps);
  const runId = state.run_id;
  if (unit.kind === "doubt-consult") {
    return { worktree: null, branch: null, brief_path: consultBrief ?? p.briefFile(unit.id), report_path: p.unitAnswerFile(unit.id), schema_path: via === "cli" ? p.schemaFile("doubt-answer") : "" };
  }
  const reviewType = REVIEW_KINDS.includes(unit.kind);
  const n = attempt ?? unit.attempt ?? 1;
  const refs = reviewType
    ? { worktree: path.resolve(project, state.integration.worktree), branch: state.integration.branch }
    : await createUnitWorktree({ project, runId, unit: unit.id, attempt: n, base: state.integration.branch }, deps);
  const brief = await writeUnitBrief({
    project, state, unit: { ...unit, attempt: n }, cell, agentType: AGENT_OF_KIND[unit.kind], token,
    schemaPath: p.schemaFile(reviewType ? "review-report" : "report"), worktree: refs.worktree,
    extra: { review, questionDefaults },
  }, deps);
  return { worktree: refs.worktree, branch: refs.branch, brief_path: brief.brief_path, report_path: brief.report_path, schema_path: p.schemaFile(reviewType ? "review-report" : "report") };
}
