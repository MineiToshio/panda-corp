---
id: LESSON-0392
type: gotcha
domain: css
tags: [css, fixed-bottom-bar, safe-area, mobile, calc]
context: padding body content so it isn't hidden behind a fixed bottom bar (tab bar, nav bar) that has a visible border
trigger: use this when a fixed bottom bar has N px of item height plus a 1px top border, and body content below it is padded by a height token to avoid being covered
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a fixed bottom bar was N px tall plus a 1px top border, rendering N+1px total. Content
below it was padded by the bar-height token alone, so the last 1px of content sat behind the
border.

**Lesson:** a fixed element's visible footprint includes its border, not just its declared
content/box height — padding by the height token alone systematically hides a sliver of content
equal to the border width. On mobile this compounds with the safe-area inset, which also must be
added, not assumed covered by the bar's own height.

**Apply next time:** pad body content below any fixed bar with
`calc(var(--bar-height) + var(--border-width) + env(safe-area-inset-bottom))`, not the height token
alone.
