---
id: BL-0218
type: bug
area: build-engine
title: "the lease quiesce re-projects status.yaml phase after the close-out set phase release, so the close-out has to restore it with an extra commit"
status: open
severity: p2
opened: 2026-10-01
closed:
source: "pandacorp-bench-form benchmark run A-1 (bench-implement commits 5998aac → 01dbb9a → 42c8993), red-team spec/redteam.md change c"
closes:
links: [DR-085, DR-097]
---

## Problem
In run A-1 (plugin 9.117.1, /Users/Shared/Proyectos/pandacorp-bench-form/bench-implement) the close-out committed
`5998aac chore(release): enter release phase after the cross-feature integration review`, then the lease quiesce
`01dbb9a chore: quiesce Claude build lease` re-projected the phase, and a third commit
`42c8993 chore(release): restore phase release after the lease quiesce re-projected it` had to undo it. The close-out
agent spent part of its 9.3 opus minutes hunting the phase setter.

## Root cause
Not verified. Suspect: the quiesce path in plugin/scripts/pandacorp-build-state.mjs re-derives `phase` from a stale
projection instead of preserving the value the close-out wrote.

## Fix plan
Make quiesce preserve a `phase` written after the run's last projection (or have close-out set it through the state
CLI so the projection agrees). Remove the restore step from the close-out prompt once fixed.

## Tests (prove the fix — TDD, RED → GREEN)
State-CLI test: set phase release, quiesce, assert phase is still release (RED today per the A-1 commit chain).

## Done when
The test passes; a 1-FRD run ends with phase release and no "restore phase" commit.
