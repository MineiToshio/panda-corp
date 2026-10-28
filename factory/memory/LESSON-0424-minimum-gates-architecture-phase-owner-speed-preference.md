---
id: LESSON-0424
type: pattern
domain: build-orchestration
tags: [architecture-phase, design-phase, gates, owner-preference, scope-change, speed, close-out]
context: a multi-gate phase (architecture or design) ballooned to many hours because extra review/fix/delta/cleanup rounds kept chaining onto the mandated gates instead of closing after the minimum
trigger: use this when planning or running a multi-gate phase (architecture, design, implement, or any phase with iterative review rounds) and deciding how many review/audit checkpoints to insert, OR when a post-approval propagation/cleanup round is tempted to chain review -> fixes -> delta -> extra cleanups instead of closing, OR when a small implement-phase change keeps absorbing unrelated legacy fixes/re-verification instead of shipping
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 (owner-stated) — the owner was frustrated that the architecture phase took many hours (two mid-phase scope changes + a 190-state design round + extra audits); corroborated by pandasaga .pandacorp/run/lessons.md 2026-10-17 (owner-stated) — a post-architecture design round ran for hours by chaining review -> fixes -> delta -> extra cleanups (newer-standards checks, discovered edge cases); owner's rule there: after approval, ONE propagation pass + ONE mechanical check, then close (commit/push) — non-blocking improvements get noted, not chained. Further corroborated 2026-10-26 (funko-tracker .pandacorp/run/lessons.md and .pandacorp/inbox/changes/done/, owner-stated, same project/different phase -- IMPLEMENT): a small 'Reservado' toggle feature dragged across a pre-existing CI baseline blocker (unrelated dependency-audit highs plus stale oracle assertions, see reserved-production-prerequisites.md) and then four more post-ship UI correction rounds (a motion/hover bug, a mobile-vs-desktop layout bug, a full action-sheet redesign detour, a color-restore bug); the owner's explicit complaint: a small feature must not drag hours of unrelated verification/fixes -- separate inherited/legacy blockers out quickly, run only the gates mandatory at the right moment, and avoid repetitive narration or scope expansion"
provenance: owner-stated
created: 2026-10-18
status: active
promotion: proposed   # 2026-10-28 (librarian review, refined) — target: factory/decisions/registry.yaml (new DR default for multi-gate phase cadence: default to the minimum mandated gates + one fix pass; once the owner has approved, run the closing sequence — propagation + one mechanical check — exactly once, logging any further nit/newer-standard/edge-case found mid-close for later rather than re-opening the same close; the same discipline now extends to IMPLEMENT — split an unrelated pre-existing blocker into its own fix-forward commit immediately, and sweep a small UI change's full neighborhood once before shipping instead of absorbing one owner-reported gap at a time). Corroborated across 2 distinct projects (funko-tracker, pandasaga) spanning 3 distinct phases now — funko-tracker's architecture phase AND its 2026-10-26 IMPLEMENT-phase recurrence, plus pandasaga's design-phase closing sequence — with zero contradicting evidence, all owner-stated (highest-trust provenance). The within-project IMPLEMENT recurrence sharpens rather than merely repeats the pattern (a new chaining mechanism: unrelated inherited CI blockers, not just extra review rounds), strengthening the case for a registry-level default over a single-phase note.
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

**2026-10-26 corroboration — the same preference holds inside IMPLEMENT, not just architecture/design:**
a small, narrowly-scoped feature (a two-state toggle) still took many hours for this owner because it
absorbed two different kinds of unrelated chaining: (1) a pre-existing production-baseline blocker
(stale dependency-audit highs, a stale pre-v2 oracle assertion) that had nothing to do with the feature
itself but sat on its only path to ship, and (2) four separate post-ship correction rounds as small UI
details (hover motion, mobile-vs-desktop layout, then a full redesign detour, then a color revert) kept
surfacing one at a time instead of being caught together. Apply the same minimum-gates discipline to
implement: when a small change's path to shipping crosses a pre-existing, unrelated red (a baseline CI
failure, a stale assertion), split it out as its own fix-forward commit immediately rather than folding
it into the feature's own narrative — and before shipping a small UI change, do one deliberate sweep of
its full neighborhood (every visual state, both breakpoints, hover AND touch) instead of shipping the
first cut and discovering each gap as a separate owner-reported bug.
