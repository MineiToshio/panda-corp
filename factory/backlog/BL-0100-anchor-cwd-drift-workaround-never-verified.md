---
id: BL-0100
type: change
area: plugin-skill
title: "Verify the implement-backlog ANCHOR cwd-drift workaround against the current haiku — test first, keep meanwhile"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-54"
closes: "plugin v9.98.13 — implement-backlog/SKILL.md ANCHOR hardening line dated/verified; plugin/docs/decision-log.md v9.98.13 entry"
links: [LESSON-0076]
---

## Problem
`plugin/skills/implement-backlog/SKILL.md:45` records a hardening workaround — low-tier agents drifting to
the session's cwd repo instead of the target factory root, fixed with an `ANCHOR` preamble plus a
worktree-ownership check — with **no BL id, no DR id and no date**. It cannot be re-verified or retired
because nothing says when or against what it was observed. Impact: low today, but **high if removed blind** —
a silent wrong-repo write is an MC-scale incident class (BL-0035).

## Fix plan
Run the **Scan phase only** (read-only: no worktree, no merge, no writes) of
`.claude/engines/pandacorp-backlog.js` from a sibling repo's cwd, once with and once without the ANCHOR
preamble, and assert every returned `path` is absolute under `FACTORY_ROOT`. Record the date, the model the
observation was made against, and the outcome in the skill's own line. If drift no longer reproduces, keep
the ANCHOR anyway and mark it "retained, last verified <date>" — do not remove it on one negative result.

## Tests (prove the fix — TDD, RED → GREEN)
The scan-only comparison above, run from a sibling repo cwd. RED = any returned path outside `FACTORY_ROOT`.

## Done when
`implement-backlog/SKILL.md:45` carries a date and the model it was verified against; the comparison result
is in `plugin/docs/decision-log.md`; plugin version bumped.

## Out of scope
Removing the ANCHOR preamble, and anything that writes to disk — this canary is deliberately read-only.
