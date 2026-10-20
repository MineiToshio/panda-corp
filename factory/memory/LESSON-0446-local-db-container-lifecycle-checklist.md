---
id: LESSON-0446
type: pattern
domain: infra
tags: [docker, postgres, local-dev, database-provisioning, synthesis, build-orchestration]
context: provisioning, running, testing against, or swapping a project's local Docker-based database (Postgres/MySQL/Redis) across a Pandacorp build
trigger: use this when an architecture/stack-install step, a fidelity/e2e gate, or a DB-backed test suite needs to stand up, provision, serialize access to, or swap a project's local database container
source: "synthesis over 5 evidence-anchored candidates, all funko-tracker .pandacorp/run/lessons.md 2026-10-18/19 (agent-inferred + owner-stated): LESSON-0429 (owner-stated — container identity/naming convention), LESSON-0431 (agent-inferred — a fidelity/e2e gate's own dedicated database was never self-provisioned, P1003 on a fresh environment), LESSON-0438 (agent-inferred — several DB-backed vitest suites run concurrently against one local Postgres starve setup/teardown hooks, looking like flaky tests), LESSON-0439 (agent-inferred — a cherry-picked Prisma schema change needs `db:generate` in the receiving checkout, tsc stays green against its own stale generated client), LESSON-0441 (agent-inferred — stopping the old DB container before pulling the new image turns pull latency into guaranteed downtime for every DB-backed verify). Librarian reflection pass, 2026-10-19 scheduled memory review."
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0429, LESSON-0431, LESSON-0438, LESSON-0439, LESSON-0441, LESSON-0131, LESSON-0040]
---

**Situation:** across one project's build, a local Docker-based Postgres database caused five
DIFFERENT failure modes at five different points in its lifecycle: an ad-hoc, improvised container
name diverging from what the app's own tooling expected (identity); a fidelity/e2e gate that assumed
its dedicated database already existed, dying with Prisma `P1003` on a genuinely fresh environment
(provisioning-at-zero); several DB-backed vitest suites firing concurrently against the one local
instance, starving setup/teardown hooks and looking exactly like flaky tests (contention); a Prisma
schema change integrated into a different checkout than the one it was authored in, leaving a stale
generated client that `tsc` cannot catch because it only checks the client against itself
(generated-artifact staleness); and stopping the old container before the new image finished pulling,
turning ordinary image-pull latency into guaranteed downtime for every DB-dependent verify running at
that moment (swap-downtime).

**Lesson:** a local database container is not a single provisioning step to get right once — it is a
small piece of stateful infrastructure with its own IDENTITY, its own BOOTSTRAP ORDERING, its own
CONCURRENCY ceiling, its own GENERATED-ARTIFACT dependency, and its own UPGRADE procedure, and each of
these five facets fails independently with a different symptom (a confusing divergent container, a
`P1003` on first clean run, a mass of "flaky" hook timeouts, a false-green `tsc` next to a real runtime
error, or a false mass regression during an image swap). None of these five is caught by fixing any of
the others — they are genuinely orthogonal, the same shape the store already has for preview/screenshot
tooling (LESSON-0047) and worktree isolation (LESSON-0125): a handful of named, independent traps worth
a standing checklist rather than five separate rediscoveries.

**Apply next time:** when a project needs a local Docker database for its build/gates, audit all five
facets up front, not just whichever one bit first:
1. **Identity** — one compose project named after the project slug, one container per needed engine,
   never an ad-hoc `docker run` with an improvised name (LESSON-0429).
2. **Self-provisioning** — any gate/e2e script that owns a dedicated database must create + migrate +
   seed it itself (in `globalSetup` or equivalent) BEFORE any build/boot step that prerenders against
   it, and this must be verified by actually dropping the database and re-running from zero, not
   trusted because it worked once on a machine with leftover state (LESSON-0431).
3. **Concurrency** — a single local Postgres instance has a finite connection/IO budget; before
   trusting a DB-backed hook timeout as a real regression, re-run that file alone, and serialize
   DB-heavy verify runs rather than stacking them (LESSON-0438, sibling of LESSON-0040).
4. **Generated-client freshness** — any change to `schema.prisma` landing through a path other than
   the checkout's own normal build pipeline (cherry-pick, manual patch, foreign-worktree merge) needs
   an explicit `db:generate` immediately after — a green `tsc` is not proof, since it only checks the
   generated types against themselves (LESSON-0439).
5. **Swap ordering** — pull the new image FIRST, while the old container is still serving, then
   stop-old -> up-new -> migrate as one fast sequence; never tear down before the new image has
   finished downloading (LESSON-0441).

This is a single-project reflection (all 5 source lessons are funko-tracker evidence) and stays a
`candidate` until a second, distinct project corroborates the pattern as a whole (DR-047
anti-poisoning) — but each of the 5 underlying facet lessons is independently evidence-anchored and
citable on its own before that happens.
