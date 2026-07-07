---
id: LESSON-0112
type: pattern
domain: testing
tags: [differential-testing, golden-master, performance, ephemeral-worktree, refactor-safety]
context: validating that a rewritten/optimized derivation function (e.g. replacing an O(N) live-derive path with a cached/faster one) produces IDENTICAL output to the old implementation, over real production data, before trusting it
trigger: use this when a performance rewrite of a derivation/read function needs proof it did not change OUTPUT, not just that it is faster — especially when the old implementation is only reachable at a prior commit
source: "panda-corp FRD-23 read-model perf validation, commit ca82bbba (2026-07-07): an ephemeral `git worktree add <scratch-dir> <parent-sha>` checked out the OLD derivation code at the commit before the rewrite; the CURRENT test loaded that old module by absolute path (a plain ts-loader/import pointed at the scratch worktree's file) while `PANDACORP_FACTORY_ROOT` stayed pinned at the REAL root, so both the old and new derivation ran over the SAME live data; the resulting JSON outputs diffed byte-identical (old 2.9s vs new 98ms, same bytes). Agent-inferred."
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0074]
---

**Situation:** a derivation function was rewritten for performance (an O(N) live-git-scan replaced by a cached/materialized path, FRD-23). Before trusting the rewrite, the build needed proof that its OUTPUT — not just its speed — matched the old implementation, over the actual live repo (not a synthetic fixture that might not exercise every real-world edge case).

**Lesson:** a clean, generalizable technique for proving "the new derivation is equivalent to the old one, not just faster": (1) create an EPHEMERAL git worktree checked out at the commit just before the rewrite (`git worktree add <scratch> <parent-sha>`) so the OLD code is available as real files without touching the working tree; (2) load the old module from that scratch path by absolute import/require (not via the package's normal resolution, which would pick up the NEW code); (3) point BOTH the old and new derivation at the SAME real data root (pin any env var the derivation uses to locate its inputs, e.g. `PANDACORP_FACTORY_ROOT`, to the actual root — not the scratch worktree); (4) diff the two JSON outputs for byte-identity. This is differential/golden-master testing, but solves the specific problem of "the golden master (old code) no longer exists in the working tree" by resurrecting it via a disposable worktree rather than a committed snapshot fixture. It complements LESSON-0074 (a characterization suite can bless a latent bug) — this technique's oracle is a DIFFERENT, independently-runnable implementation (the pre-rewrite code), not a suite derived from the new code's own output, so it does not fall into the same self-referential trap.

**Apply next time:** when validating a performance rewrite of any derivation/transform, prefer this over "trust the new tests" or "eyeball a few outputs": stand up the OLD implementation via an ephemeral worktree at the pre-rewrite commit, run both old and new over the SAME real data root, and assert byte-identical output before declaring the optimization safe. Clean up the scratch worktree after (`git worktree remove`) — it is disposable, not a fixture to commit.
