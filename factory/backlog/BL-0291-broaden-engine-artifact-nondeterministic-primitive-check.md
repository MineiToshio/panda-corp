---
id: BL-0291
type: change
area: build-engine
title: "test-engine-artifact.mjs's forbidden-primitive static check only covers Date.now()/new Date(), not Math.random()/performance.now()/process.hrtime()"
status: open
severity: p2
opened: 2026-10-30
closed:
source: "mission-control/panda-corp build 2026-10-29 (agent-inferred): a forbidden nondeterministic-primitive call inside the generated Workflow engine passed all 230 scenario-test-harness scenarios (the harness stubs `Date`, masking the violation per LESSON-0114's 2026-10-29 corroboration) and only died on the first real live run; the ONE static safety net that could have caught it build-time, `plugin/scripts/test-engine-artifact.mjs:53`, only greps for `Date.now(`/`new Date(`."
closes:
links: [LESSON-0114]
---

## Problem

`plugin/scripts/test-engine-artifact.mjs:53` runs exactly one static regex check against the generated
engine artifact:

```js
check(!/\bDate\.now\(|\bnew Date\(/.test(artifact), "artifact uses no Date.now()/new Date() (unavailable in a Workflow script)");
```

This is the only build-time safety net independent of the scenario-test harness (which stubs `Date` for
every scenario, per LESSON-0114, and therefore cannot itself catch a Date-based violation, let alone any
OTHER nondeterministic primitive). The rule it enforces (LESSON-0114: no wall-clock/RNG reads inside a
Workflow script) forbids MORE than `Date.now()`/`new Date()` — `Math.random()`, `performance.now()`,
`process.hrtime()` and similar are equally unsafe for resume-safety, but none of them are checked here, so
a violation using any of those would ALSO pass every scenario and the static check, surfacing only on a
live run exactly like the incident that motivated this item.

## Fix plan

Broaden the regex (or switch to a small named list checked in a loop, for a clearer failure message per
primitive) in `test-engine-artifact.mjs` to also reject `Math.random(`, `performance.now(`,
`process.hrtime(`, and any other nondeterministic primitive LESSON-0114/`build-orchestration.md` names.
Keep the check's failure message naming WHICH primitive matched, not just "a forbidden primitive was found."

## Tests (prove the fix — TDD, RED → GREEN)

Add a fixture/unit case in `test-engine-artifact.mjs`'s own suite (or a sibling test file) that injects
`Math.random()` into a copy of the generated artifact and asserts the check now fails; confirm the real
generated artifact still passes (no false positive). RED today for the injected fixture (the check doesn't
catch it); GREEN after broadening the regex.

## Done when

The static check in `test-engine-artifact.mjs` rejects every primitive `build-orchestration.md`/LESSON-0114
names as forbidden inside a Workflow script, proven by the new fixture test; the real generated artifact
stays green.

## Out of scope

The runtime failure-classification gap when a forbidden-primitive violation DOES reach a live run (tracked
separately as BL-0290); this item is scoped to catching the violation BEFORE it ships.
