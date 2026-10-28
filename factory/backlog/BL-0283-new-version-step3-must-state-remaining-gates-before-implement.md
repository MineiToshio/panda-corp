---
id: BL-0283
type: change
area: plugin-skill
title: "new-version must proactively tell the owner that blueprints + work orders + the three gates come before /implement can build anything after a design freeze"
status: open
severity: p2
opened: 2026-10-28
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (owner-stated): the owner believed new-version step 3 was /implement; after a design freeze, the owner needs to be told up front that blueprints + work orders + the three gates must run before /implement can build anything"
closes:
links: []
---

## Problem
After a `new-version` design freeze (step 2 in the milestone), the owner expected the very next step to
be `/implement` actually building the redesign. In reality, `new-version` step 3 ("re-plan") only
produces updated blueprints and work orders, which then must pass the architecture phase's three
readiness gates (readiness gate, `[NEEDS CLARIFICATION]` check, the right-sizing checklist — see
`factory/standards/build-orchestration.md`, DR-100) before any `/implement` run can build a single work
order. The skill did not state this up front, so the owner was surprised mid-milestone that "step 3"
was not the build they expected — a confusion cost (and an owner-trust cost) that a one-line expectation-
setting message would have avoided.

## Root cause
`plugin/skills/new-version/SKILL.md`'s step 3 (re-plan) does not currently include an explicit,
owner-facing statement of what remains between a completed design freeze and an actual `/implement` run.
The owner has to infer the pipeline's remaining shape from the skill's internal behavior rather than being
told directly.

## Fix plan
1. In `plugin/skills/new-version/SKILL.md`'s re-plan step (step 3), add an explicit owner-facing message
   emitted right after the design freeze closes and before re-planning begins: name the concrete remaining
   steps (blueprints + work orders + the architecture readiness gates) and that `/implement` only becomes
   possible once those are green — not immediately after the freeze.
2. Keep the message short (per CONV-11/DR-110 interaction style) — a one-paragraph expectation-setting
   note, not a restatement of the whole pipeline.
3. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (PATCH — messaging only,
   no behavior change).

## Tests (prove the fix — TDD, RED → GREEN)
Manual repro (skill-text change, no deterministic gate fits): re-run `new-version` through a design
freeze on a fixture project and confirm the step-3 transcript includes the new expectation-setting message
before re-planning starts. A doc-lint/skill-authoring check that greps the skill body for the message's
presence would be a reasonable automated proxy if one already exists for other skill messaging contracts;
otherwise this is a documented manual repro.

## Done when
- `new-version`'s re-plan step emits the expectation-setting message in a live or simulated run.
- Plugin version bumped (PATCH) + decision-log entry added.

## Out of scope
Changing the actual pipeline order (design freeze → re-plan → architecture gates → implement) — this item
only fixes the communication gap, not the mechanics.
