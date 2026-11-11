---
id: LESSON-0666
type: gotcha
domain: testing
tags: [vitest, per-worker-database, orphaned-resource, timeout, test-isolation]
context: a per-worker test-database-clone scheme (one disposable DB copy per vitest worker slot, recreated at the start of a run) running after a PRIOR run may have left a worker's DB uncleaned
trigger: use this when a per-worker test-database-clone scheme can be re-run after a previous run may have timed out or been killed mid-flight
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-10/11 (agent-inferred): a vitest timeout left a worker's *_snap/_dev/_prod test databases held open by the still-lingering process body from a prior run; the next run's attempt to recreate that same worker-slot database collided with an 'already exists' error. Fixed: destination-copy creation is now serialized per worker slot."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0438, LESSON-0546]
---

**Situation:** a vitest suite clones a dedicated database per worker slot at the start of each run for
isolation. A prior run timed out, but its process body (and its hold on that worker-slot's database) kept
running past the timeout. The next run's attempt to recreate the SAME worker-slot database raced against
the still-lingering prior process and failed with "already exists" — a collision that looks like test
flakiness but is actually two runs' worth of the same resource overlapping in time.

**Lesson:** a per-worker resource scheme (DB clone, temp directory, port) assumes exactly one owner per
slot at a time, but a timeout or kill signal does not guarantee the PREVIOUS owner actually released its
hold before the new run starts — "the run ended" (from the orchestrator's point of view) and "the
resource is free" (from the OS/database's point of view) are different facts, and a timed-out process
can keep a lock/connection open well past when the next run assumes the slot is clear.

**Apply next time:** when recreating a per-worker-slot disposable resource at the start of a run,
serialize (don't assume-free) the create/recreate step per slot — detect a still-held resource from a
prior run explicitly (an open connection, a lock file, a liveness probe) and wait for or reclaim it
before recreating, rather than racing a bare "drop and recreate" against whatever the previous run's
process is still doing.
