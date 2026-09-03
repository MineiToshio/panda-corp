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

## Attempt evidence — 2026-09-03 (post wf_ddcc95c6-1d7)

The owner's supervised `powerful` build ran the same day (`wf_ddcc95c6-1d7`, mission-control, FRD-24,
`maxAgents: 30`, `maxFrds: 1`, 17:41:44Z→~18:41Z, `stopReason: "maxFrds"`). Checked (CONV-13, this
session) whether it qualifies as BL-0098's run — it does **not**: the Fix plan requires
`args.maxAgents` **unset** and `args.maxSpend` at a known ceiling so `budget.spent()` is the operative
brake being isolated. This run had `maxAgents: 30` **set** (confirmed via the `BuildLaunch` event,
`~/.claude/dashboard-events.ndjson`: `{"event":"BuildLaunch","at":"2026-09-03T17:42:04Z",...,"maxAgents":30,"targeted":true}`)
and no `maxSpend` recorded anywhere (`mission-control/.pandacorp/status.yaml` has no `maxSpend` field;
`BuildLaunch`'s own printf, `.claude/engines/pandacorp-build.js:233`, doesn't even echo it, and the
in-engine check that reads `budget.spent()` — `pandacorp-build.js:1846`, `if (MAX_SPEND && budget.spent() >= MAX_SPEND)` —
short-circuits false whenever `MAX_SPEND` is null, meaning the code path that calls `budget.spent()` most
likely never executed at all this run). So this run gives **zero signal** on BL-0098's actual question,
in either direction.

**Measurement table (what IS available from this run, for the record — not a substitute for the real test):**

| Source | Figure |
|---|---|
| Engine `budget.spent()` at quiesce | **not logged anywhere** — no `BuildLaunch`/`BuildComplete`/`gate` event in `dashboard-events.ndjson` carries a `spent`/`budget` field, and `status.yaml` has no such field either. Gap confirmed live (grepped the full event window `17:41`–`18:48Z` and `status.yaml`). |
| Engine's internal weighted `agentSpawned` at quiesce | **not logged anywhere** either (same grep — no event/`status.yaml` field carries it). |
| External reconstruction (this session, from the run's own transcripts) | 22 raw `agent-*.jsonl` files under the run's transcript dir; by first-seen `message.model` per file: 6 `claude-opus-5`, 3 `claude-sonnet-5`, 13 `claude-haiku-4-5-20251001`. Applying the engine's own `COST(m) = m==='opus'?3:1` (`pandacorp-build.js:141`) as a proxy: 6×3 + 3×1 + 13×1 = **34 weighted units** against `maxAgents: 30` — i.e. the run's own internal counter, if it uses the same weighting, likely finished *above* the nominal cap; it never tripped `stopReason: "agents"` because `stopReason: "maxFrds"` (only 1 FRD in scope) ended the run first. This is a proxy from transcript files, not the engine's own logged value — it cannot stand in for `budget.spent()`. |
| BL-0096 `usage_summary` rollup (real $/tokens) | `calls_total: 876`; sonnet 164 calls/$2.1997; opus 413 calls/$17.864173; haiku 299 calls/$0.7954; **`cost_usd_total: 20.859274`** (`mission-control/.pandacorp/track.jsonl`, last line). |

**Verdict: still open, `doing`.** Neither side of BL-0098's actual comparison (`budget.spent()` vs
real subagent spend) was produced by this run — the run's shape didn't call for it (`maxSpend` unset) and
the engine doesn't persist `budget.spent()` or its own final `agentSpawned` value anywhere retrievable
after the fact even when it would. Two things to carry forward, neither actioned here (out of scope /
no permission to edit `build-orchestration.md` from this card-only pass):
1. The still-unmet Fix plan: a `powerful` targeted build with `maxAgents` unset + `maxSpend` set.
2. **Proposed follow-up (not filed):** *"Log `budget.spent()` and final weighted `agentSpawned` in the
   `BuildComplete` event / `status.yaml` at quiesce"* — without it, even a qualifying future run leaves
   the comparison to ad-hoc transcript reconstruction instead of a first-class engine figure.
