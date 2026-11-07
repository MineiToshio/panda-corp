---
id: LESSON-0155
type: pattern
domain: factory-engineering
tags: [protected-state, worktree, crash-recovery, gate-worktree, dr-118]
context: an engine or script is about to reuse or clean up a run-state path (a gate worktree, a lock directory) that may be left over from a crashed prior run
trigger: use this when deciding whether to reuse, reset or clean a run-state path that could hold residue from an interrupted or crashed prior process
source: "panda-corp R10 installed canary follow-up, 2026-07-11 — BL-0067 (factory/backlog/BL-0067-preserve-gate-worktree-crash-evidence.md), DR-118, plugin 9.92.8. Third facet: panda-corp, 2026-11-05 — BL-0304/DR-145/BUILD-5 session-cleanup engine + adversarial test suite (plugin/scripts/test-session-cleanup-adversarial.mjs), agent-inferred."
provenance: owner-stated
created: 2026-07-12
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-118, LESSON-0187, DR-145, BL-0304]
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

**Third facet — a destructive reclaim tool can safely go one level finer than whole-path registered/clean
(panda-corp, 2026-11-05, agent-inferred, BL-0304/DR-145/BUILD-5, `plugin/scripts/session-cleanup.mjs` +
its adversarial test suite):** building the session-cleanup engine that operationalizes this lesson for
git-worktree teardown surfaced a THIRD, narrower safe-delete case beyond the original binary
registered-and-clean/else-preserve split: a single FILE inside an otherwise-preserved ignored tree can be
individually disposable if, and only if, its generator recorded a SHA-256 content hash for it at the
moment it was created (`register --generated-file`) and the live file's hash still matches that receipt
exactly — any drift (edited, replaced, missing, or not a real file) immediately reclassifies it as
preserved, same as an unregistered file. This generalizes past worktree cleanup: any reclaim/teardown tool
that must coexist with user-edited files inside a directory it also partially owns (a generated cache, a
scaffolded config) can use the same technique — hash-pin exactly what you generated, never infer
"generated-looking" from a path pattern or a directory convention. The SAME adversarial test suite also
reconfirmed the original binary rule's "ambiguous → preserve" branch concretely: a failed/denied `lsof`
process-liveness probe (exit non-zero, not "no processes found") is itself an ambiguous signal and must
refuse automatic removal entirely, exactly as it must when the registered path turns out to have been
silently replaced by an unrelated worktree reusing the same filesystem path (a different session's
`git worktree move` + `add` at that exact location) — both are now binary-tested fixtures, not just prose.
The prescriptive contract itself (receipt format, exact preserved-state list, polling protocol for
long-running deletions) is the standard's job, not this lesson's — see `factory/standards/
build-orchestration.md` §"Session resource teardown (BUILD-5, DR-145)" for the operational "what"; this
facet keeps only the retrieval-triggered "why" a future, unrelated reclaim tool should reach for the same
hash-pin technique.
