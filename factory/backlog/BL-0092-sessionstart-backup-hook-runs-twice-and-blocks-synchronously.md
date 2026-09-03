---
id: BL-0092
type: bug
area: hooks
title: "backup-pandacorp-state.sh runs twice on every factory SessionStart, and both housekeeping hooks block synchronously"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-02
source: "docs/proposals/33-model-era-audit.md §6 R-69 + R-19"
closes: "plugin/hooks/hooks.json + .claude/settings.json (SessionStart dedup + async housekeeping)"
links: []
---

## Problem
`plugin/hooks/hooks.json:8` runs `${CLAUDE_PLUGIN_ROOT}/scripts/backup-pandacorp-state.sh` and
`.claude/settings.json:20-25` runs `$CLAUDE_PROJECT_DIR/plugin/scripts/backup-pandacorp-state.sh
"$CLAUDE_PROJECT_DIR"` — the **same script, two synchronous invocations**, each with a 30 s budget, on every
factory session start. Separately, neither that hook nor `rotate-events.sh` (timeout 15) is marked
`"async": true`, although Claude Code documents `"async": true` + `asyncRewake` for exactly this. Combined
with `.claude/settings.json`'s three SessionStart hooks (10 + 30 + 30 s), the worst case is **~115 s of
synchronous session start**, not the ~45 s previously assumed. Impact: latency on every session, plus an
open correctness question about which copy owns the job (they are invoked with different arguments).

## Fix plan
1. Decide which copy owns the session-start backup — the plugin hook or the repo `settings.json` hook — and
   remove the other. Record the choice in `plugin/docs/decision-log.md` (they differ in arguments, so this
   is a behaviour decision, not a dedup).
2. Mark the surviving `backup-pandacorp-state.sh` and `rotate-events.sh` SessionStart entries
   `"async": true`. **Safety hooks stay synchronous** — async changes *when* a side effect completes, never
   whether it runs, so it is only correct for housekeeping.

## Tests (prove the fix — TDD, RED → GREEN)
Instrument both invocation paths (a timestamped marker line) and start a factory session: before, two marker
lines; after, exactly one. Measure time-to-first-prompt across 3 sessions before and after the async flags.

## Done when
Exactly one backup invocation per SessionStart; both housekeeping hooks carry `"async": true`; safety hooks
unchanged; time-to-first-prompt measurement recorded in the decision-log entry; plugin version bumped.

## Out of scope
The Stop-hook path (BL-0097) and any change to what the backup script itself covers.
