---
id: LESSON-0234
type: gotcha
domain: build-orchestration
tags: [implement, arg-echo, journal.jsonl, dashboard-events, verification]
context: verifying that arguments (mode/maxAgents/targeted) actually reached a /pandacorp:implement launch, rather than being silently dropped
trigger: use this when confirming a /pandacorp:implement launch's args (mode, maxAgents, targeted) actually reached the engine
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred) — for a /pandacorp:implement ARG-ECHO verification, the workflow's own journal.jsonl only logs a bare {\"type\":\"started\",...} event with no maxAgents text -- the actual proof that args reached the engine (mode/maxAgents/targeted) is the BuildLaunch line the engine appends to ~/.claude/dashboard-events.ndjson right after start. Check that file, not journal.jsonl, when confirming args weren't dropped."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069]
---

**Situation:** verifying that a `/pandacorp:implement` launch's arguments (`mode`, `maxAgents`, `targeted`)
actually reached the engine, by inspecting the run's `journal.jsonl`.

**Lesson:** `journal.jsonl`'s own `started` event is a bare `{"type":"started",...}` with no argument text
— it cannot prove or disprove that `mode`/`maxAgents`/`targeted` reached the engine. The actual evidence
lives in the `BuildLaunch` line the engine appends to `~/.claude/dashboard-events.ndjson` immediately after
start, which does echo the received arguments. Checking `journal.jsonl` for this purpose gives a false
sense of verification (it neither confirms nor denies, so an agent might wrongly read its silence as
"nothing to worry about").

**Apply next time:** to confirm a build's launch arguments weren't silently dropped, grep the `BuildLaunch`
entry in `~/.claude/dashboard-events.ndjson`, not `journal.jsonl`'s `started` event.
