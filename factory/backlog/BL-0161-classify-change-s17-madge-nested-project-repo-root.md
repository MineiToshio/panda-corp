---
id: BL-0161
type: bug
area: plugin-skill
title: "classify-change.mjs S17 (madge) looked up node_modules under the git toplevel, so a nested project (no .git of its own) could never certify micro"
status: done
severity: p1
opened: 2026-09-23
closed: 2026-09-23
source: "first real /pandacorp:change --now dry-run on Mission Control 2026-09-23 (change-now-dryrun-report.md S4.2, 'BUG real: classify-change.mjs S17 (madge) nunca certifica en Mission Control')"
closes: "plugin/scripts/classify-change.mjs reverseDependency() (S17 signal)"
links: []
---

## Problem
`plugin/scripts/classify-change.mjs`'s `reverseDependency()` (the S17 signal) resolved both the
`madge` binary path AND its working directory from `ctx.repoRoot`, which is
`git -C <repo> rev-parse --show-toplevel`. For a project that shares its PARENT's `.git` instead
of owning one -- Mission Control lives at `panda-corp/mission-control/` inside the factory's own
repo, documented in its own `CLAUDE.md` -- that command returns the FACTORY root
(`/Users/Shared/Proyectos/panda-corp`), not the project directory the caller pointed `--repo` at.
The factory root has no `node_modules/.bin/madge` of its own (Mission Control's own
`node_modules/.bin/madge` is one level down), so S17 unconditionally hit its
`existsSync(bin)` false branch and noted `"S17: skipped (madge unavailable)"` on EVERY change to
Mission Control, however small.

Impact, confirmed live during the first real `--now` dry-run (`change-now-dryrun-report.md` S4.2):
```
cd mission-control && git rev-parse --show-toplevel   # -> /Users/Shared/Proyectos/panda-corp
ls /Users/Shared/Proyectos/panda-corp/node_modules/.bin/madge            # No such file
ls /Users/Shared/Proyectos/panda-corp/mission-control/node_modules/.bin/madge   # exists
```
S17 (`floor_hits` at level `normal` when madge is unavailable, D3) therefore always fired on
Mission Control, which floors every verdict at `normal` at minimum. No change to this project
could ever certify `micro`, not even a genuinely trivial one -- the exact 22-line, 2-file change
that motivated the dry-run itself would have qualified for `micro` on line count alone (S1) but
was floored to `normal` by this bug. `now-mode.md`'s own `## Dry run` row 10 anticipates a
missing-madge floor as a "correct outcome, not a canary failure" in general, but this specific
case is not that: madge WAS installed, just unreachable from where the classifier looked.

## Root cause
`reverseDependency()` used `ctx.repoRoot` (the git top-level, needed for path-normalizing the
diff) for TWO different concerns that need different roots: (1) where the diff's paths are
anchored (correctly repoRoot -- `git diff` reports paths relative to the top-level regardless of
which subdirectory `-C` points at), and (2) where the PROJECT's own `node_modules`/`src` actually
live (should have been the `--repo` argument itself, i.e. the project's own directory). The
function conflated the two, so a project nested one level below its git top-level always failed
concern (2).

## Fix plan
1. `main()` now computes `ctx.projectRoot` (`realOrResolved(opts.repo)`, a new helper using
   `fs.realpathSync` with a `path.resolve` fallback -- avoids a TMPDIR-vs-realpath mismatch) and
   `ctx.projectPrefix` (`path.relative(realOrResolved(ctx.repoRoot), ctx.projectRoot)`, the
   project's path below the git top-level; empty string when `--repo` already IS the git root).
2. `reverseDependency()`'s madge bin lookup, `srcDir` detection and the `execFileSync` `cwd` all
   moved from `ctx.repoRoot` to `ctx.projectRoot`.
3. `toRepo()`, which re-anchors a madge graph node (relative to `srcDir`, relative to
   `projectRoot`) back onto a path comparable against `ctx.files` (repoRoot-relative, git diff's
   own frame), now joins `ctx.projectPrefix` in front: `path.posix.join(ctx.projectPrefix, srcDir, n)`.
   For every non-nested project (`--repo` already the git root) `projectPrefix` is empty and the
   behavior is byte-identical to before.

## Tests (prove the fix -- TDD, RED -> GREEN)
New Case 20b in `plugin/scripts/test-classify-change.sh`: an OUTER git repo with a nested
`project/` subdirectory that owns no `.git` of its own and its own
`project/node_modules/.bin/madge` + `project/src/**`, replaying Case 20's exact madge stub graph
(`app/api/x/route.ts` imports `lib/formatting.ts`) but one level down. Confirmed RED against the
pre-fix script (`rigor: normal`, `"S17: skipped (madge unavailable)"` in `notes`, no `S17` in
`floor_hits`) -- the nested project could not certify the floor hit at all. GREEN after the fix
(`rigor: critical`, `S17` in `floor_hits`, no "madge unavailable" note).
`bash plugin/scripts/test-classify-change.sh` -- 91 passed / 0 failed (was 88/0), the one
pre-existing `xfail` (REV2-C, BL-0140, untouched) unchanged.
`bash plugin/scripts/run-engine-tests.sh` -- 24/24 suites green.

## Done when
- [x] `test-classify-change.sh` Case 20b is green, confirmed RED against the pre-fix script.
- [x] `bash plugin/scripts/run-engine-tests.sh` green (24/24 suites).
- [x] Fixed in commit `0296ef05` on branch `fix-change-now-bugs`.
- [x] `claude plugin validate plugin/` passes.

## Out of scope
Re-running the `--now` dry-run canary end to end against Mission Control with this fix in place
(the `## Dry run` flip criterion in `now-mode.md` still needs its own attended run) -- a separate
live canary, not part of this item's closeable scope.
