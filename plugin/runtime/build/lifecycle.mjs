// Effects of `start --run`, `start --resume`, `stop`, `finish` and the read-only views `status` and `plan` (build-engine-cli
// 3.3, 3.4, 3.19, 3.20, 3.21, 3.6; PLAN 3.16 A4, A9, A23). The dispatcher (pandacorp-build.mjs) maps error codes to exits.
// Never writes a tracked file in the main checkout: tracked writes happen in the integration worktree, by other modules.
//
// This file is the public entry: it only re-exports. The code lives by responsibility in ./lifecycle/:
// common (constants, helpers), buildDir (moves of build/), plan (planning views), start (`start --run`),
// resume (`start --resume`), terminate (`stop`, `finish`), handoff and status (`status`, `rebuild-state`).
export { planCommand } from "./lifecycle/plan.mjs";
export { startRun } from "./lifecycle/start.mjs";
export { startResume } from "./lifecycle/resume.mjs";
export { finishRun, stopRun } from "./lifecycle/terminate.mjs";
export { requestHandoff } from "./lifecycle/handoff.mjs";
export { rebuildStateCommand, statusSnapshot } from "./lifecycle/status.mjs";
