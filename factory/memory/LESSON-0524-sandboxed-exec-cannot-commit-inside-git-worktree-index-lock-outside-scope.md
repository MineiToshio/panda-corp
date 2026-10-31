---
id: LESSON-0524
type: gotcha
domain: build-orchestration
tags: [codex, sandbox, worktree, git, index-lock, orchestration]
context: running a sandboxed CLI agent (e.g. `codex exec -s workspace-write`) whose write permission is scoped to a directory, inside a git worktree, when that agent needs to `git commit`
trigger: use this when a sandboxed agent executing inside a git worktree reports a successful edit but silently fails to commit (or hangs/errors on git commit) despite having workspace-write access to the worktree directory
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — `codex exec -s workspace-write` run with its cwd set to a worktree directory could not commit, because `.git/index.lock` for a worktree is written inside the COMMON `.git` directory of the main checkout (outside the worktree's own path, via git's worktree/common-dir mechanism), which the sandbox's write scope (limited to the worktree directory itself) does not cover. Corroborated 2026-10-28 (same project, agent-inferred): the SAME sandbox, in the SAME worktree, also could not launch Chromium (blocked on `MachPortRendezvous`, a macOS sandbox-exempt IPC mechanism Chromium needs to spawn its renderer processes) nor run a NESTED Codex image-generation call — both distinct resources outside the directory-scoped write permission's reach, the same structural class as the commit failure. Corroborated on a DIFFERENT project (mission-control/panda-corp, 2026-10-29, `.pandacorp/run/lessons.md`, agent-inferred): the Apply-next-time fix (a) above does NOT actually work via `codex exec -s workspace-write --add-dir <git-common-dir>` — the sandbox still refuses writes under `.git` even with the common dir explicitly added. This is the same limitation DR-142 (registry) designed around directly: its `--codex-access sandbox` option documents 'workspace-write: cannot write .git, so it cannot commit' as accepted, not something `--add-dir` resolves — the engine's actual answer is fix (b), the supervising process commits after a sandboxed worker only edits/validates."
provenance: agent-inferred
created: 2026-10-25
status: active   # 2026-10-29: cross-project corroboration (funko-tracker + mission-control) meets the eval-gate bar
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111, DR-142, LESSON-0507]
---

**Situation:** a sandboxed CLI agent was given workspace-write access scoped to a git worktree's own
directory and asked to validate-then-commit a change. The edit succeeded, but the commit silently failed
(or errored) because `git commit` from inside a worktree needs to write `.git/index.lock`, and for a
worktree that lock file lives inside the shared/common `.git` directory of the ORIGINATING checkout, not
inside the worktree's own path (`git rev-parse --git-common-dir` — the same mechanism behind
LESSON-0111). A write-scope limited to the worktree directory never grants access to that common dir.

**Lesson:** "the agent has write access to its own worktree" does NOT imply "the agent can commit from
that worktree" — committing is a write to a path OUTSIDE the worktree's own directory tree by git's own
design, and a sandbox/policy that scopes writes to a single directory will block it even though the
agent's actual file edits all succeeded. This is easy to misdiagnose as a flaky commit or a permissions
bug in the agent itself, when it is a structural mismatch between git-worktree internals and a
directory-scoped sandbox.

**Apply next time:** when a sandboxed agent must operate inside a git worktree and also needs to commit,
either (a) grant the sandbox write access to the common `.git` directory as well (not just the worktree
path), or (b) design the flow so the SANDBOXED agent only edits/validates and the SUPERVISING/orchestrating
process (which already has full repo access) performs the actual `git commit` after validation passes —
the latter is the safer default and avoids widening the sandbox's write scope at all.

**Corroborating correction (2026-10-29):** option (a) is NOT achievable on Codex CLI by passing
`--add-dir <git-common-dir>` to `codex exec -s workspace-write` — the sandbox still refuses writes under
`.git` regardless. Treat (a) as theoretical/not currently available for this specific sandbox+tool
combination; (b) (the orchestrator commits, the sandboxed worker only edits/validates) is the one that
actually works, and is what DR-142's own design adopts by default.

**Apply next time (addendum, 2026-10-28):** a directory-scoped workspace-write sandbox's reach extends
past git internals — plan for it to also be unable to launch a real browser (Chromium needs sandbox-
exempt OS-level IPC, not just filesystem writes), bind a database port, or recursively invoke another
sandboxed worker (nested image generation). Design the division of labor up front: the sandboxed worker
does the edit/generation/validation step; the supervising process (full access) performs commit,
browser-driven gates, DB-touching steps, and anything else outside a plain filesystem write.

**Corroborating instance (funko-tracker, 2026-10-30, agent-inferred):** the same directory-scoped Codex
sandbox also made Apple Vision's on-device ML background-removal call (`removeBg`, Code 9, an ANECF
model-load failure) fail outright — the Apple Neural Engine framework needs the same kind of
sandbox-exempt OS-level access the Chromium/MachPortRendezvous case needed, not just a filesystem write.
Extend the "plan for it" list above to any on-device ML/Neural-Engine API, not only a real browser or a
nested sandboxed worker; run that step outside the sandbox (the supervising process, or an unsandboxed
invocation) instead of trying to grant the sandbox a wider scope.
