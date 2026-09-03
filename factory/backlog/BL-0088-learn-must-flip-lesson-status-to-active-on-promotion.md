---
id: BL-0088
type: bug
area: plugin-skill
title: "learn approves a lesson promotion but never flips its status: candidate -> active"
status: done
severity: p2
opened: 2026-08-03
closed: 2026-09-02
source: "librarian review sweep 2026-08-03, factory/memory audit"
closes: "plugin/skills/learn/SKILL.md promotion-apply step + validate-memory.sh promotion/status check, plugin v9.98.1"
links: [LESSON-0147, LESSON-0152, DR-047]
---

## Problem
`/pandacorp:learn`'s promotion apply step (SKILL.md rule "Self-learning loop (DR-047)") sets
`promotion: approved` and back-links the new standard/DR/skill on the source lesson, but never touches
its `status:` field. Two lessons already promoted to a shipped standard are stuck at `status: candidate`
with `promotion: approved`: `factory/memory/LESSON-0147-synthesized-dispatch-prompts-must-be-self-contained-not-pointer-specs.md`
(promoted to `PROMPT-8`, commit `ce33a1f7`) and `factory/memory/LESSON-0152-model-facing-artifact-heading-must-match-parser-literally.md`
(promoted to `QUAL-14`, commit `b026cc16`). Every OTHER `promotion: approved` lesson in the store
(LESSON-0001/0002/0003/0004/0021/0022) is `status: active`, so this is an inconsistency, not the intended
lifecycle: a `promotion: approved` lesson the owner has already vetted and codified into a standard should
never be sitting in `status: candidate` (excluded from `INDEX.md`, excluded from the eval-gate's
"cross-corroborated" activation path, and read by nobody who only skims the always-loaded index).

## Root cause
`plugin/skills/learn/SKILL.md`'s promotion-apply instructions only say "set `promotion: approved`"; they
never instruct flipping `status:` to `active`. Owner approval via `/pandacorp:learn` is itself a form of
corroboration stronger than the eval-gate's normal "different project" bar (DR-047 already treats
`owner-stated` as sufficient without cross-project corroboration) — so a promoted, approved lesson should
always end up `active`, but nothing in the skill currently does that.

## Fix plan
1. In `plugin/skills/learn/SKILL.md`'s promotion-apply step (the paragraph that says "After promoting,
   back-link... and set `promotion: approved`"), add: also set `status: active` on the source lesson if it
   is not already (an owner-approved promotion is by definition cross-corroborated/trusted evidence per
   DR-047, regardless of the lesson's own `provenance`/`confidence`).
2. One-time backfill: flip `status: active` on `LESSON-0147` and `LESSON-0152` (the two lessons currently
   affected) and add their lines to `factory/memory/INDEX.md` (delta edit, per the index's own maintenance
   rule).
3. Add a `validate-memory.sh` check (or extend the existing one): a lesson with `promotion: approved` must
   have `status: active` (never `candidate`/`deprecated`) — fail loud on drift instead of relying on the
   next review sweep to notice.

## Tests (prove the fix — TDD, RED → GREEN)
A `validate-memory.sh` fixture case: a lesson file with `promotion: approved` + `status: candidate` should
FAIL validation before the fix (RED, once the check from step 3 ships) and the two backfilled lessons
should PASS after step 2. A `learn` skill dry-run (or a documentation read-through) confirming the
promotion-apply paragraph now names the `status: active` flip.

## Done when
`plugin/skills/learn/SKILL.md` names the `status: active` flip in its promotion-apply step; LESSON-0147
and LESSON-0152 are `status: active` with both lines present in `factory/memory/INDEX.md`;
`validate-memory.sh` rejects a `promotion: approved` + non-`active` status fixture; plugin version bumped
per semver (PATCH) and `plugin/docs/decision-log.md` notes the fix.

## Out of scope
Auditing whether `LESSON-0147`/`LESSON-0152`'s underlying claims still hold (that is a normal review-sweep
concern, not this bug) — this item only fixes the status-flip mechanism and backfills the two known-drifted
lessons.
