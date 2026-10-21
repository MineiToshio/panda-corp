---
id: LESSON-0463
type: gotcha
domain: infra
tags: [shared-machine, docker, daemon-ownership, multi-tenant, test-isolation]
context: choosing or configuring a test/dev dependency (Docker daemon, local database, any long-running service) on a machine potentially shared with other users or projects
trigger: use this when a project's architecture or test setup would reach for a shared daemon (Docker, a local DB engine) on a machine that is not exclusively owned by this project
provenance: owner-stated
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (owner-stated)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0429, LESSON-0464]
---

**Situation:** on a Mac shared with another user, that other user already runs their own Docker
daemon for unrelated work. The owner ruled out using Docker for this project's local database/test
needs on that machine, because a project cannot assume it owns a shared daemon it did not start and
does not control.

**Lesson:** a shared machine's long-running daemons/services (Docker, a system-wide DB engine, a
background scheduler) cannot be assumed exclusive to any one project. Reaching for "the" Docker
daemon, "the" local Postgres, etc. on such a machine risks colliding with another user's unrelated
work, or being silently starved/restarted by it.

**Apply next time:** on a machine that may be shared, either (a) stand up a project-isolated native
instance (its own process, its own port, its own data directory — never the system-wide daemon) or
(b) use an explicitly authorized, clearly project-scoped target the owner has approved. Never assume
exclusive ownership of a shared daemon, and never configure a test/build step to touch it without
confirming scope first.
