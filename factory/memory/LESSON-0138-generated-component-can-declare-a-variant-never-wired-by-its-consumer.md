---
id: LESSON-0138
type: gotcha
domain: design-process
tags: [design-system, dead-code, wiring, reconciliation, verification, responsive]
context: reviewing a design-system component generated with a conditional/responsive variant (a prop, a docstring promising activation under some condition) before trusting that the variant is actually reachable at runtime
trigger: use this when a generated component's docstring/prop declares a conditional variant (a breakpoint-activated layout, a state-triggered style) and you are about to trust that it works without tracing its consumer
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred): the generated Nav component implemented layout=\"rail\" with a docstring promising activation at >=1024px, but the AppShell that renders Nav always mounted the bottom-bar variant unconditionally — the rail layout existed only as a hand-drawn mock on a responsive-overview card, never actually wired at runtime; found only by tracing AppShell's render code, not by visual review or the cross-screen closing sweep (which only diffs usage across SCREENS, not internal wiring)"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0057, BL-0059, LESSON-0141]
---

**Situation:** a design-system generation pass produced a `Nav` component with a `layout="rail"` prop and
a docstring promising it activates at viewport widths >=1024px. The screens looked correct in every
review (a responsive-overview mock card even showed the rail visually). But the actual consumer,
`AppShell`, always mounted the bottom-bar variant of `Nav` unconditionally — nothing in the codebase ever
read the viewport and branched to `layout="rail"`. The variant was declared and documented but never
wired. This was invisible to the standard cross-screen "closing sweep" reconciliation check, because that
check only diffs components/patterns actually USED across generated screens against the system gallery —
a variant that no screen ever needed to invoke (because its consumer always picks the other branch) never
shows up as a discrepancy in that diff.

**Lesson:** a generated component's own docstring or prop signature is a CLAIM about behavior, not
evidence that the behavior is reachable — the same "verify the real computation/wiring, don't trust the
artifact's self-description" class as LESSON-0057, but for conditional/responsive variants specifically.
A component can carry a fully-implemented, plausible-looking variant that is simply dead: declared,
documented, even visually mocked once, and never triggered by any code path. Cross-screen usage-diff
reconciliation (checking "is X used somewhere") does not catch this, because the defect is about whether
a variant's OWN trigger condition is ever evaluated, not whether the variant appears in a screen.

**Apply next time:** when a design-system component declares a conditional/responsive variant (a
breakpoint-activated layout, a state-triggered style), trace its actual consumer(s) to confirm the
declared trigger condition is read and branched on somewhere in the generated code — do not rely on the
docstring, a visual mock, or a cross-screen usage diff as proof it is wired. If no consumer branches on
it, treat it as dead code: either wire it or prune the declared variant.
