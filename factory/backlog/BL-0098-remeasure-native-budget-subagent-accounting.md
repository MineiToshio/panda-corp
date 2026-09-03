---
id: BL-0098
type: change
area: build-engine
title: "Re-measure whether budget.spent() now tracks subagent spend — measure only, never swap the primary brake"
status: doing
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

## Attempt evidence — 2026-09-03

The Fix plan requires an actual live **`powerful` targeted build** — `args.maxAgents` unset, `args.maxSpend`
at a known ceiling — with `budget.spent()` (the Dynamic Workflows-injected primitive, only readable from
*inside* a running Workflow pass; see `plugin/templates/shared/.claude/engines/pandacorp-build.js:1810-1812`)
compared, at the end of that SAME run, against the real subagent spend recorded by BL-0096's
`kind:"usage_summary"` line. Neither side of that comparison can be produced or observed from this
backlog-implementer's isolated git worktree: it has no `Workflow`/`Monitor`/`ScheduleWakeup`/
`PushNotification` tools (only `Read`/`Write`/`Edit`/`Bash`), so it cannot launch or supervise a live
build, and per DR-113/agent-portability §Build safety only the owner's own Claude Code session may write
project build state at all.

Checked (CONV-13 — live, this session, 2026-09-03) whether a qualifying run had ALREADY happened and could
be measured retroactively instead: grepped every `track.jsonl` reachable under `/Users/Shared/Proyectos`
(`mission-control` + every `panda-corp-bl00NN/mission-control` copy, `personal-page-v2`, and every
`pandacorp-canaries/*` fixture) for a `usage_summary` line — **zero matches anywhere**, and the newest
`track.jsonl` entry in the live `mission-control` project is a `frd_end` dated 2026-07-07, well before
BL-0096 shipped the rollup (closed 2026-09-03). So the "one supervised real `powerful` build" the owner
funded per `factory/decision-log.md` 2026-09-02 (referenced by `BL-0099`'s "Depends on" as the vehicle for
BL-0096/BL-0102/BL-0110/BL-0099's own heartbeat check) has not yet run, and even if/when it does, BL-0098
is **not** one of the four canaries it was scoped to carry — it needs either its own qualifying run or an
explicit owner decision to append this measurement to that same run.

This item stays `doing` (non-blocking measurement work, not a defect) until that live run happens under
an owner-authorized Claude Code session that can read `budget.spent()`/`budget.total` and cross the
result against the run's `usage_summary` line. The `implement-backlog`/build-engine track is the right
place to pick this measurement up the next time a real `powerful` build runs — do not fabricate or
estimate the comparison instead (DR-078/CONV-13).
