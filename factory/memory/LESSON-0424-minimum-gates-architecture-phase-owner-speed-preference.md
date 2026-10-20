---
id: LESSON-0424
type: pattern
domain: build-orchestration
tags: [architecture-phase, design-phase, gates, owner-preference, scope-change, speed, close-out]
context: a multi-gate phase (architecture or design) ballooned to many hours because extra review/fix/delta/cleanup rounds kept chaining onto the mandated gates instead of closing after the minimum
trigger: use this when planning or running a multi-gate phase (architecture, design, or any phase with iterative review rounds) and deciding how many review/audit checkpoints to insert, OR when a post-approval propagation/cleanup round is tempted to chain review -> fixes -> delta -> extra cleanups instead of closing
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 (owner-stated) — the owner was frustrated that the architecture phase took many hours (two mid-phase scope changes + a 190-state design round + extra audits); corroborated by pandasaga .pandacorp/run/lessons.md 2026-10-17 (owner-stated) — a post-architecture design round ran for hours by chaining review -> fixes -> delta -> extra cleanups (newer-standards checks, discovered edge cases); owner's rule there: after approval, ONE propagation pass + ONE mechanical check, then close (commit/push) — non-blocking improvements get noted, not chained"
provenance: owner-stated
created: 2026-10-18
status: active
promotion: proposed   # 2026-10-19 (librarian review) — target: factory/decisions/registry.yaml (new DR default for multi-gate phase cadence: default to the minimum mandated gates + one fix pass; once the owner has approved, run the closing sequence — propagation + one mechanical check — exactly once, logging any further nit/newer-standard/edge-case found mid-close for later rather than re-opening the same close). Corroborated across 2 distinct projects (funko-tracker's architecture phase, pandasaga's design-phase closing sequence) with zero contradicting evidence — same owner-stated preference, two different phases, both owner-stated (highest-trust provenance).
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0274, LESSON-0390, LESSON-0246]
---

**Situation:** funko-tracker's architecture phase ran for many hours, driven by two mid-phase scope
changes, a 190-state design round, and additional audits layered on top of the phase's own mandated
gates. The owner flagged the total elapsed time as frustrating. A second, distinct project
(pandasaga) independently produced the same complaint about a different phase: a post-architecture
design round ran for hours because review -> fixes -> delta -> extra cleanups (newer-standards checks,
newly discovered edge cases) kept chaining onto each other instead of closing once the owner had
approved. The owner's own fix there was explicit: after approval, run ONE propagation pass + ONE
mechanical check, then close (commit/push); non-blocking improvements get noted for later, not chained
into the same closing sequence.

**Lesson:** this owner's default expectation (consistent with LESSON-0274's "optimize for
time-to-first-useful-result" and LESSON-0390's "don't keep re-auditing an already-sufficient hand-off")
is the MINIMUM mandatory gate set plus one fix pass, then ship — not every extra review/audit/owner
checkpoint a phase could in principle run, especially once a mid-phase scope change has already eaten
into the budget. Stacking additional checkpoints onto an already-extended phase compounds the owner's
frustration rather than buying confidence proportional to the extra time spent. The pandasaga evidence
sharpens this into a closing-process rule, not just a gate-count rule: once the owner has approved, the
CLOSING sequence itself (propagation of the approved change + a mechanical check) should run exactly
once and then land — any further round discovered during that close (a newer standard to check, an edge
case noticed in passing) is a note for later, not a reason to re-open the same closing sequence. This
corroboration (two distinct projects, same owner-stated complaint, same underlying preference, applied
to two different phases — architecture and design) strengthens this from a single-project observation to
a cross-project pattern.

**Apply next time:** when running a multi-stage phase (architecture, design, or similar) for this owner,
default to the minimum mandated gates + a single fix pass. Any ADDITIONAL review/audit/owner checkpoint
beyond that mandated minimum should be explicitly non-blocking (deferred, async, or offered as optional)
rather than inserted into the critical path — and this applies with extra force once a mid-phase scope
change has already extended the phase once. Separately, once the owner has approved a result and the
phase moves into its CLOSING sequence (propagate the approved change, run the mandated mechanical
checks, commit/push), run that sequence exactly once: do not let a fix discovered mid-close, a newer
standard noticed in passing, or an edge case spotted along the way re-open another review -> fix -> delta
round in the same close — log it and close on schedule instead.
