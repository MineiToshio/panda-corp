---
id: LESSON-0459
type: gotcha
domain: testing
tags: [webserver, readiness, port-collision, process-ownership, nextjs, false-green]
context: a browser or fidelity harness launches its own app server and polls a loopback health endpoint
trigger: use this when a gate's startup check sees a healthy port but the process it spawned may have failed
source: "funko-tracker commit 203f1ec3252e58f7568160ce7728a9073a425f92, scripts/fidelity/server.mjs and scripts/fidelity/_tests/server.test.ts; reviewer collision probe 2026-10-20"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040]
---

**Situation:** a fidelity launcher polled `/api/health` on its configured loopback port and treated
any 2xx response as startup success. A reviewer ran an unrelated healthy server on that port while
the launcher’s own `pnpm next start` child exited with code 1. The old check still returned ready.
The repaired launcher rejects a bound port before spawn, observes its own child exit, waits for the
installed Next server's post-listen ready marker, then checks health; negative and positive cases are
covered in the linked commit.

**Lesson:** endpoint health proves only that *some* process answered. For a gate that promises an
isolated server, it cannot establish ownership or that its own launch succeeded. A false-green
readiness check can make every downstream browser result refer to the wrong app.

**Apply next time:** reserve or reject an occupied port before launch, couple readiness to the
spawned child's documented post-listen signal and exit lifecycle, then probe health. Stop only the
owned process group. A public health response without the owned startup signal must stay red.
