---
id: LESSON-0441
type: gotcha
domain: infra
tags: [docker, postgres, container-swap, local-dev, verify-sh]
context: swapping the Docker image/version of a project's local database container (e.g. upgrading the Postgres version)
trigger: use this when about to replace a running local database container with a new image version
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0429]
---

**Situation:** swapping a project's local database container to a new image version by stopping the OLD
container first, then pulling and starting the new one, left the project with NO running Postgres for
the duration of the pull — long enough that the Stop-gate verify went red across 122 DB-backed test
files, a mass failure that looked like a severe regression but was actually "there is currently no
database at all."

**Lesson:** a container swap has an unavoidable image-pull latency; doing the pull AFTER tearing down the
old container turns that latency into guaranteed downtime for anything that depends on the database
being reachable, including an unrelated verify/gate run that happens to fire during the gap.

**Apply next time:** when swapping a local database container's image/version: pull the NEW image FIRST
(`docker pull postgres:17`) while the OLD container is still running and serving traffic, then do
stop-old → up-new → migrate as one fast sequential step — never stop the old container before the new
image has already finished downloading.
