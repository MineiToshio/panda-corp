---
id: LESSON-0556
type: gotcha
domain: hooks
tags: [hooks, stdin, background, manual-invocation, claude-code]
context: manually invoking (outside the real harness) a script that a Claude Code hook normally runs, which reads its input JSON from stdin, as a background shell call
trigger: use this when running a hook script by hand (for debugging, a dry run, or a routine simulation) as a background process — before it appears to hang with no output
source: "mission-control .pandacorp/run/lessons.md 2026-10-29 (agent-inferred): a script that reads hook-payload JSON from stdin hung indefinitely when invoked manually in the background (no real hook harness piping input), because nothing closes stdin for a background shell call — the read blocks forever waiting for input that will never arrive."
provenance: agent-inferred
created: 2026-10-29
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a hook script designed to read its JSON payload from stdin (the real Claude Code harness
pipes it in and closes stdin when done) was run manually as a background command for debugging. With no
harness attached, stdin stayed open and connected to the terminal/session, so the script's stdin read never
returned — the command never finished and never produced output, looking like a silent failure rather than
a blocking read.

**Lesson:** a background shell invocation does not automatically close or redirect stdin — a script that
blocks on reading it will hang forever unless something explicitly provides or closes stdin. This is easy to
misdiagnose as "the script is broken" when it's actually "the script is correctly waiting for input that
this particular invocation never supplies."

**Apply next time:** when manually invoking (especially in the background) any script that reads from
stdin — a hook, a pipe-fed tool — always redirect `</dev/null` (if no real input is intended) or pipe the
actual JSON payload in explicitly. Never background such a call bare; it will hang the session's job list
rather than fail loud.
