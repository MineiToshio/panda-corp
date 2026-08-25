---
id: BL-0089
type: bug
area: plugin-skill
title: "memory skill's harvest mode never instructs committing its own drained-inbox + LESSON output"
status: open
severity: p2
opened: 2026-08-25
closed:
source: "factory/memory/_inbox.md 2026-08-25 note (agent-inferred), corroborating the 2026-07-14 abandoned-harvest incident named in factory/standards/debugging.md's Why section"
closes:
links: [BL-0061, LESSON-0113]
---

## Problem
`plugin/skills/memory/SKILL.md`'s harvest mode (steps 1-6, `## Mode: harvest (Phase 1)`) writes durable
output to the working tree — drained/rewritten `factory/memory/_inbox.md` (or a project's
`.pandacorp/run/lessons.md`), new/updated `factory/memory/LESSON-*.md` files, `INDEX.md` deltas,
`factory/backlog/BL-*.md` items split off per DR-103 — and then stamps `last_harvest` and reports to the
owner (steps 5-6), but **never instructs committing any of it**. Grepped the file directly for
`git add`/`git commit`/`commit` — zero hits (verified 2026-08-25).

Concrete impact, already observed: the 2026-08-11 `pandacorp-memory-review` harvest completed all its
writes (3 new LESSON files, BL-0061 annotations, LESSON-0105's 9th corroboration) but sat uncommitted in
the working tree until the 2026-08-15 sweep happened to notice via `git status` — a second concrete
instance of the "abandoned harvest" pattern already named in `factory/standards/debugging.md`'s Why
section (the 2026-07-14 incident: "a routine trusted a note count where a `git status` timeline check
would have caught days of uncommitted work"). That prior instance was about a routine mis-measuring a
BUILD's state; this one is the routine leaving ITS OWN harvest output uncommitted — a distinct, still-open
gap in the skill's own SOP text, not covered by any existing BL.

## Root cause
The harvest mode's step list ends at "stamp the project" (step 5) and "report to the owner" (step 6) —
there is no step instructing the delegated `librarian` agent (or the invoking session) to `git add` the
touched paths (`factory/memory/_inbox.md`, any new/updated `LESSON-*.md`, `INDEX.md`, any new `BL-*.md`,
the project's `status.yaml` last_harvest stamp) and `git commit`. Every other skill that mutates committed
state in this repo (e.g. `learn`, `sync-portfolio`) either commits explicitly in its own SOP or hands off
to a step that does; `memory` harvest is the outlier that stops at "write + report" and relies on some
LATER, unrelated session noticing the diff.

## Fix plan
1. In `plugin/skills/memory/SKILL.md`, `## Mode: harvest (Phase 1)`, insert a new step between the
   existing step 5 (stamp `last_harvest`) and step 6 (report to owner) — call it step 5b or renumber:
   **"Commit."** Stage every path this harvest touched (drained inbox file(s), new/updated
   `factory/memory/LESSON-*.md`, `factory/memory/INDEX.md`, any new `factory/backlog/BL-*.md`, the
   stamped `.pandacorp/status.yaml`) and create a commit with a descriptive message (English, per
   `AGENTS.md`'s language rule — this is committed state) BEFORE reporting to the owner. State explicitly
   that this applies whether harvest ran standalone, from the factory, from inside a project, or as part
   of the `/loop` `pandacorp-memory-review` sweep — the commit step is not optional in any of those paths.
2. Cross-check `## Mode: review / prune (Phase 4)` (steps 7-9) for the same gap — the review/prune mode
   also mutates `factory/memory/` (status changes, `promotion: proposed` flags, INDEX edits) and should
   commit its own output too if it doesn't already have an equivalent instruction; fix in the same change
   if missing.
3. Bump the plugin version (PATCH — this is a fix to existing skill behavior, no new capability) and
   record the change in `plugin/docs/decision-log.md` per `CLAUDE.md`'s plugin-maintenance ritual.

## Tests (prove the fix — TDD, RED → GREEN)
Behavior lives in a SKILL prompt (automation of skill-prompt execution is infeasible); proof is a
documented text assertion against the edited file:
- **RED (current state):** `grep -n "git add\|git commit" plugin/skills/memory/SKILL.md` under `## Mode:
  harvest` returns zero hits (reproduced 2026-08-25).
- **GREEN (after fix):** the same grep, scoped to the harvest mode's step list, returns at least one hit
  naming both `git add` (or "stage") and `git commit` as an explicit step ordered BEFORE the "report to
  owner" step, with prose that says the paths staged include the drained inbox, any new/updated
  `LESSON-*`/`INDEX.md`, and any new `BL-*` items.
- A manual repro: run harvest end-to-end on a fixture with ≥1 pending inbox note, confirm the resulting
  `git status` is clean (no uncommitted memory/backlog output) once harvest reports completion.

## Done when
`plugin/skills/memory/SKILL.md`'s harvest mode (and review/prune mode, if it had the same gap) instructs
an explicit commit of every artifact it wrote, ordered before the owner report; the RED→GREEN grep above
passes; plugin version bumped + decision-log entry recorded; this item's `closes:` filled with the commit
SHA and `status: done`.

## Out of scope
Retroactively auditing every PAST harvest for uncommitted output (the 2026-08-15 sweep already did this
once; a recurring `git status` check on schedule, if wanted, is a separate concern from fixing this skill's
own instructions).
