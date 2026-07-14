---
id: LESSON-0155
type: pattern
domain: factory-engineering
tags: [protected-state, worktree, crash-recovery, gate-worktree, dr-118]
context: an engine or script is about to reuse or clean up a run-state path (a gate worktree, a lock directory) that may be left over from a crashed prior run
trigger: use this when deciding whether to reuse, reset or clean a run-state path that could hold residue from an interrupted or crashed prior process
source: "panda-corp R10 installed canary follow-up, 2026-07-11 — BL-0067 (factory/backlog/BL-0067-preserve-gate-worktree-crash-evidence.md), DR-118, plugin 9.92.8"
provenance: owner-stated
created: 2026-07-12
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-118]
---

**Situation:** a build baseline treated `.pandacorp/run/gate-worktree` as disposable run state and
prescribed `git worktree remove --force` with a recursive-delete fallback whenever it pre-existed. That
path can be the ONLY uncommitted evidence left by a crashed review — the "just clean it" instruction
contradicted the factory-wide protected-state rule (CLAUDE.md's PROTECTED STATE PATHS) without anyone
having deliberately decided to make an exception for it.

**Lesson:** a run-state path an engine reuses across invocations is not automatically "disposable" just
because it's usually ephemeral — the moment a prior run could have crashed mid-use, that same path can
hold the ONLY surviving evidence of what went wrong. The safe test to distinguish reusable state from
crash residue is narrow and mechanical: registered (git/lock-manager knows about this exact path) AND
clean (no uncommitted/pending changes) → safe to reuse; anything else (dirty, orphaned, unregistered,
locked, ambiguous) → preserve and fall back to a slower-but-safe path, never force-remove.

**Apply next time:** before writing "remove/reset/recreate" into any baseline self-heal or cleanup step
for a reused run-state directory, ask whether that path could be the sole evidence of a crash — if yes,
gate the cleanup behind an explicit registered+clean check and preserve everything else, the same
discipline CLAUDE.md's protected-state-paths rule already applies to `.pandacorp/` and `factory/memory/`
more broadly.
