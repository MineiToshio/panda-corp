---
id: LESSON-0536
type: pattern
domain: factory-engineering
tags: [new-version, design-freeze, feature-removal, scope, migration]
context: a `new-version` redesign's frozen prototype deliberately drops UI surfaces/features that v1 had, rather than only adding new ones
trigger: use this when planning or executing the build phase of a `new-version` milestone whose frozen design dropped one or more v1 features — before assuming every v1 surface must be preserved
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (owner-stated) — Mission Control v2 design freeze"
provenance: owner-stated
created: 2026-10-28
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0492, LESSON-0497]
---

**Situation:** during a `new-version` redesign, the owner clarified that the frozen v2 design is the
target in BOTH directions — it says what to build AND, implicitly, what to retire. A feature present in
v1 but absent from the frozen v2 prototype/FRDs is not an oversight to preserve defensively; it is a
decision already made at the freeze.

**Lesson:** a redesign is not purely additive. Treating "the new design doesn't show it" as "leave the
old one alone, just in case" silently ships a v2 with dead/orphaned v1 surfaces (unreachable nav entries,
dead routes, stale components, tests exercising a retired flow) that the frozen design never asked to
keep. The removal is as much a deliverable as the new feature is.

**Apply next time:** when a `new-version` milestone's frozen design omits a v1 feature/surface, treat its
removal as an explicit, planned unit of work — not a side effect to leave for later cleanup. Enumerate
what must be removed (code, nav/menu entries, routes, tests, docs referencing it) from the SAME
acceptance-criteria/FRD diff used to plan additions (see LESSON-0492: derive the undrawn/removed set
mechanically from the FRDs, not from a pitch/proposal's illustrative list), and schedule it as its own
work rather than assuming preservation is the safe default.
