---
id: LESSON-0565
type: pattern
domain: build-orchestration
tags: [supervisor, monitor, parked-chain, claude-fallback, liveness]
context: a long-running build's supervisor loop decides whether the run is healthy/progressing by watching for work-order status changes
trigger: "use this when designing or debugging a build supervisor's liveness/progress check — before trusting a lack of WO status changes as proof nothing is happening, or as the only signal worth watching"
source: "mission-control .pandacorp/run/lessons.md 2026-10-30/31 (agent-inferred) — a build run parked everything (every in-flight chain stalled) with no work-order status change at all; only landed-commit activity, parked-chain state and Claude-fallback events (not status transitions) would have surfaced it"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0131, BL-0135, BL-0294]
---

**Situation:** a build's supervision loop watched for work-order `implementation_status` transitions as
its signal that the run was alive and progressing. A run occurred where every in-flight chain parked
(stalled) at once, but because none of the parked work orders had their own status field change, the
status-transition signal stayed silent — the stall was invisible to anyone watching only that one field.
The actual evidence of trouble lived elsewhere: landed-commit activity went flat, several chains sat in a
parked state, and the run had fallen back to a different executing agent (a "Claude fallback") without a
status-field change recording any of it.

**Lesson:** a work order's own status field is a necessary but not sufficient liveness signal for a
multi-chain build supervisor. A run can go fully silent on that one axis while still being observably
unhealthy on others (landed-commit cadence, the count of chains sitting parked, and whether execution has
silently fallen back to a different agent/runtime than the one that started the step). Watching a single
derived field and treating its silence as "nothing to report" misses exactly the failure mode where
everything stalls at once.

**Apply next time:** a build supervisor's health/progress check should combine at least three independent
signals, not just WO status: (1) landed-commit cadence (is real progress landing, not just status fields
moving), (2) the count/age of chains sitting in a parked state (a rising or stuck-nonzero count is itself
a signal, regardless of any status field), and (3) whether execution has fallen back from the expected
runtime/agent to another one (a distinct event, not inferred from status). Treat "no WO status change" as
ambiguous, never as proof of health, when any of the other two signals could instead explain the silence.
