---
id: BL-0082
type: bug
area: hooks
title: "check-derived-drift.sh Stop gate reddens an innocent session when a PARALLEL session has plugin-metadata edits in flight"
status: done
severity: p2
opened: 2026-07-16
closed: 2026-09-03
source: "factory/memory/_inbox.md 2026-07-15 note (agent-inferred) — seen live: PROMPT-8/manual-fix session vs the 9.97.0 debugging-standard session"
closes: "plugin/scripts/check-derived-drift.sh session-attribution guard + plugin v9.101.2 (plugin/docs/decision-log.md)"
links: [BL-0005]
---

## Problem
`plugin/scripts/check-derived-drift.sh`, wired as (or feeding) a Stop-hook gate, reddens ANY session's
`Stop` the moment the two generated plugin manifests (`plugin/.claude-plugin/plugin.json` /
`plugin/.codex-plugin/plugin.json`) disagree with their SOURCE (`plugin/runtime/plugin-metadata.json`).
This check is repo-wide, not session-scoped: when a session with no `plugin/` edits of its own stops
while a DIFFERENT, PARALLEL session has an in-flight (uncommitted) edit to `plugin-metadata.json` — a
completely normal situation in this solo-operator, multi-session factory (parallel changes to `plugin/`
by other agents/sessions are documented as expected, not anomalous) — the innocent session's Stop also
reds, because the gate has no way to attribute the drift to the session that actually caused it.

Seen live 2026-07-15: a `PROMPT-8`/manual-fix session's Stop reddened purely because a concurrent
9.97.0 debugging-standard session had `plugin/runtime/plugin-metadata.json` mid-edit (not yet
regenerated/committed) at the same moment.

Impact: this is the same class of hazard BL-0005 already fixed for `verify-before-stop.sh`'s foreign-red
basename attribution (DR-099 session-isolation) — here it recurs for a DIFFERENT gate
(`check-derived-drift.sh`) and a different signal (generated-manifest staleness rather than a failing
test file). Worse, the naive "fix" — regenerating the manifests from the innocent session — would STOMP
the other session's in-flight, not-yet-committed `plugin-metadata.json` change.

## Root cause
`check-derived-drift.sh` compares the current on-disk state of the SOURCE file against the two derived
manifests with no session/ownership awareness — it can't tell "I (this session) caused this drift" from
"someone else, right now, is mid-edit on the source I'd need to regenerate from." A regenerate-and-commit
auto-fix is therefore unsafe to run unconditionally from any session that happens to observe the drift.

## Fix plan
Give the gate session-attribution the same way BL-0005 did: before reddening a Stop on manifest drift,
check whether the touched/dirty-file set for the CURRENT session actually includes `plugin/runtime/
plugin-metadata.json` or the generated manifests. If the drift exists but this session's own tracked
changes don't touch those paths, treat it as a FOREIGN drift (same DR-099 spirit as BL-0005): warn instead
of blocking Stop, and never auto-regenerate manifests over another session's uncommitted source edit.

## Tests (prove the fix — TDD, RED → GREEN)
Extend `plugin/scripts/test-check-derived-drift.sh` (or create it if absent): simulate a dirty
`plugin-metadata.json` NOT touched by the current session's own edit set → gate WARNS, does not block
Stop, does not regenerate. Control: the current session's own edit set DOES touch `plugin-metadata.json`
or the manifests and they disagree → gate still REDs/blocks as today.

## Done when
The RED canary above passes GREEN, the existing same-session drift detection still blocks correctly, and
the fix is documented in `plugin/docs/decision-log.md`.

## Out of scope
Fixing every possible parallel-session race in the factory's hooks — this item is scoped to
`check-derived-drift.sh`'s specific attribution gap, the same narrow scope BL-0005 took for
`verify-before-stop.sh`.
