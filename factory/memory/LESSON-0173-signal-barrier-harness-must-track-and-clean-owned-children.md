---
id: LESSON-0173
type: pattern
domain: agent-orchestration
tags: [process-management, signals, sigint, sigterm, crash-evidence, r10]
context: a harness/runner pauses an executor at a signal barrier (waiting on a child process, a supervised subprocess, or a foreground block) and can itself be interrupted
trigger: use this when writing a runner/harness that spawns and waits on child processes and must remain safe to interrupt (Ctrl-C, timeout, owner cancel)
source: "panda-corp R10/R11 installed-runtime certification mission, 2026-07-14 inbox note (agent-inferred)"
provenance: agent-inferred
created: 2026-07-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0154, LESSON-0155, LESSON-0187]
---

**Situation:** a certification harness paused an executor at a signal barrier (blocking in the foreground
waiting on a spawned child/supervised process). If the harness itself was interrupted (SIGINT/SIGTERM/
SIGHUP, or normal exit) without having registered cleanup for its own children, those children could be
left running orphaned, or — the opposite failure — a naive cleanup-on-exit could kill state that was the
only surviving evidence of what the run was doing when it was interrupted.

**Lesson:** a harness that spawns and waits on child processes owns their lifecycle for as long as it
runs, including the abnormal-exit paths. This is a sibling of two existing findings: LESSON-0154 (a
detached child can be reaped when its launching exec ends, even with `nohup`) and LESSON-0155 (a
crash-residue run-state path is evidence, not disposable, and must be preserved rather than force-cleaned).
The missing piece here is symmetric to both: the harness must explicitly install signal handlers
(SIGINT/SIGTERM/SIGHUP) and an exit hook that clean up ONLY the processes/fixtures it itself owns (by
tracked PID, never a broad pattern-match), and — before terminating anything — preserve whatever evidence
the interrupted run had produced, the same "registered+clean → safe to reuse; anything else → preserve"
test LESSON-0155 already applies to run-state directories.

**Apply next time:** when a runner/harness blocks waiting on a spawned child (a signal barrier, a
supervised subprocess, a foreground gate), register signal handlers for SIGINT/SIGTERM/SIGHUP and a
normal-exit hook that (1) preserve any evidence the interrupted run has produced so far, then (2) terminate
only the exact owned PID(s)/fixture(s) it tracked itself — never a broad process-group kill or a blind
"clean the run directory" step that could also destroy an unrelated or still-useful process/artifact.
