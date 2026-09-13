---
id: BL-0130
type: bug
area: build-engine
title: "DR-065 auto-repair's hard-reset-to-last_green_sha checks only ancestry, not whether there is actually WIP to discard"
status: open
severity: p1
opened: 2026-09-13
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred, translated from Spanish) — DR-065's foundation self-repair recipe resets HARD to last_green_sha after verifying only that it is an ANCESTOR of HEAD. Ancestry alone is not enough: on personal-page-v2 that SHA was from 2026-09-08 with ~30 verified commits on top of it and a fully clean tree (zero half-built surfaces) — the recipe would have discarded verified work, not WIP. The real trigger for a reset should be 'does half-built surface actually exist?' (a dirty git status / files belonging to the failed surface), not just ancestry."
closes:
links: []
---

## Problem
`factory/standards/build-orchestration.md`'s DR-065 foundation self-repair recipe hard-resets to
`last_green_sha` after checking only that the SHA is an **ancestor** of `HEAD`. That check does not
distinguish "HEAD has uncommitted/half-built WIP from the failed surface that should be discarded" from
"HEAD is `last_green_sha` plus many further legitimately-verified commits, with a fully clean tree" — in
the latter case, the recipe as specified would hard-reset and destroy real, verified work, not WIP.
Reproduced/caught (not executed) on personal-page-v2 2026-09-12: `last_green_sha` was ~30 verified commits
and 4 days behind HEAD, tree clean.

## Root cause
The recipe's precondition is under-specified: "is an ancestor of HEAD" is necessary but not sufficient
evidence that a hard reset is safe/correct. The actual signal that should gate a destructive reset is
"does the failed surface's half-built state still exist" (a dirty `git status --porcelain`, or files
belonging to the failed surface still present) — which the recipe as written never checks.

## Fix plan
Update the DR-065 recipe (`factory/standards/build-orchestration.md` + wherever the engine implements it)
to require BOTH conditions before hard-resetting: (1) `last_green_sha` is an ancestor of HEAD (existing
check), AND (2) there is evidence of an actual half-built/failed surface to discard (a dirty tree, or
specific files tied to the failed WO/surface) — not merely "ancestor, so reset is safe." If condition (2)
is false (clean tree, ancestor SHA far behind HEAD with verified commits on top), the recipe must refuse
the hard reset and escalate instead of silently discarding verified work.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: `last_green_sha` = an ancestor commit, HEAD = N verified commits ahead, tree clean. RED (current
recipe): hard-reset proceeds, destroying the N commits. GREEN (fixed): the recipe detects "no dirty tree /
no half-built surface" and refuses the reset, escalating instead.

## Done when
The DR-065 recipe (standard + engine implementation) requires both ancestry AND a dirty-tree/half-built-surface
signal before hard-resetting; the new test passes; the standard's text is updated; `plugin/runtime/plugin-metadata.json`
bumped PATCH/MINOR per severity of the behavior change and manifests regenerated.

## Out of scope
Redesigning DR-065's repair recipe beyond this precondition fix.
