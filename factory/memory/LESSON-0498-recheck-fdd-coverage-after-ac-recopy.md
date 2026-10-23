---
id: LESSON-0498
type: gotcha
domain: documentation
tags: [check-fdd-coverage, acceptance-criteria, reconciler, traceability]
context: re-copying an amended acceptance-criteria bullet from `frd.md` into its owning work order, on a
  WO line the reconciler had previously annotated with a "(drawn in FRD-XX's captured states)" note
trigger: use this when re-copying an amended AC bullet into its work order and the line being replaced
  carries a "(drawn in FRD-XX's captured states)" reconciler annotation
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred), found during the v2
  Orbita plan gate pass: re-copying an amended AC bullet wiped the reconciler's note on that line,
  silently failing check-fdd-coverage until the checker was re-run and the line manually re-annotated"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0277]
---

**Situation:** a work-order line quoted copy that is captured only in a DIFFERENT FRD's oracle states;
the reconciler had appended "(drawn in FRD-XX's captured states)" to that line so `check-fdd-coverage`
would pass it. An unrelated AC amendment re-copied that same bullet verbatim from `frd.md`, overwriting
the line — and silently dropping the reconciler's note along with it. `check-fdd-coverage` then failed on
the next (unrelated) gate run, with nothing pointing back at the re-copy as the cause.

**Lesson:** an AC re-copy step treats the WO line as disposable text to overwrite, with no awareness that
a reconciler annotation it carries is load-bearing for a downstream gate (`check-fdd-coverage`). The
failure surfaces later, decoupled in time from the actual re-copy that caused it, making the real cause
easy to miss.

**Apply next time:** immediately after re-copying ANY amended AC bullet into its work order, re-run
`check-fdd-coverage` (or the relevant design/architecture gate step that wraps it) before moving on — do
not wait for the next scheduled gate pass to discover a dropped annotation. A tooling fix to preserve the
annotation automatically is tracked at BL-0277; until it ships, treat every AC re-copy as a trigger to
re-check coverage, not just a text edit.
