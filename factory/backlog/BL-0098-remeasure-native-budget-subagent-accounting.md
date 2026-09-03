---
id: BL-0098
type: change
area: build-engine
title: "Re-measure whether budget.spent() now tracks subagent spend — measure only, never swap the primary brake"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-14"
closes:
links: []
---

## Problem
`.claude/engines/pandacorp-build.js:47-48` records that `args.maxSpend` is *"UNRELIABLE alone (under-counts
subagent work; unenforced if the supervisor dies)"* and `:67` names `args.maxAgents` *"THE reliable
overnight guardrail"*, backed by a real 2026-06-17 run that hit ~6M tokens against a 2M ceiling
(`factory/standards/build-orchestration.md:487-491`). The hand-rolled cost-weighted counter at `:141`
(`COST = (m) => (m === 'opus' ? 3 : 1)`) shadows the native primitive. Whether the platform's accounting has
since improved has never been re-tested. Impact: low urgency, **high if mishandled** — a speculative swap
recreates the 2026-06-17 incident.

## Fix plan
A `powerful` targeted build with `args.maxAgents` unset and `args.maxSpend` at a known ceiling: record
whether `budget.spent()` tracks actual subagent spend. Write the result into
`factory/standards/build-orchestration.md`. **Only if it measures accurately** may `agentSpawned` be
demoted to a secondary check in a LATER item — never removed, and never in this one. If it still
under-counts, record that too and close the question for another cycle.

## Tests (prove the fix — TDD, RED → GREEN)
One instrumented targeted build; `budget.spent()` compared against the run's real subagent spend from
BL-0096's `usage_summary` line.

## Done when
The comparison is recorded in `build-orchestration.md` and `plugin/docs/decision-log.md`; `MAX_AGENTS`
remains the primary brake regardless of the outcome.

## Out of scope
Any change to `MAX_AGENTS`/`capHit()` (§9 item 6 — keep primary) or to `MAX_REOPENS` (§9 item 7).
