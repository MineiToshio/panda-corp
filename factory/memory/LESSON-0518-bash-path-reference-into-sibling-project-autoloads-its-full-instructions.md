---
id: LESSON-0518
type: gotcha
domain: claude-code-runtime
tags: [claude-code, system-reminder, context-cost, cross-project, bash, portfolio]
context: running the factory's pandacorp-memory-review PASO 0 sweep, which checks each portfolio
  project's pending-notes count from inside the factory session
trigger: use this when a factory-session tool call (Bash, or any tool) needs to reference a path that
  lives inside a sibling portfolio project's directory (e.g. checking `<project>/.pandacorp/run/
  lessons.md`), especially for a cheap read-only check
source: "factory/memory/_inbox.md 2026-10-24 (agent-inferred), pandacorp-memory-review PASO 0 sweep:
  a plain Bash command (grep/awk/wc) that only referenced a path inside mission-control/ (e.g.
  mission-control/.pandacorp/run/lessons.md) triggered the harness's automatic injection of mission-
  control's ENTIRE CLAUDE.md/AGENTS.md/docs/rules/*.md/.pandacorp/guide.md as system-reminders in the
  next response — roughly 15 full files, thousands of tokens — even though no file inside that project
  was opened or edited, only touched by path from a Bash command run in the factory session"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0280]
---

**Situation:** during the daily `pandacorp-memory-review` PASO 0 sweep, the agent ran a plain Bash
command (`grep`/`awk`/`wc`) referencing a path inside a sibling portfolio project (e.g.
`mission-control/.pandacorp/run/lessons.md`) purely to count pending notes — no file inside that
project was opened, read or edited by name.

**Lesson:** Claude Code's own harness auto-loads a project's full instruction set
(`CLAUDE.md`/`AGENTS.md`/`docs/rules/*.md`/`.pandacorp/guide.md` — on the order of 15 files and
thousands of tokens) as system-reminders the moment ANY tool call references a path located inside
that project's directory, regardless of whether the call actually opens, reads or edits a file there.
A Bash command whose only "contact" with the sibling project is a path argument is enough to trigger
it. This is an unexpected, high, and easy-to-miss cost for what is meant to be a trivial read-only
check from an adjacent session (the factory, auditing a portfolio project).

**Apply next time:** when a factory-session (or any cross-project) task needs to read a single known
file inside a sibling project (e.g. counting lines in its `.pandacorp/run/lessons.md`), prefer the
`Read` tool targeted at that exact file over a `Bash` command whose arguments merely contain a path
string into that project's directory — `Read` does not appear to trip the same auto-load. If a `Bash`
command genuinely must reference a path inside the sibling project (e.g. a script that globs across
multiple projects), budget for the full-instructions injection as an accepted cost rather than being
surprised by it, or restructure the command to avoid naming that project's directory directly (e.g. run
from inside a worktree-neutral location, or pipe pre-resolved absolute file lists rather than directory
globs).
