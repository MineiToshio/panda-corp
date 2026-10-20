---
id: LESSON-0438
type: pattern
domain: testing
tags: [postgres, vitest, hook-timeout, local-db, contention, flaky-looking]
context: several DB-backed vitest suites run at once against ONE local Postgres instance (e.g. a Codex worktree's own verify, the orchestrator's review verify, and the Stop hook's verify all firing close together)
trigger: use this when a DB-backed test suite's setup/teardown hook times out (e.g. a 10s hook budget) with every individual test otherwise passing, and more than one verify/gate process may be running concurrently against the same local database
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040]
---

**Situation:** Codex worktrees, the orchestrator's own review verify, and the Stop-hook verify all ran
DB-backed vitest suites against the SAME local Postgres instance around the same time. The result was
intermittent 10-second hook timeouts in setup/teardown, with every individual test passing when it did
run — a failure shape that looks exactly like a flaky/broken test but is actually resource contention
on the shared database connection pool.

**Lesson:** a single local Postgres instance has a finite connection/IO budget; stacking multiple
independent DB-backed test runs against it concurrently (parallel worktrees, a reviewer's own re-verify,
a Stop-hook verify, all DB-backed) can starve setup/teardown hooks without any test logic being wrong.
This is a sibling of LESSON-0040's "rule out a shared resource before trusting mass test failure as a
real regression," specialized to local database contention rather than a dev-server port.

**Apply next time:** when a DB-backed test file times out in setup/teardown while every other test
passes, re-run that file ALONE before treating it as a real defect — a clean pass in isolation confirms
contention, not a regression. When possible, serialize DB-heavy verify runs (don't run several
concurrently against the same local Postgres instance) rather than relying on the connection pool to
absorb unlimited concurrent load.
