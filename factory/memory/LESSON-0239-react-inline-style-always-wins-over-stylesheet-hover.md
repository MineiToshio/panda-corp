---
id: LESSON-0239
type: gotcha
domain: css
tags: [react, inline-style, css-specificity, hover, transform]
context: an element needs a fixed/static inline transform (or other style) AND a stylesheet-driven :hover/:focus transform on the same CSS property
trigger: use this when an element with a React inline style also needs a stylesheet :hover/:focus rule affecting the SAME CSS property
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred) — a React inline style attribute (e.g. style={{ transform: \"rotate(180deg)\" }}) always wins over a stylesheet's :hover rule for the same CSS property, regardless of selector specificity -- this silently killed the hover-nudge animation on every 'back' LinkArrow (About/blog back-links) since the rotation was set inline."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a "back" arrow icon needed a fixed 180-degree rotation (set as a React inline `style`) plus
a stylesheet `:hover` rule that also transforms it (a nudge animation). The hover animation silently never
appeared.

**Lesson:** an inline `style` attribute always beats a stylesheet rule for the same CSS property,
regardless of the stylesheet selector's specificity — inline styles sit outside the normal
specificity cascade entirely (equivalent to `!important`-level precedence for that property). Setting a
static value like a fixed rotation inline permanently blocks any stylesheet-driven `:hover`/`:focus` rule
on that same property from ever applying, with no visible error — the hover rule simply never wins.

**Apply next time:** when the same element needs both a static baseline value (a fixed rotation, a fixed
color) and a stylesheet-driven interactive state (`:hover`/`:focus`) on the SAME CSS property, move the
static value into a CSS class instead of an inline style, and compose the two effects in one rule (e.g.
`transform: rotate(180deg) translateX(4px);` on `:hover`) rather than fighting cascade order.
