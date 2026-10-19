---
id: LESSON-0428
type: gotcha
domain: build-orchestration
tags: [worktree, lane, dr-096, stop-gate, verify-sh, cwd]
context: a supervising session wants to manually test/inspect something inside a running build engine's lane worktree (.pandacorp/run/lanes/lane-N)
trigger: use this when you are tempted to `cd` the supervising session's own shell into an engine lane worktree to poke at its state — do not; the session's primary cwd follows the shell, and the Stop gate then runs verify.sh against the LANE, not your own work
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0125, LESSON-0155]
---

**Situation:** a supervising session `cd`'d into a running build engine's lane worktree
(`.pandacorp/run/lanes/lane-N`) to inspect something. The session's primary cwd followed the `cd`, so
when the Stop hook fired it ran `verify.sh` inside the lane, not the session's own location — a
directory with no `build.lock` of its own and the engine's own in-flight, uncommitted dirt. The Stop
gate then blocked on reds that belonged to the engine's lane, not to the session's actual work.

**Lesson:** a lane worktree is live, mutable state owned by the build engine while a run is in
flight — it is not a safe read-only inspection target for a plain `cd`. Any Bash tool invocation that
does `cd <lane-path> && ...` (or a bare `cd <lane-path>` followed by later commands) permanently moves
the session's own cwd there until something moves it back, and the Stop gate has no way to tell "this
red belongs to someone else's in-flight lane" from "this red is the session's own fault."

**Apply next time:** to look at or test something inside a lane worktree, never change the session's
own cwd into it — use `git -C <lane-path> ...`, absolute paths, or a subshell (`( cd <lane-path> &&
... )`), all of which leave the session's own cwd untouched when the command returns.
