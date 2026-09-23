---
id: BL-0165
type: bug
area: plugin-skill
title: "classify-change.mjs S8 floored ANY rmSync/rmdirSync as irreversible/destructive, including a test's own mkdtempSync cleanup — a pattern already used, unflagged, in 66 existing test files"
status: done
severity: p1
opened: 2026-09-23
closed: 2026-09-23
source: "canary 2 of /pandacorp:change --now on Mission Control, render UiPassSkipped (change-now-canary-2-report.md §4.2, 'S8 (FLOOR) falso positivo en rmSync de limpieza de tmpdir')"
closes: "plugin/scripts/classify-change.mjs S8_CONTENT / S8_CONTENT_JOINED matching (classify() S8 block)"
links: [BL-0161, BL-0162, BL-0164]
---

## Problem
`/\b(rmSync|rmdirSync)\b/` in `S8_CONTENT` fired `critical` (FLOOR, no exception) on ANY added
`rmSync`/`rmdirSync` call, with no distinction between "deletes a real, non-temporary path" and
"cleans up a directory the SAME test created via `mkdtempSync`/`os.tmpdir()` in its own
`afterEach`". Confirmed live in canary 2: the reviewer's adversarial test file
(`event-vm.uipassskipped.review.test.ts`) wrote `fs.rmSync(tmpDir, { recursive: true, force: true })`
in an `afterEach`, where `tmpDir` was assigned three lines earlier from
`fs.mkdtempSync(path.join(os.tmpdir(), "..."))` — textbook test hygiene. This is not a one-off
pattern: `grep -rl rmSync src/ --include="*.test.ts" | wc -l` → 66 existing test files in this repo
already do the same thing, none of them previously flagged.

## Root cause
S8's content scan has no file-context awareness — every pattern is evaluated identically whether the
surrounding file is production code or a test's own scratch-directory cleanup. The classifier's own
design principle ("the ONLY failure that matters is a false negative on the floor... over-escalation
is an accepted cost") justifies staying floor-first, but a mechanical, unconditional match on a
keyword shared by both a real destructive operation and routine test teardown is not a judgment call
in favor of safety — it is a blind spot that made `rmSync` in `_tests/` a de-facto ban.

## Fix plan
Added a narrow, fail-closed carve-out in `plugin/scripts/classify-change.mjs`, scoped to
`rmSync`/`rmdirSync` ONLY (every other S8 pattern — SQL `DELETE`/`DROP`, `truncate`, `deleteMany`,
`unlink`, a forced push/reset, `git clean`, a deploy command, shell `rm -rf` — is untouched, in or
out of a test file):
1. `isTestSurface(path)` — the file must be a test surface (`*.test.ts`/`*.spec.ts`, `_tests?/`,
   `src/test/`).
2. `rmCallsAreTempCleanup(joined)` — EVERY `rmSync`/`rmdirSync` call in that file's added content
   must visibly trace its argument to a temp source: inline (`rmSync(tmpdir())`) or via a variable
   assigned (as a `const`/`let`/`var` declaration OR a later plain reassignment — the common
   `let tmpDir: string;` + `beforeEach(() => { tmpDir = mkdtempSync(...); })` shape) from
   `mkdtempSync`/`mkdtemp`/`tmpdir` in that same added content.
3. A call whose argument is a literal path, an untraced identifier, or anything else this cannot
   positively resolve leaves the WHOLE file un-exempted — fail-closed, matching the file's own
   stated principle: "cannot determine it is temporary" stays `critical`, never the reverse.
4. `findS8()` (new, replacing the plain `findContent`/`findContentJoined` calls for S8) walks the
   same buckets those helpers did but SKIPS an `rmSync`/`rmdirSync` match when `isTestSurface` +
   `rmCallsAreTempCleanup` both hold, continuing the search — so a real S8 pattern elsewhere in the
   same or a different file still fires.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-classify-change.sh`, marked `# ---- BL-0164/BL-0165 ----`:
- **BL-0165-neg**: `rmSync(tmpDir, ...)` on a `mkdtempSync`-derived var, inside a `_tests/*.test.ts`
  file → `normal`, no `S8` floor hit.
- **BL-0165-pos** (control): the identical `rmSync(projectDir, ...)` call OUTSIDE a test surface
  (`src/lib/cleanup.ts`) → still `critical`, `S8` in `floor_hits`.
- **BL-0165-pos2** (control): an `rmSync` call INSIDE a test file whose argument is an untraced
  literal path → still `critical` (fail-closed — being in a test file alone is not enough).
Confirmed RED against the pre-fix script (BL-0165-neg classified `critical` via `S8`); GREEN after
the fix. Also caught and fixed during this same TDD cycle: the FIRST version of the fix only matched
`const|let|var NAME = ...mkdtempSync...` (declaration + initializer in one statement) and missed the
canary's own `let tmpDir: string;` + later `tmpDir = mkdtempSync(...)` reassignment shape — the real
canary worktree's reviewer test file still classified `critical` via `S8` after the first pass.
Broadened `TMP_VAR_DECL` to also match a plain reassignment of a previously-declared variable; the
real classifier run against the canary worktree then dropped `S8` from `floor_hits` entirely.
`bash plugin/scripts/test-classify-change.sh` — 127 passed / 0 failed / 0 xfail.
`bash plugin/scripts/run-engine-tests.sh` — all suites green.

## Done when
- [x] `test-classify-change.sh` BL-0165 cases are green, confirmed RED against the pre-fix script.
- [x] The real classifier gives no `S8` floor hit on canary 2's preserved worktree diff (which uses
      exactly this `mkdtempSync`/`rmSync` pattern in its reviewer-authored test).
- [x] `bash plugin/scripts/run-engine-tests.sh` green.
- [x] `claude plugin validate plugin/` passes.
- [x] Fixed in commit `a36b50ce` on `main`.

## Out of scope
Extending the same temp-path tracing to shell `rm -rf` (bash variable tracking is a different
regex universe than JS/TS declarations, and no live false positive on the shell pattern was found —
only `rmSync`/`rmdirSync` were observed in the canary evidence). Left as shell `rm -rf` floors
unconditionally, in or out of a test file, same as before this fix.
