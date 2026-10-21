---
id: LESSON-0458
type: gotcha
domain: testing
tags: [mutation-testing, stryker, timeout, mutant-identity, score]
context: interpreting mutation-test timeouts or reprobing a timed-out subset under machine contention
trigger: use this when a mutation report includes timeouts and a later focused run appears to kill the same mutants
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21; /private/tmp/funko-erasure-mutation-join.json and /private/tmp/funko-export-admission-mutation-full.json (source hash and exact-mutant re-probe receipt)"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0480]
---

**Situation:** a Stryker run reported 28 timed-out mutants alongside 149 killed mutants. A focused
re-run selected source lines, but most resulting mutants were *different identities* from those in the
original timeout set. The receipt matched source hash, mutator name, location, and replacement; only
5 of the 28 original timeouts were actually re-probed and killed. A separate bounded 30-second
re-probe of 16 timeouts produced 9 killed and 7 survived.

**Lesson:** a timeout does not establish that a test detected the mutation, and a later green result
on the same line does not establish that the original timed-out mutant died. Line-based selection can
silently change the denominator and overstate the mutation score.

**Apply next time:** retain the original mutant set and source hash, match each re-probe by exact
mutant identity (mutator, location, replacement), and count unresolved timeouts as unverified. Report
the conservative score against the original denominator; investigate machine contention separately
from actual test sensitivity.
