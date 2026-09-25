---
id: LESSON-0259
type: gotcha
domain: build-engine
tags: [maxAgents, cost-weighted-budget, concurrency, wave-scheduling, frd-gate, serial-review, powerful-mode]
context: tuning or interpreting an `/pandacorp:implement` launch's `maxAgents` setting, or diagnosing why a `powerful`-mode build's first wave dispatched far fewer work orders than the number of ready, disjoint WOs available
trigger: use this when setting maxAgents for a powerful-mode build expecting N-way WO concurrency, or when a wave collapses to far fewer WOs than the ready/disjoint count would suggest, or when deciding whether to invest in more build-time WO parallelism to speed up a build
source: "panda-corp — canary D1/D2 (wf_6e88dd68-8e4 / wf_faf48b18-881, mission-control, 2026-09-25, docs/proposals/37 'Canario D', decision-log v9.109.0). D1 (maxAgents:8) collapsed to 1 dispatched WO out of 4 ready/disjoint ones, root-caused to fixed pre-wave overhead (precheck+process-change+plan+foundation-gate, opus-weighted, reaching agentSpawned:11 before the scheduler ever picked a wave) exhausting the budget before any wave-pick, fixed for OBSERVABILITY as BL-0173 (the engine now names the cut reason instead of a generic wave-cap label). D2 (maxAgents:40) achieved genuine concurrency_max:4 real WO parallelism (3 WOs built concurrently, ~5.6min saved) yet still failed its own ≤45min wall-clock bar at 87.5min, because 65.8% of wall-clock (84.9% of cost) was FRD-gate review running in SERIES — a structurally different bottleneck than WO concurrency."
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0173, BL-0135]
---

**Situation:** two live canaries on the same real project isolated two separate facts about the build
engine's cost/time model that both read, at a glance, like the SAME finding ("parallelism isn't working")
but are actually distinct and need distinct fixes. `maxAgents:8` in `powerful` mode looked like a
reasonable ceiling for 4 ready/disjoint work orders, yet only 1 dispatched — not a dependency stall, but the
fixed pre-wave overhead (baseline-precheck, process-change/plan at opus weight ×3 each, safe-point,
foundation-gate at opus weight when the change touches UI artifacts) alone consuming ~8-11 cost-weighted
units before the scheduler ever picked a wave. Separately, even a run with `maxAgents:40` and genuinely
measured 4-way real WO concurrency still took 87.5 minutes against a 45-minute target, because the FRD-gate
review step — which runs once per FRD, in series, regardless of how many WOs built concurrently underneath
it — was 65.8% of the wall clock and 84.9% of the cost.

**Lesson:** `maxAgents` is a TOTAL, cost-weighted budget for the entire run (opus-tier work costs roughly
3x a mech/haiku-tier unit) — not a WO-concurrency dial. A build's fixed pre-wave overhead (precheck, plan,
safe-point, and a conditionally-forced foundation-gate) can consume most or all of a modest `maxAgents`
ceiling before the first wave is even picked, collapsing what looks like a 4-way-ready wave down to 1 WO —
a budget exhaustion, not a dependency or count-cap stall, and indistinguishable from one without reading the
engine's own cut-reason. Separately and more fundamentally: even where real WO-level parallelism is
achieved and measured, it saves relatively little wall-clock/cost on a typical build, because FRD-gate
review is a serial bottleneck sitting AFTER (not alongside) WO construction — raising `maxAgents` or
achieving wider concurrency does not touch that serial phase at all. The two facts compound: a low
`maxAgents` starves concurrency before it can even start, and a high `maxAgents` that does achieve real
concurrency still can't beat a build whose dominant cost is a serial gate.

**Apply next time:** when configuring `maxAgents` for `powerful` mode expecting multi-WO concurrency, budget
for the pre-wave fixed overhead first (~8-11 cost-weighted units, more when the change forces a
foundation-gate) — a ceiling near or below that floor will starve wave 1 regardless of how many WOs are
truly ready and disjoint; read the engine's own cut-reason (`blocked:agent-budget` vs `blocked:wave-cap`)
before assuming a real dependency stall. And do not expect raising `maxAgents`/WO concurrency alone to be
the main lever for build speed: the FRD-gate review phase runs in series per FRD and structurally dominates
both time and cost on a typical build — the real lever for a materially faster build is reducing or
parallelizing gate/review work itself (e.g. cross-FRD gate parallelism), not widening WO-level concurrency
further.
