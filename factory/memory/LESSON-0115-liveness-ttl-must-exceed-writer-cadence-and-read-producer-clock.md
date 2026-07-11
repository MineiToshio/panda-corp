---
id: LESSON-0115
type: pattern
domain: build-engine
tags: [liveness, heartbeat, ttl, supervisor, ndjson]
context: designing a liveness/health check that decides whether a long-running process (a build, a job) is still alive from an event stream or heartbeat file
trigger: use this when adding or tuning a liveness/TTL guard that gates a takeover, restart or "steamroll" action over a possibly-still-healthy long-running process
source: "panda-corp — implement-audit 2026-07-07 (workflowization proposal 31 / implement overhaul), factory/memory/_inbox.md"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a build-engine liveness guard needed to decide whether a running build was dead (and
therefore safe to steamroll/restart) purely from timestamps. A build that was healthy but momentarily
quiet (a long WO with no chatty output) was misread as dead.

**Lesson:** two independent mistakes compound into this false-dead read. (1) The TTL window must be
strictly LONGER than the writer's guaranteed refresh cadence, not merely "seems long enough" — if the
producer only writes every 90s in the worst case, a 60s TTL fires false-deads by construction, not by bad
luck. (2) The guard must read the PRODUCER's clock (the timestamp of the last real event it emitted,
`last_event_at`), not only the WATCHER's clock (`supervisor_heartbeat`, a separate process whose own
liveness is a different question) — conflating the two lets a healthy-but-quiet worker get killed because
an unrelated supervisor process looked stale, or vice versa.

**Apply next time:** when adding a liveness/TTL check, (a) derive the TTL from the writer's documented
worst-case cadence with headroom, never a round-number guess, and (b) make sure the field being compared
against "now" is the one the thing-being-checked itself last wrote, not a proxy from a different process.
