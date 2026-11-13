---
id: LESSON-0675
type: pattern
domain: factory-engineering
tags: [bootstrapping, build-engine, self-hosting, implement, change, safety]
context: redesigning/rebuilding the factory's own build engine (the thing /pandacorp:implement and /pandacorp:change themselves are) must not be done BY running it through itself
trigger: use this when a change targets the factory's own build/change machinery (the build engine, a core skill like implement/change/architecture, or any tool those skills depend on to run)
source: "mission-control .pandacorp/run/lessons.md 2026-11-11 (owner-stated): the implement redesign is built directly (an orchestrator dispatching subagents by hand), not via /pandacorp:implement nor /pandacorp:change"
provenance: owner-stated
created: 2026-11-13
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-103, DR-150]
---

**Situation:** the factory needed to redesign its own build engine — the exact machinery backing
`/pandacorp:implement`/`/pandacorp:change`. The instinct would be to use those skills to build their own
replacement.

**Lesson:** the factory's core execution machinery is not modified by running it through itself. If the
engine being changed is broken, mid-redesign, or behaving unpredictably, routing the very work that changes
it through that same engine risks building on a foundation that is shifting under the build, or using a
tool to cut the branch it is standing on. The safe pattern is to step OUTSIDE the machinery being changed —
a plain orchestrator dispatching subagents directly, hand-run verification — for any change whose target IS
the build/change engine itself, its core skills, or a tool those skills depend on to execute.

**Apply next time:** before routing a change through `/pandacorp:implement` or `/pandacorp:change`, check
whether the change's TARGET is the engine/skill that `implement`/`change` themselves rely on to run. If yes,
build it directly (an orchestrator + subagents dispatched by hand, with deterministic scripts/gates run and
verified manually) instead of asking the machinery to rebuild itself.
