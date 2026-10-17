---
id: LESSON-0382
type: pattern
domain: css-architecture
tags: [prototype, demo-chrome, design-tokens, sticky-offset]
context: a prototype or internal preview build that overlays demo-only chrome (a banner, a strip, a mode switcher) on top of the real product UI
trigger: use this when a prototype's demo-only chrome (a strip, banner, or dev toolbar) needs its own height/offset and a sticky/scroll-margin token is the natural place to add it
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

**Situation:** a prototype's demo strip height was added directly into the product's sticky-header
offset token (`--demo-h` folded into the sticky-top/scroll-margin calculations). This leaked
prototype-only chrome into the product's own layout math — any later measurement or screenshot of
"the product" actually measured "the product plus demo chrome", and removing the demo strip would
silently break the real sticky offsets.

**Lesson:** demo/preview-only chrome (banners, mode strips, dev toolbars) that sits above or around
the real product UI must never be folded into the SAME token the product itself uses for its layout
math (sticky offsets, scroll margins) — doing so makes the product's own measured layout dependent
on build-time-only scaffolding that won't exist in production, and that nobody will think to check
when editing "the sticky offset".

**Apply next time:** keep exactly one product layout-offset token (computed only from real product
chrome, e.g. the header), and add any demo-only chrome height as a SEPARATE, clearly-named
prototype-only rule that can be switched off explicitly (e.g. a `?demo=off` query flag) — never mix
the two into one token.
