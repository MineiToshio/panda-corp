---
id: LESSON-0006
type: gotcha
domain: javascript
tags: [javascript, immutability, object-freeze, prototype-pollution, dictionary, shallow-copy, gotcha]
context: hand-rolled immutability and dictionary patterns in TypeScript/JavaScript that look safe but are not, caught by mutation/adversarial testing during Mission Control's build
source: mission-control lessons.md — WO-04-003 (2026-06-16, BUILDING_ROWS shallow copy), WO-12-003 (2026-06-16, dictionary keyed by user strings), BUILD_MODES catalog freeze (2026-06-16)
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: high
times_applied: 0
links: []
---

**Situation:** Three related immutability/dictionary bugs surfaced independently during Mission Control's
build via mutation-style adversarial tests, all in the same family (JS's structural-sharing and prototype
semantics silently defeat naive "safe" code).

**Lesson:**
1. **`[...CONST_ARRAY]` only copies the outer array; inner objects remain shared references.** A "pure"
   function that returns `[...BUILDING_ROWS]` hands callers a reference into the module-level constant —
   mutating `rows[0].command = "X"` corrupts every subsequent call. TypeScript's `readonly` annotation is
   compile-time only and does not freeze anything at runtime. **Fix:** shallow-copy each entry —
   `CONST_ARRAY.map((r) => ({ ...r }))`.
2. **`Object.freeze` on an array of objects is shallow.** The array itself is frozen (no push/pop) but
   each entry object stays mutable. For a catalog of shared singleton entries (e.g. a `BUILD_MODES`
   catalog), map + `Object.freeze` each entry individually.
3. **A plain `{}` used as a dictionary keyed by user-supplied strings is unsafe.** `__proto__` as a key is
   silently swallowed (the assignment never creates an own property — data loss, not a crash). Keys like
   `"constructor"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"` read the inherited prototype member via
   `obj[key] ?? 0`, producing type-confused results (e.g. a function instead of a number). **Fix:** create
   the dict with `Object.create(null)`, read with `Object.hasOwn(obj, key) ? obj[key] : 0`, and copy with
   `Object.assign(Object.create(null), src)` (not spread, which re-attaches `Object.prototype`).

**Apply next time:** When a function returns a constant catalog/array of objects to callers, or builds a
dictionary keyed by external/user strings, don't trust `readonly`, `[...x]` or `Object.freeze` alone to
make it safe — verify with an adversarial test that actually mutates the returned reference or probes a
prototype-polluting key (`__proto__`, `constructor`). This class of bug is invisible to type-checking and
to a happy-path test suite.
