---
id: BL-0202
type: bug
area: build-engine
title: "for a nested project the baseline pre-check and judge-baseline read the WHOLE repository's git status, so factory WIP outside the project escalates the baseline and falls under its restore step"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-26
source: "found reading the pre-check while fixing BL-0195 (code reading, NOT exercised live)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js PROJECT_STATUS_COMMAND/SCOPE_GUARD/scopedRestoreCommand/scopedCleanCommand + precheck STEP 3, judge-baseline STEP 1, outsideDirtyPaths partition, foundation-repair nested guard; plugin/scripts/pandacorp-build-state.mjs close-preloop scoped reads — a7d5a2d0; plugin/scripts/block-dangerous.sh nested-host whole-tree rule + git global-option normalization — b0c40746; docs 5cac9eaa"
links: [BL-0195, BL-0124, DR-099]
---

## Problem
`git -C <project> status --porcelain` lists every dirty path of the repository, not only the project's. For Mission
Control (nested in the factory repo) a parallel session's WIP under `plugin/` or `factory/` makes the pre-check escalate
to the opus judge-baseline, whose STEP 1 restores "the other tracked MODIFIED files" to `last_green_sha` with
`git checkout <last_green_sha> -- <files>`. Read literally, that would overwrite another session's factory WIP.

## Fix plan
Scope both steps to the project: `git -C <project> status --porcelain -- .` in the pre-check and in the baseline's
reconciliation (and never restore a path outside the project prefix). Add a nested-fixture test with dirt outside the
project that must neither escalate nor be touched.

## Fix (as implemented)
- Pre-check STEP 3 and judge-baseline STEP 1 list the tree with ONE literal command: `PREFIX=<show-prefix>`, `IN <path>`
  for this project (`git -C <project> status --porcelain -- .`), `OUT <path>` for anything else. OUT paths are reported as
  `outsideDirtyPaths`: informational, they never escalate and are never touched. The engine also re-partitions any
  `dirtyPaths` entry outside the prefix (an agent that still listed the whole repo) and logs them.
- Every restore/clean goes through a literal guard: all paths must be repo-root-relative under the prefix, never the
  controller-owned status.yaml, never empty (an empty `git checkout <sha> --` would move HEAD) — otherwise exit 3 and
  nothing runs. Stashes are left untouched (the stash list is repository-wide). The judge's commit stages explicit paths.
- Foundation auto-repair: a nested project (non-empty prefix) never `git reset --hard`s; it takes the guarded path.
- BL-0066 pointer check uses `git diff --name-only --relative`, so a nested pointer commit can match.
- `pandacorp-build-state.mjs close-preloop` read the whole repo too (it refused every nested close: its own status.yaml
  read `mission-control/.pandacorp/status.yaml`); it now reads `status -- .` / `diff --cached --relative`, prefix stripped.
- Defense in depth: `block-dangerous.sh` blocks, in a repo hosting a nested Pandacorp project, `git reset --hard` and a
  whole-tree `checkout`/`restore`/`clean` at the repo root or with a `:/`/`:(top)` pathspec; every git check now sees
  through global options (`git -C <dir> …`, `--literal-pathspecs`), which slipped past all of them before.
- A flat project has an empty prefix: every command acts as before (tested).

## Tests (RED → GREEN)
`test-pandacorp-build.mjs` `// ---- BL-0202 ----` a..g (8 RED on 7284ada5, executed on real nested + flat repos, incl.
zsh); `test-build-state.mjs` nested close-preloop (RED on 7284ada5); `test-block-dangerous.sh` BL-0202 sections (19 RED).

## Done when
- [x] The scenario above is RED → GREEN in `test-pandacorp-build.mjs`.
- [ ] **Not verified live** on a real nested run (Mission Control main checkout).

## Out of scope (noted)
- The BL-0147 close-out reuse check still reads the whole repo's dirtiness (read-only; outside dirt only prevents a reuse,
  the safe direction).
- The reopen/revert ladders (DR-070 revert, patch-block) restore WO artifact paths from the project cwd — scoped by
  construction (project-relative pathspecs), not routed through the guard.
