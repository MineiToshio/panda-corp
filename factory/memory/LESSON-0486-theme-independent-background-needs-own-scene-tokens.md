---
id: LESSON-0486
type: gotcha
domain: css
tags: [theming, dark-mode, light-mode, contrast, design-tokens]
context: a UI element that is intentionally dark in BOTH the light and dark site themes (e.g. an illustrated scene/art panel on a dark background), styled with the page's shared theme-dependent semantic colour tokens
trigger: use this when an element must stay visually dark regardless of the active site theme, and it currently reuses the page's theme-dependent semantic tokens (--green/--amber/etc.) for its own internal colours
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Orbita"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** an illustrated scene meant to always render dark (dark art on a dark background) reused
the page's shared semantic colour tokens. When the SITE theme switched to light, those tokens resolved
to the light theme's darker/more-saturated variants (tuned to read well on a light page background), and
text rendered on top of the scene's own permanently-dark background failed contrast — the token values
were chosen for the light page's own background, not for staying legible against this element's
different, unchanging background.

**Lesson:** an element whose own background is intentionally theme-independent cannot safely consume the
page's theme-dependent semantic tokens, because those tokens are tuned for the SURROUNDING page's current
theme, not for whatever background the element itself happens to have. Swapping the page theme can
silently break contrast inside an element that never changes, with nothing in the element's own markup
or CSS pointing at the cause.

**Apply next time:** give a theme-independent-background element its own fixed "scene" token set,
declared once in the `:root` block independent of the active theme, and remap the shared semantic names
(`--green`, `--amber`, …) to those scene-specific values scoped to the scene's own container — rather
than letting it silently inherit the page's theme-switched tokens.
