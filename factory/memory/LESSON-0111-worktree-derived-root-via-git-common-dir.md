---
id: LESSON-0111
type: gotcha
domain: build-orchestration
tags: [worktree, dr-096, gitignored-state, git-common-dir, false-red]
context: code that needs to read a gitignored owner-state file (portfolio.md, run/*, profile.md) or otherwise needs the REAL factory/project root, executed from inside a git worktree
trigger: use this when a derive/read function that depends on gitignored owner state (readPortfolio, factory profile, run/*) is exercised from a git worktree and either returns empty/falls back to "git unavailable" or makes an otherwise-real-repo test go red ONLY inside a worktree
source: "panda-corp — a git worktree checkout has no copy of the gitignored personal files (portfolio.md is DR-033 owner data, never committed, so a worktree — which only ever carries tracked content — never has it); readPortfolio() resolved [] there, and derive-cores whose contract assumes 'a real repo has a portfolio' misread the worktree as git-unavailable, redding a 'this is a real repo' test only under worktree execution. Resolved by resolving the REAL root via `git rev-parse --git-common-dir`'s parent (the same pattern serve.sh already uses to escape worktree isolation for live data) instead of the worktree's own cwd. Agent-inferred, 2026-07-07."
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0090, LESSON-0093, LESSON-0073, LESSON-0125]
---

**Situation:** a git worktree (DR-096 isolation) only ever carries tracked content — by construction it never has a copy of gitignored owner-state files (`factory/portfolio.md`, `factory/profile.md`, a project's `.pandacorp/run/*`). Code that reads one of those (e.g. `readPortfolio()`) resolves an empty result inside a worktree, and any derive/core logic downstream that treats "no portfolio" as "not a real repo" degrades or reds — a false signal that is purely an artifact of running inside a worktree, not a real defect.

**Lesson:** this is the SAME underlying class LESSON-0090/0093 already track (a worktree only carries tracked files, so anything gitignored is invisible from inside it) applied to a THIRD symptom: not a lost backup, not a broken deploy, but a silently-empty derive result / false-red test. The generalizable fix is a resolution technique, not a per-caller special case: from inside a worktree, `git rev-parse --git-common-dir` returns the shared `.git` directory of the worktree's PARENT checkout — its parent directory is the real repo root that actually has the gitignored state. This is the pattern `serve.sh` already uses to escape worktree isolation for live data; any new code with the same need (read gitignored state, need the "real" root) should reach for the same resolver rather than reinventing cwd-based path guessing.

**Apply next time:** when a function needs the REAL project/factory root to read gitignored owner state, and might run from a worktree, resolve via `git rev-parse --git-common-dir` → take its parent (not `cwd` and not a naive `cwd/..` probe, which breaks for nested worktrees) — matching the existing `serve.sh` resolver. Before debugging a "real repo" test that only fails in a worktree, check whether it is silently reading an empty gitignored input rather than a genuine logic bug.
