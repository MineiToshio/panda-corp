---
id: LESSON-0146
type: pattern
domain: telemetry
tags: [telemetry, attribution, cross-runtime, model-tracking, dr-113]
context: recording "which model did X" in a telemetry stream (e.g. track.jsonl) that can be written by more than one runtime/CLI
trigger: use this when designing or extending a telemetry schema that must attribute work to a specific model under multi-runtime operation (DR-113)
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry); ringer docs/TAXONOMY.md"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-113]
---

**Situation:** a telemetry stream needs to record which model performed a piece of work, under a factory
that can dispatch through more than one runtime/CLI (Claude Code, Codex, etc.). A naive schema stores one
"model" string per event.

**Lesson:** a harness/CLI name (e.g. "Codex", "Claude Code") is NEVER a model — it is the launcher. A
single field conflates at least four distinct facts that can each vary independently: the MODEL
(sonnet/opus/gpt-5.5...), the LAB that trained it, the HARNESS/CLI that dispatched it, and the ACCESS
PLAN under which it ran (subscription tier, API key, etc.). Collapsing them loses the ability to answer
"which model" precisely once more than one harness or plan is in play.

**Apply next time:** keep model / lab / harness / access-plan as SEPARATE fields in any cross-runtime
attribution schema. Resolve precedence explicitly: harness-reported value (most trustworthy, the CLI
itself knows what it dispatched) > config-resolved value (the neutral tier mapping, PORT-2) >
unattributed (explicit unknown, never a guess). Stamp a `source` field for how the value was obtained and
a `last_verified` date, so a stale or guessed attribution is distinguishable from a fresh, harness-reported
one.
