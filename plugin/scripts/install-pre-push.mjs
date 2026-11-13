#!/usr/bin/env node
// Installs the Pandacorp git pre-push hook (D29, BUILD-13) as an UNTRACKED file in the hooks directory
// that git itself resolves (`git rev-parse --git-path hooks`: honors linked worktrees and core.hooksPath).
//
//   node install-pre-push.mjs --project <dir> [--check]
//
// Exit codes: 0 installed/current, 1 missing or stale (--check only), 2 not a git repository,
//             3 core.hooksPath points inside the work tree (tracked hooks, e.g. husky: refused),
//             4 the hooks directory could not be written (install mode only), 64 bad arguments.
//
// The installed hook is a configured copy of plugin/templates/shared/.pandacorp/hooks/pre-push carrying a
// `# pandacorp-pre-push v<N>` marker. A hook that is not ours is kept next to it as
// `pre-push.pandacorp-chained`, which the installed hook runs after its own gate. The hook gates by a
// flag, not a secret: it stops an unprompted push to the default branch of a launched project, not a
// deliberate bypass.
import { execFileSync } from "node:child_process";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXIT = Object.freeze({ OK: 0, NOT_READY: 1, NOT_A_REPO: 2, TRACKED_HOOKS_PATH: 3, WRITE_FAILED: 4, USAGE: 64 });
export const HOOK_NAME = "pre-push";
export const CHAINED_NAME = "pre-push.pandacorp-chained";
export const MARKER_RE = /^# pandacorp-pre-push v(\d+)\s*$/m;
const DEFAULT_TEMPLATE = fileURLToPath(new URL("../templates/shared/.pandacorp/hooks/pre-push", import.meta.url));
// Variables a parent git process (a hook, a worktree helper) may export; they would redirect our git calls.
const GIT_ENV_LEAKS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_PREFIX"];

/** Default git runner: `git -C <cwd> <args>` -> trimmed stdout, or null when git exits non-zero. */
export function runGit(cwd, args) {
  const env = { ...process.env };
  for (const k of GIT_ENV_LEAKS) delete env[k];
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** realpath of `p`, or of its nearest existing ancestor plus the missing tail (a hooks dir may not exist yet). */
function realpathLoose(p) {
  const tail = [];
  let cur = path.resolve(p);
  for (;;) {
    try {
      return path.join(realpathSync(cur), ...tail.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Marker version of a hook body, or null when it is not a Pandacorp hook. */
export function markerVersion(body) {
  const m = MARKER_RE.exec(body);
  return m ? Number(m[1]) : null;
}

/**
 * Install (or check) the pre-push hook.
 * @param {{project: string, check?: boolean}} opts project directory (any path inside the repo) and mode.
 * @param {{git?: Function, templatePath?: string, fs?: object}} [deps] injected for tests; defaults are real.
 * @returns {{code: number, status: string, hooksDir: string|null, changed: boolean, chained: boolean, message: string}}
 *   status: current | installed | updated | missing | stale | not_a_repo | tracked_hooks_path | write_failed
 */
export function installPrePush(opts, deps = {}) {
  const git = deps.git ?? runGit;
  const templatePath = deps.templatePath ?? DEFAULT_TEMPLATE;
  const fs = deps.fs ?? {
    existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, chmodSync,
  };
  const result = (code, status, message, extra = {}) => ({
    code, status, hooksDir: null, changed: false, chained: false, message, ...extra,
  });

  const start = path.resolve(opts.project);
  const top = fs.existsSync(start) ? git(start, ["rev-parse", "--show-toplevel"]) : null;
  if (!top) return result(EXIT.NOT_A_REPO, "not_a_repo", `${start} is not inside a git work tree`);

  const hooksRaw = git(top, ["rev-parse", "--git-path", "hooks"]);
  if (!hooksRaw) return result(EXIT.NOT_A_REPO, "not_a_repo", `git could not resolve the hooks path of ${top}`);
  const hooksDir = path.resolve(top, hooksRaw);

  // A hooks directory inside the work tree but outside the git directories is tracked content (husky and
  // friends): writing there would create a tracked file on the default branch, which the engine never does.
  const realTop = realpathLoose(top);
  const gitDirs = ["--git-dir", "--git-common-dir"]
    .map((flag) => git(top, ["rev-parse", flag]))
    .filter(Boolean)
    .map((d) => realpathLoose(path.resolve(top, d)));
  const realHooks = realpathLoose(hooksDir);
  if (isInside(realHooks, realTop) && !gitDirs.some((g) => isInside(realHooks, g))) {
    return result(
      EXIT.TRACKED_HOOKS_PATH,
      "tracked_hooks_path",
      `core.hooksPath (${hooksDir}) points inside the work tree; refusing to write an untracked hook there`,
      { hooksDir },
    );
  }

  const source = fs.readFileSync(templatePath, "utf8");
  // Git shares hooks across linked worktrees: persist repository-relative project roots, never an
  // absolute checkout path. Keep every already registered project when installing another one.
  const scope = path.relative(realTop, realpathLoose(start)).split(path.sep).join("/") || ".";
  if (!isInside(realpathLoose(start), realTop) || /[\r\n]/.test(scope)) {
    return result(EXIT.USAGE, "invalid_project", "project must be inside the repository and contain no newline");
  }
  const hookPath = path.join(hooksDir, HOOK_NAME);
  let registered = [];
  if (fs.existsSync(hookPath)) {
    const previous = fs.readFileSync(hookPath, "utf8");
    const match = /^# pandacorp-projects (.+)$/m.exec(previous);
    if (markerVersion(previous) !== null && match) {
      registered = JSON.parse(match[1]);
      if (!Array.isArray(registered) || registered.some((s) => typeof s !== "string" ||
          !s || /[\r\n]/.test(s) || path.posix.isAbsolute(s) || s.split("/").includes(".."))) {
        throw new Error("invalid registered pre-push project scopes");
      }
    }
  }
  const scopes = [...new Set([...registered, scope])].sort();
  const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
  const template = source.replace("# PANDACORP_PROJECT_SCOPES", () =>
    `# pandacorp-projects ${JSON.stringify(scopes)}\nPROJECT_SCOPES=${quote(scopes.join("\n"))}`);
  if (markerVersion(template) === null) throw new Error(`template ${templatePath} has no pandacorp-pre-push marker`);

  const chainedPath = path.join(hooksDir, CHAINED_NAME);
  let state = "missing";
  let foreign = false;
  const exists = fs.existsSync(hookPath) || safeLstat(fs, hookPath);
  if (exists) {
    let body = null;
    try { body = fs.readFileSync(hookPath, "utf8"); } catch { body = null; }
    if (body !== null && markerVersion(body) !== null) state = body === template ? "current" : "stale";
    else foreign = true;
  }

  if (opts.check) {
    const ok = state === "current";
    return result(ok ? EXIT.OK : EXIT.NOT_READY, ok ? "current" : foreign ? "missing" : state,
      ok ? "pre-push hook installed and current" : foreign ? "a foreign pre-push hook is present; ours is not installed" : `pre-push hook ${state}`,
      { hooksDir });
  }
  if (state === "current") return result(EXIT.OK, "current", "pre-push hook already installed and current", { hooksDir });

  try {
    fs.mkdirSync(hooksDir, { recursive: true });
    let chained = false;
    if (foreign) {
      // Never lose a hook: an older chained copy (a tool re-wrote pre-push after our install) is kept aside.
      if (fs.existsSync(chainedPath) || safeLstat(fs, chainedPath)) {
        fs.renameSync(chainedPath, `${chainedPath}.prev-${Date.now()}`);
      }
      fs.renameSync(hookPath, chainedPath);
      chained = true;
    }
    const tmp = path.join(hooksDir, `.${HOOK_NAME}.pandacorp-tmp-${process.pid}`);
    fs.writeFileSync(tmp, template, { mode: 0o755 });
    fs.chmodSync(tmp, 0o755);
    fs.renameSync(tmp, hookPath);
    const status = state === "stale" ? "updated" : "installed";
    return result(EXIT.OK, status, `pre-push hook ${status}${chained ? " (existing hook chained)" : ""}`, {
      hooksDir, changed: true, chained,
    });
  } catch (e) {
    return result(EXIT.WRITE_FAILED, "write_failed", `could not write ${hooksDir}: ${e.message}`, { hooksDir });
  }
}

function safeLstat(fs, p) {
  try { return Boolean(fs.lstatSync(p)); } catch { return false; }
}

function parseArgs(argv) {
  const out = { project: ".", check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") out.check = true;
    else if (a === "--project") out.project = argv[++i];
    else if (a.startsWith("--project=")) out.project = a.slice("--project=".length);
    else return null;
    if (out.project === undefined) return null;
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args) {
    console.error("usage: install-pre-push.mjs --project <dir> [--check]");
    return EXIT.USAGE;
  }
  const r = installPrePush(args);
  console.log(JSON.stringify({ status: r.status, hooks_dir: r.hooksDir, changed: r.changed, chained: r.chained, message: r.message }));
  if (r.code !== EXIT.OK) console.error(`install-pre-push: ${r.message}`);
  return r.code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
