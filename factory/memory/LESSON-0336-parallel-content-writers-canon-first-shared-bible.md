---
id: LESSON-0336
type: pattern
domain: content-generation
tags: [parallel-generation, consistency, canon, multi-agent, content-writing]
context: dispatching multiple parallel content-writing agents/workers to produce related demo/narrative content for the same shared world
trigger: use this when dispatching more than one content-writing agent in parallel against a shared fictional/structured world and consistency between their outputs matters
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13 (agent-inferred): three parallel content writers stayed coherent by having one writer fix the events (chapters) first, with the others reading its output as canon against a shared fixed-details bible, then diffing their invented details against the generated images before merging"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** three content-writing tasks ran in parallel against the same shared fictional world
(characters, places, events). Dispatched with no ordering or shared reference, parallel writers risk
inventing conflicting details (who keeps a given item, a route's geography, a minor visual trait) since
none of them see the others' in-flight output.

**Lesson:** parallel content generation stays coherent when one writer's output is designated
ground-truth FIRST (the events/chapters, in this case) and the remaining parallel writers read that
output as canon, anchored to a shared fixed-details bible (names, key facts, constraints) rather than
each inventing independently. Even with that ordering, invented peripheral details (a seal's color, a
route's layout, which character holds a given object) can still silently diverge between writers and
between writers and any separately-generated images — a final diff pass against all generated artifacts
is still required before merging.

**Apply next time:** when dispatching parallel content-generation tasks against one shared world, pick
one task to establish ground-truth facts first and feed its output (plus a short fixed-details bible) to
every other parallel task as a hard constraint; still run an explicit diff of each writer's invented
peripheral details against the other writers' output and against any separately generated images before
merging, since the ordering reduces conflicts but doesn't eliminate them.
