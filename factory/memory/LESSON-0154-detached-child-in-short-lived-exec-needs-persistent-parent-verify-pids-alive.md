---
id: LESSON-0154
type: gotcha
domain: agent-orchestration
tags: [process-management, nohup, unattended, r11, launcher, bash-tool, run_in_background]
context: launching a durable background/unattended process (a supervisor, a long-running build, a worker script) from inside a short-lived orchestration exec (a tool call, a one-shot shell invocation)
trigger: use this when a launcher starts a detached (nohup-style) child process meant to outlive the exec that spawned it, or when an agent's own Bash tool call must launch several concurrent background workers
source: "panda-corp R11/Codex unattended-certification work, 2026-07-11 — factory/decision-log.md 'Ephemeral runtime shells own unattended process lifetime in foreground' entry; fixed via BL-0065, plugin 9.92.6. Corroborated on a DIFFERENT project (funko-tracker, 2026-11-18, .pandacorp/run/lessons.md, agent-inferred): running a worker launcher script (`codex-run.sh`) with trailing `nohup … &` inside a single Bash tool call still died when that call's own shell exited — the fix was to launch each worker as its OWN separate Bash tool call with `run_in_background: true`, Claude Code's actual durable-background primitive, instead of trying to self-detach via `nohup`/`&` from inside one call."
provenance: agent-inferred
created: 2026-07-12
status: active   # 2026-11-19: cross-project corroboration (panda-corp R11 + funko-tracker) meets the eval-gate bar
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0187]
---

**Situation:** a certification launcher started a durable process with `nohup` from inside a short-lived
orchestration exec (a single tool-call shell). When that exec ended, the detached child was reaped along
with it — `nohup` alone does not guarantee survival past the parent shell's own session/process-group
lifetime under every execution vehicle; some ephemeral runtime shells terminate their whole process group
on exit regardless of `nohup`.

**Lesson:** `nohup` protects a child from HUP on terminal disconnect; it does NOT protect it from being
reaped when the launching exec's session ends, if that exec runs inside an ephemeral/foreground-owned
shell rather than a durable background one. A launcher needs a genuinely persistent parent/session (a
distinguishable "durable shell" execution mode, not just "detached via nohup") to keep a supervised
process alive unattended.

**Apply next time:** when a launcher must keep a background process alive after its own invocation
returns, don't trust `nohup` alone — verify empirically, after the launching exec returns, that the
supervisor/child PIDs are still alive (a follow-up process check), and use whichever execution mode the
runtime actually offers for durable (non-ephemeral) background shells rather than assuming any exec context
is durable by default.

**Corroborating instance (funko-tracker, 2026-11-18, agent-inferred):** inside a Claude Code session, a
single Bash tool call that launched a worker script with `nohup codex-run.sh … &` (trying to self-detach
the child with shell-level `nohup`/`&`) still reaped that child the moment the call's own shell exited,
because the call itself was NOT marked durable — it ran as an ordinary foreground tool invocation. The fix
was to stop trying to self-detach from inside one call and instead give each worker its OWN Bash tool call
with `run_in_background: true` — the runtime's actual durable-background execution mode (same shape as
this lesson's "Apply next time", concretely identified for the Claude Code runtime): one call per worker,
each one explicitly backgrounded via the tool parameter, not via shell syntax inside a single foreground
call.
