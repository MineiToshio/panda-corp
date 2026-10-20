---
id: BL-0258
type: bug
area: build-engine
title: "preflight's session-cwd check PASSes for a lane-worktree subpath; engine does not verify a landed WO receipt's sha is an ancestor of main"
status: open
severity: p1
opened: 2026-10-19
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred): pass run_20261018T142754Z_67530 was launched while the session cwd sat in .pandacorp/run/lanes/lane-1; the WO-01-007 fast-build committed in lane-1 (42070c4, parent = lane HEAD eb6391c) instead of main, its commit-wo receipt still said \"committed\", and the engine counted WO-01-007 landed and dispatched its dependents on a main that lacks it"
closes:
links: [BL-0220, LESSON-0442]
---

## Problem

`preflight-implement.sh` section 1b (shipped by BL-0220) WARNs when the session's real cwd is outside
the project, comparing real paths — but it treats ANY path inside the project tree as "inside the
project," including a path nested inside `.pandacorp/run/lanes/lane-N`. On funko-tracker (run
`run_20261018T142754Z_67530`), the session's cwd was `.pandacorp/run/lanes/lane-1` when `/pandacorp:
implement` was launched; Workflow subagents inherited that cwd (the same BL-0220 mechanism), so the
WO-01-007 fast-build subagent committed its work INSIDE lane-1 (commit `42070c4`, parent = the lane's
own HEAD `eb6391c`) instead of onto `main`. Its commit-wo receipt still reported "committed" (it is not
itself aware of which branch it landed on), so the engine counted WO-01-007 as landed and dispatched its
dependent WOs against a `main` that does not actually contain WO-01-007's changes.

## Root cause

Two compounding gaps: (1) the BL-0220 preflight check's definition of "inside the project" is "real cwd
is the project root or any subdirectory of it," which is true for a lane path too — it needs to require
cwd === the project's own root (or explicitly reject any `.pandacorp/run/lanes/` prefix) to catch this
case; (2) nothing downstream cross-checks that a WO a receipt claims "committed" actually landed
somewhere reachable from `main` — a receipt is trusted at face value, so a commit made on a detached
lane branch is indistinguishable from one made on `main`.

## Fix plan

1. `preflight-implement.sh` section 1b: tighten the "session cwd inside project" check to require the
   real cwd equal the project's own root exactly (or at minimum, explicitly reject any path containing a
   `.pandacorp/run/lanes/` or `.pandacorp/run/` segment) — surfacing a distinct, named WARN/FAIL
   ("session cwd is inside a lane worktree, not the project root — re-launch from the project root")
   rather than silently passing.
2. The engine's WO-landed accounting (wherever a commit-wo receipt is read to mark a WO `VERIFIED`/
   landed) must verify the receipt's reported sha is actually an ancestor of `main` (`git merge-base
   --is-ancestor <sha> main`) before trusting "committed" — if it is not, treat the WO as NOT landed and
   surface a distinct stop reason instead of dispatching dependents.

## Tests (prove the fix — TDD, RED → GREEN)

- A fixture session whose cwd is set to a path under `.pandacorp/run/lanes/lane-1`: preflight reports the
  new distinct WARN/FAIL. RED today (passes as "inside the project").
- A fixture commit-wo receipt reporting "committed" with a sha that is NOT an ancestor of `main` (e.g. it
  lives only on a detached lane branch): the engine's landed-check rejects it instead of counting the WO
  as landed. RED today (receipts are trusted at face value).

## Done when

- Both tests above are green; `bash plugin/scripts/run-engine-tests.sh` stays green.
- Plugin + `OVERLAY_VERSION` bumped; `plugin/docs/decision-log.md` entry; BL-0220 back-linked as the
  prior, now-insufficient fix for the same class.

## Out of scope

Preventing a session from ever manually `cd`-ing into a lane worktree for inspection — that is a
process rule (see LESSON-0428), not an engine enforcement; this item only hardens what happens when a
build is LAUNCHED from inside one.
