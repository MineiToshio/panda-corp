---
id: BL-0271
type: change
area: plugin-skill
title: "Design freeze time-box and S2.1 batching must scale with touched-FRD count for a redesign of an existing app"
status: open
severity: p2
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred) — Mission Control v2 design freeze (21 UI FRDs, 159 states)"
closes:
links: [LESSON-0493]
---

## Problem
`plugin/skills/design/references/freeze-and-fidelity.md`'s freeze plan targets "60 to 100 minutes, hard
limit 2 hours" (DR-129), calibrated against funko-tracker-scale greenfield prototypes. Running the SAME
plan against a REDESIGN of Mission Control itself (21 UI FRDs, 159 states) blew the time box about 5x
over. The single S2.1 stage (draw the owner-approved Group B items, apply roughly 75 copy fixes, rebuild,
recapture — all specified as "ONE batch") alone took hours, because it was executed as one undivided unit
regardless of how many FRDs it actually touched.

Impact: a redesign of any sufficiently large existing app will reliably blow the freeze's time box under
the current plan, with no built-in signal telling the operator to split the work differently BEFORE
starting the clock.

## Fix plan
1. In `freeze-and-fidelity.md`'s entry conditions / time-box section, add an explicit scaling rule: budget
   the freeze's time box proportionally to the number of UI FRDs actually touched this round (not a flat
   60-100 min/2h default), with a stated reference point (e.g. "~X minutes per touched FRD, calibrated
   against funko-tracker's N FRDs").
2. Change S2.1's own task description (currently "ONE batch of prototype/copy changes...") to require
   splitting into parallel per-surface batches whenever the batch would touch more than roughly 10 FRDs,
   rather than running it as a single undivided unit.
3. Record the explicit redesign-scale finding (Mission Control v2: 21 FRDs, 159 states, ~5x overrun) in
   `factory/standards/design.md` §5d-§5f alongside the existing funko-tracker calibration point, so future
   redesigns have two reference scales instead of one.

## Tests (prove the fix — TDD, RED → GREEN)
- A test/check over the freeze tracker template or planning script (if one exists) that asserts: when the
  touched-FRD count for a stage exceeds the configured split threshold, the plan must list that stage as
  split into N per-surface sub-batches rather than one entry (RED on a monolithic-batch fixture with >10
  FRDs; GREEN once split). Where no automated planner exists yet, a documented before/after of the
  reference text in `freeze-and-fidelity.md` + `design.md` is the acceptable proof (manual repro per the
  template's allowance for automation-infeasible items).

## Done when
- `freeze-and-fidelity.md` states the FRD-count-scaled time-box rule and the >10-FRD split rule for S2.1.
- `factory/standards/design.md` §5d-§5f records the second (redesign-scale) calibration point.
- Plugin MINOR version bumped + manifests regenerated; decision log entry.

## Out of scope
- Building an automated FRD-count-based time-box calculator — this item only requires the explicit
  documented rule; tooling automation can follow as a later change if the documented rule proves
  insufficient.
