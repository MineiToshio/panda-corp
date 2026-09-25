---
id: LESSON-0265
type: gotcha
domain: agent-orchestration
tags: [worktree, scratchpad, write-tool, sandbox, dr-096]
context: writing a temporary/throwaway script inside a git-isolated worktree (including at the worktree root, not just the main checkout) before executing it with Bash
trigger: use this when you need to write a temp script inside a Pandacorp project checkout (worktree or main) before running it — before assuming a repo-tree path is a safe place to stage it
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-24 (agent-inferred) — a temp script written into the repo working tree (even a worktree root) disappeared before it could run: the Write tool reported success and the file was gone by the next Bash call"
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0219, LESSON-0235, LESSON-0092]
---

**Situation:** a temp script was written with the Write tool directly into a project's repo working tree
(a git-isolated worktree root, not the OS-level session scratchpad). The Write tool reported success, but
by the time the next Bash call tried to execute the script, the file was gone.

**Lesson:** the repo working tree (main checkout or worktree) is not a reliable scratch space for
temp/throwaway scripts, even when the write itself appears to succeed — something in the session/worktree
machinery can make the file vanish again before a later tool call sees it. This is distinct from
LESSON-0235 (a *forgotten* project-root scratchpad directory that persists and later blocks a build) and
from LESSON-0219 (complex Bash rejected outright by the isolation hook): here the write is accepted and
then silently lost. The harness's own instructions already designate the session scratchpad directory for
exactly this use — this incident is a concrete case where deviating from that guidance failed, not just a
style preference.

**Apply next time:** always write temp/throwaway scripts to the session's own scratchpad directory (never
the repo tree, worktree root included), then invoke them from there with a literal path. If a script must
live in the repo tree temporarily (e.g. to be committed), verify it still exists with a Read/ls immediately
after the Write before relying on it in a later step, and treat a vanished file as a signal to move it to
scratchpad rather than retrying the same write in place.
