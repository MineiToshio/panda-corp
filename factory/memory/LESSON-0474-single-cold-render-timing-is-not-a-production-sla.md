---
id: LESSON-0474
type: gotcha
domain: performance
tags: [benchmarking, variance, sla, cold-start, rendering]
context: measuring a single (or small number of) cold end-to-end render/processing run and using that number to communicate a production performance promise
trigger: use this when a benchmark of a cold or resource-heavy operation has only been run once or twice and the result is about to be stated as a production expectation
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — real200-acceptance/benchmark-200{,-final}.json"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** two cold, integrated renders of the SAME 200 official resources, run back to back,
took 173.549s and 323.255s respectively from creation to READY — nearly a 2x difference between two
runs of identical work. A single local proof-of-concept timing had been on the verge of being quoted
as a production expectation.

**Lesson:** a cold/resource-heavy operation's run-to-run variance can be large enough (here, close to
2x) that a SINGLE measurement — even a real, non-mocked one — is not representative. Converting one
timing into a stated production promise risks being wrong by a wide margin in either direction, and a
stakeholder who hears "173 seconds" will hold the system to that number even though the very next run
took nearly double.

**Apply next time:** before stating a performance expectation to the owner or in a durable doc, run
the benchmark enough times (or under enough varied conditions) to see its actual spread, and report a
range (or a conservative upper bound) rather than a single POC number. Keep the raw receipts so the
range's basis is auditable later.
