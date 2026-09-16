---
id: LESSON-0036
type: gotcha
domain: web-performance
tags: [scroll-reveal, intersection-observer, visual-baseline, playwright, screenshot]
context: a scroll-reveal animation primitive (opacity:0 until IntersectionObserver fires) combined with a fullPage Playwright visual-baseline gate captured at scroll position 0
trigger: use this when a page uses a scroll-reveal/IntersectionObserver animation primitive and a Playwright fullPage screenshot baseline is failing to bless (looks blank below the fold)
source: "personal-page-v2 .pandacorp/run/lessons.md — useReveal (.reveal/.stagger, WO-01-001), home (FRD-02) and projects (FRD-03) shipped blessed:false. Corroborated/extended 2026-09-06 (harvested 2026-09-07): the gate was confirmed STRUCTURALLY unable to catch a broken page here — six surfaces were left `blessed:false` because of exactly this mechanism, and the ONE surface that WAS blessed (`/contact`) had content missing from its own blessed baseline (a gate that would have passed GREEN while the page was broken). The shipped fix revealed the settled state when `navigator.webdriver` is true (plus `@media print`, since a printed page is never scrolled either) — matching this lesson's own option (b). Making reveals visible under automation then immediately surfaced FOUR pre-existing responsive overflows the Responsive Gate had never been able to measure (they were invisible) and one wall-clock-relative date that would have expired every 'Now' baseline on its own — a second wave of findings that only appeared because the fix made previously-unmeasured content measurable. Further corroborated 2026-09-15 (personal-page-v2, agent-inferred): the SAME fullPage-without-real-scroll blind spot also hits plain `next/image` `loading=\"lazy\"` below-the-fold images (not just a custom reveal primitive) — a blog's 'Related posts' cover images render as empty boxes in the capture, so the blessed baseline itself encodes a blank cover as correct; a genuinely broken cover image there would go unnoticed forever, since both the broken and working states screenshot identically (empty box) under this gate."
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
`opacity:1`/`is-visible` on ALL reveal nodes regardless of intersection state — e.g. reveal the settled
state whenever `navigator.webdriver` is true, and also under `@media print` (a printed page is never
scrolled either) — not just a transition-disabling rule. Fix this at the primitive level, not per-page —
every surface using the primitive inherits the same failure. **Check what a baseline actually CONTAINS,
not just whether it blessed:** a gate can silently degrade to asserting almost nothing when a
scroll-triggered reveal meets a screenshot gate — even a `blessed:true` baseline can be missing content if
it was captured before this class of fix. **Budget for a second wave of findings** after shipping this
fix: making previously-invisible content visible under automation tends to surface pre-existing issues
(responsive overflows, stale relative dates, etc.) that were simply never measurable before. **The same
blind spot applies to NATIVE `loading="lazy"` images, not just custom reveal primitives:** a `fullPage`
screenshot taken without an actual scroll-through never triggers native lazy-image loading either, so
below-the-fold `<img loading="lazy">`/`next/image` content also bakes an empty/placeholder box into the
blessed baseline — set `loading="eager"`/`priority`, or force-load images the same way (a) or (b) force
reveal nodes, before trusting a fullPage baseline that includes lazy-loaded images as real coverage.
