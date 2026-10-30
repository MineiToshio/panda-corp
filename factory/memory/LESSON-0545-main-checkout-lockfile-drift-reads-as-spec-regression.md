---
id: LESSON-0545
type: gotcha
domain: debugging
tags: [node_modules, lockfile, dependency-drift, e2e, false-regression, worktree]
context: a long-lived main checkout's installed node_modules can silently predate a dependency version bump that landed in the lockfile afterward, while every freshly-provisioned worktree for the same commit always installs clean
trigger: use this when an e2e/test suite fails deterministically in the main checkout on one specific route/code path while a fresh worktree checked out at the SAME commit passes cleanly every time
source: "funko-tracker 2026-10-29 (agent-inferred) — main's node_modules installed 2026-10-22, zod/undici bumped in the lockfile 2026-10-25; the piece route hit its own error boundary only in main, never in a fresh worktree; related BL-0256 (open, merge-queue.sh never runs an install step after a lockfile-touching landing)"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0256, LESSON-0533]
---

**Situation:** a spec looked deterministically "broken on main" — the same route consistently hit its
error boundary — while the identical commit, checked out fresh into a brand-new worktree, passed every
single time.

**Lesson:** a long-lived main checkout's installed `node_modules` is not guaranteed to track its own
committed lockfile. Any commit that bumps a dependency (here `zod`/`undici`) — whether landed by hand,
by a merge queue, or by any other out-of-band path — leaves main running STALE installed code against
NEWER application code written against the bumped package's API, producing a deterministic (not flaky)
failure that is indistinguishable from a real regression in the feature under test. A freshly-provisioned
worktree never reproduces it, because it always installs clean from the CURRENT lockfile — making "only
fails in main, worktree is clean" read exactly backwards from the usual worktree-isolation failure shape
(LESSON-0533's three axes are about a worktree missing something a normal checkout has; this is the
opposite — the long-lived checkout is the one silently behind).

**Apply next time:** before calling a spec "broken on main" purely from a main-only failure, compare the
installed version of each package the failing code path actually touches
(`node_modules/<pkg>/package.json`) against the lockfile's pinned version, and run the project's
`install --frozen-lockfile` equivalent in the main checkout before trusting the failure as a real defect.
This is the manual diagnostic counterpart to BL-0256's engine-level fix (teach the merge queue to install
after any lockfile-touching landing) — apply it by hand whenever that fix hasn't shipped yet for the
project, or when the drift came from a non-queue source the engine fix wouldn't catch anyway.
