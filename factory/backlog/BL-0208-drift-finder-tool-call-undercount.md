---
id: BL-0208
type: bug
area: build-engine
title: "the whole-FRD drift finder's self-reported toolCalls count undercounts its actually-billed tool calls by 35-47%, and it can wrongly narrate budget exhaustion at a fraction of the real cap"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-30
source: "docs/reviews/canary-f2-report.md §2 tool-budget table (canary F2, wf_8bab7752-702)"
closes: "plugin/runtime/engine/pandacorp-build.src.js (validateDriftFinding/awaitDriftFinding/driftFinderBlock, DRIFT_FINDER_TOOL_BUDGET note), plugin/scripts/usage-rollup.mjs (tool_calls, tool_calls_self_reported)"
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
- [x] Either an authoritative tool-call count replaces the self-report, or a discrepancy check is in place
      and logs loudly.
- [x] The sizing guidance in `plugin/agents/drift-finder.md`/the engine's arg-doc comment states the known
      undercount, so a future canary sizes the budget correctly.

## Resolution (2026-09-30)
- **Investigation (evidence):** `agent()` hands the engine no per-agent call ledger (the engine has no fs either), so an in-engine authoritative count is not available. The authoritative figures exist OUTSIDE the engine: the agent's own transcript (`tool_use` blocks) and the Workflow's per-agent `toolCalls` in `wf_<runId>.json`. Verified 2026-09-30 on `wf_d23327e1-6cb`: harness `toolCalls` 7 = 7 `tool_use` blocks in the transcript = 5 work calls + 2 `StructuredOutput` return calls.
- **Engine decisions no longer read the self-report.** Before: the self-reported `toolCalls` was quoted to the judge ("in N tool calls") and `budgetExhausted` conditioned the judge's "treat UNKNOWN rows as unreviewed" text. Now `validateDriftFinding` keeps them under `selfReported` for the log only; the judge is told unconditionally that every UNKNOWN row is unreviewed "whatever reason the finder gives". A `budgetExhausted` claim with a self-count under 80 % of `DRIFT_FINDER_TOOL_BUDGET` (or no count) logs a loud `DriftFinderSelfReportDiscrepancy` (canary F2 FRD-04 shape: exhausted "at 8").
- **Real count:** `usage-rollup.mjs` adds per-agent `tool_calls` (distinct transcript `tool_use` ids, `StructuredOutput` excluded), `tool_calls_harness` (wf json ledger, includes the return call), `tool_calls_self_reported` and `tool_calls_undercount_pct`, so the next canary reads the billed number straight from the rollup.
- **Guidance:** the `DRIFT_FINDER_TOOL_BUDGET` comment now states the measured 35-47 % undercount: 60 is a soft ceiling in the finder's own units and the billed count runs ~1.5-1.9x that. The number itself is unchanged (a behavior change for a measurement fix would confound the next canary). `plugin/agents/drift-finder.md` was NOT edited: its method block is mirrored byte-for-byte into the engine and into the generated Codex agents.
- **Tests (RED then GREEN):** `test-pandacorp-build.mjs` `F2g1..F2g4` (discrepancy logged at 8/60 and at no count; none at 59 or when not exhausted; the judge prompt never carries the self-reported figures) plus the tightened `F2d1`; `test-usage-rollup.mjs` (real count with a streamed duplicate line and a `StructuredOutput` return; harness ledger; 2-vs-3 undercount 33.33 %).

## Out of scope
- Building a general per-agent token/tool-call telemetry system for every agent type in the engine (a much
  larger effort) — this item is scoped to the ONE agent (drift-finder) whose own self-report is currently
  the sole signal driving a real engine decision (`budgetExhausted`).
