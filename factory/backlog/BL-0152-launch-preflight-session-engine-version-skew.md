---
id: BL-0152
type: change
area: build-engine
title: "launch-implement.sh / preflight-implement.sh should warn on session-plugin vs installed-engine version skew before launching a build"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "BL-0141's own Out of scope sub-item, restated here as a standalone trackable item (incident: canary A launch 2026-09-22 12:24 UTC, run wf_35a54be4-172)"
closes:
links: [BL-0141]
---

## Problem
This is the formal, standalone tracking item for the preventive half of **BL-0141** (done, p0): BL-0141
fixed the RUNTIME symptom (the engine now degrades honestly with a fallback agent type instead of dying on
an unknown `pandacorp:*` spawn), but its own "Out of scope" section explicitly flags the causal condition
as unaddressed — a Claude Code session running an older resident plugin (a plugin update applies at
session restart, not mid-session) launches a newer installed engine that requires an agent type the
session's runtime doesn't recognize (`pandacorp:mech`, introduced by WP-03). BL-0141's fix makes that
survivable; it does not make it detectable BEFORE the build launches. See BL-0141 for the full incident
narrative and root cause; this item only carries the preventive fix BL-0141 deliberately left open.

## Fix plan
In `launch-implement.sh` and/or `preflight-implement.sh` (wherever `/pandacorp:implement`'s pre-launch
checks live), add a comparison: read the INSTALLED plugin's version (`plugin/runtime/plugin-metadata.json`
via the marketplace install path, or the installed `~/.claude/plugins/installed_plugins.json` SHA) against
whatever version marker the CURRENT session's `CLAUDE_PLUGIN_ROOT` resolves to (the plugin copy the running
session actually loaded at its own start). On a mismatch, print a clear, non-blocking warning: "el plugin
se actualizó a <installed> pero esta sesión sigue en <session> — reinicia la sesión antes de lanzar un
build" (Spanish, owner-facing per AGENTS.md language rule) and let the owner decide whether to proceed
(BL-0141's runtime fallback already covers the case where they launch anyway).

## Tests (prove the fix — TDD, RED → GREEN)
A test that stages a session/installed version mismatch (mock or fixture the two version sources) and
asserts the preflight prints the warning and does not block the launch; a matched-version case asserts no
warning. Extend the nearest existing preflight test harness (`run-engine-tests.sh`'s `.sh` suite set) rather
than inventing a new one, if one already exercises `launch-implement.sh`/`preflight-implement.sh`.

## Done when
- The version-skew warning fires on a real staged mismatch and stays silent on a match, proven by the new
  test case(s).
- `bash plugin/scripts/run-engine-tests.sh` stays green.
- BL-0141's "Out of scope" sub-item note is updated to point at this item's id once filed.

## Out of scope
Blocking the launch outright on a mismatch (this is advisory only, per BL-0141's own framing — "non-
blocking is fine; this item's runtime fallback already covers the case where the owner launches anyway").
Auto-restarting the session — Claude Code has no supported mechanism for a skill to restart its own host
session.
