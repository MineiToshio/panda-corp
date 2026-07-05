---
id: LESSON-0091
type: gotcha
domain: agent-portability
tags: [codex, hooks, enforcement, multi-runtime, security]
context: an external coding-agent runtime (Codex, or any runtime with filesystem write access) operating on the same repo as Claude Code
trigger: use this when a safety/enforcement rule is implemented as a Claude Code hook and the factory also needs to operate under a different runtime
source: "panda-corp — Claude↔Codex dual-runtime portability rollout, 2026-07-04 (see BL-0030)"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0030]
---

**Situation:** the factory's dangerous-command gate and other enforcement live as Claude Code hooks
(`PreToolUse`/`Stop` in `plugin/hooks/hooks.json`). A different runtime with workspace-write access
(Codex) has no equivalent hook mechanism — it runs whatever shell command it decides to run, unfiltered
by the factory's guardrails.

**Lesson:** a hook is a Claude-Code-local enforcement layer, not a portable one. Any rule that is critical
enough to be hook-enforced under Claude Code (protected paths, destructive-command blocking) must ALSO
exist as an explicit, readable instruction in the runtime-agnostic instruction file (`AGENTS.md`) — the
hook is a belt, the written rule is the suspenders, and only the written rule crosses runtimes. Treating
the hook as sufficient enforcement is an illusion the moment a second runtime with write access joins.

**Apply next time:** when adding a new hook-enforced guardrail, add its plain-English equivalent to
`AGENTS.md` in the same change (not as a follow-up) — this generalizes past Codex to any future runtime
that lacks the host's hook mechanism.
