---
id: LESSON-0187
type: pattern
domain: agent-orchestration
tags: [process-management, unattended, r10, r11, synthesis, crash-recovery]
context: building or reviewing a harness/launcher/engine that runs or supervises a process unattended (background, overnight, or across a session/conversation restore)
trigger: use this when designing, reviewing, or debugging any unattended/background execution harness (a launcher, a supervisor, a signal-barrier runner, a run-state reuse/cleanup step) — before trusting that a lifecycle primitive (session restore, nohup, a reusable path, a wait-on-child) does what it appears to
source: "synthesis over 4 evidence-anchored candidates, panda-corp R10/R11 unattended-certification work, 2026-07-11..07-16 (LESSON-0173 already names LESSON-0154 and LESSON-0155 as siblings in its own body): LESSON-0153 (a restored session/conversation proves context continuity, not provider quota/rate-limit availability — must probe the real provider before trusting a resume can keep working), LESSON-0154 (`nohup` alone does not guarantee a detached child survives past a short-lived/ephemeral launching exec — must verify PIDs are alive after the exec returns), LESSON-0155 (a reused run-state path may be the only surviving evidence of a crashed prior run — safe to reuse only if registered AND clean, never force-cleaned by default), LESSON-0173 (a harness blocking on a signal barrier must install its own signal handlers and preserve evidence before killing only its own tracked PIDs, never a broad pattern-match) — librarian reflection pass, 2026-08-03"
provenance: agent-inferred
created: 2026-08-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0153, LESSON-0154, LESSON-0155, LESSON-0173]
---

**Situation:** across the R10/R11 unattended-runtime certification work, four independent primitives that
LOOK like they guarantee something about process/session lifecycle each turned out to guarantee less than
assumed: a restored session (LESSON-0153), a `nohup`-detached child (LESSON-0154), a reusable run-state
directory (LESSON-0155), and a harness blocking on a spawned child (LESSON-0173). Each gap was found the
hard way, during real overnight/unattended certification runs, not by reading documentation — because in
each case the primitive's NAME promises more than its actual runtime behavior delivers under every
execution vehicle.

**Lesson:** no single OS/runtime primitive used to build unattended execution is safe to trust at face
value — each dimension (quota/availability, process survival, state reuse safety, interrupt handling) must
be verified empirically and independently, because they fail independently too. A session/token restore
proves CONTEXT continuity, not QUOTA availability (LESSON-0153). `nohup` protects from terminal hangup,
not from being reaped when an ephemeral launching exec's session ends (LESSON-0154). A run-state path
being "usually disposable" does not make it safe to force-clean — it may be the only evidence of a crash
(LESSON-0155). And a harness that blocks waiting on a child owns that child's cleanup through every
abnormal-exit path, which requires explicit signal handlers, not an assumption that the process tree will
clean itself up (LESSON-0173). The common failure shape is the same across all four: treating an
apparent guarantee as automatic instead of testing it under the actual execution vehicle in use.

**Apply next time:** when building or reviewing any unattended/background execution harness, verify each
of these four independently rather than assuming any one covers the others: (1) after a session/context
restore, probe the real provider with a cheap call before trusting it can keep working (LESSON-0153); (2)
after launching a detached child meant to outlive its exec, verify empirically (a follow-up PID check)
that it actually survived, don't trust `nohup` alone (LESSON-0154); (3) before reusing or cleaning any
run-state path, apply the "registered AND clean → reuse; anything else → preserve" test rather than a
blanket "it's ephemeral, just clean it" step (LESSON-0155); (4) when a harness blocks on a spawned child,
install SIGINT/SIGTERM/SIGHUP handlers plus a normal-exit hook that preserves evidence first and kills
only its own tracked PIDs (LESSON-0173).
