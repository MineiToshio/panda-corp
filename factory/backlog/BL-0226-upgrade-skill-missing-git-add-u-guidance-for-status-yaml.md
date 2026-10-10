---
id: BL-0226
type: change
area: plugin-skill
title: "/pandacorp:upgrade step 5 (commit) doesn't warn that a plain git add refuses .pandacorp/status.yaml-class paths"
status: open
severity: p2
opened: 2026-10-10
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-01 (agent-inferred); corroborates the existing LESSON-0103 (now a third mission-control occurrence, see that lesson's updated source)"
closes:
links: [LESSON-0103, factory/standards/conventions.md#CONV-14]
---

## Problem
`plugin/skills/upgrade/SKILL.md` step 5 ("Commit on its own") just says `chore: upgrade pandacorp overlay
<old> -> <new>` with no guidance on HOW to stage the files. In Mission Control (and any project where a
TRACKED file sits under a directory later added to `.gitignore` — the exact shape of `.pandacorp/status.yaml`
under `.pandacorp/`), a plain `git add <path>` or `git add -A <dir>` is refused as "ignored by one of your
.gitignore files" even though the file is already tracked (LESSON-0103/CONV-14, corroborated three times, two
of them on this exact project). The underlying gotcha and its generalized workaround already live in
`factory/standards/conventions.md#CONV-14`, but `upgrade` is the ONE skill that reliably hits this trap on
every run (it always touches `.pandacorp/status.yaml`), and its own step 5 text doesn't mention it — so an
agent following the skill verbatim reaches for a plain `git add` and gets refused every single time.

## Fix plan
Add a one-line parenthetical to `plugin/skills/upgrade/SKILL.md` step 5, immediately after the commit
instruction: stage with `git add -u --` first (falls back to `git add -f --` per CONV-14) rather than a
plain `git add` / `git add -A`, since `.pandacorp/status.yaml` is a tracked file under a gitignored
directory. Cross-reference `factory/standards/conventions.md#CONV-14` instead of re-stating the full
workaround inline.

## Tests (prove the fix — TDD, RED -> GREEN)
No automated gate exercises skill prose directly; prove by a documented manual repro: re-run `/pandacorp:upgrade`
on a project whose `.pandacorp/` is gitignored-but-tracked and confirm the skill's own text now names the
`-u --` staging step before the commit, so a fresh agent reading it does not have to rediscover the gotcha.

## Done when
`plugin/skills/upgrade/SKILL.md` step 5 names the `git add -u --` staging step; plugin version bumped (PATCH,
prose-only skill change).

## Out of scope
Changing `block-dangerous.sh` or `.gitignore` semantics — this only adds guidance to the skill's own text.
