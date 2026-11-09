---
id: LESSON-0637
type: problem-solution
domain: testing
tags: [determinism, snapshot-comparison, sql, order-by, false-positive]
context: a test/guard that compares two snapshots of the same logical rows (e.g. a "coverage changed" check comparing a Neon copy against a native copy) row-by-row in array order
trigger: use this when a snapshot/coverage-equality check reports a mismatch between two sources that should contain the same rows, and the comparison walks the two result arrays in parallel order
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07 (agent-inferred): assertPreservedCoverage compared coverage_cell rows in order, but the catalog snapshot SELECTs had no ORDER BY, so a Neon copy and a native copy returned the SAME rows in a DIFFERENT order, producing a false 'Targeted coverage changed'; fixed by sorting the canonical rows before comparing"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0636, LESSON-0656]
---

**Situation:** a guard asserting "the set of coverage rows is unchanged between snapshot A and snapshot
B" compared the two result arrays element-by-element in the order the database returned them. Both
underlying `SELECT`s lacked an `ORDER BY`, so Postgres (or a different backend, e.g. Neon vs a native
copy) was free to return the identical row SET in a different sequence — the guard then diffed row N of
A against row N of B, found them different, and reported a false "coverage changed" even though the
actual row content was identical.

**Lesson:** any unordered `SELECT` is only guaranteed to return the same ROWS, never the same ORDER —
even against the exact same data, a different backend/connection/replica is free to reorder. A
comparison that assumes array-index correspondence between two independently-fetched result sets is
implicitly assuming an ordering guarantee that SQL without `ORDER BY` never makes.

**Apply next time:** before comparing two query results element-by-element, either add an explicit,
deterministic `ORDER BY` to both queries, or sort both result arrays by a stable key immediately after
fetching and before comparing. When a snapshot-equality check reports a spurious mismatch between two
sources that should be identical, check first whether the underlying query is unordered — this is a
cheaper, more likely root cause than assuming the data itself actually diverged. Audit sibling snapshot
comparisons in the same codebase for the same gap, since one unordered query usually isn't the only one.
