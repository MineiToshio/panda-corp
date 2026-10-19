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
status: active  # cross-project corroboration (panda-corp + funko-tracker, DR-047) — 2026-10-19
promotion: none
confidence: high
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0068, LESSON-0069, LESSON-0442]
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

**Cross-project corroboration, builder-not-just-reviewer variant (funko-tracker, 2026-10-19, agent-inferred,
under an owner-granted DR-120 per-project exception, see LESSON-0442):** a SEPARATE Codex pass
(gpt-6-astra) re-checking FRD-06 (a data-integrity FRD) as an independent reviewer found 4 distinct clause
violations — missing-field report, cross-franchise run reuse while locked, reused-candidate accounting,
empty collection summary — that the Claude engine's OWN opus FRD-06 gate had already certified as passing,
each proven against the pre-change baseline commit. Same project, same incident also showed the inverse of
this lesson's usual shape being a GOOD sign: the Codex builder itself (not just the reviewer pass) stopped
on an under-declared cross-FRD scope instead of silently overreaching past its work order's boundary
(see BL-0262). Two distinct projects, two distinct runtimes relationship directions (Codex building AND
Codex reviewing Claude's prior work), same underlying mechanism — this promotes the lesson from
`candidate` to `active` (DR-047 cross-project corroboration).
