---
id: LESSON-0501
type: gotcha
domain: tooling
tags: [claude-cli, headless, oauth, benchmarking, agent-tool, telemetry]
context: trying to benchmark/compare models with exact per-call USD cost by shelling out to `claude -p`
  from inside a Bash tool subprocess, or by relying on the Agent tool's own telemetry for a cost breakdown
trigger: use this when designing a model-calibration benchmark from inside a Claude Code session and
  reaching for a headless `claude -p` subprocess, or for the Agent tool's own usage report, to get exact
  cost numbers
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): `claude -p` launched from
  a Bash tool subprocess failed with \"OAuth session expired and could not be refreshed\" (cost 0),
  and the Agent tool reports only combined subagent_tokens (about 100k baseline of shared context) plus
  duration, no in/out split. CORROBORATED on a DIFFERENT project (funko-tracker .pandacorp/run/lessons.md
  2026-11-08, agent-inferred): using `claude -p` as an independent photo-review reviewer hit the same
  \"OAuth session expired\" failure when the CLI's OAuth had lapsed; lead subagents were also refused as
  reviewers of their own parent's production. The working pattern was a genuinely separate TOP-LEVEL
  Claude Code session (its own `CLAUDE_CODE_SESSION_ID`, started fresh from the lead, not a subagent and
  not a bare `claude -p` subprocess) acting as the independent reviewer — same root cause as this lesson
  (a subprocess/subagent of an active session does not carry a fresh, independently-authenticated identity
  the way a standalone top-level session does), applied to review-authentication instead of benchmarking."
provenance: agent-inferred
created: 2026-10-23
status: active   # 2026-11-09 (librarian eval-gate): cross-project corroboration (mission-control + funko-tracker), schema-valid, no contradiction
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** benchmarking several models/efforts from inside a running Claude Code session, two
natural approaches to get exact per-call cost both failed to deliver it: (1) shelling out to `claude -p`
from a Bash tool subprocess failed outright with an OAuth-session-expired error (reporting cost 0,
not a real measurement); (2) the Agent tool's own usage reporting gives only a combined
`subagent_tokens` figure (which already includes roughly a 100k-token shared-context baseline) plus
duration — no separate input/output token split, so a true per-call USD cost can't be reconstructed from
it either.

**Lesson:** a headless CLI invocation of `claude -p` cannot be used to benchmark models with exact USD
cost from INSIDE an already-running session — the subprocess doesn't inherit a usable OAuth session. And
the Agent tool, while usable for the dispatch itself, is not an instrumentation surface for precise
token/cost accounting; its reported numbers are a rough combined signal, not a billing-grade breakdown.

**Apply next time:** when a calibration/benchmark needs exact per-model USD cost, don't design it around
`claude -p` run as a subprocess of an active session, and don't rely on the Agent tool's own usage report
for input/output token splits — budget for a coarser signal (wall time, pass/fail outcome, relative
ordering) from inside a session, or run the comparison from a genuinely separate, freshly-authenticated
CLI invocation outside any active session if exact cost is required.

**Generalized (funko-tracker corroboration):** the same failure recurs anywhere a flow needs a freshly,
independently-authenticated Claude identity — not just benchmarking, but also an "independent reviewer"
step that must not share the producer's own authority. Don't reach for `claude -p` as a bare subprocess of
the current session, and don't use a subagent of the producer, for a review/verification step that needs
genuine independence — start a real, separate top-level Claude Code session instead (its own session ID,
its own fresh OAuth context); that is the only form that reliably passes both an "OAuth still valid" check
and a "not the producer / not a child of the producer" independence check.
