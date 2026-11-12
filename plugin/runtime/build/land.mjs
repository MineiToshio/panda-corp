/**
 * Pandacorp build engine v2: `land`, integration branch to `main` (D1, D2, D24, PLAN 3.16 A1, A3, A15, BUILD-13).
 *
 * `land` is the ONLY path to `main`. It never writes a tracked file in the main checkout: every tracked write is a
 * commit on the integration branch inside the integration worktree, and `main` moves only through the project's own
 * `.pandacorp/merge-queue.sh`, run from that worktree as a detached `land` job (no host H slot in the wrapper: the
 * script takes its own around `verify.sh`, A1).
 *
 * Two phases across calls (D5, D6): the first call rebases the integration branch onto `main` outside the mutex, writes the
 * landing metadata commit in phase 2 and spawns the job (`result: "running"`); later calls (and `next`, through
 * `harvestLand`) poll the job and map the merge-queue exit code (D24).
 *
 * The engine NEVER sets `PANDACORP_OWNER_RELEASE_OK`. A launched project's production gate is merge-queue exit 21
 * (`waiting_gate`); only the owner's chat order lands it, by running `land` with that variable set on that one
 * command. The variable is passed through to the job exactly as the calling environment carries it, except for the
 * `drive` actor, which never carries an owner order.
 *
 * Every dependency is injected (`deps`, always the last argument): `fs`, `env`, `exec`, `jobs`, `clock`, `buildState`,
 * `isAlive`. Test hooks only; defaults are the real thing.
 *
 * This file is the public entry; the implementation is split by responsibility under `./land/` (common, batch,
 * harvest, command).
 */

export { assessBatch, cardCompletedBy, mapMergeQueueExit, setStatusScalars } from "./land/batch.mjs";
export { harvestLand, land } from "./land/command.mjs";
export { harvestLandJob } from "./land/harvest.mjs";
