---
id: LESSON-0431
type: anti-pattern
domain: build-orchestration
tags: [postgres, fidelity-gate, e2e, prisma, p1003, database-provisioning, fail-closed]
context: a fidelity/e2e harness that depends on a dedicated local Postgres database (a build-side gate database, or an e2e-only database) existing before it runs
trigger: use this when building or auditing a fidelity/e2e gate script that connects to its own dedicated local database — before trusting it on a fresh machine, clean container, or CI runner
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18/2026-10-19 (agent-inferred), two related incidents on the same project's own scripts/fidelity/gate.mjs and e2e/server-env.json"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0131]
---

**Situation (incident 1 — build order):** `scripts/fidelity/gate.mjs` ran `prepareTemplate → buildApp →
resetAndSeed` per group — i.e. it ran `next build` BEFORE creating the gate's own database. Next
prerenders DB-backed pages at build time, so any run against a database that doesn't exist yet (a fresh
machine, or a freshly isolated `FIDELITY_GATE_DB`) died with Prisma `P1003` before measuring anything.
It only ever worked because earlier e2e runs had already created the database by hand.

**Situation (incident 2 — database never provisioned at all):** separately, the project's e2e server
points at a database (`ft_gate`, via `e2e/server-env.json`) that NOTHING in the project creates, migrates
or seeds — it existed only because an earlier session had made it by hand on an old container. On a
fresh container or machine, every signed-in e2e test fails with the same `P1003`.

**Lesson:** a fail-closed verification/e2e harness that assumes a dedicated database already exists is
itself an untested path — its FIRST run on a genuinely clean environment (fresh machine, swapped
container, CI) is the one case nobody exercises until it breaks. This is a specific instance of
LESSON-0131's class (gitignored/day-zero state a worktree or fresh environment never receives
automatically) but at the database-provisioning layer rather than the env-file/codegen layer, and it
recurred TWICE on the same project through two different scripts.

**Apply next time:** any gate/e2e script that owns a dedicated database must (1) create + migrate + seed
it itself — in a `globalSetup`, a `pnpm db:up` follow-up step, or equivalent — BEFORE the build/app-boot
step that depends on it, never after; and (2) order its own steps so the database exists before anything
that prerenders against it (`next build` after `resetAndSeed`, not before). Verify this by actually
dropping the database (or using a disposable container) and re-running the gate from zero, not by trusting
that it worked once on a machine that already had the database from a prior manual run.
