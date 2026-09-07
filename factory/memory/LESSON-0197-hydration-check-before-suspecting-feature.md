---
id: LESSON-0197
type: pattern
domain: testing
tags: [playwright, e2e, hydration, diagnosis, next-themes]
context: an e2e suite where interaction tests fail (clicks/toggles do nothing) but render/screenshot tests on the same pages pass
trigger: use this when Playwright interaction tests fail while render/smoke tests on the same pages pass
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06 (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040, LESSON-0185]
---

**Situation:** e2e interaction tests failed (a theme toggle stayed `[disabled]`, a drawer and a Lightbox
never opened) while render/smoke tests on the same pages passed clean. The root cause turned out to be an
HMR WebSocket handshake failure (see LESSON-0040), not a feature regression — but the diagnostic move that
named it first was checking hydration, not the feature code.

**Lesson:** a control that is disabled-until-mounted (e.g. `next-themes`' toggle) is a free "did this page
actually hydrate?" oracle, already present in the very failure snapshot the test produces. When
interaction tests fail but render tests pass, check hydration status BEFORE suspecting the feature under
test.

**Apply next time:** on an interaction-vs-render split failure, first look for a mount-gated control in
the failure snapshot/DOM; if it's stuck in its pre-hydration state, the fault is upstream of the feature
(client bundle/HMR/hydration), not in the feature's own logic. A ~20-line Playwright probe logging
`console`/`pageerror`/`requestfailed` names the real cause in one run.
