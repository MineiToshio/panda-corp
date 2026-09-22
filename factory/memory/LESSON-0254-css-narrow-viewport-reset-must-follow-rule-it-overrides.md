---
id: LESSON-0254
type: gotcha
domain: css
tags: [css, cascade, media-query, specificity, mobile-first, responsive]
context: a responsive CSS rule is implemented as an unconditional base rule plus a narrow-viewport override written in a separate max-width media query, both at equal specificity
trigger: use this when a responsive CSS behavior (e.g. a sticky element) needs to be disabled/reset below a breakpoint and the reset is written in a `max-width` media query
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20 (owner-stated) — the blog-generator preview artifact's sticky table-of-contents covered the post body on a phone; the `@media (max-width: …)` block resetting `.toc { position: static }` was written BEFORE the unconditional `.toc { position: sticky }` rule, so at equal specificity the later (unconditional) rule always won regardless of viewport width; the real site scopes the enhancement itself to `@media (min-width: 901px)` instead, so nothing needs resetting below that width"
provenance: owner-stated
created: 2026-09-22
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0059]
---

**Situation:** a sticky table-of-contents was meant to be disabled below a phone breakpoint via a
`@media (max-width: …)` reset. The reset was written BEFORE the unconditional `sticky` rule in the
stylesheet; at equal specificity, CSS cascade order (not the media-query condition) decided the winner, so
the later unconditional rule applied at every width and the reset never took effect — the TOC stayed sticky
and covered the post body on mobile.

**Lesson:** a narrow-viewport `max-width` reset written before the rule it's meant to override is a silent
no-op at equal specificity — later same-specificity declarations always win regardless of the reset's
media-query condition, so source order defeats the intent invisibly (no error, no warning, just the wrong
rule winning). The robust fix is not "reorder the reset after the enhancement" (fragile — the next edit can
reintroduce the bug) but to scope the ENHANCEMENT itself to a `min-width` media query in the first place, so
the base/mobile styles need no reset at all — mobile-first media-query scoping, not desktop-first-with-
overrides.

**Apply next time:** when a responsive behavior only makes sense above a breakpoint, write it inside
`@media (min-width: …)` from the start rather than applying it unconditionally and trying to reset it away
below a `max-width` breakpoint; if a max-width reset already exists, verify it is declared AFTER the rule
it overrides, and prefer converting it to min-width scoping instead.
