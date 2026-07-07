---
id: LESSON-0100
type: gotcha
domain: build-engine
tags: [reviewer, acceptance-criteria, grep, indirection, gate]
context: an acceptance-criteria clause (or any reviewer gate check) implemented as a literal source-string grep for a function/symbol name across a set of files
trigger: use this when an AC clause reads "some real read path consumes <helper/function name>" and you're tempted to satisfy it through a wrapper or lib-level indirection
source: "mission-control .pandacorp/run/lessons.md 2026-07-06/07 (FRD-23 aggregate wiring, AC-23-003.1) — agent-inferred; a prior attempt hid the call behind a lib helper and RED'd"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an acceptance criterion worded as "some real read path consumes `readStatsAggregate`" was
enforced by the reviewer as a literal source grep of the app/component directories for the string
`readStatsAggregate` — indirection through an intermediate `src/lib` helper (which itself called the
reader) did NOT satisfy it, because the literal name never appeared at the grepped call site. A prior
attempt hid the call behind exactly such a helper and the AC RED'd.

**Lesson:** when an AC/gate check is implemented as a plain-text grep (not an AST/type-level check), the
check is literal, not semantic — it verifies that the NAMED symbol textually appears at the real read path,
not merely that the effect is achieved through some indirection. A correct implementation from the app's
perspective can still fail a literal-grep AC if it factors the call behind a wrapper.

**Apply next time:** when an AC is phrased as "X consumes/calls Y" and the gate is a source grep, have the
actual page/route/consumer reference the named function DIRECTLY (import and call it by name), not through
an intermediate helper — even if the helper is otherwise good factoring, it will fail a literal-grep check.
If the indirection is architecturally preferred, flag the AC's wording as too literal instead of fighting it.
