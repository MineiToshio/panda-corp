---
id: LESSON-0428
type: gotcha
domain: build-orchestration
tags: [worktree, lane, dr-096, stop-gate, verify-sh, cwd]
context: a supervising session wants to manually test/inspect something inside a running build engine's lane worktree (.pandacorp/run/lanes/lane-N), or has left its own shell cwd pointed at a worktree that later gets removed
trigger: use this when you are tempted to `cd` the supervising session's own shell into an engine lane/unit worktree to poke at its state, or notice the shell's cwd is still inside a worktree you (or the engine) are about to remove — do not leave it there; the session's primary cwd follows the shell, and both the Stop gate and the `block-dangerous.sh` PreToolUse hook derive their scope from that cwd
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred). CORROBORATED on a DIFFERENT project (panda-corp itself, factory/memory/_inbox.md, 2026-11-13, agent-inferred): once the Bash tool's cwd is a worktree that has already been removed (directory no longer exists on disk), `block-dangerous.sh` fails EVERY subsequent command — even a bare `cd` — with \"falló la normalización interna de la ruta de alcance\" (`plugin/scripts/block-dangerous.sh:30`, `scope_root=$(cd \"${scope_root:-$cwd}\" ... ) || block ...`: the hook unconditionally `cd`s into the recorded cwd to resolve its scope root, and that `cd` itself fails first, before the hook ever looks at what the actual command is). A SECOND consequence of the SAME root cause as the Stop-gate case (leaving the session's own cwd pointed at a worktree that can disappear out from under it), on a different gate."
provenance: agent-inferred
created: 2026-10-19
status: active   # 2026-11-15 (librarian eval-gate): cross-project corroboration (funko-tracker + panda-corp), schema-valid, no contradiction
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
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

**Generalized (panda-corp corroboration):** the same root cause — the shell's own cwd pointing at a
worktree that becomes invalid — has a second, harder failure mode once the worktree is actually
*removed* (not just a live engine lane you shouldn't be poking at): `block-dangerous.sh` tries to
resolve its scope root by `cd`-ing into the recorded cwd on EVERY tool call, before it ever inspects the
command; if that directory no longer exists, the `cd` itself fails and the hook blocks, with no way to
recover by running another command from the same cwd (even a plain `cd elsewhere` is blocked, since the
hook still tries to resolve the now-dead cwd first). **Recovery if you get stuck here:** use the Write
tool to create a placeholder file at the dead path (this does not go through the shell cwd the hook is
failing to resolve), then `cd` out of it and remove the placeholder. **The real fix is prevention:**
before removing a worktree (yours or one you know the engine is about to reclaim), always `cd` the
session's shell OUT of it first — never leave the shell cwd inside a worktree that is about to stop
existing, whether you're the one removing it or not.
