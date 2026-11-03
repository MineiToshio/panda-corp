---
id: LESSON-0586
type: pattern
domain: documentation
tags: [fdd, frozen-metrics, live-data, documentation-and-decisions, calibration]
context: a feature design doc (FDD) or similar design artifact that cites specific numeric figures (counts, percentages, measurements) captured once during design/calibration, describing screens that will later show the LIVE, current version of those same kinds of figures
trigger: use this when writing or reviewing an FDD/design doc that cites specific numbers alongside a description of a screen that will render the current, live version of that same metric
source: "mission-control docs/decision-log.md 2026-10-31 (agent-inferred) — a fidelity-calibration pass found FDD figures that mixed frozen reference captures (numbers measured once, during one calibration run) with the live/dated audit's current figures, without the doc itself ever stating which was which; the fix made FRD-17 explicitly separate the frozen capture counts from the dated live audit before describing the screens that display them"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a feature's design documentation cited numeric figures (reference measurements taken
during one specific calibration pass) in the same breath as screens that render a LIVE, continuously
updated version of conceptually the same metric. Nothing in the document flagged which numbers were a
one-time snapshot versus which were expected to always reflect current reality, so a reader (or a later
editor) could reasonably treat a frozen number as if it were still accurate, or vice versa.

**Lesson:** a numeric figure in a design doc is ambiguous without a stated TEMPORAL CONTRACT — "this was
measured once, on this date, as a reference" reads identically to "this is what the screen currently
shows" unless the document says which. The ambiguity compounds over time: the live figure drifts, the
frozen one doesn't, and a reader six months later has no way to tell which kind they're looking at.

**Apply next time:** when an FDD or design doc cites specific numbers, state up front — before
describing the screens that use them — which figures are FROZEN reference captures (with the date/run
that produced them) and which are LIVE/current values the screen computes on every render. Keep this
distinction near the numbers themselves, not buried in a changelog entry elsewhere.
