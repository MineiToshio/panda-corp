---
id: LESSON-0480
type: pattern
domain: ci-infra
tags: [shared-machine, resource-contention, false-regression, root-cause-attribution, reflection]
context: a gate, test suite, or mutation run fails in a way that reads like a code regression, but the actual cause is a shared/contended machine resource (a daemon neither process owns, local disk, a local database's connection pool, or an ambiguous mutant re-probe identity) rather than the code under test
trigger: use this when any automated gate/test/mutation run fails or looks flaky on a machine that is ALSO running other heavy or concurrent jobs (parallel worktrees, another user's processes, several verify lanes at once) — attribute to contention explicitly before trusting the failure as a real defect
source: "reflection synthesis (librarian review, 2026-10-21) of LESSON-0040 (mission-control/personal-page-v2/panda-corp, shared webServer port collision), LESSON-0438 (funko-tracker, parallel DB-backed vitest suites contend one local Postgres), LESSON-0458 (funko-tracker, mutation-test timeout re-probe needs exact mutant identity), LESSON-0463 (funko-tracker, owner-stated — a shared machine's daemon is not exclusively this project's), LESSON-0464 (funko-tracker, e2e fixture dirty data on a shared Postgres cluster), LESSON-0479 (funko-tracker, ENOSPC from a concurrent mutation-test sandbox) — 4 distinct projects across the 6 folded lessons. Corroborated again 2026-10-23 (mission-control `.pandacorp/run/lessons.md`, agent-inferred, 2 notes): a FULL `verify.sh` run under machine load produced BOTH `e2e/persistent-navigation.spec.ts` (desktop+mobile) and `logical-data-model.spec.ts` timeouts, AND 6 `DataModelViewer/_tests/viewer.reviewer.test.tsx` unit-test `findByRole` timeouts (setup alone took 323s) — every one of these passed 4/4 (e2e) or 58/58 (unit) when re-run isolated, the exact 'looks like a regression, re-run isolated to confirm contention' shape this lesson already prescribes, now on a SIXTH resource type (CPU/wall-clock scheduling contention from a large parallel multi-suite `verify.sh` run itself, not a separate daemon/port/DB/disk another job owns)."
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040, LESSON-0438, LESSON-0458, LESSON-0463, LESSON-0464, LESSON-0479]
---

**Situation:** six independently-harvested lessons, across four distinct projects (mission-control,
personal-page-v2, panda-corp, funko-tracker) and spanning five distinct resource types (a dev-server
port, a local Postgres connection pool, a Docker/system daemon, an e2e fixture database, and disk
space), all show the SAME shape: a gate/test/mutation run produces a failure that reads exactly like a
code regression, but the real cause is this machine's OWN finite or shared resource being contended by
more than one job at once (parallel worktrees, another user, several verify lanes, a concurrent heavy
job like mutation testing). Re-corroborated on mission-control (2026-10-23) with a SIXTH resource type:
no separate daemon/port/DB at all — a single large parallel `verify.sh` run (desktop+mobile e2e plus
hundreds of unit files) exhausted its own wall-clock/CPU budget under machine load, timing out tests
that pass 100% when re-run isolated. The mechanism generalizes past "another job's resource" to "this
very gate's own parallel fan-out, on a loaded machine, can starve itself."

**Lesson:** "looks like a regression" and "is a regression" are different claims whenever more than one
job can run on the same machine. The failure shapes recur because the underlying mechanism recurs: a
shared/contended resource (port, daemon, connection pool, fixture database, disk, even a re-probed
mutant's identity) has no inherent per-job isolation unless something explicitly built it — so any two
concurrent consumers can starve, corrupt, or exhaust it for each other and produce symptoms
indistinguishable from an app-code defect (intermittent failure, "flaky" test, timeout, disk-exhaustion
error, wrong starting state). Stacking more autonomous agents/worktrees/gates onto one machine makes
this MORE likely, not less — it is a structural cost of concurrency, not a code-quality signal.

**Apply next time:** before diagnosing a gate/test/mutation failure as a real code regression on a
machine that may be shared or running other concurrent jobs: (1) identify which specific shared
resource is implicated (port, daemon, connection pool, fixture DB, disk, mutant identity); (2) re-run
the SAME check isolated/serialized from other concurrent jobs, or verify the resource's current owner,
before trusting the failure; (3) fix narrowly — reclaim/reset only this job's own resource footprint,
never a shared daemon, another project's data, or another job's in-use cache/sandbox; (4) when
architecting a new dependency on a shared machine (a daemon, a local DB), default to a project-isolated
instance over "the" system-wide one. See the folded lessons for the resource-specific playbooks.
