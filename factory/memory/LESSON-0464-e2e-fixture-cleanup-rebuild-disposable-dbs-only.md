---
id: LESSON-0464
type: gotcha
domain: testing
tags: [e2e, fixtures, postgres, test-hygiene, shared-machine, dirty-data]
context: an e2e test suite's database fixture may carry leftover data from a prior failed/aborted run, especially on a shared or multi-tenant Postgres cluster
trigger: use this when an e2e gate run fails or is interrupted mid-way and a rerun must decide whether to trust the existing fixture database
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — ft_gate fixture database"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0463, LESSON-0438, LESSON-0480]
---

**Situation:** a failed cleanup step in an e2e run left stale "goals" data behind in the `ft_gate`
fixture database. Re-running the gate without recreating that fixture produced a SECOND, different
failure — an empty-state assertion at the start of the run that expected a clean slate.

**Lesson:** a database fixture is not self-healing across runs. A prior run's incomplete cleanup
leaves state that the NEXT run's own assumptions (e.g. "the catalog starts empty") can silently
violate, producing a failure that looks like a new regression but is actually stale data from a
previous attempt. On a cluster that might be shared with other projects/users, this must be fixed
without touching anything outside this project's own disposable fixtures.

**Apply next time:** before trusting a rerun after any aborted/failed e2e run, verify the fixture
cluster's own connections/state belong to this project, and rebuild ONLY the disposable fixture
database(s) this project owns (never a shared cluster-wide reset, and never any database/service
belonging to another user or project — e.g. never touch a hosted Neon instance or another project's
database as a shortcut) before running the suite again.
