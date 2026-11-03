---
id: LESSON-0593
type: gotcha
domain: design
tags: [design-canvas, svg, logo, grayscale, contrast, dark-theme]
context: preparing a brand/logo image asset (especially an SVG with CSS-driven styling) before uploading it to the Claude Design canvas, or auditing a logo's contrast across light/dark themes
trigger: use this when a logo asset uploaded to the design canvas renders solid black (or another wrong flat color), or when checking a flat/monochrome logo's visibility via a grayscale conversion
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-31/11-01 (agent-inferred)"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0550, LESSON-0579]
---

**Situation:** two distinct logo-processing traps hit in the same work: (1) an SVG logo styled via a
`<style>` block (CSS classes, not inline `fill`/`stroke` attributes) turned solid black once uploaded to
the design canvas — the canvas's SVG handling strips `<style>` elements, so every class-styled path loses
its color and falls back to the SVG default (black). (2) converting a flat, solid-black logo to grayscale
to audit its contrast told nothing useful — a flat black mark stays indistinguishable from itself in
grayscale regardless of the surrounding theme, so grayscale alone cannot surface a real low-contrast
problem on a dark background.

**Lesson:** the design canvas's SVG support is not full-fidelity — CSS-driven styling (classes, external
`<style>` rules) is a silent loss, not an error, so an SVG that renders correctly in a browser can still
arrive broken on the canvas. Separately, a grayscale check is the wrong tool for a flat-color mark: it
only reveals contrast differences that already exist in luminance, and a single flat color has none to
reveal — the real test is rendering the mark against its ACTUAL target background(s), in both themes.

**Apply next time:** before uploading a CSS-class-styled SVG to the design canvas, rasterize it to PNG
(bake the computed styles into pixels) rather than uploading the SVG directly. When auditing a flat/
monochrome logo's visibility, don't rely on a grayscale conversion alone — adjust contrast/opacity against
the real background and verify the result by rendering it in BOTH the light and dark theme, not by
inspecting the grayscale image in isolation.
