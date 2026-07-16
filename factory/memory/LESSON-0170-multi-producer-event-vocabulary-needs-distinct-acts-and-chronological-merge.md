---
id: LESSON-0170
type: gotcha
domain: event-vocabulary
tags: [telemetry, event-sourcing, multi-runtime, dedup, ordering]
context: designing or merging a shared event vocabulary consumed by more than one independent producer (e.g. two runtimes each emitting their own log/transport)
trigger: use this when defining canonical event names for a cross-producer telemetry vocabulary, or merging several independent per-source event tails into one capped/bounded view
source: "mission-control — commit 5ee83d4e (R9 dual-runtime event vocabulary + reader); docs/decision-log.md 2026-07-11 \"Runtime-neutral observability without a second event truth\" + its Independent-review addendum"
provenance: agent-inferred
created: 2026-07-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0169]
---

**Situation:** an independent review of Mission Control's new dual-runtime (Claude + Codex) event
vocabulary caught two defects before it shipped: `dispatch_finished` had been aliased to the
result-bearing `agent.done`, and `change_reconciled` aliased to `change.integrated` — two pairs that
look interchangeable but are distinct semantic acts — and the code merging the two runtimes'
independent event tails preserved single-file append order instead of sorting the combined set
chronologically before capping it.

**Lesson:** (1) two events resembling each other are not the same canonical act just because one could
stand in for the other in the common case — alias them and a downstream consumer either double-counts
or silently drops the distinct one; give each its own canonical name even while the *display* vocabulary
stays shared for the UI. (2) file-append order is only a valid proxy for chronological order within ONE
producer's own stream. The moment a second independent producer is merged in, the combined tail needs an
explicit sort by timestamp before any cap is applied, or a burst from a fast producer can evict genuinely
newer events written by a slower one.

**Apply next time:** when adding a second producer to a previously single-source event log/vocabulary,
red-team every "this new event is basically the same as X" aliasing decision during design review, and
audit every place that caps or truncates a merged tail for whether it sorts across sources first (not
just within one).
