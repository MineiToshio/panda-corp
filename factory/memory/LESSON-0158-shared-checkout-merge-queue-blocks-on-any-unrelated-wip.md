---
id: LESSON-0158
type: gotcha
domain: build-orchestration
tags: [worktree, dr-096, merge-queue, shared-checkout, preflight, solo-operator]
context: landing a worktree-isolated change via the shared merge-queue.sh template while the single shared main checkout holds ANY uncommitted change, even one unrelated to the branch being landed
trigger: use this when a `merge-queue.sh` landing unexpectedly fails at the preflight step ("worktree has uncommitted changes"), or when diagnosing why every parallel worktree session's merges are frozen at once
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-12 (agent-inferred) — merge-queue.sh's preflight (`[ -z \"$(git status --porcelain)\" ]`, see BL-0006) blocked ALL landings while the shared main checkout had ANY uncommitted WIP, including unrelated files left by an abandoned session; a stale 2-day-old WIP silently froze every parallel session's merges until the owner cleared it by hand. Corroborated 2026-09-05 (personal-page-v2, harvested 2026-09-07): a one-line uncommitted `status.yaml` stamp in the shared main checkout was enough to block landing ANY worktree's branch, and from INSIDE a worktree the isolation guard prohibits `git -C <main checkout>` directly — the working resolution sequence is `ExitWorktree(keep)` → commit the stray change in main → `EnterWorktree({path})` back into the worktree → then `merge-queue.sh`.
Corroborated again (2026-09-09, personal-page-v2): `merge-queue.sh` returned exit 12 (main busy) against a
leftover UNTRACKED `scratchpad/` directory from a different, unrelated session — confirming the preflight
treats untracked paths the same as tracked WIP, blocking a clean fast-forward for a reason that does not
intersect the branch being landed at all."
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0125, BL-0006]
---

**Situation:** the DR-096 worktree-isolation model lands branches through ONE shared main checkout
(`merge-queue.sh`), which by design fails fast at a cleanliness preflight (`git status --porcelain` must be
empty) BEFORE it rebases/merges anything (BL-0006 shipped exactly this fail-fast-first ordering on purpose).
In practice, that preflight has no way to distinguish "WIP relevant to the branch about to land" from "any
stray uncommitted file anyone left in the shared checkout" — a single abandoned session's leftover diff, even
days old and completely unrelated, blocks every OTHER worktree session's landing until a human clears it.

**Lesson:** the shared-checkout + worktree-isolation model trades parallel EDITING (each worktree has its own
working tree) for still-serial LANDING (one shared checkout, one clean-tree gate) — this is a structural
property of the solo-operator model (constitution §11: no PR queue, direct-to-main), not a bug to code around.
A clean main checkout is a precondition every parallel session implicitly depends on, and it degrades silently:
nothing tells a NEW worktree session that an old one left the shared checkout dirty until that new session's
landing fails.

**Apply next time:** before starting a batch of parallel worktree sessions, verify the shared main checkout is
clean (`git -C <main checkout> status --porcelain`); if a landing fails at the preflight with "uncommitted
changes", don't assume it's your own branch's fault — check whether the dirt belongs to a different, possibly
abandoned session and resolve/commit/stash it (owner gate if unsure whose WIP it is) before retrying. If the
dirt needs to be committed from INSIDE a worktree session (the isolation guard forbids `git -C <main>` from
there): `ExitWorktree(keep)` → commit the stray change directly in main → `EnterWorktree({path})` back into
the worktree → retry `merge-queue.sh`. This is
adjacent to the DR-096 worktree-isolation checklist (LESSON-0125) but a distinct guarantee: LESSON-0125 covers
what a worktree does NOT inherit; this covers what ALL worktrees still SHARE (the one landing checkout).

**Fix candidate worth flagging (not this lesson's job to file, product-project defect):** the preflight
could ignore untracked paths that don't intersect the landing branch's own changed paths instead of
treating any `git status --porcelain` output as blocking — this would remove most of the false-positive
freezes documented above while keeping the fail-fast guarantee for actually-relevant WIP.
