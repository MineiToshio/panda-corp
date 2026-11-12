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
//
// This file is the public entry; the code lives under `./units/` (common, git, worktrees, workOrders, allowlist, render,
// brief, dispatch). Nothing below `./units/` imports this file.
export { agentRoleFile, PLUGIN_ROOT, renderBrief } from "./units/render.mjs";
export { allowlistPatterns, isAllowedPath, isTestSurface, matchesArtifact } from "./units/allowlist.mjs";
export { writeUnitBrief } from "./units/brief.mjs";
export { prepare, writeBrief } from "./units/dispatch.mjs";
export { defaultRun, git, productPrefix, productRoot, runnerOf } from "./units/git.mjs";
export { artifactsOf, extractAcLines, frontmatterBlock, isWorkOrderPath, readUnitWorkOrders } from "./units/workOrders.mjs";
export { createUnitWorktree, prepareUnitWorktree, restoreUnitWorktree, unitBase, unitRefs } from "./units/worktrees.mjs";
