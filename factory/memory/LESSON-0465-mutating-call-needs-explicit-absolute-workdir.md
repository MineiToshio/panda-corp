---
id: LESSON-0465
type: gotcha
domain: agent-orchestration
tags: [worktree, cherry-pick, workdir, cwd, mutating-call, subagent]
context: a sequence of tool calls across agents/subagents where one call creates or depends on a specific working directory (a git worktree) and a LATER mutating call assumes that directory is still current
trigger: use this when a mutating command (git cherry-pick, a write, a build step) follows a prior call that set up or entered a specific directory (e.g. a worktree), especially across a subagent boundary
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0219]
---

**Situation:** a subagent created a git worktree. The NEXT call that ran `git cherry-pick` did not
pin an explicit working directory, and executed against `main` instead of the intended worktree. Root
verified the exact commit before reverting, and reverted cleanly without a destructive reset.

**Lesson:** a working directory set up by one tool call (`cd`, entering a worktree, a subagent's own
session) is NOT guaranteed to carry over to the next mutating call — especially not across a subagent
boundary, and in this environment tool-call working directories are explicitly reset between calls.
A mutating call that silently inherits the wrong directory can land changes on `main` (or any other
unintended tree) with no error, because the command itself is syntactically valid wherever it runs.

**Apply next time:** every mutating call (git operations, writes, builds) must carry its own explicit
absolute working directory or path argument (`git -C <absolute-path>`, an absolute file path) rather
than relying on an inherited `cd` from a prior call or another agent's session. Before trusting a
cherry-pick/merge/commit landed in the right tree, verify the resulting commit's location explicitly
rather than assuming the working directory was correct.
