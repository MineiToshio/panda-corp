---
id: LESSON-0588
type: pattern
domain: data-modeling
tags: [reader, staleness, parsing, shared-module, join]
context: a reader/parser of a snapshot-style artifact that is shared between a context requiring strict freshness and a context (e.g. a multi-source join) that must tolerate a stale snapshot while other sources catch up
trigger: use this when a shared reader for a snapshot artifact needs to serve both a strict freshness-gated consumer and a join/merge consumer that must not reject a stale-but-parseable snapshot
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred) — a reader that bundled staleness-rejection INTO its parse step could not be reused for a join across multiple sources, because the join needed to accept a structurally valid but stale snapshot from one source while waiting on another; separating 'can I parse this' from 'is this fresh enough for THIS caller' let both contexts share the same parser"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0180]
---

**Situation:** a reader for a periodically-regenerated snapshot artifact rejected the artifact outright
if it judged the snapshot too old — a staleness policy baked directly into the parse function. A later
need arose to join this snapshot's data with another source in a context where being briefly stale (one
source hasn't caught up yet) was acceptable and expected, not an error. The bundled policy made the
parser itself unusable there: every call site inherited the strict-freshness opinion whether it wanted it
or not.

**Lesson:** "can this artifact be parsed into a valid structure" and "is this particular read fresh enough
for what I'm about to do with it" are two independent questions answered at two different layers. Baking
a freshness policy into the parser forces every consumer to adopt the SAME staleness tolerance, which is
false in general — a strict UI display and a best-effort multi-source join have legitimately different
tolerances for the same data.

**Apply next time:** when a shared reader must serve consumers with different staleness tolerances,
split it into (1) a pure parse step that only validates structure and returns a typed result (or a typed
parse error, per DR-078) — never rejecting on age — and (2) a separate, explicit freshness check that
each caller applies with its OWN tolerance. This keeps the parser reusable and makes each consumer's
staleness policy visible at its own call site instead of hidden inside a shared function.
