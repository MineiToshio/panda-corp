---
id: LESSON-0479
type: gotcha
domain: ci-infra
tags: [enospc, disk-space, next-cache, browser-gate, false-regression]
context: a partial/focused browser gate run fails with a disk-space error (ENOSPC) on a machine also running other heavy jobs (e.g. mutation testing sandboxes)
trigger: use this when a browser/e2e gate fails with ENOSPC or a similar disk-exhaustion symptom, especially while another heavy job (mutation testing, parallel builds) is also running on the same machine
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a partial browser gate exhausted disk space, logging `ENOSPC` — not a functional test
regression. Stopping only this gate's OWN Playwright/dev-server processes and removing only its OWN
inactive `.next` build cache (which Next regenerates on demand) recovered 3.1 GiB, with source and
test files preserved untouched.

**Lesson:** an `ENOSPC` failure from a browser/e2e gate is an infra symptom, not a code regression —
and the safe fix is narrower than it first appears: a regenerable build cache belonging to THIS gate's
own inactive process can be reclaimed without risk, but only after confirming it's this gate's own
cache and that its process has actually stopped (never touch another job's in-use cache or sandbox).

**Apply next time:** on an `ENOSPC` gate failure, stop only the failing gate's own Playwright/dev-server
processes, then remove only its own inactive, regenerable `.next` cache (never source or test files, and
never another job's working cache/sandbox). Maintain a disk floor (e.g. 6 GiB free) before starting a
new batch and keep this gate's own footprint below a quiesce threshold (e.g. 4 GiB) when other heavy
jobs (mutation-test sandbox copies, parallel builds) are running concurrently on the same machine.
