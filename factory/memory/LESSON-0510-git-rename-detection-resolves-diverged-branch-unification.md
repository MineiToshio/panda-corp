---
id: LESSON-0510
type: pattern
domain: tooling
tags: [git, merge, rename-detection, conflict-resolution, cherry-pick]
context: unifying two long-diverged git branches/lines (e.g. two forks of the same project with very different commit counts) that each independently renamed the same directory
trigger: use this when merging two long-diverged branches and hitting UA (unmerged-added) or AA (both-added) conflict states that involve a directory one or both sides renamed
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0273]
---

**Situation:** unifying two long-diverged branches (94 vs 47 commits) that had each independently renamed
the same directory. Git's merge rename-detection matched the directory rename and relocated the OTHER
side's new files into the renamed path automatically — these surfaced as UA entries with no conflict
markers to resolve by hand. Separately, entries marked AA (both sides added/changed) turned out to be
byte-identical: the same fix, landed via cherry-pick independently on both lines.

**Lesson:** git's rename detection is active during merge, not just `log`/`diff` — it can resolve what
looks like a structural divergence (a directory moved on one or both sides) by itself, relocating one
side's additions into the renamed path with no conflict markers. Reaching for a manual "re-apply the
directory move by hand" step on a UA entry duplicates work git already did correctly. An AA conflict where
both sides are identical usually means the same change landed on both lines independently (a shared
cherry-pick, a shared upstream fix) and needs no real merge — just picking either side.

**Apply next time:** when unifying long-diverged lines, let git's rename detection resolve UA entries
(take the already-relocated file; don't manually redo the directory move); for AA conflicts, diff the two
sides first — if identical, resolve trivially by taking either. Afterward, separately grep the codebase for
any reference to the OLD pre-rename path that git's detection wouldn't have rewritten (docs, configs,
string literals, import paths) — rename detection only affects git's own bookkeeping, never in-repo path
references. See LESSON-0273 for the companion gotcha: the reverse operation (enumerating the files a
commit touched via `git log --name-only`) silently drops the OLD path of a rename instead of surfacing it.
