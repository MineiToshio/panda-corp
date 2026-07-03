---
id: BL-0025
type: change
area: build-engine
title: "implement-backlog whole-queue mode needs a single version-bump owner for plugin.json, not per-subagent computation"
status: open
severity: p2
opened: 2026-07-03
closed:
source: "factory/memory/_inbox.md 2026-07-02 note — BL-0010 and BL-0006 subagents both computed plugin.json v9.53.0 independently, colliding with main's already-merged v9.53.0"
closes:
links: [LESSON-0032]
---

## Problem

In an `/pandacorp:implement-backlog` whole-queue run, each backlog item is worked by a parallel
worktree-isolated subagent. When more than one of those items touches `plugin/` and needs a semver
bump, EACH subagent independently reads `plugin/.claude-plugin/plugin.json`'s `version` from its own
worktree's (stale) base and computes "current + 1 PATCH/MINOR" — on 2026-07-02, BL-0010's and BL-0006's
subagents both independently computed `v9.53.0`, which collided with `v9.53.0` that `main` had already
advanced to via a prior serialized merge in the same run. The serialized-merge step caught and
reconciled the collision by hand, but nothing structurally prevents it from recurring on every
whole-backlog run that touches `plugin/` with 2+ items.

Impact: this is not a one-off — the whole-queue mode's entire selling point is running items in
parallel, and any run with 2+ `plugin/`-touching items will hit this again, costing a manual
reconciliation step every time.

## Root cause

`validate-backlog.sh` and `validate-memory.sh` already solve this exact class of problem for `BL-*`/
`LESSON-*` ids — an authoritative "next free id" the caller must query rather than infer. No analogous
allocator exists for `plugin.json`'s `version` field: each subagent treats "current + 1" as safe because
its own worktree looks clean, but worktree isolation only prevents file-content conflicts, not
value-collision on a monotonic field computed from a shared, possibly-stale base.

## Fix plan

Pick one of the two documented options (either is acceptable; the merging orchestrator option is
simpler to implement in the existing serialized-merge step):

1. **Merge-time bump (preferred):** subagents do NOT bump `plugin/.claude-plugin/plugin.json`'s
   `version` themselves when their change touches `plugin/` — they record the semver LEVEL their
   change requires (patch/minor/major, per the existing DR-034 rubric) in their item's own commit
   message or a sidecar marker. The `implement-backlog` skill's serialized-merge step (the single
   place that already lands one item at a time onto `main`) reads the just-merged `main` version AFTER
   each merge and applies the recorded bump level itself, immediately before/as part of that merge —
   so there is only ever one writer computing "current + 1", already serialized.
2. **Stamped-at-merge-time convention (alternative):** if per-subagent commits must contain the bump
   (e.g. for the item's own tests to reference a version), have the subagent write a placeholder
   (e.g. `"version": "PENDING"` or a level marker) instead of a computed number, and have the
   merge step resolve the placeholder to the real next version at merge time.

Touch: `plugin/skills/implement-backlog/SKILL.md` (the serialized-merge step's instructions),
`plugin/templates/shared/.claude/workflows/pandacorp-build.js` if the merge orchestration lives there
for this flow, and `factory/standards/build-orchestration.md` if it documents per-item version-bump
responsibility.

## Tests (prove the fix — TDD, RED → GREEN)

Automation is impractical for a full multi-agent race (would require simulating two live subagents);
prove it with a **documented manual repro + a script assertion**:
- RED: construct two backlog items that both touch `plugin/` and would each independently compute the
  same next PATCH version from the same base `plugin.json`; run the OLD flow (or trace it manually) and
  show both would write the same `version` string — the collision the note describes.
- GREEN: after the fix, re-run (or trace) the same two-item scenario through the new merge-time-bump
  step and confirm the second item's merge lands a version ONE HIGHER than the first's, never a
  collision, with only the merge step (never a subagent) computing the final number.
- Add a script assertion in `plugin/scripts/` (or extend an existing merge-queue script) that fails
  loudly if a merge would land a `plugin.json` version equal to or lower than `main`'s current version.

## Done when

- The serialized-merge step (not individual subagents) owns the final `plugin.json` version bump for
  any item touching `plugin/`, verified by the manual repro above.
- A script assertion exists that fails loudly on a would-be version collision/regression at merge time.
- `plugin/skills/implement-backlog/SKILL.md` documents the new responsibility split.
- `plugin/docs/decision-log.md` records the change.

## Out of scope

Does not change how a SINGLE-item `implement-backlog <BL-NNNN>` run bumps the version (already
serialized, no collision risk there) — only the whole-queue parallel mode.
