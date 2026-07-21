---
id: LESSON-0180
type: gotcha
domain: factory-engineering
tags: [staleness-check, two-phase-write, timestamp-comparison, orphan-detection]
context: a check that compares "when X was stamped" against "when the commit/artifact recording X landed"
trigger: use this when designing or reviewing a staleness/orphan check that compares a stamped timestamp against the timestamp of the commit/artifact that records it
source: "panda-corp factory/memory/_inbox.md 2026-07-20 (pandacorp-memory-review PASO 0 orphan-of-harvest check) — mission-control's last_harvest (17:28:47Z) was stamped ~18min BEFORE the commit that recorded that same sweep (b2815518, 17:46:52Z) landed"
provenance: agent-inferred
created: 2026-07-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0115, BL-0086]
---

**Situation:** PASO 0's orphan-of-harvest check compares a project's last commit timestamp against its
stamped `last_harvest` timestamp. A just-completed sweep stamped `last_harvest`, then committed the stamp
plus the sweep's report ~18 minutes later — a naive "commit postdates last_harvest => orphaned"
comparison near-missed false-flagging a project that was JUST harvested, within the same sweep.

**Lesson:** any staleness/orphan check built around a two-phase write (write a timestamp stamp, THEN
commit the artifact that records it) must not treat "commit lands after the stamp" as evidence of
staleness — that ordering is guaranteed by construction on every SAME-operation write, not just a
genuinely stale one. The check needs either a tolerance window sized to the operation's own worst-case
duration, or to compare against the START of the write rather than raw stamp-vs-commit ordering. Sibling
of LESSON-0115 (liveness TTL vs writer cadence): a different concrete mechanism (a one-shot two-phase
commit vs a periodic heartbeat), same root class — the check's own clock model doesn't match how the
thing it's checking actually writes.

**Apply next time:** when a staleness/orphan/freshness check compares two timestamps produced by the SAME
multi-step operation, measure their expected lag empirically (how long between the stamp and its
enclosing commit, worst case) and build in a tolerance for it, rather than trusting raw chronological
ordering (see BL-0086, which applies this to this specific routine's check).
