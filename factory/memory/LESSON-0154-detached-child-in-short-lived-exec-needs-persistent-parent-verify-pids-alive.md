---
id: LESSON-0154
type: gotcha
domain: agent-orchestration
tags: [process-management, nohup, unattended, r11, launcher]
context: launching a durable background/unattended process (a supervisor, a long-running build) from inside a short-lived orchestration exec (a tool call, a one-shot shell invocation)
trigger: use this when a launcher starts a detached (nohup-style) child process meant to outlive the exec that spawned it
source: "panda-corp R11/Codex unattended-certification work, 2026-07-11 — factory/decision-log.md 'Ephemeral runtime shells own unattended process lifetime in foreground' entry; fixed via BL-0065, plugin 9.92.6"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
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
