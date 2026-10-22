---
id: LESSON-0493
type: gotcha
domain: factory-engineering
tags: [design-skill, freeze, time-box, redesign, scaling]
context: running the design-freeze time-box (built and tuned for a greenfield prototype of ordinary size) against a REDESIGN of an already-shipped, much larger app
trigger: use this when planning a design freeze for a REDESIGN of an existing, already-shipped app with a large number of UI FRDs/states, not a greenfield design
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred) — Mission Control v2 design freeze (21 UI FRDs, 159 states)"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [BL-0271]
---

**Situation:** the design freeze's time-box (60-100 minutes, hard limit 2 hours, tuned against a
funko-tracker-scale greenfield prototype) was applied to a REDESIGN of Mission Control itself — 21 UI
FRDs, 159 states — and blew the box about 5x over. A single required stage (drawing the owner-approved
scope items plus roughly 75 copy fixes plus recapture, all as one batch) alone took hours, because it was
planned and executed as one undivided unit regardless of how many FRDs it touched.

**Lesson:** the freeze's time-box was calibrated against a single project's observed greenfield scale,
not against FRD/state count — a redesign of an app that already has 10-20x as many UI FRDs as the
calibration project doesn't just take proportionally longer, it breaks the "one undivided batch"
execution model entirely, because a batch sized for roughly 5 FRDs doesn't parallelize or checkpoint when
it silently becomes a batch over 21.

**Apply next time:** size the freeze's time-box budget explicitly by the number of UI FRDs/states
actually touched, not a flat default calibrated on one past project; and once a single batch-type stage
(e.g. "draw the approved scope + copy fixes + recapture") would touch more than roughly 10 FRDs, split it
into parallel per-surface batches up front rather than running it as one long undivided unit.
