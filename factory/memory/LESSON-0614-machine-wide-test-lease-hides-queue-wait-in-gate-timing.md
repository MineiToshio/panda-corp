---
id: LESSON-0614
type: gotcha
domain: testing
tags: [concurrency, test-lease, gate-timing, worktrees, measurement]
context: a project's own test harness serializes ALL vitest/playwright runs across every worktree on the machine via a machine-wide lease (e.g. a lockfile under a shared temp directory), and gate/verify timings are being measured or compared
trigger: use this when measuring or comparing a gate/verify.sh wall-clock time on a project whose test harness holds a machine-wide (not per-worktree) test lease
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): scripts/test/gateLease.mjs serializes ALL vitest+playwright runs across every worktree (machine-wide lease in /private/tmp); queue wait is invisible in gate-report timings, so wall-clock of verify.sh includes other sessions' runs"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0480]
---

**Situation:** a project's own test infrastructure uses a machine-wide lease (held in a shared temp
location, not scoped per worktree) to serialize test runs across every concurrent session/worktree on the
machine, so two gates running at once don't fight over shared resources (a port, a DB). The gate's own
timing report shows only the time its OWN test run took, not any time spent WAITING for the lease.

**Lesson:** this is the same shared-resource-contention class as LESSON-0480 (attribute a flaky/slow run
to contention before trusting it as a real regression), sharpened for a specific invisible mechanism: a
machine-wide test lease makes queue wait silently part of the measured wall-clock, with no signal in the
gate's own report that any waiting happened at all. Comparing two gate runs' wall-clock times (e.g. before
vs. after an optimization) is unreliable if one of them queued behind another session's run and the other
didn't — the difference may be pure queue-wait noise, not the change being measured.

**Apply next time:** before trusting or comparing a gate/verify.sh wall-clock measurement on a project with
a machine-wide test lease, check whether another session/worktree held the lease during the run (the lease
holder/queue state, if the lease mechanism logs it) — a measurement taken while contended is not comparable
to one taken uncontended.
