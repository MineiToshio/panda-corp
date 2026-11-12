// Every on-disk location of the v2 build engine. Pure string arithmetic: no I/O, no clock.
// Layout is the one of build-engine-cli.md section 5 and PLAN 3.4 + 3.16 A16/A17.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_ID = /^[A-Za-z0-9._-]{1,160}$/;

/** Directory of the JSON schemas shipped with the engine (self-located). */
export const SCHEMAS_DIR = fileURLToPath(new URL("./schemas/", import.meta.url));

/**
 * Reject an id that is unsafe as a path segment or a git ref component.
 * @param {string} value candidate id (run id, unit id, doubt id, job id, worker id)
 * @param {string} label name used in the error message
 * @returns {string} the id, unchanged
 */
export function assertSafeId(value, label = "id") {
  if (typeof value !== "string" || !SAFE_ID.test(value) || value === "." || value === "..") {
    throw Object.assign(new Error(`invalid ${label}: ${JSON.stringify(value)}`), { code: "INVALID_PATH" });
  }
  return value;
}

/**
 * Validate a unit id: a safe id that cannot collide with the other `lane/<run_id>/...` branch names.
 * `integration` and ids starting with `assume-` are reserved (integration and assumption branches).
 * @param {string} value candidate unit id
 * @returns {string} the id, unchanged
 */
export function assertUnitId(value) {
  assertSafeId(value, "unit id");
  if (value === "integration" || value.startsWith("assume-")) {
    throw Object.assign(new Error(`reserved unit id: ${value}`), { code: "INVALID_PATH" });
  }
  return value;
}

/**
 * Host-level locations (independent of any project).
 * @param {{env?: Record<string,string|undefined>, homedir?: string}} [deps] test hooks
 */
export function hostPaths({ env = process.env, homedir = os.homedir() } = {}) {
  const hostDir = env.PANDACORP_HOST_DIR || path.join(homedir, ".pandacorp", "host");
  const codexHome = env.CODEX_HOME || path.join(homedir, ".codex");
  const hSlotsDir = path.join(hostDir, "h-slots");
  return {
    hostDir,
    hSlotsDir,
    /** Host heavy-tool slot directory `slot-<i>` (admission protocol, PLAN A1). */
    hSlotDir: (index) => path.join(hSlotsDir, `slot-${Number(index)}`),
    codexHome,
    /** Events ndjson of a company: env override, else `<home>/dashboard-events.ndjson`. */
    eventsFile: (runtime = "claude") => (runtime === "codex"
      ? env.PANDACORP_CODEX_EVENTS_FILE || path.join(codexHome, "dashboard-events.ndjson")
      : env.PANDACORP_EVENTS_FILE || path.join(homedir, ".claude", "dashboard-events.ndjson")),
    orchestrateDir: env.PANDACORP_ORCHESTRATE_DIR || path.join(homedir, ".claude", "state", "orchestrator-mode"),
  };
}

/**
 * All paths of one project's build engine.
 * @param {string} project absolute project root
 * @param {{env?: object, homedir?: string}} [deps] test hooks (see hostPaths)
 * @returns {object} frozen map of paths and path builders
 */
export function buildPaths(project, deps = {}) {
  if (typeof project !== "string" || !project) throw Object.assign(new Error("project root required"), { code: "USAGE" });
  const root = path.resolve(project);
  const pandacorp = path.join(root, ".pandacorp");
  const run = path.join(pandacorp, "run");
  const build = path.join(run, "build");
  const unitsDir = path.join(build, "units");
  const doubtsDir = path.join(build, "doubts");
  const jobsDir = path.join(build, "jobs");
  const handbackDir = path.join(build, "handback");
  const driveDir = path.join(build, "drive");
  const codexWorkersDir = path.join(run, "codex-workers");
  const attemptSuffix = (attempt) => (Number(attempt) >= 2 ? `-a${Number(attempt)}` : "");
  const unitSegment = (unitId, attempt) => `${assertUnitId(unitId)}${attemptSuffix(attempt)}`;
  return Object.freeze({
    ...hostPaths(deps),
    project: root,
    pandacorp,
    statusYaml: path.join(pandacorp, "status.yaml"),
    run,
    // Lease files: written by build-state.mjs only; listed here so readers agree on the location.
    leaseDir: path.join(run, "build.lease"),
    leaseFile: path.join(run, "build.lease", "lease.json"),
    leaseEpochFile: path.join(run, "lease-epoch"),
    leaseMutex: path.join(run, "lease-mutation.lock"),
    build,
    tokenFile: path.join(build, "lease-token.json"),
    stateFile: path.join(build, "state.json"),
    journalFile: path.join(build, "journal.jsonl"),
    preflightFile: path.join(build, "preflight.json"),
    scopeFile: path.join(run, "scope.json"),
    quotaFile: path.join(build, "quota.json"),
    admissionFile: path.join(build, "admission.json"),
    handoffFile: path.join(build, "handoff.json"),
    /** Consumed handoff: renamed by drive after it takes over (CLI doc section 5). */
    handoffConsumedFile: (epoch) => path.join(build, `handoff.consumed-${Number(epoch)}.json`),
    deferredReviewsFile: path.join(run, "deferred-reviews.json"),
    // Integration worktree (every tracked write of the engine lands here, D1).
    integrationWorktree: path.join(build, "integration"),
    /** Integration branch: `lane/<run_id>/integration` (a ref cannot be both a branch and a prefix directory). */
    integrationBranch: (runId) => `lane/${assertSafeId(runId, "run id")}/integration`,
    unitBranch: (runId, unitId, attempt = 1) => `lane/${assertSafeId(runId, "run id")}/${unitSegment(unitId, attempt)}`,
    assumeBranch: (runId, doubtId) => `lane/${assertSafeId(runId, "run id")}/assume-${assertSafeId(doubtId, "doubt id")}`,
    /** Worktree of an assumption branch (DEC-2): `<build>/wt/assume-<doubt>`, never colliding with a unit worktree (`assume-*` ids are reserved). */
    assumeWorktree: (doubtId) => path.join(build, "wt", `assume-${assertSafeId(doubtId, "doubt id")}`),
    // Unit worktrees and per-unit files (A16).
    unitWorktreesDir: path.join(build, "wt"),
    unitWorktree: (unitId, attempt = 1) => path.join(build, "wt", unitSegment(unitId, attempt)),
    unitsDir,
    unitDir: (unitId) => path.join(unitsDir, assertUnitId(unitId)),
    briefFile: (unitId) => path.join(unitsDir, assertUnitId(unitId), "brief.md"),
    reportFile: (unitId) => path.join(unitsDir, assertUnitId(unitId), "report.json"),
    reviewFile: (unitId) => path.join(unitsDir, assertUnitId(unitId), "review.json"),
    unitDoubtFile: (unitId) => path.join(unitsDir, assertUnitId(unitId), "doubt.json"),
    unitAnswerFile: (unitId) => path.join(unitsDir, assertUnitId(unitId), "answer.json"),
    doubtsDir,
    doubtFile: (doubtId) => path.join(doubtsDir, `${assertSafeId(doubtId, "doubt id")}.json`),
    doubtSourcesFile: (doubtId) => path.join(doubtsDir, `${assertSafeId(doubtId, "doubt id")}.sources.json`),
    // Detached jobs (g2, land) and Codex workers.
    jobsDir,
    jobDir: (jobId) => path.join(jobsDir, assertSafeId(jobId, "job id")),
    jobCmdFile: (jobId) => path.join(jobsDir, assertSafeId(jobId, "job id"), "cmd.json"),
    jobOutFile: (jobId) => path.join(jobsDir, assertSafeId(jobId, "job id"), "out.log"),
    jobExitFile: (jobId) => path.join(jobsDir, assertSafeId(jobId, "job id"), "exit"),
    codexWorkersDir,
    codexWorkerDir: (workerId) => path.join(codexWorkersDir, assertSafeId(workerId, "worker id")),
    // Hand-backs.
    handbackDir,
    handbackFile: (unitId) => path.join(handbackDir, `${assertUnitId(unitId)}.md`),
    engineHandbackFile: path.join(handbackDir, "engine.md"),
    // Drive.
    driveDir,
    driveStandbyFile: path.join(driveDir, "standby.json"),
    driveLogFile: path.join(driveDir, "drive.log"),
    driveCaffeinatePidFile: path.join(driveDir, "caffeinate.pid"),
    // Terminal and suspended runs (A4).
    buildArchiveRoot: path.join(run, "build-archive"),
    buildArchiveDir: (runId) => path.join(run, "build-archive", assertSafeId(runId, "run id")),
    buildSuspendedRoot: path.join(run, "build-suspended"),
    buildSuspendedDir: (runId) => path.join(run, "build-suspended", assertSafeId(runId, "run id")),
    // Schemas.
    schemasDir: SCHEMAS_DIR,
    schemaFile: (name) => path.join(SCHEMAS_DIR, `${assertSafeId(name, "schema name")}.schema.json`),
  });
}

/**
 * Resolve a repo-relative path against a root and refuse anything that escapes it.
 * @param {string} root absolute root
 * @param {string} rel relative path
 * @returns {string} absolute path inside root
 */
export function resolveInside(root, rel) {
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel)) {
    throw Object.assign(new Error(`path must be relative: ${JSON.stringify(rel)}`), { code: "INVALID_PATH" });
  }
  const abs = path.resolve(root, rel);
  const back = path.relative(root, abs);
  if (back === "" || back.startsWith("..") || path.isAbsolute(back)) {
    throw Object.assign(new Error(`path escapes ${root}: ${rel}`), { code: "INVALID_PATH" });
  }
  return abs;
}
