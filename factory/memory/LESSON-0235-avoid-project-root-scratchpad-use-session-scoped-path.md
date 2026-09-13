---
id: LESSON-0235
type: anti-pattern
domain: agent-orchestration
tags: [scratchpad, project-root, untracked-drift, implement-preflight]
context: an agent needs a scratch/temp directory for intermediate files during a task inside a Pandacorp project
trigger: use this when a task needs a scratch/temp directory inside a Pandacorp project — before creating one at the project root
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred) — a stray scratchpad/ folder had been created directly at a Pandacorp project's repo root (outside the OS-level per-session scratch dir) by an earlier session and sat there untracked for days without anyone noticing, because normal git status checks (and the owner) don't flag it as urgent -- but it silently blocks any future /pandacorp:implement launch (see BL-0128)."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0128]
---

**Situation:** an earlier session created a `scratchpad/` directory directly at a Pandacorp project's repo
root (instead of the OS-level per-session scratch path it should have used). It sat there untracked for
days, unnoticed by casual `git status` glances or the owner, until it silently blocked a later
`/pandacorp:implement` launch (see BL-0128 for the engine-side gap this exposes).

**Lesson:** a project-root `scratchpad/` directory is easy to create by accident (a plausible-looking
name, no obvious harm at creation time) and easy to forget — nothing about it looks urgent to a human or a
routine status check, yet it is untracked drift that can silently brick a future build launch. The always-
correct location for scratch/temp files during any task is the session's own scratchpad path (the one
provided by the environment for that session), never a directory created inside the project checkout
itself.

**Apply next time:** always use the session's own scratchpad path for intermediate/temp files; never
create a `scratchpad/` (or similarly-named) directory at a Pandacorp project's repo root, precisely because
of build-engine interactions like this one.
