---
id: LESSON-0680
type: gotcha
domain: database
tags: [prisma, neon, migrations, dev-prod-parity, schema-drift]
context: rehearsing a data migration or operational change against a DEV database branch before running it against PROD, when DEV and PROD may not be on the same migration history
trigger: use this when about to trust a DEV-environment rehearsal as proof a migration/operation is safe against PROD's actual schema, especially on a managed branched-DB provider (Neon) with Prisma migrations
source: "funko-tracker `.pandacorp/run/lessons.md` 2026-11-12 (agent-inferred): Neon's DEV branch was one migration behind PROD (missing `20261107180000_contextual_reports`) — a rehearsal run against DEV did not actually exercise PROD's real schema, because the two environments had silently drifted apart."
provenance: agent-inferred
created: 2026-11-13
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** before running a change against production, the plan was to rehearse it against the DEV
database branch first and treat a clean DEV run as evidence the change is safe. DEV turned out to be one
migration behind PROD (a migration applied to PROD had never been applied to DEV), so the "rehearsal"
silently ran against an OLDER schema than the one the real operation would touch — any outcome from that
rehearsal said nothing reliable about PROD's actual behavior.

**Lesson:** on a branched-DB setup (Neon, or any environment where DEV/staging and PROD are separate
database instances with their own independently-applied migration history), nothing automatically keeps
them in lockstep — a migration applied directly to PROD (a hotfix, a manual `prisma migrate deploy` run
only against one target) leaves every OTHER environment behind with no error, no warning, just a schema
that looks similar but isn't identical. A rehearsal's value depends entirely on the rehearsal environment
actually matching the target environment's current schema.

**Apply next time:** before treating a DEV-environment rehearsal as proof a migration/operation is safe
for PROD, run `prisma migrate status` (or the provider's equivalent migration-history check) against BOTH
environments from the project's own main checkout (`pnpm env:run migration <env>`-style command) and
confirm they report the identical applied-migration set. If they differ, apply the missing migration(s)
to DEV first — never skip straight to rehearsing against a schema you haven't confirmed matches PROD.
