---
id: LESSON-0009
type: gotcha
domain: javascript
tags: [timestamps, iso8601, date-parse, timezone, gotcha]
context: comparing ISO 8601 timestamp strings to find the most-recent one, in a reader/selector over event or status data
trigger: use this when selecting the most-recent ISO 8601 timestamp among strings that may come from more than one producer or offset
source: mission-control lessons.md — WO-12-001 freshness.ts (2026-06-16)
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

**Lesson:** Reserve raw-string lexicographic comparison for the common case where every producer stamps
`Z` (UTC) consistently — it is a valid and cheap max-at selector then, and keeping the raw string (instead
of `Date.parse`-ing it) avoids `NaN`-corruption risk entirely for the *storage*/*display* path. But the
moment more than one timestamp source/offset can appear in the same comparison, lexicographic order is
unsafe — compare via `Date.parse(at)` and keep the raw string only for display.

**Apply next time:** Before writing a "pick the latest timestamp" selector, confirm every producer in
scope stamps the same offset (grep the emitters). If not guaranteed, always compare via `Date.parse`, never
raw string `>`.
