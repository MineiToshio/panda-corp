---
id: LESSON-0419
type: anti-pattern
domain: build-orchestration
tags: [dependency-scheduling, deadlock, dag, granularity, fast-lane, stop-reason]
context: a dependency-wait rule for "the dependent waits for the floor unit's VERIFIED" applied at a coarser grain (feature/FRD) than the true task-level DAG (work-order), inside a scheduler that can defer work indefinitely
trigger: use this when designing or debugging a dependency-wait/scheduling rule applied at a coarser grain (e.g. feature/FRD level) than the true task-level DAG (e.g. work-order level) it is derived from, OR when a scheduler/loop can decide to defer ALL remaining work without making progress
source: "panda-corp build engine — funko-tracker run_20261018T033601Z_80858 (fast lane, lanes K=2, plugin 9.131.0); BL-0251/DR-132: build-mech-lanes.mjs planChains, pandacorp-build.src.js fastIdle/fastDeadlockCheck"
provenance: agent-inferred
created: 2026-10-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0251, DR-132]
---

**Situation:** the build engine's "a dependent waits for the floor FRD's VERIFIED" rule was correct at the
work-order level (the true DAG was acyclic) but was ALSO applied at the FRD level, a coarser projection of
that same DAG. The FRD-level projection introduced a cycle the WO-level DAG didn't have (WO-02-001 needed
FRD-01's floor WO, while another FRD-01 WO needed something from FRD-02/03 to finish) — so the floor FRD
could never finish, never gate, never VERIFY, and every FRD deferred forever. The run ended with
`stopReason: null`: nothing failed loudly, nothing advanced, and a relaunch would defer identically.

**Lesson:** collapsing a fine-grained acyclic DAG into a coarser-grained projection (tasks → features,
work orders → FRDs, commits → PRs) does not preserve acyclicity for free — a wait rule that is deadlock-free
at the fine grain can still deadlock at the coarse grain, because the projection can create a cycle the
original graph never had. Separately: a scheduler that can legitimately decide "nothing is ready, defer
everything" needs its own circuit breaker — silently returning with no explicit terminal signal is
indistinguishable from "still working" and will repeat the exact same deadlock on every relaunch.

**Apply next time:** when a dependency-wait rule is defined at one grain but a scheduler also enforces it
(directly or implicitly) at a coarser grain derived from the same graph, either (a) schedule/wait strictly
at the finer grain and only report state at the coarser grain, or (b) explicitly waive the coarse-grain wait
for whichever unit the floor itself transitively needs in order to finish. And unconditionally: any loop
that can defer ALL remaining work without advancing anything must detect that condition and stop with an
explicit, named reason (e.g. `stopReason: 'deadlock'`, the cycle named) — never a null/silent return that
looks identical to ordinary in-progress deferral.
