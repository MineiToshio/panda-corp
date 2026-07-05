---
id: LESSON-0090
type: pattern
domain: factory-engineering
tags: [backup, gitignored-state, data-loss, worktree, dr-096]
context: any gitignored directory that holds owner state with no git history (.pandacorp/, factory/ideas, factory/memory, factory/profile.md, factory/portfolio.md)
trigger: use this when a directory is gitignored BY DESIGN (owner data, machine state, provisional inbox) yet holds state that would be a real loss if deleted
source: "panda-corp — factory backup layer shipped after the unexplained mission-control/.pandacorp deletion incident (BL-0035), 2026-07-04"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0035]
---

**Situation:** an unexplained deletion of 11 versioned files was recoverable via `git checkout` because
those files were committed — but the factory's gitignored layers (`.pandacorp/` in any project;
`factory/{ideas,memory,profile.md,portfolio.md}`) have **no git history by design** (DR-033: they hold
owner data, not framework code). A similar deletion hitting one of those has no undo.

**Lesson:** gitignored-by-design is the same axis as backup-free-by-default — a directory being
intentionally excluded from git (to keep owner data out of committed history) does not mean it doesn't
need durability; it means git cannot be the durability mechanism, so something else must be. The fix
that shipped: a periodic snapshot (`backup-pandacorp-state.sh`) copying these paths to a location outside
the repo (`~/.pandacorp-backups`) on session start, with bounded retention (30 days) — an external
backstop that doesn't put owner data in git, but does make it recoverable.

**Apply next time:** when introducing a new gitignored state directory (a new provisional inbox, a new
per-project machine-state file), ask whether its loss would be a real incident — if so, it needs to be
swept into an external, non-git backstop, not left to "we'll notice if it's gone." Never assume "not in
git" implies "not backed up"; those are independent decisions.
