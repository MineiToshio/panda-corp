---
id: BL-0125
type: bug
area: plugin-skill
title: "sync-portfolio can leave factory/portfolio.md's phase stale against the project's own status.yaml, with no re-verification until the next manual run"
status: open
severity: p2
opened: 2026-09-07
closed:
source: "factory/memory/_inbox.md note, 2026-09-04 (agent-inferred) — pandacorp-memory-review sweep, read live on mission-control"
closes:
links: []
---

## Problem
A 2026-09-04 `pandacorp-memory-review` sweep found `factory/portfolio.md`'s Mission Control row marking
phase `release` (stamped by the 2026-08-31 `/pandacorp:sync-portfolio` run), while
`mission-control/.pandacorp/status.yaml` read `phase: implementation` — read live in the same session. Per
AGENTS.md rule 5, `status.yaml` is the ONLY source of truth for an `in-pipeline` project's phase once
`in-pipeline`; the portfolio is a pointer/summary and must never diverge from it. The sweep only reads/
reports (out of its own scope) — it did not correct the row, and nothing else re-verifies it until the
next `/pandacorp:sync-portfolio` run, which itself may be the source of the drift.

## Root cause
Unconfirmed — needs investigation as part of this item's own fix work: either (a) the 2026-08-31 sync ran
BEFORE mission-control's status transitioned to `implementation` (a timing/ordering issue, not a bug), or
(b) `/pandacorp:sync-portfolio` has a bug reading/writing the `phase` field for at least one project shape.
Distinguish these before designing the fix.

## Fix plan
1. Reproduce: run `/pandacorp:sync-portfolio` against the current repo state and confirm whether it now
   correctly reads mission-control's live `phase` from `status.yaml` into `factory/portfolio.md`. If yes,
   this was (a) — a timing gap between the status change and the next scheduled sync, not a code defect;
   narrow the fix to reducing that gap (see step 3). If the row is STILL wrong after a fresh sync run, this
   is (b) — debug `sync-portfolio`'s phase-reading logic directly.
2. If (b): fix the read/write path so `sync-portfolio` always reflects the project's current
   `status.yaml` `phase` field verbatim, with a regression fixture pinning this specific project shape.
3. Either way, consider adding a staleness check to `sync-portfolio` (or a status-note it emits) so a
   portfolio row that has gone uncorrected for longer than N days after a phase change is flagged rather
   than silently trusted — closing the "nothing re-verifies until the next manual run" gap this note found.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a project whose `status.yaml` `phase` differs from its current `factory/portfolio.md` row. RED =
current behavior (document whichever of (a)/(b) reproduces). GREEN = after the fix, running
`/pandacorp:sync-portfolio` corrects the row to match `status.yaml` exactly, and a fixture pinning this
project's shape stays green on repeat runs.

## Done when
`factory/portfolio.md`'s phase column matches every in-pipeline project's `status.yaml` `phase` after a
`sync-portfolio` run, proven by the fixture above; root cause (a) vs (b) is documented in this item's
closing note; plugin version bumped per DR-034 if code changed.

## Out of scope
Re-architecting the portfolio's derivation model (AGENTS.md rule 5 already defines it correctly) — this
item is scoped to why ONE known instance went stale and closing that specific gap.
