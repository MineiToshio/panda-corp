---
id: BL-0228
type: bug
area: plugin-hooks
title: "No Stop-hook backstop catches a harvest/review pass that wrote to factory/memory or factory/backlog but never committed (BL-0089 pattern, execution-skip variant)"
status: open
severity: p2
opened: 2026-10-10
closed:
source: "pandacorp-memory-review daily sweep, 2026-10-10: found factory/backlog/BL-0027 + 7 factory/memory/LESSON-*.md modified, plus BL-0224/BL-0225/LESSON-0279/LESSON-0280 new, all uncommitted and dated from a 2026-10-07 /pandacorp:memory harvest personal-page-v2 run (confirmed via the files' own `harvested 2026-10-07` provenance text and matching the project's then-live .pandacorp/run/lessons.md notes). Completed and committed that harvest (42db8a12) before continuing the sweep. See factory/decision-log.md 2026-10-10 entry."
closes:
links: [BL-0089, LESSON-0113]
---

## Problem
`plugin/skills/memory/SKILL.md`'s harvest mode already has an explicit, mandatory commit step (step 6,
added by BL-0089, plugin v9.98.2) that names BL-0089's own 2026-08-11 incident as precedent. Despite that,
a 2026-10-07 harvest of personal-page-v2 wrote fully correct, internally consistent output (2 new backlog
items, 2 new lessons, 7 lesson corroborations) and then stopped WITHOUT draining the project's
`.pandacorp/run/lessons.md` or committing anything — the exact BL-0089 pattern recurring about two months
after the SOP fix, this time as an **execution skip** (the instruction existed and was ignored/interrupted),
not a **missing instruction** (BL-0089's root cause). Nothing in the repo would have caught this short of
a later sweep manually reading `git status` and cross-checking every modified file's content against a
project's live inbox notes — exactly what this sweep had to do by hand.

## Root cause
The only enforcement for "a memory/backlog write got committed" is the skill's own prose instruction,
followed voluntarily each time the skill runs. There is no structural backstop — analogous to the existing
`verify-before-stop.sh` (which checks build-state claims) or `capture-lessons-reminder.sh` (which checks the
INBOX is being written, not that a WRITE got committed) — that notices "this session's turn is ending and
`factory/memory/` or `factory/backlog/` has uncommitted tracked changes" and flags it before the session
exits.

## Fix plan
1. Add a new Stop-hook script, `plugin/scripts/check-uncommitted-memory.sh`, wired into `plugin/hooks/hooks.json`'s `Stop` array alongside the existing four.
2. Scope: run only when `cwd` is the factory root (`factory/memory` + `factory/backlog` exist) OR a Pandacorp project (`.pandacorp/status.yaml` exists, check `git status --porcelain -- .pandacorp/run factory/memory factory/backlog` as applicable — the project case only has its own `.pandacorp/run/lessons.md` to check locally, since `factory/memory`/`factory/backlog` live in the factory checkout, not the project's).
3. If `git status --porcelain` (scoped to those paths) is non-empty, exit 2 with a one-time (per-session, same pattern as `capture-lessons-reminder.sh`'s marker file) stderr message naming the dirty paths and instructing: commit them now (harvest/review's own step 6/12) or explain to the owner why they're intentionally left open.
4. Do NOT fire if the only dirty path is a `.gitignore`d file (e.g. a project's own `.pandacorp/run/lessons.md`, which several recent harvests correctly leave undrained-but-local when gitignored — only check paths `git status` actually reports, which already excludes ignored files by default).
5. Bump plugin PATCH + regenerate manifests; record in `plugin/docs/decision-log.md`.

## Tests (prove the fix: TDD, RED to GREEN)
- RED (current): simulate the 2026-10-07 scenario — stage no commit after writing to `factory/memory/`,
  run the Stop hook chain, confirm no warning fires today.
- GREEN (after fix): same fixture, `check-uncommitted-memory.sh` exits 2 with a message naming the dirty
  files; a clean `git status` after committing lets Stop proceed silently; re-firing within the same
  session (second Stop) does not re-nag (marker file, same convention as the other Stop backstops).

## Done when
The hook is wired, the RED→GREEN fixture passes, and the next time an agent's memory/backlog write goes
uncommitted the SAME session gets flagged before it ends — no longer dependent on a later sweep noticing.

## Out of scope
Auto-committing on the agent's behalf (never do that without the agent's own review of what it's
committing); extending the check to arbitrary other committed-state directories beyond
`factory/memory`/`factory/backlog`/a project's own `.pandacorp/run` (scope creep — those are the two planes
this exact incident class touches, per DR-103).
