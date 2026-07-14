---
id: LESSON-0144
type: gotcha
domain: factory-engineering
tags: [adopt, brownfield, phase-inference, quality-gate, dr-119]
context: an engine or skill infers a project's current lifecycle phase from the presence of artifacts (code, docs) rather than their verified quality
trigger: use this when designing or reviewing a phase-inference/adoption step that stamps a project's phase from what artifacts exist on disk
source: "panda-corp Mission Control adoption incident, 2026-07-10 — bad reconstructed FRDs/blueprints/work-orders went undetected, a downstream build ran ~2 days on them; fixed by DR-119, factory/decisions/registry.yaml, plugin v9.85.0 (adopt Step 6b)"
provenance: owner-stated
created: 2026-07-12
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-119]
---

**Situation:** `/pandacorp:adopt` mapped code maturity straight to a stamped project phase — if the
folder had FRDs/blueprints/work-orders, it stamped that phase as done, with no independent check that
those reconstructed docs were actually GOOD. On Mission Control this let a phase advance over
low-quality reconstructed docs; the ~2 days of downstream build work consumed them uncritically before
anyone noticed.

**Lesson:** artifact PRESENCE is not artifact QUALITY. Any engine step that infers "this phase is done"
from "these files exist" is structurally blind to a reconstructed/backfilled/machine-generated artifact
that satisfies the shape but not the substance. The fix generalizes past this one adoption flow: phase
advancement anywhere in the pipeline needs its OWN phase's independent readiness/quality gate re-run at
the point of inference, not a presence check borrowed from a different concern.

**Apply next time:** when a step needs to determine "how far along is this thing?" from existing
artifacts (not from a skill that just produced them under its own gate), don't stamp a ceiling from
presence alone — re-run (or reuse verbatim, as `adopt` now does) the SAME quality-gate battery the
producing skill would have required, bottom-up to the presence-implied ceiling, and cap the phase at the
first battery that fails.
