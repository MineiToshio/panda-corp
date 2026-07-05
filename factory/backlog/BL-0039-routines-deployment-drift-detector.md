---
id: BL-0039
type: change
area: plugin
title: "Detect drift/deletion between plugin/docs/routines.md (canonical) and the installed scheduled tasks"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "Fable hardening sprint WS1 adversarial audit 2026-07-04, finding #6"
closes:
links: []
---

## Problem
`plugin/docs/routines.md` declares itself canonical over the installed scheduled tasks
(`pandacorp-review-launch` weekly, `pandacorp-memory-review` daily): "when this file and the
installed routine diverge, this file wins". Nothing implements that comparison: no script or
Mission Control surface reads the installed tasks, so a deleted/disabled/hand-edited routine
diverges silently — the exact "deployment drift" class FRD-15 already solves for the plugin SHA.
Verified in sync today by recency, not by mechanism.

## Fix plan
A small checker in the same spirit as FRD-15's drift banner: compare routines.md's declared
cron + prompt against the installed tasks (the scheduled-tasks store under `~/.claude/`), and
surface divergence/absence in Mission Control next to the plugin-drift banner (or, cheaper, a
`plugin/scripts/check-routines-drift.sh` runnable from the memory-review sweep itself).

## Done when
A missing, disabled or cron/prompt-diverged installed routine is detected and surfaced somewhere
the owner actually sees (MC banner or sweep output), proven by a deliberately-tampered fixture.

## Out of scope
Auto-reinstalling routines (the fix may stay propose-only; installation is one command).
