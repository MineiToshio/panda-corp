---
id: BL-0025
type: change
area: build-engine
title: "Parallel agents (implement-backlog whole-queue, parallel librarian harvests) need a single owner for shared monotonic values (plugin.json version, LESSON-id/INDEX.md)"
status: open
severity: p2
opened: 2026-07-03
closed:
source: "factory/memory/_inbox.md 2026-07-02/03 notes — 8 of 10 implement-backlog subagents each independently computed plugin.json v9.53.0, hand-renumbered up to v9.62.0; a 2026-07-03 note flags the same race shape for /pandacorp:memory harvest's LESSON-id allocation + INDEX.md delta-append if the factory-inbox harvest and a project harvest ever ran as parallel librarian agents"
closes:
links: [LESSON-0032]
---

## Problem

Two instances of the same race, both in factory tooling that parallelizes agents against a shared base:

1. **`implement-backlog` whole-queue mode.** Each backlog item is worked by a parallel
   worktree-isolated subagent. When more than one item touches `plugin/` and needs a semver bump, EACH
   subagent independently reads `plugin/.claude-plugin/plugin.json`'s `version` from its own worktree's
   (stale) base and computes "current + 1". On a 2026-07-02 whole-queue run, `main`'s HEAD was already
   at v9.53.0 when a 10-item run branched; 8 of the 10 subagents that touched `plugin/` each
   independently computed `v9.53.0` as "next", colliding on every single serialized merge — reconciled
   by hand all the way up to v9.62.0.
2. **`/pandacorp:memory harvest` run in parallel.** The harvester computes the next free `LESSON-NNNN`
   id and appends delta lines to `factory/memory/INDEX.md` by reading current state at invocation time.
   Running the factory-inbox harvest and a project's harvest as parallel librarian agents would race on
   the same id counter and the same `INDEX.md` file. Observed only as a near-miss on 2026-07-03 (avoided
   by sequencing factory-inbox-first, project-harvests-after, never by an actual allocator).

Impact: not a one-off — the whole-queue mode's entire selling point is running items in parallel, and
any run with 2+ `plugin/`-touching items, or any future auto-parallelized harvest sweep, will hit this
again, costing a manual reconciliation step (or worse, a silent id/version collision) every time.

## Root cause

`validate-backlog.sh` and `validate-memory.sh` already solve this exact class of problem for `BL-*`/
`LESSON-*` id ALLOCATION when a caller queries them serially — an authoritative "next free id" the
caller must query rather than infer. What's missing is the same discipline applied (a) when multiple
callers could query/compute "next" concurrently rather than serially, and (b) to the OTHER shared
monotonic values in the factory's tooling that aren't ids at all: `plugin.json`'s `version` field, and
`INDEX.md`'s append-point. Worktree isolation only prevents file-CONTENT conflicts; it does nothing to
prevent VALUE collisions on a monotonic field computed from a shared, possibly-stale base by more than
one concurrent writer.

## Fix plan

Two related but separately-testable fixes:

1. **`plugin.json` version — merge-time bump (preferred):** subagents do NOT bump
   `plugin/.claude-plugin/plugin.json`'s `version` themselves when their change touches `plugin/` —
   they record the semver LEVEL their change requires (patch/minor/major, per the existing DR-034
   rubric) in their item's own commit message or a sidecar marker. The `implement-backlog` skill's
   serialized-merge step (the single place that already lands one item at a time onto `main`) reads the
   just-merged `main` version AFTER each merge and applies the recorded bump level itself, immediately
   before/as part of that merge — so there is only ever one writer computing "current + 1", already
   serialized. (Alternative: a `"version": "PENDING"` placeholder resolved at merge time, if a
   subagent's own tests must reference a concrete version.)
2. **Memory harvest concurrency guard:** `/pandacorp:memory harvest` (or its wrapping skill/routine)
   must never run two harvest invocations concurrently against the same `factory/memory/` store. Add an
   explicit serialization guard (a lock file under `.pandacorp/run/`, checked and cleared by the
   harvester itself) OR document/enforce in `plugin/docs/routines.md` + the `implement-backlog`/
   `memory` skills that factory-inbox and project harvests must run sequentially, never fanned out in
   parallel — whichever is cheaper to implement reliably.

Touch: `plugin/skills/implement-backlog/SKILL.md` (serialized-merge step), `plugin/skills/memory/
SKILL.md` (concurrency guard), `plugin/templates/shared/.claude/workflows/pandacorp-build.js` if the
merge orchestration lives there, `plugin/docs/routines.md` (document the sequencing constraint for the
scheduled sweep), and `factory/standards/build-orchestration.md` if it documents per-item version-bump
responsibility.

## Tests (prove the fix — TDD, RED → GREEN)

Automation is impractical for a full multi-agent race (would require simulating live concurrent
subagents); prove it with a **documented manual repro + a script assertion** for each fix:

- **plugin.json:** RED — construct two backlog items that both touch `plugin/` and would each
  independently compute the same next PATCH version from the same base `plugin.json`; trace the OLD
  flow and show both would write the same `version` string (the collision observed 2026-07-02). GREEN —
  after the fix, trace the same two-item scenario through the new merge-time-bump step and confirm the
  second item's merge lands a version ONE HIGHER than the first's, with only the merge step computing
  the final number. Add a script assertion (in `plugin/scripts/` or an existing merge-queue script) that
  fails loudly if a merge would land a `plugin.json` version equal to or lower than `main`'s current
  version.
- **memory harvest:** RED — trace two concurrent harvest invocations against the same store and show
  both would compute the same next `LESSON-NNNN` id / append to `INDEX.md` at the same insertion point.
  GREEN — after the guard, the second invocation either waits/serializes or fails loudly with a clear
  "harvest already in progress" message rather than silently racing.

## Done when

- The serialized-merge step (not individual subagents) owns the final `plugin.json` version bump for
  any item touching `plugin/`, verified by the manual repro above.
- A script assertion exists that fails loudly on a would-be `plugin.json` version collision/regression
  at merge time.
- A concurrency guard (or an enforced sequencing rule, documented and checked) prevents two
  `/pandacorp:memory harvest` invocations from racing on the same store.
- `plugin/skills/implement-backlog/SKILL.md` and `plugin/skills/memory/SKILL.md` document the new
  responsibility/guard.
- `plugin/docs/decision-log.md` records the change.

## Out of scope

Does not change how a SINGLE-item `implement-backlog <BL-NNNN>` run bumps the version (already
serialized, no collision risk there) — only the whole-queue parallel mode and the memory-harvest
concurrency case. Does not build a general distributed-lock system for the factory repo — a file-based
guard/documented sequencing rule is sufficient at this scale.
