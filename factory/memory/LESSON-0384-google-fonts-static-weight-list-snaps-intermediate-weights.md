---
id: LESSON-0384
type: gotcha
domain: web-fonts
tags: [google-fonts, css, font-weight, variable-font]
context: loading a Google Fonts family via a static `wght@400;500;600...` weight list when the design's CSS specifies intermediate weights
trigger: use this when a project's tokens/CSS declare an intermediate font-weight (e.g. 550, 650) for a Google Fonts family and the `<link>`/`@import` URL lists specific static weights
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

**Situation:** a Google Fonts `<link>`/`@import` requested a static list of weights
(`wght@400;500;600;700`), but the project's CSS used intermediate weights like 550/650 for some
text. The browser silently snapped those declarations to the nearest weight actually served (e.g.
500 or 600), rather than erroring or rendering nothing — so the mismatch was invisible without
comparing the design's intended weight to the rendered one.

**Lesson:** Google Fonts' static-weight delivery URL only serves the exact weights listed; any CSS
`font-weight` value that isn't one of them is silently rounded to the nearest served face by the
browser, with no console warning. A font family requested via a fixed weight list cannot support
arbitrary intermediate weights even though the CSS accepts the value without complaint.

**Apply next time:** when the design tokens/CSS use any intermediate `font-weight` value, request the
family's full variable axis (e.g. `wght@400..900`) instead of a static weight list, or ensure every
weight actually used in CSS is explicitly listed in the `<link>`/`@import` URL.
