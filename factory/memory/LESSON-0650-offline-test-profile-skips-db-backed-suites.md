---
id: LESSON-0650
type: anti-pattern
domain: testing
tags: [test-selection, offline-config, database, ci, coverage-gap]
context: a test-run profile/configuration built to run "offline" (no external services/database dependency) for speed, used as the default or primary signal before landing a change
trigger: use this when relying on an offline-config test run as evidence a change is safe to merge, and that change touches a shared contract that DB-backed suites also exercise
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): offline-config test runs miss DB-backed suites (ingestPublication/Quick*/seriesCorrection); a review change that tightens a shared contract must run those suites against native Postgres before the merge queue, not just the offline profile"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0431]
---

**Situation:** a change tightened a shared contract (used across several ingestion/review flows). The
team's "offline" test-run profile — the fast, DB-independent default used as the primary pre-merge signal
— passed cleanly, but that profile structurally excludes every DB-backed suite (`ingestPublication`,
`Quick*`, `seriesCorrection`), so it never exercised the contract change against real database behavior at
all. The gap was only caught by deliberately running those suites against a native Postgres before
landing.

**Lesson:** an "offline" test profile is a coverage SUBSET by design, not a cheaper equivalent of the full
suite — any change to a contract that DB-backed suites depend on can pass the offline profile 100% clean
while still breaking every excluded suite, because the offline profile never touches that code path at
all. Treating "offline profile green" as "safe to merge" silently assumes the change doesn't affect
anything the offline profile excludes, which is exactly the assumption a shared-contract change violates.

**Apply next time:** before landing a change that touches a shared contract/data-layer behavior, identify
which test suites are DB-backed and excluded from the fast/offline profile, and run those explicitly
against a real (native, not mocked) Postgres as a required gate — don't let a fast offline-profile green
substitute for that check just because it's the default signal.
