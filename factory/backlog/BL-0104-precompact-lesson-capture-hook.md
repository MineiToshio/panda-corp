---
id: BL-0104
type: change
area: hooks
title: "Add a PreCompact hook running the lesson-capture check — compaction is an uncovered DR-047 window"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-20"
closes:
links: []
---

## Problem
`plugin/hooks/hooks.json:3,21,57,81` wires **4 of 33** documented hook events, and
`capture-lessons-reminder.sh` is `Stop`-only (`:67-72`). A session that compacts before it stops loses the
window in which DR-047 rule 8 ("capture the lesson IN THE SAME TURN") would have been enforced. Impact: a
genuine uncovered window for the factory's own capture rule.

## Fix plan
Add a `PreCompact` hook running the same `capture-lessons-reminder.sh` check, keeping its existing four-way
throttling. **Add, do not relocate** — the `Stop` backstop stays exactly as it is. This is net-new machinery
(§10.5), so it lands only after Wave 0 has closed the mechanisms the factory already wrote but never wired.

## Tests (prove the fix — TDD, RED → GREEN)
Trigger a compaction mid-session after an owner-correction event and confirm the reminder fires *before*
compaction completes. Confirm the throttles still suppress it on a short, inbox-touched session.

## Done when
`PreCompact` is wired; the `Stop` hook is unchanged; the repro above is recorded; plugin version bumped.

## Out of scope
Any change to `capture-lessons-reminder.sh`'s throttling logic (§9 item 14 — keep as designed).
