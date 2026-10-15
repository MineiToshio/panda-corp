---
id: LESSON-0323
type: gotcha
domain: design-verification
tags: [claude-artifact, mobile-emulation, fixed-positioning, navigation]
context: verifying a mobile/narrow-width layout for a mockup that will be reviewed inside a claude.ai Artifact link, when the layout relies on a position:fixed bottom navigation bar
trigger: use this when a mockup verified with standard mobile viewport emulation (e.g. Playwright at a phone width) still might show NO visible navigation to the owner once published as a claude.ai Artifact, especially if the design uses a fixed bottom tab/nav bar
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred hypothesis from the owner's report — not independently reproduced, because the agent's own browser session could not reach the owner's logged-in Artifact view): a mobile-emulated Playwright check of the narrow layout confirmed the bottom tab bar rendered correctly in local testing, yet the owner reported seeing no navigation at all on the published Artifact link at a narrow width"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0047]
---

**Situation:** a layout used a `position: fixed` bottom navigation bar for narrow widths. Local
Playwright mobile-viewport emulation showed the bar rendering correctly at the expected position. The
owner, viewing the same mockup through its published claude.ai Artifact link at a narrow width,
reported seeing no navigation at all.

**Lesson:** the claude.ai Artifact viewer can render a page sized to its OWN total content height
rather than the device viewport height it is emulating — when that happens, anything positioned via
`position: fixed` relative to the viewport ends up anchored to the end of the (much taller) rendered
document instead of staying pinned to the visible screen edge, so a fixed bottom bar scrolls off-screen
entirely. Standard headless mobile-viewport emulation does not reproduce this, because it correctly
sets a fixed viewport height that the Artifact viewer's own rendering mode may not actually honor —
this makes the defect invisible to the normal verification pass and visible only in the real
published-Artifact context.

**Apply next time:** for any narrow-width layout that will be reviewed through a claude.ai Artifact
link, avoid relying on `position: fixed` chrome (bottom tab bars especially) as the ONLY way to reach
navigation; prefer a header-anchored menu (e.g. a hamburger toggle) that doesn't depend on
viewport-relative fixed positioning. When verifying, also test narrow DESKTOP browser windows (not
only phone emulation) as a cheap second signal, since it exercises layout at a narrow width without
assuming a mobile-specific viewport contract the Artifact viewer may not actually provide.
