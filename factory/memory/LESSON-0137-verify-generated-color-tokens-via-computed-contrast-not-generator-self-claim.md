---
id: LESSON-0137
type: pattern
domain: design-process
tags: [accessibility, contrast, oklch, wcag, design-system, self-eval, verification]
context: verifying a generated design system's color tokens for WCAG AA contrast before freezing/handing off, especially when tokens are authored in a perceptual color space (OKLCH) across multiple themes
trigger: use this when a design-system generation pass (canvas or otherwise) claims its color tokens pass WCAG AA, or before freezing color tokens defined in OKLCH/LCH/any non-sRGB space
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred): a 20-line script converting each OKLCH token to sRGB and computing the real contrast ratio found that --text-faint failed AA in BOTH themes (3.85 and 4.15, against the 4.5 body-text threshold) on real content (a date, a relative-time string) — while the canvas's own generated readme asserted 'Both pass WCAG AA' and a visual review of the rendered screens did not catch it"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0037, LESSON-0057, LESSON-0141]
---

**Situation:** a design-system generation pass defined color tokens in OKLCH across a light and a dark
theme, and its own generated documentation asserted both themes passed WCAG AA contrast. A visual review
of the rendered screens (the normal pull-and-review discipline) did not surface any problem — the failing
token (`--text-faint`) looked plausible on screen and was used on real, load-bearing text (a date, a
relative-time string), not decorative filler. Only a small script that actually converted each OKLCH
value to sRGB and computed the real luminance-contrast ratio caught it: 3.85 and 4.15 in the two themes,
both below the 4.5 threshold for body text.

**Lesson:** neither a visual/eyeball review nor the generator's own self-reported accessibility claim is
sufficient evidence that color tokens pass contrast requirements — a perceptual color space like OKLCH
does not map linearly to sRGB contrast, so a token that "looks" like it has enough contrast, or that a
generator asserts passes, can fail the actual computed ratio. This is the same "never trust the artifact's
self-description, verify the real computation" class as LESSON-0057, applied to color/contrast
specifically: a generator asserting "AA pass" in its own output is exactly the kind of claim that must be
independently computed, not accepted.

**Apply next time:** before freezing any generated (or hand-authored) color-token set, run every
foreground/background pairing actually used for real text through an OKLCH-to-sRGB conversion + WCAG
contrast-ratio calculation (a short deterministic script, not a visual check), across every theme the
tokens define — regardless of what the generator's own documentation claims about accessibility
compliance. Treat "the readme says AA pass" as an unverified claim, not evidence.
