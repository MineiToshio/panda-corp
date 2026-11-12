// units/git.mjs: process runner and git helpers of the units modules.
import { execFile } from "node:child_process";
import path from "node:path";
import { err, RELEASE_VAR } from "./common.mjs";

const GIT_TIMEOUT_MS = 2 * 60 * 1000;

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
