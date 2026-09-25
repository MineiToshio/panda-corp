---
id: BL-0175
type: bug
area: build-engine
title: "A blocked gate leaves its adversarial test files untracked in the gate worktree, silently degrading C2 to the legacy synchronous path for the rest of the run (and forever after)"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "canary D2 (wf_faf48b18-881), canary-d-frd02-forensics.md §5 finding H3"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js persistGateBlock (~:1715) — F2"
links: [BL-0067, BL-0149, BL-0150]
---

## Problem
A reviewer that reaches a BLOCK verdict has usually already written its adversarial test files into
the (review-only) frozen gate worktree before giving up. Those files only get PORTED to the main tree
on a PASS (`applyGate`'s `testFiles` mechanism) — a block never ports them, so they sit untracked in
`GATE_WORKTREE`. The next `ensureGateWorktree` reuse probe requires `git status --porcelain` to be
empty; it isn't, so it refuses to reuse the worktree and the run degrades to the legacy synchronous
gate path for every remaining FRD this run — and, because BL-0067 forbids ever deleting evidence in
that path, for every FUTURE run too, until someone manually inspects and clears it by hand. Canary D2
found this already true in TWO places: Mission Control's real gate worktree
(`decision-id.reviewer.test.ts` untracked) and canary C's own worktree
(`sealCoverage.reviewer.test.ts` untracked) — both permanently stuck on the legacy path.

## Root cause
`persistGateBlock` (the MAIN-tree writer that finalizes a block) never touches `GATE_WORKTREE` at all.
Nothing salvages or clears the reviewer's leftover files, so the worktree is left dirty by design on
every block, not just a crash.

## Fix plan
`persistGateBlock`'s prompt now includes a salvage step, run AFTER the main-tree commit: if
`GATE_WORKTREE` exists and is a registered worktree, run `git status --porcelain` inside it; for EACH
reported path, copy it to `.pandacorp/run/gate-evidence/<frd>/<same relative path>` (gitignored,
durable), then clean EXACTLY that path (`git clean -f --` for untracked, `git checkout --` for a
modified tracked file) — never a blanket `clean -fd`/`reset --hard`/`checkout .`, so any OTHER crash
evidence BL-0067 protects in that worktree survives untouched. If the worktree is already clean or
doesn't exist, skip entirely.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0174..0177 ----`, scenario `BL-0175a`:
a needs-owner block (DR-072 reopen-cap path) asserts the `persist-block:<frd>` prompt (1) salvages
into `.pandacorp/run/gate-evidence/`, (2) inspects via `git status --porcelain`, (3) cleans the exact
reported paths (`clean -f --`), and (4) explicitly forbids a blanket clean/reset.

## Done when
- [x] `BL-0175a` is green; confirmed RED against the pre-fix engine (no salvage/clean instruction
  existed in the prompt at all).
- [x] `bash plugin/scripts/run-engine-tests.sh` green (173/173).
- [x] Shipped in the same release batch as BL-0174/0176/0177 (plugin 9.109.0).

## Out of scope
Actually cleaning up the ALREADY-dirty gate worktrees in `panda-corp/mission-control` and
`panda-corp-canary-c` that canary D2 found — that is a one-time manual cleanup for the owner to run
(or a follow-up item), not part of this engine fix, and it is NOT done by this item. A live re-run
proving C2 stays on the concurrent path after a block (rather than just asserting the prompt content)
is a natural follow-up, same shape as BL-0155's own deferred re-measurement — not verified here.
