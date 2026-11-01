---
id: LESSON-0596
type: anti-pattern
domain: data-modeling
tags: [redundant-state, derived-data, membership, invariant]
context: a record's membership in a set/category (e.g. "is this item part of collection X") is tracked by its own boolean flag instead of being derived from the row that already defines the relationship
trigger: use this when a schema or query is about to add (or already has) a boolean flag that restates a fact already determinable from an existing row/relationship
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-31/11-01 (agent-inferred) — an `inUniverse`-style flag falsified n-of-m membership counts; a review removed it in favor of deriving membership from the existing row"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a boolean membership flag (e.g. "is this item in universe X") was stored alongside the
data instead of being computed from the row that already establishes the relationship. The flag drifted
out of sync with that row, producing wrong n-of-m counts (e.g. "12 of 15 collected" when the real count,
derived from the underlying relationship, was different).

**Lesson:** a redundant boolean that restates a fact already derivable from existing data is a second
source of truth with no mechanism keeping it in sync — it WILL desync the moment the underlying
relationship changes without someone remembering to also flip the flag, and the resulting bug (a wrong
count, a wrong filter) is silent until someone cross-checks the numbers.

**Apply next time:** before adding a membership/category boolean, check whether it is already derivable
from an existing row or relationship (a foreign key, a join, a computed predicate). If it is, derive it at
read time (a query/view/selector) instead of storing it — eliminate the second source of truth rather than
trying to keep two representations in sync.
