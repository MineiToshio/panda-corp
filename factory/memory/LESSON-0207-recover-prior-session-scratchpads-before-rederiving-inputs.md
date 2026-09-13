---
id: LESSON-0207
type: pattern
domain: agent-orchestration
tags: [scratchpad, session-continuity, find, rederivation, cost]
context: starting a new session/subagent on a task that a previous session likely already did partial research or produced inputs for (a fact sheet, a research memo, generated assets)
trigger: use this when starting work that resembles something a previous session in the same project may have already researched or drafted
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-07, agent-inferred. Complementary facet, 2026-09-13 (same project, agent-inferred): the session scratchpad can be WIPED between sessions (the `find`-based recovery above fails). To keep editing an already-published artifact in that case, recover it via the Artifact tool's `action=read` (it saves the full HTML under `tool-results/`) and strip the publish-time doctype/head/body wrapper before republishing — a second, independent recovery channel for when the filesystem-based one is unavailable."
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** prior sessions' scratchpad directories survive on disk at
`/private/tmp/claude-501/<project>/<session-id>/scratchpad` after the session ends, and can be located
with `find`. A new session re-deriving inputs (a fact sheet, a research memo) that a previous session
already produced wastes the work and risks drift between the two versions.

**Lesson:** scratchpad directories are not session-scoped from the filesystem's point of view — they
persist and are discoverable across sessions in the same project. Checking for and reusing a prior
session's scratchpad output is cheaper and more consistent than re-deriving the same inputs from scratch.

**Apply next time:** at the start of a task likely to overlap prior work, search for previous scratchpads
(`find /private/tmp/claude-501/<project-slug> -type d -name scratchpad` or similar), copy anything relevant
into the current session's own scratchpad, and note the source path in the raw lessons inbox so the
provenance of the reused input stays traceable. This is agent-inferred from a single occurrence — treat as
a candidate technique pending corroboration from another project before leaning on it as settled practice.
If the scratchpad itself was wiped (the `find` comes back empty) but the artifact was already published,
try the Artifact tool's `action=read` as a second recovery channel before re-deriving from scratch — it
returns the full published HTML, which just needs its publish-time doctype/head/body wrapper stripped
before it can be edited and republished.
