---
id: LESSON-0647
type: anti-pattern
domain: security
tags: [integrity, approval-state, append-only, trust-boundary, run-directory]
context: approval/pin/decision state for a review or ingestion workflow stored as files inside the same run directory the workflow itself reads and writes
trigger: use this when designing (or auditing) where an approval/pin/"this was reviewed and accepted" flag lives for a workflow — before trusting a flag stored inside the same directory tree the workflow's own process can freely read/write/delete
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): approval/pin state stored inside the run directory is forgeable by deleting or restoring files — authenticity must come from an externally anchored append-only history"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0169, LESSON-0190]
---

**Situation:** a review/ingestion pipeline recorded "this item was approved/pinned" as a file inside its
own run directory. Nothing prevents any process with normal filesystem access to that directory (a retry,
a reset script, a different session) from deleting or recreating that file at will — the approval record
has no identity or history independent of the directory it's supposed to be gating.

**Lesson:** this is the same trust-boundary gap LESSON-0169 identified for event-sourced accounting
(a producer's own self-reported state is a claim, not proof) applied to approval state specifically: a
flag that lives inside the SAME filesystem tree the workflow it gates can freely mutate is not actually
an authorization record — it is state that happens to currently say "approved," indistinguishable from
state that was reset, forged, or restored from an old copy. Deleting-and-recreating a file is
indistinguishable, from inside the run directory, from a genuine approval having happened.

**Apply next time:** approval/pin/"reviewed" state that matters for correctness or trust should not live
only as a mutable file inside the run directory it gates — anchor it externally: an append-only log
outside the run's own write scope, a content hash checked against an independent record, or a durable
store the run process cannot unilaterally rewrite (mirroring LESSON-0190's "oracle/external-timestamp over
self-reported log content" pattern). Before trusting an approval flag, ask whether the same actor that
needs the approval could also have produced the flag.
