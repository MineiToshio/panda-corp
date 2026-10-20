---
id: LESSON-0429
type: pattern
domain: infra
tags: [docker, postgres, local-dev, compose, naming]
context: provisioning a local database (or any other stateful local service) for a Pandacorp build
trigger: use this when an architecture/stack-install step needs to stand up a local database (or similar stateful service) for a project
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18, owner-stated"
provenance: owner-stated
created: 2026-10-19
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** the owner clarified the expected shape of local database provisioning for a Pandacorp
build: ONE Docker container per project, named after the project, holding every database that
project needs — not an ad-hoc `docker run` with a throwaway name invented per session.

**Lesson:** the project's compose identity should equal the project slug (e.g. `funko-tracker-postgres-1`,
`marketplace-api-postgres-1`, `buytrack-mysql-1`), so any session/agent can recognize and reuse the
SAME long-lived container across runs instead of spinning up a parallel, differently-named one
(`ft-pg-tmp`) that silently diverges from what the app's own `.env`/compose file expects.

**Apply next time:** the architecture/stack-install step should ship the compose file that the
project's own `pnpm db:up` (or equivalent) expects, with the compose project name set to the project
slug and one container per needed engine (Postgres/MySQL/Redis) inside it — never a hand-rolled
`docker run` with an improvised name.
