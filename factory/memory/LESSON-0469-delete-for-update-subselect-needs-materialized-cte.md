---
id: LESSON-0469
type: gotcha
domain: database
tags: [postgres, delete, for-update, cte, materialized, query-planner]
context: a bounded/limited DELETE that selects its target rows via a `FOR UPDATE` subselect (e.g. "delete at most N matching rows, locking them first")
trigger: use this when writing a DELETE statement whose target row set comes from a `FOR UPDATE`-locked subquery or CTE meant to pin an exact, bounded set of IDs
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — real Postgres reproduction"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a limited DELETE joined to a `FOR UPDATE` subselect was meant to delete only the exact
set of IDs that subselect locked. On real Postgres, this reproduced removing MORE than 25 rows beyond
the intended bound — the planner re-evaluated the inlined subquery rather than treating its locked
result as a fixed, materialized set. Forcing the subquery into a `MATERIALIZED` CTE fixed it; an
independent boundary oracle (checking the actual deleted-row count against the intended limit) caught
the original overcount.

**Lesson:** Postgres is free to inline/re-evaluate a plain subselect or a non-materialized CTE when
planning a query, even one wrapped in `FOR UPDATE` — the lock does not pin the ROW SET as a frozen
input to the outer DELETE unless the planner is forced to treat it as one. A DELETE that assumes "the
subselect's locked rows are exactly what gets deleted" can silently delete a different, larger set.

**Apply next time:** when a bounded/limited DELETE (or UPDATE) depends on an exact row set produced by
a `FOR UPDATE` subquery, force it into a `MATERIALIZED` CTE so the planner treats it as a fixed input,
and keep an independent test oracle that asserts the exact deleted-row count against the intended
bound (not just "no error") — a limited-mutation query with an implicit row-set assumption needs that
assumption verified on the real database, not just reasoned about.
