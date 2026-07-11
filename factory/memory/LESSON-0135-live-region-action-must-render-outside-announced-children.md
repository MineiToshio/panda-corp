---
id: LESSON-0135
type: gotcha
domain: accessibility
tags: [aria, live-region, banner, alert, screen-reader, a11y]
context: implementing or reviewing a Banner/Alert-type component that uses role="alert" or role="status" and needs to include an inline action (dismiss, retry, undo)
trigger: use this when a component with role="alert"/role="status" (a live region) needs to render an action element (a button, a link) alongside its message
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred): a Banner component using role=\"alert\"/role=\"status\" rendered its action button as a child inside the live-region text — screen readers announced, then RE-announced, the whole region (including the action label) every time it re-rendered, because the entire subtree is treated as live content"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0007]
---

**Situation:** a `Banner` component set `role="alert"` (or `role="status"`) to get assistive-technology
announcement of its message, and included an action button (e.g. "retry", "dismiss") as a normal React
child inside that same element. Because `role="alert"`/`role="status"` makes the ENTIRE subtree a live
region, every re-render of the banner (including ones that only touch the action button's own state, not
the message) causes screen readers to re-announce the whole region — message and action label together —
creating a confusing, repetitive announcement loop for assistive-technology users.

**Lesson:** a live-region role (`alert`/`status`) applies to everything nested inside it, not just the
text content it is meant to announce. Any interactive action bundled inside that subtree gets swept into
the same announce/re-announce behavior as the message, even though the action itself did not change and
does not need to be re-announced. This is a distinct a11y gotcha from ordinary ARIA-role misuse (compare
LESSON-0007's Biome-caught cases): it is not that the role is wrong, but that the region's CONTENT BOUNDARY
is wrong — the action does not belong inside the region that gets live-announced.

**Apply next time:** when a component with `role="alert"`/`role="status"` needs an inline action, render
the action in a slot OUTSIDE the live-announced text (a separate sibling element, or a designated `action`
prop rendered adjacent to, not nested inside, the `children`/message content) — never as a child of the
live region itself. This keeps the message the sole content re-announced on change, and keeps the action
element stable across re-renders from the screen reader's perspective.
