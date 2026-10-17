---
id: LESSON-0417
type: pattern
domain: build-orchestration
tags: [work-orders, dr-100, dag, dependency-wave, seam, acceptance-criteria]
context: a work-order plan where an acceptance criterion must land in a downstream WO, but the file it most naturally belongs in is owned/already written by an earlier, upstream WO
trigger: use this when splitting work orders and an AC's natural implementation site is a file an EARLIER WO already owns, but the AC itself conceptually belongs to a LATER WO — a case where moving the logic upstream would create a cycle or shift the whole plan's wave structure
source: "pandasaga .pandacorp/run/lessons.md 2026-10-16 (agent-inferred): When an AC must move to a downstream WO but its code sits in an upstream WO's file, give the upstream WO an explicit ordered seam (a preflight list) and let the downstream WO own a separate module plus a minimal registration edit of that file, serialized by its existing dependency; moving the logic upstream would create a cycle or shift waves."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an acceptance criterion conceptually belonged to a downstream work order, but the file
where it would most naturally be implemented (a registry, a config list, a routing table) was already
owned and written by an earlier, upstream work order. Moving the AC's implementation fully upstream (into
the WO that owns the file) would misattribute the work and, worse, could introduce a dependency cycle or
force the whole plan's wave structure to shift to accommodate the now-earlier logic. Moving the file
ownership fully downstream was also wrong — the file's OWN primary content still belongs upstream.

**Lesson:** the two WOs don't need to fight over owning the same file wholesale — the upstream WO can
expose an explicit, ORDERED extension point (a preflight list, a named registration slot, a documented
seam) as part of its own deliverable, and the downstream WO then does two things: (1) implement its own
logic in a NEW module it fully owns, and (2) make a minimal, mechanical registration edit to the upstream
file at that seam — a small, well-defined diff rather than owning or rewriting the whole file. Because the
downstream WO already depends on the upstream one (the existing DAG edge), this registration edit is
naturally serialized after the upstream file exists, with no new cycle and no wave shift.

**Apply next time:** when an AC's natural file sits in an earlier WO but the AC itself belongs to a later
one, don't move the AC upstream or the file downstream wholesale — have the upstream WO declare an
explicit ordered seam (preflight list/registration point) as part of ITS acceptance criteria, and give the
downstream WO a new, separately-owned module plus a minimal registration edit at that seam, relying on the
existing upstream->downstream dependency edge to serialize the two safely.
