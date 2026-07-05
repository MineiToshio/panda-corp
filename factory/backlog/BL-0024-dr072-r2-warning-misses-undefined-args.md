---
id: BL-0024
type: bug
area: build-engine
title: "DR-072 R2's args-drop warning never fires when args is undefined, only when it is a non-object string"
status: done
severity: p1
opened: 2026-07-03
closed: 2026-07-04
source: "factory/memory/_inbox.md 2026-07-02 note — Workflow tool run 2026-07-02 degraded to plan mode with 'all verified' after args was silently dropped as undefined"
closes:
links: [DR-072]
---

## Problem

`plugin/templates/shared/.claude/workflows/pandacorp-build.js` (around line 91) guards against the
Workflow-tool serialization bug (DR-072 R2, `args` arriving as a JSON string instead of an object) with:

```js
if (args && typeof args !== 'object') log(`⚠⚠ args arrived as a ${typeof args}, NOT an object — mode/maxAgents/maxFrds were DROPPED. This run is UNBOUNDED. Stop and relaunch passing args as a JSON object (DR-072 R2).`)
```

The leading `args &&` short-circuits the whole check when `args` is `undefined` — which is exactly the
failure mode hit on 2026-07-02: the Workflow tool's permission handler rewrote/dropped the input
entirely (not just serialized it as a string), `args` arrived `undefined`, the warning never fired, and
a `change:`-scoped run silently degraded to a normal plan pass reporting "all verified" without
processing the intended scope. The operator only caught it by noticing the run's behavior didn't match
the intended scope, then worked around it with a hardcoded-fallback copy of the engine
(`CHANGE`/`MAX_AGENTS` as `|| <value>` defaults) relaunched via `scriptPath`.

Impact: DR-072 R2 was written specifically to make this failure loud; the `undefined` case is the one
observed in production and it stays silent, exactly the outcome R2 was meant to prevent.

## Root cause

The guard `if (args && typeof args !== 'object')` treats a falsy `args` (`undefined`, `null`, `""`, `0`)
as "nothing to warn about", but the DR-072 R2 intent is "warn whenever `args` did not arrive as the
expected object" — `undefined` is squarely inside that intent, not outside it. The condition was written
for the one serialization failure observed at the time (string) and not generalized to "not an object of
the expected shape", including the absent case.

## Fix plan

In `plugin/templates/shared/.claude/workflows/pandacorp-build.js`, broaden the DR-072 R2 guard so it
fires whenever `args` is not a proper object with the expected keys, not only when it is a truthy
non-object:

```js
if (typeof args !== 'object' || args === null) log(`⚠⚠ args arrived as ${args === undefined ? 'undefined' : typeof args}, NOT an object — mode/maxAgents/maxFrds/change scope were DROPPED. This run is UNBOUNDED and may silently skip the intended scope. Stop and relaunch passing args as a JSON object (DR-072 R2).`)
```

Also apply the same broadened check anywhere else in the file that reads `args.mode`/`args.maxAgents`/
`args.maxFrds`/`args.change`/`args.frds` directly without a prior existence check, so a dropped `args`
cannot silently fall through to defaults without at least one loud warning at the top of the run.
Bump `OVERLAY_VERSION` (templates changed) and the plugin's PATCH version (fix, no new capability).

## Tests (prove the fix — TDD, RED → GREEN)

RED: a unit/script test that invokes the workflow's args-guard logic (extracted or exercised via a
small harness) with `args = undefined` and asserts today it produces NO warning log line — fails to
assert (i.e. currently the assertion "a warning was logged" is false, proving the gap).
GREEN: after the fix, the same test with `args = undefined` asserts the warning line IS logged and
mentions "undefined". Add a second case with `args = '{"mode":"change"}'` (the original string-drop
case) to confirm it still warns (no regression). Where a real invocation harness is impractical, a
documented manual repro is acceptable: relaunch a Workflow-tool run with an intentionally-stripped
`args` and confirm the log line appears before any work begins.

## Done when

- The guard fires for `undefined`, `null`, and non-object-string `args`, verified by the test above.
- `OVERLAY_VERSION` and plugin `version` are bumped (PATCH) in `plugin/.claude-plugin/plugin.json`.
- `plugin/docs/decision-log.md` records the fix referencing DR-072 R2.

## Out of scope

Does not change the PATCH-FIRST/revert convergence logic of DR-072/DR-073 itself — only the
args-arrival warning. Does not add a general schema validator for `args` beyond the existence/type
check described above.
