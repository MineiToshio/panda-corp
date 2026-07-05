---
id: LESSON-0060
type: gotcha
domain: preview-tooling
tags: [playwright, prefers-color-scheme, dark-mode, headless, screenshot]
context: capturing a screenshot of an HTML prototype/page whose visual theme is driven by the `prefers-color-scheme` media query
trigger: use this when capturing a screenshot (headless browser, Playwright, or similar) of a page whose theme depends on `prefers-color-scheme` and the site's intended/shipped theme is dark (or otherwise non-default)
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — owner caught it ('por qué está en light si la app es dark?')"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** capturing an HTML prototype whose theme is driven purely by `prefers-color-scheme`, a
headless Playwright capture resolved to LIGHT by default (the headless browser's default color scheme
preference), producing light-theme screenshots of a page meant to ship dark. The owner caught the
mismatch on sight.

**Lesson:** a headless browser's default `prefers-color-scheme` is not guaranteed to match the site's
intended/shipped theme — relying on the media query alone to drive a capture silently produces the
wrong theme. This is invisible until a human looks at the output.

**Apply next time:** when capturing a screenshot of theme-`prefers-color-scheme`-driven content, force
the intended theme explicitly before capturing — either set it in the DOM
(`document.documentElement.setAttribute('data-theme', 'dark')`) or via the tool's own override
(Playwright's `colorScheme: 'dark'` context option) — never rely on the media query's default resolving
correctly under headless capture.
