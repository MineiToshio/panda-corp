---
id: LESSON-0090
type: pattern
domain: factory-engineering
tags: [backup, gitignored-state, data-loss, worktree, dr-096]
context: any gitignored directory that holds owner state with no git history (.pandacorp/, factory/ideas, factory/memory, factory/profile.md, factory/portfolio.md)
trigger: use this when a directory is gitignored BY DESIGN (owner data, machine state, provisional inbox) yet holds state that would be a real loss if deleted
source: "panda-corp — factory backup layer shipped after the unexplained mission-control/.pandacorp deletion incident (BL-0035), 2026-07-04. Corroborated 2026-07-05: the SAME gap hit a second instance — Mission Control's gitignored, never-committed local-deploy machinery (`.pandacorp/run/serve.sh` + `deploy-local.sh`) was swept once and silently took the always-on deploy down (launchd exit 127 x150); fixed in BL-0045/plugin v9.72.0 by extending backup-pandacorp-state.sh to cover `run/*.sh`."
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0035, BL-0045]
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
git" implies "not backed up"; those are independent decisions. This applies just as much to gitignored
**machinery/scripts** (e.g. a project's `.pandacorp/run/*.sh` deploy scripts) as to gitignored **data** —
"regenerable in principle" is not the same as "actually backed up," and a swept regenerable script can
silently take down a running service just as a swept data file loses owner state.
