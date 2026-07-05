---
id: LESSON-0073
type: gotcha
domain: build-engine
tags: [worktree, subagent, parallel-agents, dr-096, path-resolution]
context: parallel sub-agents dispatched from a session standing in a git worktree, expected to isolate their edits to that worktree
trigger: use this when dispatching multiple parallel sub-agents from a worktree-isolated session and trusting that their edits land only in the worktree
source: "panda-corp — Fable sprint WS3, 2026-07-04 (5 of 15 rewriter sub-agents edited the wrong tree)"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0032]
---

**Situation:** a session standing in a git worktree (DR-096 isolation) dispatched 15 parallel rewriter
sub-agents, each given the worktree's absolute path in its prompt. 5 of the 15 nonetheless landed their
`Edit`/`Write` calls in the MAIN checkout, not the worktree — because the sub-agent internally resolved a
repo-root-relative path (e.g. via a `grep`/`find` from a tool that defaults to its own cwd, or a
half-remembered absolute path from training/context) instead of consistently anchoring every file
operation to the worktree path it was handed.

**Lesson:** giving a sub-agent the correct absolute worktree path in its prompt does not guarantee every
tool call it makes resolves relative to that path — an agent that greps or infers a path itself can drift
back to whatever it considers "the repo" (typically the main checkout), especially under parallel
dispatch where prompts get less individual scrutiny. Worktree isolation is only as good as EVERY
participating agent's actual path resolution, not the instruction that told it to isolate.

**Apply next time:** after any parallel sub-agent editing wave dispatched into a worktree, run `git
status` in BOTH the worktree AND the main checkout before trusting the work landed where intended — don't
assume isolation held. If strays are found in the main checkout, transplant them with `git diff | git
apply` rather than re-doing the work.
