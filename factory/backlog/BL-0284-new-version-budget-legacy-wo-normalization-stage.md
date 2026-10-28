---
id: BL-0284
type: change
area: plugin-skill
title: "new-version must budget a project-wide legacy work-order normalization stage before any v2 FRD can flip active on a brownfield project"
status: open
severity: p2
opened: 2026-10-28
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred): flip-active needs ac-matrix/plan-consistency green PROJECT-WIDE, so a v2 of a legacy v1 project must normalize every old work order (undefined AC ids, non-verbatim copies) before any FRD can be stamped — budget that as a stage of new-version"
closes:
links: [LESSON-0537]
---

## Problem
Flipping a v2 FRD to `active` via `new-version` requires the project-wide `ac-matrix`/`plan-consistency`
gates to pass. On mission-control (a legacy v1 project predating these gates), the first flip-active
attempt during the v2 milestone failed because many PRE-EXISTING v1 work orders — unrelated to the FRD
being flipped — carried undefined AC ids or non-verbatim acceptance-criteria copies the gates had never
been run against. This was discovered mid-milestone, costing a detour to normalize the whole legacy
corpus before the actual redesign work could proceed. See `factory/memory/LESSON-0537` for the
generalized lesson.

## Root cause
`plugin/skills/new-version/SKILL.md` plans its milestone stages (design freeze, re-plan, architecture
gates, implement) without an explicit, up-front stage that runs the project-wide `ac-matrix`/
`plan-consistency` gates against the CURRENT (pre-redesign) state and budgets normalizing whatever fails.
The gap only surfaces reactively, at the first flip-active attempt, on any project old enough to predate
the gates' introduction.

## Fix plan
1. In `plugin/skills/new-version/SKILL.md`, add an explicit early stage (before or alongside the design
   freeze) for brownfield projects: run the project-wide `ac-matrix`/`plan-consistency` gates once against
   the current state, and if they fail, surface the normalization work (defining missing AC ids, making
   copies verbatim across legacy work orders) as its own planned stage of the milestone.
2. Gate this stage on project age/origin (e.g. `created_with` predating the gates' introduction, or a
   direct gate run) rather than always running it — a project already gate-clean should not pay this cost.
3. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (MINOR — new planning
   capability).

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a brownfield project with intentionally malformed legacy work orders (undefined AC ids,
non-verbatim criteria) entering a `new-version` milestone. RED = the milestone reaches flip-active before
surfacing the normalization need, failing late. GREEN = the new early stage detects and surfaces the
normalization work before the design freeze/re-plan stages proceed.

## Done when
- `new-version` runs the project-wide gates up front on a brownfield project and surfaces normalization
  work as an explicit stage, confirmed by the fixture above.
- Plugin version bumped (MINOR) + decision-log entry added.
- `factory/memory/LESSON-0537` backlinked (`promotion` field or `links`) once this ships.

## Out of scope
Auto-fixing the legacy work orders' AC ids/copies itself (that stays a planned, reviewed stage of the
milestone, not an automated rewrite) — this item only makes the NEED visible early, not the fix itself.
