---
id: LESSON-0676
type: gotcha
domain: factory-engineering
tags: [build-engine, admission, dr-156, build-9, memory-pressure, swap, concurrency]
context: a concurrency-admission heuristic that gates on an OS-reported absolute memory-pressure level, rather than a delta/trend, can read as already-elevated at pure idle on a modest-RAM machine
trigger: use this when tuning, trusting, or debugging an admission/concurrency decision that reads an absolute OS memory-pressure LEVEL (not a swap-growth delta) as one of its signals
source: "mission-control .pandacorp/run/lessons.md 2026-11-11 (agent-inferred): on a MacBook Pro M5 16GB with only ordinary desktop apps open, `sysctl vm.memory_pressure`-class signals already read level 2 (warn) and swap usage was already ~7.2 GiB before launching any build agent"
provenance: agent-inferred
created: 2026-11-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-156]
---

**Situation:** before launching any build agent, a plain idle check of the host's memory signals
(`vm_stat`/`sysctl vm.swapusage`-class reads) already showed an elevated OS pressure level and several
gigabytes of swap in use, purely from ordinary desktop applications — not from any factory workload.

**Lesson:** DR-156/BUILD-9's admission ladder already prefers trend signals (sustained swapout growth, a
512 MB swap-growth threshold, a calm-readings cooldown) over a bare absolute reading for STEPPING DOWN —
but it also treats a "critical" absolute pressure level as an independent, immediate floor. On a modest-RAM
machine that normally idles at an elevated pressure level with ordinary apps open, an absolute-level check
can misread a machine's permanent baseline as active contention, under-provisioning concurrency even when
nothing the build is doing is actually causing pressure. Before trusting an absolute memory-pressure level
as evidence of contention, know what that same machine reads at pure idle.

**Apply next time:** when admission behaves more conservatively than expected (or when auditing/tuning
BUILD-9's signal thresholds), first measure the host's true idle baseline (`vm_stat`, `sysctl
vm.swapusage`, `sysctl vm.memory_pressure` or the equivalent, with no agents running) before concluding an
absolute-level reading proves the build itself is the source of the pressure. The specific measured
baseline for the owner's own machine belongs in `factory/profile.md` (DR-156: machine facts are personal
data, never committed policy), not in this lesson.
