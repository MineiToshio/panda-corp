---
id: LESSON-0506
type: library-verdict
domain: model-selection
tags: [codex, gpt-6, model-tiering, calibration, headless]
context: calibrating Codex model+effort tiers (the same bench used for the Claude-side calibration) and
  running Codex headlessly from inside a Claude Code session
trigger: use this when sizing a Codex subagent's model+effort tier (PORT-2 of
  factory/standards/agent-portability.md), or when needing to drive Codex headlessly from a session
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred), same bench as
  LESSON-0504: gpt-6.1-sol at low effort scored 10/10 on the hard review at the lowest token count; astra
  (same generation) was no better; xhigh effort only cost 2-3x the time for no measured gain; gpt-6-luna
  scored 6/7.5/8.5 across low->high effort, usable for mechanical/spec'd work only. Separately: `codex
  exec` can be driven headless from inside a Claude Code session, unlike `claude -p` (LESSON-0501), which
  fails with an OAuth error under the same conditions."
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0504, LESSON-0325, LESSON-0501, "factory/standards/agent-portability.md#PORT-2"]
---

**Situation:** the same model/effort calibration bench used for Claude (LESSON-0504) was run against
Codex, on a machine where the currently-available model generation is NEWER than the ids
`factory/standards/agent-portability.md`'s PORT-2 table currently lists for its STANDARD/JUDGE columns
(`gpt-5.5`/`gpt-5.6-luna`) — this bench instead exercised `gpt-6.1-sol`, `astra` and `gpt-6-luna`.

**Lesson:** `gpt-6.1-sol` at LOW effort already saturated the hard review (10/10) at the lowest token
cost observed; its sibling `astra` (same generation) scored no better, and pushing to `xhigh` effort only
cost 2-3x the wall time with no measured score gain — the cheapest-effort pass on this generation was
already enough for judgment-heavy review work in this test. `gpt-6-luna` scored 6/7.5/8.5 across low to
high effort, usable only for mechanical/spec'd tasks, matching the MECH-tier role it's meant to fill.
Separately, `codex exec` CAN be driven headless from inside an already-running Claude Code session (unlike
`claude -p`, which fails with an OAuth error under the same conditions per LESSON-0501) — useful for
in-session cross-runtime benchmarking.

**Apply next time:** when sizing a Codex subtask, don't assume the PORT-2 table's current model ids are
the latest available generation — model generation names drift (this bench already found a newer
`gpt-6.x` family in active use); verify against a recent live invocation before trusting a standard's
pinned id. For a judgment-heavy Codex subtask on a current-generation model, a LOW effort pass may already
be sufficient — don't default to escalating effort without evidence it helps. This single-trajectory
finding needs corroboration from a different project before the PORT-2 table itself is proposed for
update; until then, treat the pinned ids there as potentially stale, not necessarily correct.
