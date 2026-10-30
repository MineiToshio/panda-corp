---
id: BL-0290
type: bug
area: build-engine
title: "infraSignal() classifies any thrown error as 'limit' or 'infra', with no bucket for a deterministic code defect in the engine's own logic"
status: open
severity: p2
opened: 2026-10-30
closed:
source: "mission-control/panda-corp build 2026-10-29 (agent-inferred, confirmed live in `plugin/runtime/engine/pandacorp-build.src.js:917-920`): a deterministic TypeError-shaped throw from a forbidden nondeterministic-primitive call inside the Workflow engine was classified as generic `infra` and reported with the usage-limit-style resumeHint, instead of surfacing as a code defect."
closes:
links: [LESSON-0558, LESSON-0114, BL-0291]
---

## Problem

`infraSignal()` (`plugin/runtime/engine/pandacorp-build.src.js:917`, mirrored in
`plugin/templates/shared/.claude/engines/pandacorp-build.js:300`) handles the `err` branch as:

```js
if (err) {
  const m = String((err && err.message) || err)
  return { kind: THROWN_LIMIT_RE.test(m) ? 'limit' : 'infra', detail: `threw: ${m.slice(0, 200)}` }
}
```

Every thrown error that doesn't match `THROWN_LIMIT_RE` (429/529/overloaded/rate-limit/usage-limit/quota/
too-many-requests wording) is classified `infra` — including a deterministic bug in the engine's OWN code
(observed live: a `TypeError`-shaped throw from a forbidden nondeterministic-primitive call inside a
Workflow script, per LESSON-0114). The run then halts via `haltForInfra()` with an infra/usage-limit framing
and a resumeHint that invites the owner to "just resume later" — the wrong remediation for a genuine code
defect, which resuming cannot fix. The defect's own error text is burled 200 chars deep in a generic halt
message, not surfaced as something that needs a code fix.

## Root cause

The classifier has exactly two buckets for a thrown error (`limit` / `infra`) with no third bucket for
"this error shape indicates a bug in the engine's own code," so any uncaught engine-internal exception
defaults into the SAME remediation path as a genuine provider outage.

## Fix plan

Add a third classification path in `infraSignal()`'s `err` branch: before falling back to `infra`, check
whether the error shape/message indicates a deterministic programmer error (e.g. `err instanceof TypeError`
/ `ReferenceError`, or a message matching a known-forbidden-operation signature) and, if so, return a new
`kind: 'engine-bug'` (or similar) that `haltForInfra()`/the caller routes to a LOUD "code defect, needs a
fix" report — never the resumeHint path. Land in both `pandacorp-build.src.js` and the generated
`plugin/templates/shared/.claude/engines/pandacorp-build.js` (keep them in sync per the existing generation
step); update `generate-engine.mjs`'s regeneration if the source file is the one hand-edited.

## Tests (prove the fix — TDD, RED → GREEN)

A scenario test (in the existing `test-build-engine.mjs`/`test-pandacorp-build.mjs` corpus) that throws a
`TypeError` from a mocked agent call and asserts the run halts with `kind: 'engine-bug'` (not `'infra'`) and
a message distinct from the usage-limit resumeHint. RED today (classified `infra`); GREEN after the fix.

## Done when

A deterministic/programmer-error-shaped throw is classified and reported distinctly from a genuine infra/
usage-limit signal, proven by the new scenario test; `test-engine-artifact.mjs` and the existing scenario
corpus stay green.

## Out of scope

Broadening the static nondeterministic-primitive check in `test-engine-artifact.mjs` (tracked separately as
BL-0291) — this item is scoped to the RUNTIME classifier, not the build-time static check.
