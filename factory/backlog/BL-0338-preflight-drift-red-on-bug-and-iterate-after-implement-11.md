---
id: BL-0338
type: bug
area: plugin-skill
title: "check-preflight-drift.sh is red on origin/main: bug and iterate lack the A1/A2 preflight spans"
status: open
severity: p1
opened: 2026-11-26
closed:
source: "Observed while landing DR-166 on chore/free-quota (2026-11-26); also red on the untouched base origin/main 02a6cc7b"
closes:
links: [BL-0042, BL-0091]
---

## Problem
`bash plugin/scripts/check-preflight-drift.sh` exits 1 on `origin/main` (02a6cc7b), before any DR-166 change:
`DRIFT: bug/SKILL.md` and `DRIFT: iterate/SKILL.md` do not carry the byte-identical A1 (marker-routing) and
A2 (upgrade + active-build-guard) preflight spans. The check runs in `.github/workflows/factory-engine-tests.yml`
("Check canonical and generated contracts") and as a factory Stop hook, so every factory push and session
end is red for a reason unrelated to the change at hand.

## Root cause
Commit ac577dac (plugin 11.0.0, implement became a goal-based skill) rewrote `plugin/skills/bug/SKILL.md` and
`plugin/skills/iterate/SKILL.md` into short internal guidance skills without the canonical spans, while
`check-preflight-drift.sh` still lists them as carriers.

## Fix plan
Decide which is true now. (a) If bug and iterate are no longer entry skills that preflight, remove them from the
carrier list in `plugin/scripts/check-preflight-drift.sh` and record why in `plugin/docs/decision-log.md`.
(b) If they must still preflight, re-add the byte-identical A1/A2 spans. Bump the plugin PATCH version.

## Tests (prove the fix — TDD, RED → GREEN)
`bash plugin/scripts/check-preflight-drift.sh` is RED on the current tree and GREEN after the fix. Its own
self-test (if present) still proves that a drifted carrier goes RED.

## Done when
`check-preflight-drift.sh` exits 0 on main. The factory-engine-tests contract step passes. The decision is
logged in the plugin decision log.
