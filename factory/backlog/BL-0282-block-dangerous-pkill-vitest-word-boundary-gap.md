---
id: BL-0282
type: bug
area: hooks
title: "block-dangerous.sh SERVER_KILL_TARGETS regex does not catch `vitest` (word-boundary fails because `vite` is a literal prefix of `vitest`), allowing a host-wide `pkill -f vitest`"
status: open
severity: p1
opened: 2026-10-25
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — an agent nearly ran `pkill -f vitest` host-wide after a shell `test` alias shadowing incident; see LESSON-0530. Confirmed live: `plugin/scripts/block-dangerous.sh:313` SERVER_KILL_TARGETS='(^|[^a-z0-9])(next|node|nodejs|vite|playwright|pnpm|npm|npx|tsx)([^a-z0-9]|\$)' does not match the string `vitest` (the character after `vite` is `s`, which fails the `[^a-z0-9]|\$` boundary)."
closes:
links: [BL-0223, LESSON-0530]
---

## Problem
`plugin/scripts/block-dangerous.sh` refuses `pkill -f`/`killall`/piped-kill patterns naming a dev-server
or test-runner process (BL-0223's fix) via `SERVER_KILL_TARGETS` (line ~313):
`'(^|[^a-z0-9])(next|node|nodejs|vite|playwright|pnpm|npm|npx|tsx)([^a-z0-9]|$)'`. This is meant to cover
the whole family of dev-server/test-runner tools a build/gate agent might start and must stop by PID
only, never host-wide. `vitest` — one of the most commonly started test-runner processes in this exact
stack (every `verify.sh` DB-backed suite run) — is NOT matched: the regex's word-boundary requires a
non-alphanumeric character (or end of string) immediately after `vite`, but in `vitest` the next
character is the letter `s`, so the boundary check fails and the whole pattern silently does not match
`pkill -f vitest`. A command that should be refused (it has the exact same host-wide blast-radius problem
BL-0223 fixed for `next`/`playwright`) is currently ALLOWED.

## Root cause
The denylist token `vite` is a literal prefix of the real, distinct binary name `vitest`; a
word-boundary regex built from a short list of representative tokens does not generalize to a sibling
tool that happens to share that prefix (see LESSON-0530 for the general pattern). `vitest` was never
added as its own explicit token.

## Fix plan
1. Add `vitest` (and audit for any other sibling prefix gaps in the same list — e.g. `vite-node`) as its
   own explicit alternative in `SERVER_KILL_TARGETS`, rather than assuming `vite`'s boundary covers it.
2. Re-run `plugin/scripts/test-block-dangerous.sh` and add a BL-0282 case asserting `pkill -f vitest` and
   `pkill -f "vitest run"` are refused (RED today, GREEN after); keep the existing `kill $PID`/`pkill -P
   $PID` allow-cases passing.
3. Bump plugin PATCH; regenerate manifests if needed; note in `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)
- `plugin/scripts/test-block-dangerous.sh`: new assertions that `pkill -f vitest` and `killall vitest` are
  refused. Confirm RED against the current script, GREEN after adding the explicit token.

## Done when
- [ ] `pkill -f vitest` / `killall vitest` are refused by `block-dangerous.sh`, proven by a new RED→GREEN
      test case in `test-block-dangerous.sh`.
- [ ] Existing allow-cases (`kill $PID`, `pkill -P $PID`) still pass (no regression).
- [ ] Plugin version bumped; decision log entry recorded.

## Out of scope
A general audit of every other denylist in the factory for the same prefix-gotcha class — LESSON-0530
captures the generalizable review practice; this item only fixes the one confirmed live gap.
