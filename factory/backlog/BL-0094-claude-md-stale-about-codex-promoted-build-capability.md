---
id: BL-0094
type: bug
area: standards
title: "CLAUDE.md still says other runtimes are read/review-only on build state, contradicting AGENTS.md and PORT-5"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-32"
closes:
links: [BL-0084]
---

## Problem
`CLAUDE.md:15` reads *"other runtimes remain read/review-only on project build state"*. That has been stale
since the day PORT-5's `EXPERIMENTAL/attended_foreground/targeted-only` profile was promoted:
`AGENTS.md:98` and `factory/standards/agent-portability.md:84-121` both carry the correct, narrower
statement. The promotion commit updated two files, not three. Impact is informational rather than
operational — `CLAUDE.md` defers to `AGENTS.md` via the `@AGENTS.md` import at `CLAUDE.md:5` — but it is a
single-source-of-truth violation in the factory's most-read file, and its sibling `BL-0084` records the same
stale claim on Mission Control's Manual page.

## Root cause
The PORT-5 promotion had no supersession-completeness sweep (DR-116 step 5b existed but was not applied to
the Claude-layer file), so the old claim survived in the one surface that restates AGENTS.md rather than
importing it.

## Fix plan
Rewrite `CLAUDE.md:15` to match `AGENTS.md:98` / `agent-portability.md` PORT-5 exactly — the promoted
`attended_foreground` profile plus the still-pending R10/R11 gates — or replace the restatement with a
pointer to the AGENTS.md section so it cannot drift again. Then run the DR-116 grep sweep for the old claim
across `factory/`, `plugin/`, `docs/` and fix every surviving assertion in this same change.

## Tests (prove the fix — TDD, RED → GREEN)
`grep -rn "read/review-only" CLAUDE.md AGENTS.md factory/ plugin/` returns no statement contradicting PORT-5
(decision-log history excluded, DR-093).

## Done when
`CLAUDE.md:15` agrees with `AGENTS.md:98`; the DR-116 sweep is recorded; `factory/decision-log.md` noted.

## Out of scope
BL-0084 (the Mission Control Manual surface) — a separate item on the product plane.
