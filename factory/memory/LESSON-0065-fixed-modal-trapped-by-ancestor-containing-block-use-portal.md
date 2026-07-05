---
id: LESSON-0065
type: gotcha
domain: react
tags: [position-fixed, containing-block, portal, modal, will-change, css]
context: "a `position: fixed` modal/lightbox rendered inside a DOM subtree where an ancestor establishes a containing block for fixed descendants"
trigger: "use this when a `position: fixed` element renders small/mispositioned/trapped instead of covering the viewport"
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — owner spotted it (case-study header cover Lightbox trapped inside a `.reveal` wrapper)"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0019, LESSON-0045]
---

**Situation:** a `position: fixed` Lightbox modal did not escape to the viewport as expected — it
rendered small and mispositioned, trapped inside its parent. Root cause: the scroll-reveal wrapper
(`.reveal`) the modal was nested inside set `will-change: transform`, which (like `transform`, `filter`,
`perspective`, or `contain`) establishes a new containing block for `position: fixed` descendants,
overriding the expectation that `fixed` always positions relative to the viewport.

**Lesson:** `position: fixed` does NOT guarantee viewport-relative positioning if ANY ancestor sets
`transform`, `filter`, `perspective`, `contain`, or `will-change: transform` — the fixed element becomes
positioned relative to that ancestor instead, silently breaking full-viewport overlays/modals. This is
easy to miss because the CSS causing it (an animation-performance hint like `will-change`, applied for
an unrelated reason) is often far from the modal's own code.

**Apply next time:** render modals/lightboxes/full-viewport overlays via `createPortal(modal,
document.body)` so they always escape any ancestor's containing-block context, rather than relying on
`position: fixed` alone inside the normal component tree — this also sidesteps having to audit every
ancestor for transform/filter/contain/will-change.
