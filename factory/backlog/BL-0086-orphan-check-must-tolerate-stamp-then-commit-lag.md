---
id: BL-0086
type: bug
area: standards
title: "PASO 0 orphan-of-harvest check must tolerate the same-sweep stamp-then-commit lag"
status: open
severity: p2
opened: 2026-07-21
closed:
source: "factory/memory/_inbox.md note dated 2026-07-20 — mission-control's last_harvest (17:28:47Z) stamped ~18min before the commit recording that same sweep (b2815518, 17:46:52Z) landed; the librarian harvest 2026-07-21"
closes:
links: [BL-0034, BL-0048, LESSON-0180]
---

## Problem
`plugin/docs/routines.md`'s `pandacorp-memory-review` PASO 0 orphan-of-harvest check flags a portfolio
project whose last commit postdates its `last_harvest` stamp. Within a single sweep, the natural write
order is: stamp `last_harvest` into `status.yaml`, THEN commit that change (plus the sweep's report) some
minutes later — mission-control's `last_harvest` (17:28:47Z) was stamped ~18 minutes BEFORE the commit
recording that same sweep (`b2815518`, 17:46:52Z) landed. A naive "commit postdates last_harvest =>
orphaned" comparison near-misses false-flagging a project that was JUST harvested, in the very sweep
currently running.

## Root cause
The check does not account for the inherent lag between a two-phase operation's stamp step and its
commit step; it treats any commit-after-stamp ordering as evidence of drift regardless of magnitude,
rather than expecting it as the normal shape of a stamp-then-commit write.

## Fix plan
Update the orphan-detection step (PASO 0, the same step BL-0034 and BL-0048 already touch different
facets of) to tolerate a bounded lag window around the stamp — e.g. treat a commit landing within N
minutes of `last_harvest`, or explicitly within the SAME sweep run, as non-orphaning — rather than raw
chronological ordering. Coordinate with BL-0048's structured `last_build_completed_at` field work if it
lands first (the comparison logic changes either way).

## Tests (prove the fix)
Documented manual repro (a scheduled-routine prompt, not testable code): construct a fixture where
`last_harvest` predates its own recording commit by a plausible sweep-duration window (e.g. 20 minutes)
and confirm the updated check does NOT flag it as orphaned; construct a second fixture where
`last_harvest` is genuinely old (far older than the project's last real build commit) and confirm it
still flags correctly.

## Done when
PASO 0's orphan check explicitly documents (or scripts) the lag tolerance, verified against both the
near-miss fixture and a genuine-orphan fixture.

## Out of scope
The note-counting fix (BL-0061) and the free-text-parsing fix (BL-0048) themselves — only the
stamp-vs-commit comparison's lag tolerance.
