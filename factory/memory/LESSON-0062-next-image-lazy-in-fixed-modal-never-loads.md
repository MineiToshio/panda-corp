---
id: LESSON-0062
type: gotcha
domain: react
tags: [next-image, lazy-loading, intersection-observer, modal, fixed-position]
context: rendering a `next/image` component inside a fixed-position modal/lightbox with the default lazy loading behavior
trigger: use this when a `next/image` inside a modal/lightbox never loads or stays blank
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a `next/image` with the default `loading="lazy"` rendered inside a fixed-position modal
never loaded — the image stayed blank indefinitely.

**Lesson:** `next/image`'s lazy loading relies on an `IntersectionObserver` confirming the image entered
the viewport. An element inside a `position: fixed` modal (especially one that may be conditionally
rendered/mounted, off-screen, or whose containing context confuses the observer) never fires that
confirmation, so the lazy-load promise never resolves and the image never loads at all — not just late.

**Apply next time:** set `priority` on any `next/image` rendered inside a modal/lightbox (or otherwise
outside normal document scroll flow), bypassing lazy-loading entirely, rather than relying on the
default `IntersectionObserver`-driven lazy behavior.
