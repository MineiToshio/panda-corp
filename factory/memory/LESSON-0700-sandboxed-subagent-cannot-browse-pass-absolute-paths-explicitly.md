---
id: LESSON-0700
type: gotcha
domain: agent-orchestration
tags: [subagent, sandbox, directory-allowlist, dispatch, absolute-path]
context: a lead dispatches a subagent whose filesystem access is restricted to a directory allowlist and expects it to discover/browse the files it needs to review
trigger: use this when briefing a subagent that cannot `ls`/`cd` outside a fixed set of allowed directories and needs to act on files that live elsewhere
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-18 (agent-inferred): photo-reviewer subagents could not `ls`/`cd` into `funko-tracker-data/runs` (outside their allowed directories), but a `Read` call on an absolute path into that same tree succeeded regardless"
provenance: agent-inferred
created: 2026-11-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0465, LESSON-0524]
---

**Situation:** photo-reviewer subagents were asked to review files under `funko-tracker-data/runs`, a
directory outside their configured allowlist. `ls`/`cd` into that directory failed as expected (outside
allowed dirs), but a `Read` call naming an absolute path inside that same tree succeeded anyway — the
directory-browsing restriction and the direct-read restriction are NOT the same gate.

**Lesson:** a subagent's directory allowlist commonly blocks *discovery* (`ls`, `cd`, globbing a directory
it isn't scoped to) without blocking a *direct, explicitly-named* read of a path inside that same
off-limits tree. This is easy to misdiagnose as "the subagent can't reach this data at all" when the real
gap is narrower: it can't find the path on its own, but it can use it once handed the exact path. Relying
on the subagent to browse to its own targets inside a restricted tree will silently fail or degrade to "I
don't see anything there," even though the actual read capability exists.

**Apply next time:** when dispatching a subagent with a restricted/sandboxed directory allowlist to act on
files outside that allowlist, never ask it to discover the paths itself (`ls`/`cd`/glob) — the lead (which
has full access) must resolve every target path explicitly and pass each one as a full absolute path in
the subagent's own brief/request. Treat "the subagent reported nothing there" as a discovery-restriction
symptom first, not proof the resource is unreachable, before concluding the data needs to move or the
allowlist needs widening.
