---
id: BL-0183
type: bug
area: build-engine
title: "A same-pin chained C2 gate skips the worktree clean check and can run over another FRD's untracked tests, which vitest --changed executes (false reds, silent contamination)"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md, Red-team addendum (2026-09-25) §A3 finding X2 (evidence e5: vitest 4.1.9 getUnstagedFiles = git ls-files --other --modified)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js ensureGateWorktree fast path + gate step 2 (gateFocusedStep) — fixed in 86c95003"
links: [BL-0182, BL-0184, BL-0150]
---

## Problem
Every FRD that becomes gate-ready at the same wave barrier shares one pin (`capturePin([...frds])`). In
`ensureGateWorktree`, `worktreeState === 'ready' && lastWorktreeSha === sha` returned `true` with no
spawn, skipping the probe AND its `git status --porcelain` clean check. The second gate at that pin
therefore ran in a tree that still held the first reviewer's untracked test files. The focused gate
runs `verify.sh --since <sha>`, which is vitest `--changed <sha>`, and vitest 4.1.9 includes untracked
files in that selection (red-team e5, `getUnstagedFiles()` = `git ls-files --other --modified
--exclude-standard`). A sibling's RED-proven failing test could red this FRD's gate: a false reject and
a paid patch cycle, with nothing in the logs naming the foreign file. A worktree found dirty by the
probe was also reported only as a generic "dirty, orphaned, unregistered, or ambiguous", with no list.

## Root cause
The no-spawn fast path trusted "same sha" as "same state". The sha only says which commit is checked
out, not whether the working tree is clean. Which tests certify an FRD was left to `--changed`, whose
selection depends on the uncommitted state of the tree.

## Fix plan
1. New engine flag `gateWorktreeClean`, set true only by the probe's own clean check or by the previous
   gate's release postcondition (BL-0182), and set false when a gate starts writing. The same-sha fast
   path now also requires it; otherwise the probe runs again.
2. The probe lists dirt with `status --porcelain=v1 --untracked-files=all` and returns it as `dirty[]`.
   The engine logs `REFUSING to gate over a DIRTY gate worktree … <paths>` and falls back to the legacy
   path on main. It never gates over the dirty tree and never deletes the evidence (BL-0067).
3. Gate step 2 (`gateFocusedStep`, serial and split closer, explore and digested) now carries
   `REVIEWER_TESTS_EXPLICIT`: after verify.sh, the reviewer runs every adversarial test file it wrote BY
   PATH (`pnpm vitest run <path> …`), never trusting `--changed` to have collected them.
   `verify.sh` itself was not changed (it is overlay-managed and a vitest filter list would intersect
   with `--changed`, not add to it).

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0182..0184 ----`:
- `BL-0183a`: two FRDs at the SAME pin; the first gate's release cannot clean a path. Asserts that the
  second acquisition re-probes (2 probes, not the silent fast path), that the log names the stuck path,
  and that the second gate runs on main.
- `BL-0183b`: a foreign untracked file already in the worktree at the first probe. Asserts the probe
  uses `--untracked-files=all` and asks for `dirty`, the log names the foreign path, and the gate runs
  on main.
- `BL-0183c`: the gate prompt names the `--changed` hazard and runs the adversarial tests by path.

## Done when
- [x] All three RED against the pre-fix engine (1 probe and a silent in-worktree gate; no path in the
  log; no directive). GREEN after the fix.
- [x] `bash plugin/scripts/run-engine-tests.sh`: 25/25 suites.

## Out of scope
The directive in point 3 is prompt-level (the reviewer runs the command). The engine-side guarantee is
the clean-tree precondition, which makes `--changed` see only this FRD's files. An engine-run
(MECH) re-execution of the reviewer's PASS tests was considered and not added: the close-out full
suite runs them anyway.
