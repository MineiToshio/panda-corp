// Bootstrap of the integration worktree (DR-096): the land job's merge-queue runs verify.sh in that checkout.
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, defaultExec, nowIso, readJson } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { gitIn, out } from "./git.mjs";

/** The project's worktree bootstrap (DR-096), relative to the product root of a worktree. */
const BOOTSTRAP_SCRIPT = ".pandacorp/worktree-bootstrap.sh";
/** Same bound as a unit worktree's bootstrap (units.mjs). */
const BOOTSTRAP_TIMEOUT_MS = 10 * 60 * 1000;
/** Untracked marker of the integration worktree's last bootstrap, under `<build>/` (moves with the run on archive/suspend). */
const BOOTSTRAP_MARKER = "integration-bootstrap.json";
/** The engine never hands the production-release variable to a child process (D1). */
const RELEASE_VAR = "PANDACORP_OWNER_RELEASE_OK";

/** Run the bootstrap script: injected `deps.exec(cmd, args, {cwd, env, timeout})`, else a child with the release variable removed. */
function runBootstrap(deps, root) {
  const env = { ...(deps.env ?? process.env) };
  delete env[RELEASE_VAR];
  if (deps.exec) return deps.exec("bash", [BOOTSTRAP_SCRIPT], { cwd: root, env, timeout: BOOTSTRAP_TIMEOUT_MS });
  return new Promise((resolve) => {
    execFile("bash", [BOOTSTRAP_SCRIPT], { cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: BOOTSTRAP_TIMEOUT_MS, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      const timedOut = Boolean(error && (error.killed || error.signal === "SIGKILL"));
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 127) : 0, stdout: stdout ?? "", stderr: `${stderr ?? ""}${timedOut ? "\nworktree-bootstrap.sh timed out" : ""}` });
    });
  });
}

/** The product root of the integration worktree (nested projects live under their repository prefix). */
async function integrationProductRoot(project, deps) {
  const p = buildPaths(project, deps);
  const prefix = out(await gitIn(deps.exec ?? defaultExec, path.resolve(project))(["rev-parse", "--show-prefix"])).replace(/\\/g, "/").replace(/\/+$/, "");
  return prefix ? path.join(p.integrationWorktree, prefix) : p.integrationWorktree;
}

/**
 * Bootstrap the integration worktree with the project's `.pandacorp/worktree-bootstrap.sh` (DR-096: a fresh checkout has
 * no dependencies), so the land job's G3 (`merge-queue.sh` -> `verify.sh`, run in that checkout) never goes red for an
 * environment reason. Same contract as a G2 snapshot (B5, exit 75): a failed bootstrap is an environment failure, never
 * a code verdict; this function only reports it (`ok:false`) and the caller hands the work back as `env-infra`.
 * Idempotent: a successful bootstrap of this run's checkout is recorded in the untracked marker `<build>/integration-bootstrap.json`
 * and not repeated unless `force` (a fresh `worktree add`). A project without the script needs none (`ok:true, ran:false`).
 * Never throws for the script's own exit; runs outside any mutex (it can take minutes).
 * @param {{project: string, runId: string, root?: string, force?: boolean}} input `root` = product root inside the integration worktree
 * @param {{exec?: Function, fs?: object, env?: object, bootstrap?: boolean}} [deps] `bootstrap:false` skips the script (tests)
 * @returns {Promise<{ok: boolean, ran: boolean, cached: boolean, exit: number|null, tail: string}>}
 */
export async function bootstrapIntegrationWorktree({ project, runId, root = null, force = false }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const marker = path.join(buildPaths(project, deps).build, BOOTSTRAP_MARKER);
  const productRoot = path.resolve(root ?? await integrationProductRoot(project, deps));
  const none = { ok: true, ran: false, cached: false, exit: null, tail: "" };
  if (deps.bootstrap === false) return none;
  if (!force) {
    const seen = await readJson(marker, { fs }).catch(() => null);
    if (seen?.ok === true && seen.run_id === runId && seen.root === productRoot) return { ...none, cached: true, exit: seen.exit ?? 0 };
  }
  if (!(await fs.stat(path.join(productRoot, BOOTSTRAP_SCRIPT)).then((st) => st.isFile(), () => false))) return none;
  const res = await runBootstrap(deps, productRoot);
  const code = Number.isInteger(res?.code) ? res.code : 127;
  const result = { ok: code === 0, ran: true, cached: false, exit: code, tail: `${res?.stdout ?? ""}\n${res?.stderr ?? ""}`.trim().split("\n").slice(-10).join("\n") };
  await atomicWriteJson(marker, { run_id: runId, root: productRoot, ok: result.ok, exit: code, at: nowIso(deps), tail: result.tail }, { fs });
  return result;
}
