---
id: BL-0141
type: bug
area: build-engine
title: "build engine dies on its first spawn when a session's resident plugin lags the engine version, leaving the lease orphaned"
status: done
severity: p0
opened: 2026-09-22
closed: 2026-09-22
source: "owner-reported incident, canary A launch 2026-09-22 12:24 UTC, run wf_35a54be4-172"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js agent() wrapper + preLoopGuarded; plugin/runtime/event-vocabulary.json MechFallback event"
links: [BL-0152]
---

## Problem
Launching the canary A build on the 9.103.0 engine from a Claude Code session that was still running
plugin 9.102.3 (a plugin update applies at session restart, not mid-session) crashed the run on its very
FIRST agent spawn. `baseline-precheck` calls `agent(...)` with `agentType: MECH_AGENT('pandacorp:implementer')`,
which resolves to the new `'pandacorp:mech'` type (WP-03, `MECH_LEAN` defaults true) — a type the
9.102.3-resident session's runtime did not yet know about. The runtime rejected the spawn with:

```
Error: agent({agentType}): agent type 'pandacorp:mech' not found. Available agents: … pandacorp:implementer …
```

This exception was thrown from INSIDE `agent()` before any of the engine's own red/failed verdict checks
ever ran, and — because the scheduler loop did not exist yet at this point in the run — nothing caught it.
The whole Dynamic Workflow died, `.pandacorp/status.yaml` was left with `running: true`, and the atomic
build lease stayed held. The owner had to release it by hand before relaunching. `MECH_AGENT(fallback)` is
referenced at 15 call sites across the engine (`plugin/templates/shared/.claude/engines/pandacorp-build.js`),
so any one of them could have hit the identical failure mode; `baseline-precheck` just happened to be first.

Impact: a routine plugin-version lag between a long-running session and its freshly-updated engine turns
into a hard crash + a manually-recovered stuck lease, instead of a graceful degrade — exactly the kind of
transient runtime/plugin skew the factory otherwise treats as recoverable (DR-067, DR-069).

## Root cause
Two independent gaps compounded:
1. The `agent()` wrapper (BL-0022's `WORK_FROM` prepend wrapper) had no error handling at all — any
   rejection from the underlying runtime call propagated straight out, unretried and unlogged.
2. The pre-loop guaranteed-shutdown discipline (WS-D/D3's `ensureStopped()`, extended by REV2-6's
   `drainReadyQueuePreLoop()` try/catch) only covered ONE of the several awaited pre-loop spawns
   (`drainReadyQueuePreLoop()` itself). The baseline pre-check/repair spawns, a targeted change's
   integration, and both planner invocations had no equivalent boundary — an exception in any of them
   escaped with `running:true` still on disk and the lease unreleased.

## Fix plan
1. **`agent()` wrapper retry** (`plugin/templates/shared/.claude/engines/pandacorp-build.js`, the BL-0022
   `WORK_FROM` wrapper): catch a rejection whose message matches `agent type '<x>' not found` for the
   EXACT `agentType` this call requested. Retry ONCE with a fallback (`opts.fallbackAgentType` or
   `pandacorp:implementer` by default). If the requested type is `'pandacorp:mech'`, set a sticky
   module-level `mechUnavailable` flag so every LATER mech-typed call this run substitutes the fallback
   BEFORE spawning (no repeat 404), and log the explanatory message + inject one `MechFallback` dashboard
   event ONCE. Any OTHER `pandacorp:*` type 404s the same way but logged generically, without touching the
   sticky flag. A non-"not found" error, or a fallback that ALSO fails, is never retried a second time —
   the ORIGINAL error always propagates.
2. **D7 pre-loop boundary extension**: added `preLoopGuarded(fn)` next to `ensureStopped()` — the same
   `try { … } catch (e) { log(...); await ensureStopped('pre-loop failure: ' + e.message); throw e }`
   idiom `drainReadyQueuePreLoop()`'s own call site already used, reused (not restructured) at every other
   unprotected pre-loop await: the baseline pre-check spawn, the baseline-repair judge spawn, a targeted
   change's `processChange()` call, and both `runPlanner()` invocations (`'plan'` and `'plan-post-drain'`).
   `drainReadyQueuePreLoop()`'s own existing try/catch was left untouched (already correct, no regression
   risk to its behavior/message).
3. **`MechFallback` dashboard event**: registered in `plugin/runtime/event-vocabulary.json`
   (`agent.type-fallback` → display `MechFallback`) and the mission-control copy regenerated via
   `node plugin/scripts/generate-event-vocabulary.mjs`.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, appended block (prefix `FIX1`):
- **FIX1a** — `baseline-precheck` 404s on `pandacorp:mech` on the first attempt; asserts exactly one retry
  (now `pandacorp:implementer`), the retried prompt carries the one-time `MechFallback` event, every LATER
  mech-typed spawn this run (`safe-point-pre-loop`, `ensure-stopped`) goes straight to `implementer`
  without a repeat 404, and the explanatory log fires exactly once.
- **FIX1b** — a DIFFERENT `pandacorp:*` type (the planner's `pandacorp:architect`) 404s; asserts the same
  one-retry-with-implementer mechanism, logged, WITHOUT setting the sticky `mechUnavailable` flag (a later
  genuinely-mech spawn still requests `pandacorp:mech` normally).
- **FIX1c** — the fallback ALSO 404s; asserts no second retry, the ORIGINAL not-found error propagates
  (not the retry's own failure), and `ensure-stopped` is still spawned (D7 boundary releases the lease
  before the error escapes the engine).
- **FIX1d** — a generic (non-"not found") `agent()` failure; asserts it is NEVER retried (exactly one
  attempt) and the D7 boundary still releases the lease.

Confirmed RED before the fix (`git stash` on just the engine file): all four scenarios failed, including
FIX1c/FIX1d demonstrating the pre-existing D7 gap independently of the retry mechanism. GREEN after:
`node plugin/scripts/test-pandacorp-build.mjs` → 133 passed, 0 failed (129 pre-existing + 4 new, zero
regressions). `bash plugin/scripts/run-engine-tests.sh` green.

## Done when
- `node plugin/scripts/test-pandacorp-build.mjs` is green with the FIX1 scenarios included (133/133).
- `bash plugin/scripts/run-engine-tests.sh` is green (full suite, including the `.sh` suites).
- `bash plugin/scripts/validate-backlog.sh` is green with this item present.
- `plugin/runtime/event-vocabulary.json` carries the `MechFallback` event and
  `mission-control/src/lib/events/event-vocabulary.json` is regenerated from it (byte-identical to the
  source per `generate-event-vocabulary.mjs`).

All of the above are true as of this commit — `status: done`.

## Out of scope
**Session/engine version-skew detection at launch time.** This item fixes the RUNTIME symptom (an
in-flight build now degrades honestly instead of dying). It does NOT add a preflight check to
`launch-implement.sh` comparing the SESSION's resident plugin version (the `CLAUDE_PLUGIN_ROOT`/cache path)
against the installed plugin version the engine file itself was read from, to warn "reinicia la sesión"
BEFORE a build ever launches into this skew. That preventive check is a separate, smaller follow-up:

- **Sub-item (done, BL-0152):** `launch-implement.sh` should read the installed plugin's version (e.g. from
  `plugin/runtime/plugin-metadata.json` or the installed marketplace manifest) and compare it against
  whatever version marker the CURRENT session's `CLAUDE_PLUGIN_ROOT` resolves to; on a mismatch, print a
  clear "plugin actualizado pero la sesión sigue en <old> — reinicia la sesión antes de lanzar" warning
  (non-blocking is fine; this item's runtime fallback already covers the case where the owner launches
  anyway). Filed and implemented as **BL-0152** — the check landed in `preflight-implement.sh` (not
  `launch-implement.sh`, the read-only gate that already owns every other advisory version check), and
  is corroborated by a second, direct agentType-coverage check against the session's own `plugin/agents/`.
