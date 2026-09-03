---
id: BL-0093
type: bug
area: plugin-skill
title: "The two recurring jobs are advertised as /loop jobs, but /loop tasks expire 7 days after creation"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-72"
closes: "plugin/skills/review-launch/SKILL.md + plugin/skills/memory/SKILL.md + CLAUDE.md + mission-control Manual text (skill-flows.ts, manualPages.tsx, despues-de-lanzar.md) rewritten to name the Desktop scheduled tasks (pandacorp-review-launch weekly, pandacorp-memory-review daily; plugin/docs/routines.md) as the durable recurring mechanism, with /loop kept as the attended/session-scoped alternative stating its 7-day expiry; plugin v9.98.5, plugin/docs/decision-log.md entry"
links: [LESSON-0113]
---

## Problem
`plugin/skills/memory/SKILL.md:3,14` and `plugin/skills/review-launch/SKILL.md:3,34` both present themselves
as recurring `/loop` jobs. Recurring `/loop` tasks are **session-scoped and expire 7 days after creation**
(and are cleared by a fresh conversation), so neither job can deliver the recurring contract it advertises.
The durable mechanism is the Desktop scheduled tasks described in `plugin/docs/routines.md:3-4` — a file
that says of itself that the configuration *"does NOT live in this repo"*. Impact: the two jobs the
self-learning loop depends on are promised on a mechanism that cannot deliver — a 12th instance of the
`LESSON-0113` promise-without-mechanism pattern, inside the very loop the audit was testing.

## Fix plan
Pick one and make both skills say it plainly: (a) point the two skills at `plugin/docs/routines.md`'s
Desktop scheduled tasks as the durable form, keeping `/loop` named as the attended-session form only; or
(b) keep `/loop` and state the 7-day expiry inline so the owner knows to re-create it. Option (a) is
preferred — it matches how the jobs actually run today. Update both `SKILL.md` frontmatter descriptions and
bodies, plus `plugin/docs/routines.md` if it needs the reciprocal pointer.

## Tests (prove the fix — TDD, RED → GREEN)
Create one recurring `/loop` job and confirm it is gone on day 8 while the Desktop scheduled task survives —
or, if that wall-clock test is impractical, a documented manual repro plus a grep assertion that neither
skill claims durability for `/loop` any more.

## Done when
Neither skill advertises `/loop` as the durable recurring mechanism; the durable mechanism is named with a
path; plugin version bumped and `plugin/docs/decision-log.md` noted.

## Out of scope
Adopting Cloud Routines (R-24 — deliberately "wait", `[UNVERIFIED]` maturity).
