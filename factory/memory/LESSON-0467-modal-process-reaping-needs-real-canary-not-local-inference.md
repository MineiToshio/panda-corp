---
id: LESSON-0467
type: gotcha
domain: infra
tags: [modal, process-reaping, signal, pidfd, sandboxed-children, deployment-image]
context: a Modal (serverless compute platform)-hosted supervisor that spawns detached, TERM-ignoring child processes (e.g. a Playwright browser) and must reap them on completion or timeout
trigger: use this when reasoning about child-process reaping/signal behavior for a Modal-deployed supervisor, especially one using Playwright or another detached-child pattern
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — Modal Linux supervisor canary + exact deployment image probe"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0150]
---

**Situation:** two related findings came out of the same investigation into a Modal-hosted
supervisor's child-process reaping. (1) A real Modal Linux canary verified that detached,
TERM-ignoring children ARE reaped correctly on both normal completion and timeout, without killing
an unrelated sibling process — a property that local adapter probes alone (run outside the actual
Modal container) could NOT establish. (2) The EXACT Modal Playwright deployment image's CPython
3.13 build omits the `os`/`signal` module's `pidfd` wrappers, despite the underlying libc and kernel
both supporting them — a gap only visible by checking the actual deployed image, not by inferring
support from the host's libc/kernel capability.

**Lesson:** process-management guarantees (signal reaping, pidfd availability) are properties of the
EXACT runtime image actually deployed, not of the host machine's kernel/libc or of a local
development environment's Python build. Both a positive guarantee (reaping works) and a negative gap
(pidfd wrappers missing) can only be trusted after verifying them against the real deployed
container — local probes and host-capability inference can each give a false answer in either
direction.

**Apply next time:** for any process-management invariant a Modal (or similar sandboxed serverless)
supervisor relies on, run a real canary inside the EXACT deployed image rather than a local adapter
probe. If the deployed Python/OS build lacks a needed primitive (e.g. `pidfd` wrappers), use typed
libc calls through the available binding rather than an unsafe `kill(PID)` fallback that can race a
PID reuse.
