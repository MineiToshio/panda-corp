---
id: LESSON-0524
type: gotcha
domain: build-orchestration
tags: [codex, sandbox, worktree, git, index-lock, orchestration]
context: running a sandboxed CLI agent (e.g. `codex exec -s workspace-write`) whose write permission is scoped to a directory, inside a git worktree, when that agent needs to `git commit`
trigger: use this when a sandboxed agent executing inside a git worktree reports a successful edit but silently fails to commit (or hangs/errors on git commit) despite having workspace-write access to the worktree directory
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — `codex exec -s workspace-write` run with its cwd set to a worktree directory could not commit, because `.git/index.lock` for a worktree is written inside the COMMON `.git` directory of the main checkout (outside the worktree's own path, via git's worktree/common-dir mechanism), which the sandbox's write scope (limited to the worktree directory itself) does not cover"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111]
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
