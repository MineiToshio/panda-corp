---
id: LESSON-0667
type: gotcha
domain: deployment-ops
tags: [publish-command, precondition-check, dev-server-dependency, partial-failure]
context: a publish/apply command that writes to a database and THEN calls a revalidation or notification step against a separately-running process (a dev server, a webhook endpoint)
trigger: use this when a publish/apply command's sequence is "write to the database, then revalidate/notify against another running process"
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-10/11 (agent-inferred): ingest:quick publish writes its catalog changes to the database first, then calls a DEV revalidation step via BETTER_AUTH_URL (localhost:4030) — if the dev server isn't already running, publish fails AFTER the DB writes with 'Catalog development revalidation failed,' leaving real data written but the operation reported as failed."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0532, LESSON-0574]
---

**Situation:** a publish command wrote catalog changes to the database, then tried to revalidate a dev
server's cache against the same data. When the dev server wasn't running, the revalidation call failed —
but by then the database write had already happened. The command reported failure, but the data was
already mutated; re-running the command without first starting the dev server would retry the DB write
too, not just the missing step.

**Lesson:** sequencing a command as "mutate, then check a dependency" means any failure in the SECOND
step leaves the FIRST step's effect already committed with no clean way to tell, from the failure
message alone, which parts of the operation actually happened — the command's apparent all-or-nothing
framing ("publish failed") doesn't match its actual partial-success reality (data written, revalidation
skipped).

**Apply next time:** when a command's later step depends on another process being reachable (a dev
server, a webhook target, an external service), verify that dependency is UP before the mutating step
runs, not after — fail fast with a clear "start X first" message before touching the database, rather
than mutating first and discovering the dependency is missing only when it's too late to avoid a
partial-success/partial-failure state.
