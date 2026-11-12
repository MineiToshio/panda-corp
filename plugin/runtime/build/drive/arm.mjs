// Arming of the standby relay: keep-awake, the standby argv and `armDrive` (split from drive.mjs).
import nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FORBIDDEN_WORD, err } from "./constants.mjs";
import { assertNoForbiddenWord, driveLog, isoAt, nowMs, pathsOf, withDefaults } from "./context.mjs";
import { readStandby, writeStandby } from "./standby.mjs";

// The owner's production-release token must never reach a spawned child (D1 guard).
const withoutReleaseOk = (env) => { const e = { ...env }; delete e.PANDACORP_OWNER_RELEASE_OK; return e; };

/** The CLI entry the standby process is spawned through (`node pandacorp-build.mjs drive --standby --run R`). */
export const CLI_ENTRY = fileURLToPath(new URL("../../../scripts/pandacorp-build.mjs", import.meta.url));
const INSTALL_PRE_PUSH = new URL("../../../scripts/install-pre-push.mjs", import.meta.url);

/**
 * Keep the Mac awake while `pid` lives (`caffeinate -i -w <pid>`); writes `build/drive/caffeinate.pid`.
 * Off macOS (or when `deps.keepAwake` is injected) it does nothing of its own.
 * @param {string} project
 * @param {number} pid
 * @param {object} [deps] `keepAwake(pid) -> {pid}|null` replaces the real call
 * @returns {Promise<{pid: number|null}>}
 */
export async function keepAwake(project, pid, deps) {
  const d = withDefaults(deps);
  let child = null;
  if (typeof d.keepAwake === "function") {
    child = await d.keepAwake(pid);
  } else if (d.platform === "darwin") {
    const args = ["-i", "-w", String(pid)];
    assertNoForbiddenWord(args, "caffeinate argv");
    const proc = d.spawn("caffeinate", args, { detached: true, stdio: "ignore" });
    proc.unref?.();
    child = { pid: proc.pid ?? null };
  }
  const caffeinatePid = child?.pid ?? null;
  if (caffeinatePid) {
    const file = pathsOf(project, d).driveCaffeinatePidFile;
    nodeFs.mkdirSync(path.dirname(file), { recursive: true });
    nodeFs.writeFileSync(file, `${caffeinatePid}\n`, { mode: 0o600 });
  }
  return { pid: caffeinatePid };
}

// -------------------------------------------------------------------------------------------------- arming

/** The argument list of the standby process (after the entry script). */
export function standbyArgs(runId, { transcript } = {}) {
  const args = ["drive", "--standby", "--run", String(runId)];
  if (transcript) args.push("--transcript", String(transcript));
  return args;
}

/**
 * Arm the relay in standby (called by `start --run` and `start --resume`, inside their own flow).
 * Codex quota is not checked. Not arming is never an error: `{armed:false, reason}`.
 * Reasons: `codex_login_failed` (`codex login status` failed), `prepush_not_verified` (launched project whose
 * pre-push hook `--check` is not exit 0), `spawn_failed`.
 * An alive standby of the same run is reused; a stale standby.json (dead pid) is replaced.
 * @param {{project: string, runId: string, launched?: boolean, transcript?: string|null, appendEvent?: Function}} input
 *   `appendEvent` (optional): the caller's fenced journal append; called with `{type:"drive_armed", data}`
 * @param {object} [deps] `exec` (codex login), `prePushCheck(project) -> {code}`, `spawn`, `isAlive`, `execPath`, `env`
 * @returns {Promise<{armed: boolean, pid: number|null, reason: string|null}>}
 */
export async function armDrive({ project, runId, launched, transcript = null, appendEvent } = {}, deps) {
  const d = withDefaults(deps);
  if (!project || !runId) throw err("USAGE", "armDrive needs project and runId");
  const paths = pathsOf(project, d);

  const existing = await readStandby(project, d);
  if (existing && existing.run_id === runId && existing.state === "standby" && d.isAlive(existing.pid)) {
    return { armed: true, pid: existing.pid, reason: null };
  }

  const codexBin = d.env.PANDACORP_CODEX_BIN || "codex";
  const loginArgs = ["login", "status"];
  assertNoForbiddenWord(loginArgs, "codex login argv");
  let login;
  try { login = await d.exec(codexBin, loginArgs, { cwd: project }); } catch (error) { login = { code: 1, stderr: error.message }; }
  if (login?.code !== 0) return { armed: false, pid: null, reason: "codex_login_failed" };

  if (launched ?? await isLaunchedProject(project, d)) {
    let check;
    try {
      check = typeof d.prePushCheck === "function"
        ? await d.prePushCheck(project)
        : (await import(INSTALL_PRE_PUSH.href)).installPrePush({ project, check: true });
    } catch (error) { check = { code: 1, message: error.message }; }
    if (check?.code !== 0) return { armed: false, pid: null, reason: "prepush_not_verified" };
  }

  let usableTranscript = transcript;
  if (transcript && FORBIDDEN_WORD.test(String(transcript))) {
    usableTranscript = null; // trigger (b) then reads unit and worker output only
    driveLog(project, "arm: transcript path dropped (it carries a word the Codex hook adapter denies)", d);
  }
  const args = standbyArgs(runId, { transcript: usableTranscript });
  assertNoForbiddenWord(args, "drive argv");

  let child;
  try {
    nodeFs.mkdirSync(paths.driveDir, { recursive: true });
    const fd = nodeFs.openSync(paths.driveLogFile, "a", 0o600);
    try {
      // cwd = project: the CLI resolves the project from it, so no project path travels in argv.
      child = d.spawn(d.execPath, [CLI_ENTRY, ...args], { cwd: project, detached: true, stdio: ["ignore", fd, fd], env: withoutReleaseOk(d.env) });
    } finally {
      nodeFs.closeSync(fd);
    }
    child.unref?.();
  } catch (error) {
    driveLog(project, `arm: spawn failed: ${error.message}`, d);
    return { armed: false, pid: null, reason: "spawn_failed" };
  }
  const pid = Number.isInteger(child?.pid) ? child.pid : null;
  if (!pid) return { armed: false, pid: null, reason: "spawn_failed" };

  await writeStandby(project, { pid, armed_at: isoAt(nowMs(d)), run_id: runId, state: "standby" }, d);
  driveLog(project, `armed: standby pid ${pid} for ${runId}`, d);
  if (typeof appendEvent === "function") await appendEvent({ type: "drive_armed", data: { pid, run_id: runId } });
  return { armed: true, pid, reason: null };
}

// Launched = detect.mjs `signals.launched` (the one implementation of the rule). Anything detect cannot read counts as
// launched: the pre-push hook is then required (fail closed).
async function isLaunchedProject(project, d) {
  try {
    const { detect } = await import("../detect.mjs");
    return (await detect({ project }, { env: d.env, homedir: d.homedir })).signals?.launched === true;
  } catch { return true; }
}
