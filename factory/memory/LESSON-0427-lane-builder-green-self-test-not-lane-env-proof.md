---
id: LESSON-0427
type: gotcha
domain: build-orchestration
tags: [worktree, lane-isolation, environment-parity, false-green, db-tests]
context: a fast-lane builder's own self-test run passed inside its worktree while the engine's separate land-chain check on the exact same files failed
trigger: use this when a lane/worktree builder reports its own tests green, before treating that as proof the lane's environment is complete or that a subsequent landing check on the same files will also pass
source: "funko-tracker run_20261018T033601Z_80858 / run_20261018T045818Z_46300 (2026-10-18, agent-inferred) — a lane builder's own commit-wo test run passed while land-chain's check on the exact same files failed; the builder's shell carried a DATABASE_URL the landing check's shell didn't (see LESSON-0131 and BL-0257 for the root DATABASE_URL-hook gap this exposed)"
provenance: agent-inferred
created: 2026-10-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0131, LESSON-0155, BL-0257]
---

**Situation:** a lane builder self-ran its tests and reported green before handing the chain to the
engine's land-chain check; land-chain's own run of the IDENTICAL files then failed, because the
builder's shell happened to carry a `DATABASE_URL` the landing check's shell didn't.

**Lesson:** a lane builder's shell and the engine's landing-check shell are not guaranteed to share the
same environment (env vars, generated state, installed dependencies) even though both nominally operate
inside the same worktree/lane. A green self-test only proves the BUILDER's own shell had what it needed
— it is not evidence the lane's environment, as the landing check will see it, is complete. This is the
same "the environment under test, not the code, is what silently diverged" trap LESSON-0155/BL-0149
already document for gate worktrees, recurring at the lane-builder / land-chain boundary.

**Apply next time:** never treat a lane builder's own green self-test as sufficient evidence the lane is
landing-ready. Either make the landing check reuse literally the same environment-resolution path the
builder used (so a gap fails identically in both places), or have the builder explicitly assert the
specific environment facts the landing check depends on (e.g. "DATABASE_URL is set") rather than just
reporting its own tests green.
