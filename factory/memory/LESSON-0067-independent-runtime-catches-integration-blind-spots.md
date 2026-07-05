---
id: LESSON-0067
type: pattern
domain: agent-verification
tags: [multi-runtime, cross-check, qa, agent-portability, codex]
context: verifying a cross-runtime portability change (or any integration) built by one agent/runtime
trigger: use this when a change integrates with or ports to another runtime/system, and deciding who/what should verify it
source: "panda-corp — Claude↔Codex dual-runtime portability rollout, docs/proposals/25-multi-runtime-portability.md, 2026-07-04"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0068, LESSON-0069]
---

**Situation:** after building the Claude↔Codex multi-runtime portability layer (AGENTS.md, Codex agent
mirrors, tool translation tables), running the FIRST independent verification pass IN Codex itself (not
just re-reading the work in Claude Code) caught two real blockers the building session had missed:
operative content silently lost while condensing `CLAUDE.md` → `AGENTS.md`, and 11 versioned
`mission-control/.pandacorp` files that had vanished from the working tree through an unidentified
process.

**Lesson:** the best auditor of an integration with system X is the runtime/system X actually being
integrated with — not the same agent/runtime that built the integration re-reading its own work. A
same-runtime review tends to re-validate the builder's own assumptions (it reads the artifact the way it
was written to be read); an independent runtime exercises the artifact the way an actual consumer will,
surfacing gaps the builder structurally cannot see (missing content only visible when parsed by the OTHER
side's rules, e.g. dead `@imports` or a byte budget the builder's own runtime doesn't enforce).

**Apply next time:** when a change ports/integrates with another runtime, tool, or consumer, get a
genuine verification pass FROM that other side (not just a careful self-review) before declaring done —
this generalizes beyond Claude/Codex to any producer/consumer integration (an API change verified by the
actual client, a schema change verified by the actual downstream parser, etc).
