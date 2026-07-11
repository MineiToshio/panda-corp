---
id: LESSON-0136
type: gotcha
domain: design-process
tags: [design-system, canvas, coverage-gap, back-port, banner, panel, toast]
context: planning or reviewing the output of a single exhaustive Stage-1 design-system generation prompt, before starting Stage-2 per-screen generation
trigger: use this when a design system was generated in one pass (Stage 1) and you are about to trust it is complete before building individual screens against it
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred): a single-pass Stage-1 design-system generation omitted Banner/Alert, Panel/Surface, and Toast entirely — all three were discovered only while building individual screens in Stage 2 (login needed a status banner, connections needed a form panel, a separate screen needed a toast pattern), each requiring an ad-hoc back-port instead of being anticipated"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0138, BL-0060, LESSON-0141]
---

**Situation:** a design system generated in a single exhaustive prompt (Stage 1 of the canvas procedure,
scored against an anti-omission checklist before screens begin) was missing three components entirely:
Banner/Alert, Panel/Surface, and Toast. None of these were flagged as gaps during the Stage-1 review —
they surfaced only once individual screens were built in Stage 2 and each one needed a component the
system didn't have, forcing a reactive back-port each time rather than a single anticipated round.

**Lesson:** a single generation pass, however exhaustive its prompt, systematically underanticipates a
specific category of component: feedback/notification surfaces (banners, alerts, toasts, elevated
panels). These components are easy to omit from a Stage-1 prompt because they aren't tied to any specific
screen's primary content — they only become obviously necessary once a screen needs to communicate a
transient or secondary state (an error, a status update, a grouped settings section). This is a
predictable, recurring coverage gap, not a one-off oversight specific to one project.

**Apply next time:** when reviewing a Stage-1 design system before starting Stage 2, explicitly check for
a feedback/notification-surface component category (Banner/Alert — including a live-region variant, see
the related accessibility gotcha — Panel/Surface, Toast) even if the checklist used doesn't name it
explicitly yet. If the check happens after the fact (per BL-0060, updating the checklist itself), still
budget for one deliberate back-port round per screen family rather than treating each mid-Stage-2
discovery as a surprise — it is the expected shape of this gap, not an anomaly.
