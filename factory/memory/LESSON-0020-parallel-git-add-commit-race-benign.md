---
id: LESSON-0020
type: gotcha
domain: factory-engineering
tags: [git, parallel-agents, race-condition, diagnosis]
context: two parallel build agents both stage+commit at nearly the same time; the first agent sees a non-zero exit code and could misdiagnose it as a lost commit
source: mission-control lessons.md — WO-14-003 (2026-06-17)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Situation:** Two parallel agents both ran `git add <files> && git commit` at nearly the same time. The
second agent's `git commit` picked up the first agent's already-staged files (because the index hadn't
been committed between the two `git add` calls), so all files landed in ONE commit under the second
agent's message. The first agent then saw its own `git commit` exit non-zero ("nothing to commit" / dirty
state mismatch) and could have misdiagnosed this as its work being lost.

**Lesson:** This race is **harmless to the tree** — all files DO land correctly, just combined under one
commit message instead of two. The failure signal (non-zero exit on the first agent's commit) looks like a
real failure but isn't. Before escalating a "my commit failed" situation as data loss, verify against
`git log --stat` whether the files are actually present in a nearby commit (possibly under a sibling
agent's message) rather than assuming the work vanished.

**Apply next time:** In any concurrent-agent workflow that lets two agents `git add && git commit`
independently without serializing through a single writer/lock, treat a non-zero commit exit as a
**signal to check `git log --stat` first**, not as confirmed data loss. (The deeper fix — serializing
commits through one writer — is the merge-queue/worktree-isolation model, DR-093/096, already the
canonical answer for genuinely parallel sessions; this lesson is about correctly diagnosing the harmless
variant when it does occur.)
