---
id: LESSON-0057
type: gotcha
domain: agent-verification
tags: [documentation-drift, getComputedStyle, css-debugging, component-inventory]
context: diagnosing why a documented CSS visual effect (e.g. a utility class claimed "CSS-only") isn't working, using a hand-maintained component/style inventory doc as a reference
trigger: use this when a hand-maintained component/style inventory doc (e.g. docs/design/components.md) is used as ground truth while diagnosing a "why doesn't this visual effect work" bug
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0027, LESSON-0069]
---

**Situation:** a project's own component inventory doc (`docs/design/components.md`) contained a factual
error — it claimed a `.spotlight` class was "CSS-only", grouped alongside utilities (hover-lift, sheen)
that genuinely were. Trusting that claim while diagnosing why the spotlight effect wasn't working would
have sent the investigation in the wrong direction.

**Lesson:** a hand-maintained inventory/reference doc can drift from the actual code and assert things
that are simply wrong, not just stale (distinct from LESSON-0027's "stale audit snapshot" — here the doc
was factually incorrect about a mechanism, not merely outdated). When a documented mechanism ("this is
CSS-only") doesn't match observed behavior, don't treat the doc as the tiebreaker.

**Apply next time:** when diagnosing why a visual effect doesn't work, verify the actual CSS (does the
class reference a custom property that nothing in the codebase ever sets?) and grep for the runtime code
that would set any required state/property, rather than trusting a component inventory doc's
characterization of the mechanism.
