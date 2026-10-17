---
id: LESSON-0354
type: library-verdict
domain: graph-visualization
tags: [dagre, graph-layout, prototype-pollution, hostile-ids, javascript-object-keys]
context: feeding arbitrary domain-supplied string IDs (table/entity names, field names) as node/edge identifiers into a JS graph-layout library that uses them as object keys internally
trigger: use this when a graph/diagram-layout library needs to accept domain identifiers that are not controlled or sanitized (table names, entity names, user-supplied labels) as node IDs
source: "factory/memory/_inbox.md agent-inferred note — Mission Control logical-data-model-viewer, 2026-10-16: an adversarial test (hostile-ids.reviewer.test.ts) found Dagre 3.0.0 fails when domain IDs collide with JS Object prototype property names (__proto__, constructor, toString) used as internal dictionary keys"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an adversarial test fed Dagre 3.0.0 valid-looking domain identifiers that happen to collide
with JavaScript's `Object.prototype` property names — `__proto__`, `constructor`, `toString` — as node IDs
for a schema diagram. Dagre uses plain JS objects as internal lookup dictionaries keyed by node ID, so these
collisions corrupted its internal state (prototype-pollution-shaped failure) rather than raising a clear
error.

**Lesson:** a graph-layout library built on plain-object dictionaries is not safe to feed arbitrary
domain-supplied strings directly as node/edge IDs — a handful of ordinary-looking names (that a real schema
could plausibly contain) silently break it. This is the layout library's own hazard, not something a caller
can detect by validating "normal" IDs.

**Apply next time:** when wiring domain identifiers (table/entity/field names) into Dagre (or any similarly
object-keyed layout library) as node IDs, separate DOMAIN identity from LAYOUT identity: map every domain
ID to an internal layout-safe token (e.g. `n0`, `n1`, `r0`) via a `Map` (not a plain object) before handing
anything to the layout library, and translate back to the original domain ID for rendering/labels. Never
drop or filter entities based on what the layout library happened to choke on.
