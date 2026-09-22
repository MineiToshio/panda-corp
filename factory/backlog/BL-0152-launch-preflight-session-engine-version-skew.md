---
id: BL-0152
type: change
area: build-engine
title: "launch-implement.sh / preflight-implement.sh should warn on session-plugin vs installed-engine version skew before launching a build"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "BL-0141's own Out of scope sub-item, restated here as a standalone trackable item (incident: canary A launch 2026-09-22 12:24 UTC, run wf_35a54be4-172)"
closes: "plugin/scripts/preflight-implement.sh §2b/§2c (session-vs-installed plugin version skew + engine agentType coverage)"
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
- [x] The version-skew warning fires on a real staged mismatch and stays silent on a match, proven by the new
  test case(s).
- [x] `bash plugin/scripts/run-engine-tests.sh` stays green.
- [x] BL-0141's "Out of scope" sub-item note is updated to point at this item's id once filed.

## Out of scope
Blocking the launch outright on a mismatch (this is advisory only, per BL-0141's own framing — "non-
blocking is fine; this item's runtime fallback already covers the case where the owner launches anyway").
Auto-restarting the session — Claude Code has no supported mechanism for a skill to restart its own host
session.

## Resolution
Landed in **`preflight-implement.sh`** (not `launch-implement.sh`) — it is the read-only, advisory gate
every other DR-048-style version check (overlay_version §2) already lives in, and it runs before
`launch-implement.sh` takes the build lease, so the owner sees the warning with nothing yet mutated.

**Session-version signal — verified, not the ambient `CLAUDE_PLUGIN_ROOT` env var.** A live check inside
this session's own Bash tool confirmed `CLAUDE_PLUGIN_ROOT` is EMPTY as an exported shell variable (it is
only textually substituted by Claude Code when assembling a skill's `${CLAUDE_PLUGIN_ROOT}/scripts/...`
command, before the shell ever runs) — the same caveat `launch-implement.sh` already documents for Dynamic
Workflow subagents turned out to apply to the top-level session's own shell too. The reliable signal
instead: `preflight-implement.sh` is invoked BY that substituted path, so `$0` (already captured as
`$SCRIPT_DIR`) sits inside the exact plugin copy the session loaded — reading
`$SCRIPT_DIR/../runtime/plugin-metadata.json`'s `.version` directly gives the session's own plugin version,
no path-parsing of a cache directory name required.

**Installed-version signal** — `~/.claude/plugins/installed_plugins.json`, key `pandacorp@panda-corp`: the
exact file/key `claude plugin update` maintains and the one mission-control's FRD-15 drift banner already
reads (`mission-control/src/lib/plugin-sync/plugin-sync.ts`, `readInstalledVersion`/`PLUGIN_KEY`) — reused
here instead of re-deriving a second reader for the same fact (clean-code.md, one writer/one reader shape).

**Two independent WARN-only checks, both new (§2b/§2c), neither ever increments `$FAILS`:**
1. **§2b — plugin version skew.** Session version vs installed version: BEHIND → WARN with the exact
   BL-0141-quoted Spanish message, naming both versions; EQUAL → PASS; AHEAD (the normal factory-dev
   shape — `main` ahead of the last `claude plugin update` sync) → silent PASS, mirroring §2's own
   "AHEAD ... proceeding" tolerance so factory development never produces a false-positive WARN, as flagged
   as a risk in this item's brief. Either input file absent (no marketplace install — a bare repo checkout)
   → total silence, not even a WARN — there is no session/installed skew concept there.
2. **§2c — engine agentType coverage.** A DIRECT check, independent of any version-number scheme: greps the
   PROJECT's copied engine (`.claude/engines/pandacorp-build.js`) for every literal `agentType: 'pandacorp:
   ...'` plus `pandacorp:mech` whenever a `MECH_AGENT(` call is present, and checks each against the
   session's own `plugin/agents/*.md` roster (next to `$SCRIPT_DIR`). This is what directly reproduces the
   BL-0141 incident (missing `mech.md`) and also catches a same-version session that is simply missing a
   just-added agent file — a case a semver comparison alone cannot see.

**Tests** — new `plugin/scripts/test-preflight-version-skew.sh` (16 cases), run via `run-engine-tests.sh`'s
`EXPLICIT_SH_SUITES`. Exercises the REAL `preflight-implement.sh` against a synthetic fake plugin copy
(`runtime/plugin-metadata.json` + `agents/*.md`) and a synthetic `$HOME/.claude/plugins/installed_plugins.json`
(via `HOME=` override) — the real global file is never read or written. Confirmed RED (7/16 failing) against
the untouched original script, GREEN (16/16) after. Full suite: `bash plugin/scripts/run-engine-tests.sh` —
24/24 (was 23), and `test-run-engine-tests.sh`'s own self-test green (still correctly discovers 24).

No change to `.claude/engines/pandacorp-build.js` itself, so no mission-control engine re-sync was needed
(`diff` confirmed byte-identical, untouched).
