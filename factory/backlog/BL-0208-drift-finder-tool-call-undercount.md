---
id: BL-0208
type: bug
area: build-engine
title: "the whole-FRD drift finder's self-reported toolCalls count undercounts its actually-billed tool calls by 35-47%, and it can wrongly narrate budget exhaustion at a fraction of the real cap"
status: open
severity: p2
opened: 2026-09-26
closed:
source: "docs/reviews/canary-f2-report.md §2 tool-budget table (canary F2, wf_8bab7752-702)"
closes:
links: [BL-0201, BL-0203]
---

## Problem
The drift finder's own schema (`DRIFT_FINDER_SCHEMA`) asks it to self-report `toolCalls` (the count it made)
and `budgetExhausted`. Canary F2 measured the self-report against the billed call count for all four FRDs:

| FRD | billed calls | self-reported `toolCalls` | `budgetExhausted` |
|---|---:|---:|---|
| 02 | 52 | 34 | false |
| 03 | 47 | 27 | false |
| 04 | 15 | 8 | false |
| 05 | 27 | 17 | false |

The self-count undercounts the real (billed) count by 35-47%. Worse: FRD-04's finder wrote in its own prose
that "the 60-call budget was spent" at only 15 BILLED calls (and 8 self-reported) — its 3 `unknown`
contracts were a deliberate choice to stop early, not genuine exhaustion, but the narration claimed
exhaustion anyway. A finder that misreports its own exhaustion state either stops too early (leaving
`unknown` contracts that could have been resolved within budget) or, in the other direction, could keep
spending well past what an owner believes the cap allows if the undercount runs the other way on a future
FRD.

## Root cause
The finder counts its own tool invocations from inside its own generation (a model narrating "I made N
calls"), which is not the same channel as the harness/engine's own tool-call ledger — a model's count of its
own actions is not a reliable telemetry source (the same class of problem as BL-0206's JSON transcription:
trusting a model to accurately report a mechanical fact about its own execution, instead of reading it from
the system that actually knows).

## Fix plan
- `plugin/runtime/engine/pandacorp-build.src.js` (`startDriftFinder`/wherever the finder's `agent()` call
  resolves): if the harness/runtime exposes a per-agent tool-call count independent of the model's own
  narration (check whether the `agent()` wrapper or the Task/Agent SDK surfaces this — same investigation
  BL-0203's own arg-doc note at "exposing per-agent token usage (agent() returns none today)" flags as an
  open question), use THAT as the authoritative `toolCalls` figure and stop relying on the finder's
  self-report entirely.
- If no such external count is available yet, at minimum stop trusting the model's own `budgetExhausted`
  narration as the sole signal: cross-check it against the schema's own `toolCalls` field (if the model
  claims exhaustion at well under the stated budget, log a loud discrepancy so the discrepancy is visible in
  the run's own telemetry, rather than silently accepted).
- Until an authoritative count exists, adjust `DRIFT_FINDER_TOOL_BUDGET` sizing guidance (docs/comments) to
  account for the measured 35-47% undercount — i.e. state the PRACTICAL ceiling is lower than the nominal
  number, since a model narrating "N calls" has typically made more.

## Tests (prove the fix — TDD, RED → GREEN)
- If an authoritative external count becomes available: a unit test asserting the engine's recorded
  `toolCalls` for a finder run matches the harness's own ledger, not the model's self-report, with a
  fixture where the two disagree.
- In the meantime: a unit test that a `budgetExhausted:true` claim paired with a `toolCalls` figure well
  under `DRIFT_FINDER_TOOL_BUDGET` produces a loud discrepancy log line (never a silent accept).

## Done when
- [ ] Either an authoritative tool-call count replaces the self-report, or a discrepancy check is in place
      and logs loudly.
- [ ] The sizing guidance in `plugin/agents/drift-finder.md`/the engine's arg-doc comment states the known
      undercount, so a future canary sizes the budget correctly.

## Out of scope
- Building a general per-agent token/tool-call telemetry system for every agent type in the engine (a much
  larger effort) — this item is scoped to the ONE agent (drift-finder) whose own self-report is currently
  the sole signal driving a real engine decision (`budgetExhausted`).
