---
id: BL-0257
type: change
area: build-engine
title: "Stack-install should generate the DR-096 worktree-setup.sh hook for stateful (DB-backed) stacks; land-chain/lane-pool should fail loud on a missing DATABASE_URL, never park silently"
status: open
severity: p1
opened: 2026-10-18
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred) — funko-tracker (Postgres, DB-backed vitest via src/test/db/setupTestDatabase.ts) has no .pandacorp/worktree-setup.sh, so lane worktrees get no DATABASE_URL (.env.local is gitignored, .env.example leaves it empty); land-chain's vitest check reds every DB test file at setup (dropWorkerDatabase -> \"DATABASE_URL is not set\") and parks the chain silently, while chains without DB tests land fine"
closes:
links: [LESSON-0131, LESSON-0427]
---

## Problem

A stateful project (Postgres-backed, with DB-dependent vitest setup like funko-tracker's
`src/test/db/setupTestDatabase.ts`) is never given a `.pandacorp/worktree-setup.sh` — the DR-096 §4
project extension point that `worktree-bootstrap.sh` already reserves for exactly this kind of
project-specific day-zero state. Without it, a lane worktree gets no `DATABASE_URL` (`.env.local` is
gitignored by design; `.env.example` ships with the value empty). `land-chain`'s vitest check then reds
every DB-dependent test file at setup time and PARKS the chain — a result that reads exactly like a
legitimate code failure, not an incomplete lane environment. Chains with no DB tests land fine, so the
defect is invisible until a DB-touching chain happens to land, and it then looks like a code regression.

## Root cause

Two gaps: (1) nothing in the architecture/stack-install flow detects a DB-backed stack and generates the
project's own `worktree-setup.sh` hook for it (the generic mechanism already exists per LESSON-0131 —
this is a project never exercising it, now corroborated on a SECOND, distinct project with a DIFFERENT
kind of missing day-zero state — a connection string, not a codegen step); (2) `land-chain`/lane-pool has
no way to distinguish "the lane's own environment is incomplete" from "the code is genuinely red" when a
DB test fails at setup, so both cases are silently parked identically.

## Fix plan

1. Architecture/stack-install (the step that provisions the chosen stack) should detect a DB-backed stack
   (e.g. a Postgres/Prisma dependency plus a DB-dependent test-setup file) and generate a project
   `.pandacorp/worktree-setup.sh` that provisions/propagates a lane-local `DATABASE_URL` for fresh
   worktrees, following the same extension-point contract `worktree-bootstrap.sh` already documents.
2. `land-chain` (and `lane-pool`) should detect the KNOWN error signature of a missing/malformed
   `DATABASE_URL` in a DB test's setup failure (e.g. the exact "DATABASE_URL is not set" string) and
   surface a distinct, named stop reason ("lane has no DATABASE_URL") instead of parking the chain as an
   ordinary checks-red — the same fail-loud-instead-of-silent-degrade principle BL-0149 already applied
   to the gate-worktree path.
3. Link the fix back to LESSON-0131 (now cross-project corroborated: personal-page-v2's codegen case +
   this DB case) and LESSON-0427 (the adjacent "a green self-test in a lane is not proof the lane env is
   complete" finding from the same incident).

## Tests (prove the fix — TDD, RED → GREEN)

- A fixture stateful project (Postgres dependency + a DB test-setup file, no existing
  `.pandacorp/worktree-setup.sh`) run through stack-install: a hook is generated that provisions
  `DATABASE_URL` for a fresh worktree. RED today (no such generation step exists).
- A lane whose `DATABASE_URL` is deliberately unset: `land-chain` reports the named stop reason ("lane has
  no DATABASE_URL"), not a generic checks-red park. RED today (it parks identically to a real code
  failure).

## Done when

- Both tests above are green; `bash plugin/scripts/run-engine-tests.sh` stays green.
- Plugin + `OVERLAY_VERSION` bumped; `plugin/docs/decision-log.md` entry; LESSON-0131 and LESSON-0427
  back-linked.

## Out of scope

Creating `.pandacorp/worktree-setup.sh` directly on funko-tracker's own existing checkout right now —
that is a defect in THAT product project, not the factory's own tooling, and routes through funko-tracker's
own `/pandacorp:change` (DR-103), not this item.
