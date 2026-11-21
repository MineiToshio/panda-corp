---
id: BL-0336
type: bug
area: hooks
title: "warn-adhoc-write.sh can nudge on a Write whose target path is entirely OUTSIDE the repo (e.g. a session scratchpad path), because its skip-pattern list never checks the target is under $root at all"
status: open
severity: p2
opened: 2026-11-21
closed:
source: "factory/memory/_inbox.md, 2026-11-21 (agent-inferred, pandacorp-memory-review sweep): 'the DR-096 isolation reminder (warn-adhoc-write.sh) fires on a Write whose TARGET path is outside the repo entirely (a scratch analysis script under /private/tmp/claude-*/.../scratchpad/), not just on edits inside the shared main checkout; it appears to key off the session cwd git-dir rather than the actual written path, so it nags on scratch/temp writes that need no isolation at all.'"
closes:
links: [DR-096, BL-0033, BL-0044]
---

## Problem

`plugin/scripts/warn-adhoc-write.sh` can fire its DR-096 isolation reminder on a `Write`/`Edit` whose
`file_path` is a session scratchpad path (e.g. `/private/tmp/claude-<uid>/<project>/<session>/
scratchpad/...`) that is not under the repo at all — a file the isolation rule has no reason to care
about, since it can never be part of any project's or the factory's own tracked tree and therefore
cannot red another parallel session's gate.

## Root cause

The script derives `root` from the session `cwd` (`git rev-parse --show-toplevel`), then classifies the
WRITE TARGET (`$file`) with a `case` statement matching substring patterns (`*/factory/*`, `*/plugin/*`,
`*/.pandacorp/*`, etc.) relative to that `root`, but never checks whether `$file` is actually a
descendant path OF `$root` before deciding whether to nudge. A scratchpad path under `/private/tmp/...`
matches none of the existing skip patterns (it has no `/factory/`, `/plugin/`, `/.pandacorp/`, etc.
segment), so `skip_isolation` defaults to 0 and the nudge can fire on a write that is not inside the
repo at all — the opposite of what the isolation rule is meant to police (DR-096 is about avoiding
uncommitted WIP left inside the shared checkout, not about scratch files entirely outside it).

## Fix plan

1. Add an early exemption: if `$file` (resolved to an absolute path) is NOT a path-prefix descendant of
   `$root`, `allow` immediately — mirroring the existing `block-dangerous.sh` scratchpad-depth pattern
   (`case "$r" in /private/tmp/claude-*/?*) ...`) that already treats session scratch paths specially
   for a DIFFERENT hook; this hook should get the equivalent "not under the repo" short-circuit.
2. Keep every existing exemption/nudge-surface rule for paths that ARE under `$root` unchanged.
3. Bump plugin PATCH; record in `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)

Extend `plugin/scripts/test-warn-adhoc-write.sh`: a `Write` with `file_path` under
`/private/tmp/claude-fake/<project>/<session>/scratchpad/x.py` and `cwd` set to the factory/a project
root → RED today (nudge fires), GREEN after (silently allowed). Keep every existing in-repo
nudge/exempt case green.

## Done when

- [ ] The new fixture case passes; no regression in the existing `test-warn-adhoc-write.sh` suite
      (including BL-0033/BL-0044's cases).
- [ ] Plugin version bumped; decision-log entry.

## Out of scope

Any change to the in-repo exemption/nudge logic itself (BL-0033/BL-0044's scope); this item only adds
the missing "target path isn't under the repo at all" short-circuit.
