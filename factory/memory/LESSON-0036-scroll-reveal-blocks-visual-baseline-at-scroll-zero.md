---
id: LESSON-0036
type: gotcha
domain: web-performance
tags: [scroll-reveal, intersection-observer, visual-baseline, playwright, screenshot]
context: a scroll-reveal animation primitive (opacity:0 until IntersectionObserver fires) combined with a fullPage Playwright visual-baseline gate captured at scroll position 0
trigger: use this when a page uses a scroll-reveal/IntersectionObserver animation primitive and a Playwright fullPage screenshot baseline is failing to bless (looks blank below the fold)
source: "personal-page-v2 .pandacorp/run/lessons.md — useReveal (.reveal/.stagger, WO-01-001), home (FRD-02) and projects (FRD-03) shipped blessed:false"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a `useReveal` scroll-reveal primitive hid all below-the-fold content at `opacity:0` until
an `IntersectionObserver` fired on scroll. A Playwright `fullPage` screenshot taken at scroll position 0
(the visual baseline gate) therefore captured a mostly-blank page on every surface using the primitive. A
`tl-frozen` guard (meant to freeze animations for screenshotting) did NOT fix it — it only disables the
CSS transition; it never force-adds the `is-visible` class to nodes that never intersected the viewport.
Both the home and projects surfaces shipped with `blessed:false` as a result.

**Lesson:** a scroll-reveal/IntersectionObserver primitive and a `fullPage`-at-scroll-0 visual baseline
gate are structurally incompatible unless the freeze mechanism explicitly accounts for un-intersected
nodes. Disabling the *transition* (so nothing animates mid-capture) is not the same as forcing the *end
state* (fully visible) on content the observer never triggered because the viewport never scrolled past
it.

**Apply next time:** when building a scroll-reveal primitive intended to coexist with an automated visual
baseline, either (a) have the visual gate programmatically scroll through the full page before capturing
(triggering every observer), or (b) give the "frozen for capture" mode a CSS rule that forces
`opacity:1`/`is-visible` on ALL reveal nodes regardless of intersection state (e.g.
`html.tl-frozen .reveal { opacity: 1 !important; }`), not just a transition-disabling rule. Fix this at
the primitive level, not per-page — every surface using the primitive inherits the same failure.
