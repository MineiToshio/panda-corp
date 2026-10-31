---
id: LESSON-0567
type: gotcha
domain: testing
tags: [reviewer, restyle, vacuous-pass, negative-assertion, green-does-not-mean-correct]
context: a reviewer rewrites a v1 test suite to match a v2 restyle/redesign, and judges the rewrite by whether the suite is green
trigger: "use this when a reviewer rewrites an existing test suite to match a restyle/redesign — before trusting the rewritten suite's green run as proof the rewrite is correct"
source: "mission-control WO-14-005, 2026-10-30 (agent-inferred) — a reviewer rewriting v1 suites for a restyle read only the previously-failing assertions; a retired testid/wording still asserted by a PASSING negative assertion (queryByTestId(\"banner\"), stale copy like \"segura para probar\") went vacuously green instead of being caught as stale"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0074, LESSON-0559]
---

**Situation:** during a restyle, a reviewer rewrote a v1 test suite's failing assertions to match the new
v2 contract. The suite went green afterward, but a PASSING negative assertion from the old suite —
`queryByTestId("banner")` expected absent, old copy text like "segura para probar" expected absent — was
never re-examined, because it was already passing and the rewrite pass only looked at what was red. The
testid/wording it asserted against had been RETIRED by the restyle, so the assertion was vacuously true
(the thing it checked for the absence of no longer exists under any contract, old or new) rather than
meaningfully verifying anything about the new design.

**Lesson:** this is the same "green does not mean correct" family LESSON-0074 already tracks
(characterization suites bless whatever the system currently does), one level deeper: a reviewer rewrite
pass that only touches RED assertions treats a PASSING one as proof it still verifies something, when a
negative assertion against a retired identifier/wording passes vacuously for a reason unrelated to
correctness. The suite looks rewritten and green; a chunk of it has quietly stopped checking anything.

**Apply next time:** when rewriting a test suite for a restyle/redesign, read the PASSING assertions too,
not just the failing ones — specifically check every negative assertion (`queryBy*` expected absent, a
`not.toContain`/`not.toHaveText` on retired copy) against whether the testid/wording it names still exists
anywhere in the current or new contract; a negative assertion on something nobody emits anymore is dead
weight, not coverage. Separately: when adding new props to a component mid-rewrite, pass them through a
spread rather than enumerating every call site by hand — a test written ahead of the rest of the rebuild
otherwise reds `tsc` for every other, unrelated work order touching that component.
