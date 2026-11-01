---
id: LESSON-0587
type: gotcha
domain: testing
tags: [test-skip, parametrized-tests, enumerate-from-source, scope-estimation]
context: deciding to reactivate a single skipped test/suite entry without first checking how many actual cases that one skip represents
trigger: use this when planning to re-enable a `test.skip`/disabled suite and estimating the resulting work from "it's one skip" rather than from what that skip actually covers
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred) — reactivating what looked like a single skipped entry surfaced 28 distinct cases that needed attention, because the skip covered a parametrized/data-driven suite rather than one isolated test"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0491, LESSON-0492]
---

**Situation:** a single `skip` entry in a test file looked like one unit of deferred work. Reactivating
it exposed 28 separate failing/needing-fix cases, because the skip wrapped a parametrized suite (one
`describe`/`it.each` block generating many cases from a data table), not a single test — the skip's
surface area had been silently multiplying every time a new parameter/fixture was added to that suite
while it stayed disabled.

**Lesson:** the COUNT of skip annotations in a codebase is not the count of deferred work units — a
single skip around a parametrized or table-driven suite can represent an arbitrarily large and growing
number of actual cases, invisible until it's turned back on. Scoping "how much work is this skip" from
its visible annotation count underestimates data-driven suites specifically, and the gap grows the longer
the skip sits disabled (every new row added to the table silently inherits the skip).

**Apply next time:** before reactivating ANY skipped test, first enumerate what it actually covers — run
it in isolation with the skip removed (or inspect its data table/parameter list) to get the real case
count, before estimating effort or committing to a reactivation plan. Treat a skip around a
parametrized/data-driven block as a standing liability that should be sized periodically, not just
counted as "1" until the day it's turned back on.
