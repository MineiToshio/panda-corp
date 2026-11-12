// Constants of the `next` scheduler (CLI doc section 4, BUILD-7 constants): action names, retry delays, G2 snapshot
// layout, unit-kind groups, the agent types and Spanish verbs of a dispatch, and the sibling contract.

/** Every action `next` can return (CLI doc section 4). */
export const NEXT_ACTIONS = Object.freeze(["dispatch", "wait", "handoff", "land", "done", "paused-quota", "waiting-owner", "deadlock", "stop"]);
/** Terminal actions (A11); all but `done` arrive already applied. */
export const TERMINAL_ACTIONS = Object.freeze(["done", "paused-quota", "waiting-owner", "deadlock", "stop"]);
/** `--wait` upper bound in seconds (BUILD-7 constants). */
export const MAX_WAIT_S = 300;
/** Consecutive `env-infra` hand-backs that stop the run (D21). */
export const ENV_INFRA_STOP = 3;

export const RETRY_S = Object.freeze({ disk: 30, ram: 30, cpu_H: 30, workers_running: 30, jobs_running: 30, gate: 60, quota: 60 });
export const LAND_RETRY_EXITS = Object.freeze([12, 14, 20]);
export const LAND_RETRY_S = 60;
// G2 snapshot worktrees (B5): `<build>/g2/<frd>-<pinned sha>`, one per job, never the integration worktree itself.
export const G2_SNAPSHOT_DIR = "g2";

/** Consecutive passes a G2 snapshot may fail to be created before the FRD is handed back as an environment failure (NB2). */
export const G2_SNAPSHOT_FAIL_MAX = 3;
export const SHA_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
export const G2_SNAPSHOT_RE = /^(.+)-([0-9a-f]{40}(?:[0-9a-f]{24})?)$/;
/** Exit code of a G2 job whose snapshot could not be bootstrapped (`worktree-bootstrap.sh` failed): no verdict, env-infra. */
export const G2_BOOTSTRAP_EXIT = 75;
export const G2_DISK_EXIT = 76;
// The G2 job body: bootstrap the fresh snapshot (deps are not tracked), then the gate. argv: $0 label, $1 integration base sha.
export const G2_SCRIPT = `if [ -f .pandacorp/worktree-bootstrap.sh ]; then
  if bash .pandacorp/worktree-bootstrap.sh; then :; else
    bootstrap_exit=$?
    [ "$bootstrap_exit" -eq 4 ] && exit ${G2_DISK_EXIT}
    exit ${G2_BOOTSTRAP_EXIT}
  fi
fi
exec bash .pandacorp/verify.sh --since "$1"`;
export const WATCH_POLL_MS = 1000;
export const GIT_SHOW_TIMEOUT_MS = 15_000;
export const MAX_ATTEMPTS = 3;
export const LIVE_STATES = Object.freeze(["admitted", "running"]);
export const FRD_WORK_KINDS = Object.freeze(["build", "patch", "tests"]);
export const PLANNED_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
export const OWNER_PARKS = Object.freeze(["owner_question", "built_on_assumption"]);
// Worker outcomes (workers.pollWorker) that mean the environment, not the code, failed the unit.
export const ENV_WORKER_OUTCOMES = Object.freeze(["worker_error", "watchdog"]);
// Report/review/doubt outcomes the sibling modules signal by throwing: the unit was already settled (rejected,
// re-queued or handed back) by that module, so the harvest goes on.
export const SETTLED_OUTCOME_CODES = Object.freeze(["INVALID_INPUT", "EVIDENCE", "INVALID_PATH", "GATE_RED", "WAITING_GATE"]);

export const AGENT_TYPE = Object.freeze({
  docs: "pandacorp:implementer", build: "pandacorp:implementer", patch: "pandacorp:implementer",
  tests: "pandacorp:test-writer", review: "pandacorp:reviewer", "deferred-review": "pandacorp:reviewer",
  audit: "pandacorp:security-auditor", "doubt-consult": "general-purpose",
});
export const VERB_ES = Object.freeze({
  docs: "documenta", tests: "escribe pruebas de", build: "construye", patch: "corrige", review: "revisa",
  audit: "audita la seguridad de", "doubt-consult": "consulta la duda", "deferred-review": "revisa (diferida)",
});

/**
 * Sibling functions `next` calls, by their real exports (every one deps-last). `deps.<stem>` replaces the module
 * namespace; each mutating sibling runs its own fenced two-phase operation, so `next` calls it outside its own mutex.
 */
export const NEXT_SIBLING_CONTRACT = Object.freeze({
  "planner.readPlanWorkOrders": "(root, deps) -> {wos[], frds[], frd_acs, errors[]}",
  "planner.plan": "({wos, scope, units, label, size, questions, frd_acs, quota, shape, coordinator, session_model}, deps) -> {units[], now[], ready[], round[], deadlock: null|object}",
  "integrate.integrateCommitted": "({state, runId}, deps + {project}) -> {integrated: [{unit, sha, assumption?}], merged: [{doubt, sha}], conflicts: [{unit, doubt?}]} (git work only; next records the state)",
  "integrate.transitionWorkOrders": "({integration, runId, wos, to: 'IN_PROGRESS', reason, unitId}, deps) -> WO commit on lane/<run_id>",
  "units.prepareUnitWorktree": "({project, runId, unit, attempt, base?}, deps) -> {worktree, branch} (base = the assume branch for work built on an assumption)",
  "units.writeUnitBrief": "({project, state, unit, cell, agentType, token, schemaPath, worktree, reportPath, extra}, deps) -> {brief_path, report_path}",
  "jobs.startJob": "({project, epoch, actor, kind: 'g2', cmd, cwd, frd, unit: null}, deps) -> jobs[] item (fenced; records the job; cwd = the G2 snapshot <build>/g2/<frd>-<sha>)",
  "jobs.pollJob": "(project, job, deps) -> {state: 'running'|'done'|'dead', exit}",
  "workers.launchWorker": "({project, runId, unit, attempt, frd, cell, schemaFile, dir, briefFile}, deps) -> {ok, workerId, pid, job} | {ok:false, kind, detail}",
  "workers.pollWorker": "({project, workerId, unit, schemaFile, reportFile, epoch}, deps) -> {state: 'running'|'done'|'error', outcome, report?, limit?}",
  "report.ingestReport": "({project, epoch, unit, token, file, openDoubt: true}, deps) (fenced; G1, commit; opens a doubt outcome: doubt_opened | handback)",
  "review.reviewRecord": "({project, epoch, unit, token, file, openDoubt: true}, deps) (fenced; a doubt verdict leaves the unit reported)",
  "answers.answerNotes": "(state, unit, {questions}) -> string[] (the owner's recorded answers a unit's brief carries: gate OK, answered asks)",
  "doubts.pendingConsult": "(project, unit, deps) -> {runtime, model, effort, via, model_slug, brief_path, report_path, schema_path, answered}",
  "doubts.answerDoubt": "({project, epoch, id, file, token: null}, deps) (fenced; a via:'cli' consult answer)",
  "failure.handbackCommand": "({project, epoch, unit, reason, cause}, deps) (fenced; blocks dependents)",
  "failure.openUnitDoubt": "({project, epoch, unit, doubt?, diagnosis?, actor}, deps) -> {opened:true, doubt_id, step, ...} | {opened:false, handback} (fenced)",
  "failure.failUnit": "({project, epoch, unit, attempt, cause, detail, command, tail}, deps) (fenced; D21 policy for a worker with no valid report)",
  "land.harvestLand": "({project, epoch, actor}, deps) -> {harvested, exit?, output?} (fenced; finishes the land job)",
  "deferred.enqueueDeferred": "(project, entry, deps) -> {entry, created} (an audit that cannot run now, BUILD-14)",
  "risk.computeRisk": "({root, range}, deps) -> {zone, rules, audit, irreversible, ...}",
  "telemetry.emitEvent": "(project, {runtime, runId, name, data}, deps) (never throws; bulkhead)",
});
