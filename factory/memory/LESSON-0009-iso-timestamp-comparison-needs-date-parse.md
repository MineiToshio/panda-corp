---
id: LESSON-0009
type: gotcha
domain: javascript
tags: [timestamps, iso8601, date-parse, timezone, gotcha]
context: comparing ISO 8601 timestamp strings to find the most-recent one, in a reader/selector over event or status data
trigger: use this when selecting the most-recent ISO 8601 timestamp among strings that may come from more than one producer or offset
source: mission-control lessons.md — WO-12-001 freshness.ts (2026-06-16); corroborating instance —
  panda-corp implement-audit 2026-07-07, ndjson event stream mixing timestamp precisions
  (factory/memory/_inbox.md)
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: medium
times_applied: 1
applied_in: [mission-control]
links: []
---

**Situation:** `freshness.ts` needed to find the max-at timestamp among several ISO 8601 strings.
Lexicographic string comparison (`a > b`) equals chronological order **only when every timestamp uses the
same UTC offset** (all `Z`, or all the same fixed offset). With mixed offsets (some `Z`, some `+02:00`),
lexicographic comparison picks the wrong "latest" instant.

A second, independent way the same root assumption breaks (corroborated on a different project/date, same
class of bug): **mixed PRECISION within the same offset** — a shared ndjson event stream had some emitters
stamping `…42Z` and others `…42.920Z`. Lexicographically, `"…42Z" > "…42.920Z"` (`'Z' > '.'` as characters),
so the whole-second stamp sorts AFTER the sub-second one even though it may be chronologically earlier or
simultaneous — a second distinct way "same offset" is not actually sufficient for raw-string comparison to
be safe.

**Lesson:** Reserve raw-string lexicographic comparison for the case where every producer stamps the
IDENTICAL format — same offset AND same fractional-second precision — consistently; it is a valid and cheap
max-at selector then, and keeping the raw string (instead of `Date.parse`-ing it) avoids `NaN`-corruption
risk entirely for the *storage*/*display* path. The moment more than one timestamp source can differ in
EITHER offset OR precision in the same comparison, lexicographic order is unsafe. Two independent fixes,
pick per situation: compare via `Date.parse(at)` at the point of comparison (works regardless of source
uniformity), OR — when you control every emitter of a shared stream (e.g. an internal ndjson event log) —
pin ONE timestamp precision at every emitter so the invariant holds structurally and cheap string comparison
stays safe.

**Apply next time:** Before writing a "pick the latest timestamp" selector, confirm every producer in
scope stamps the identical format — offset AND precision (grep the emitters). If not guaranteed, always
compare via `Date.parse`, never raw string `>`. If you control all emitters of a shared stream, consider
pinning one precision at the source instead, so future comparisons stay safely lexicographic.
