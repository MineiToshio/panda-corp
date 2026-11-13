---
id: LESSON-0234
type: gotcha
domain: build-orchestration
tags: [implement, arg-echo, journal.jsonl, dashboard-events, verification]
context: verifying that arguments (mode/maxAgents/targeted) actually reached a /pandacorp:implement launch, rather than being silently dropped
trigger: use this when confirming a /pandacorp:implement launch's args (mode, maxAgents, targeted) actually reached the engine
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred) — for a /pandacorp:implement ARG-ECHO verification, the workflow's own journal.jsonl only logs a bare {\"type\":\"started\",...} event with no maxAgents text -- the actual proof that args reached the engine (mode/maxAgents/targeted) is the BuildLaunch line the engine appends to ~/.claude/dashboard-events.ndjson right after start. Check that file, not journal.jsonl, when confirming args weren't dropped. CROSS-PROJECT corroboration (funko-tracker 2026-10-17, agent-inferred): the implement SKILL's own ARG-ECHO prescription (\"the engine's FIRST log line must read maxAgents N\") was not readable mid-run either — the task's .output file stayed empty and journal.jsonl held only agent start/result entries; the lead fell back to the same indirect evidence this lesson already names (the launcher's BuildLaunch event + leaseToken present in agent prompts), confirming journal.jsonl is not viable across two distinct projects and that the implement SKILL should name a readable, parseable echo (e.g. a dedicated dashboard/track event) instead of a log line."
provenance: agent-inferred
created: 2026-09-13
status: deprecated   # 2026-11-13 (librarian review, scheduled sweep) — the specific args this lesson
  # verifies (mode/maxAgents/targeted as CLI launch arguments) are retired by the Day 1 build-engine
  # rewrite (plugin 10.0.0/overlay 9.0.0, 2026-11-12, DR-150): confirmed this pass that `maxAgents`/`mode`
  # no longer appear in pandacorp-build.mjs or build-engine-cli.md. `BuildLaunch` is still a real emitted
  # event per build-engine-cli.md section 7/9 this pass, and `journal.jsonl` still exists with a new
  # schema — so the underlying PATTERN ("don't trust a bare started-type journal event as proof an
  # argument reached the engine; check the dedicated dashboard/launch event instead") may still hold, but
  # it is not re-verified against the new CLI's actual journal/event shape in this pass. Do not act on
  # this lesson's literal field names (mode/maxAgents/targeted) against the current engine; open a fresh
  # candidate if the general pattern resurfaces on a current build.
promotion: none   # was `proposed` (target build-orchestration.md ARG-ECHO section) — withdrawn: the
  # section it targeted names retired CLI args
confidence: high
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
