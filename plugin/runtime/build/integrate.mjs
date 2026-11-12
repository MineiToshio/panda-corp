// Integration of committed unit chains into the run's integration branch `lane/<run_id>/integration` (D22, CLI doc 4.1),
// plus every tracked write of the engine that lands on that branch (D1): work-order transitions, `track.jsonl`
// lines, tracked project files. The main checkout is never written. All git work goes through an injected
// `exec(cmd, args, {cwd}) -> {code, stdout, stderr}` (default: fsx.defaultExec) with real `git worktree` commands.
//
// Conventions: `deps` is the LAST, optional argument; the caller holds the fence (these functions take no lease)
// and calls them one at a time; nothing here writes `state.json` or the journal except through the optional
// `appendEvent` hook of `integrateCommitted`.
// This file is the public entry; the implementation is split by responsibility under `./integrate/` (common, git,
// bootstrap, worktrees, workOrders, transitions, chain, assumptions, committed).

export { INTEGRABLE_KINDS } from "./integrate/common.mjs";
export { bootstrapIntegrationWorktree } from "./integrate/bootstrap.mjs";
export {
  createIntegrationWorktree, createUnitWorktree, dropBootstrapManifests, healIntegrationWorktree, moveWorktreesUnder,
  removeIntegrationWorktree, removeUnitWorktree, removeWorktree,
} from "./integrate/worktrees.mjs";
export { findWorkOrder, workOrderRoute } from "./integrate/workOrders.mjs";
export { transitionWorkOrders, writeProjectFile } from "./integrate/transitions.mjs";
export { committedUnits, frdsReadyForG2, integrateUnit } from "./integrate/chain.mjs";
export { assumeIntegration, assumptionBranches } from "./integrate/assumptions.mjs";
export { integrateCommitted } from "./integrate/committed.mjs";
