---
id: LESSON-0041
type: gotcha
domain: preview-tooling
tags: [preview, screenshot, below-the-fold, opacity-transition, verification, false-negative]
context: verifying a page with below-the-fold or opacity-transition (reveal-animated) content using the preview_screenshot tool
trigger: use this when preview_screenshot returns a solid-black or blank image for below-the-fold or opacity-animated content and you are about to treat that as a real rendering bug
source: "personal-page-v2 .pandacorp/run/lessons.md — cross-checked via DOM (img.complete/naturalWidth, accessibility snapshot)"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0033, LESSON-0036]
---

**Situation:** the `preview_screenshot` tool returned a solid-black JPEG for below-the-fold or
reveal-animated (opacity-transition) content even when the page was actually correct — confirmed via DOM
inspection (`img.complete`/`naturalWidth`, accessibility snapshot) that content was present and images had
loaded while the screenshot itself came back pure black.

**Lesson:** this is a distinct preview_screenshot failure mode from LESSON-0033 (hangs on a continuously
animated canvas) — here the tool doesn't hang, it returns a plausible-looking but WRONG image (a false
negative), which is more dangerous because nothing signals the capture was bad. Anything that keeps
content at `opacity:0`/hidden mid-capture (scroll-reveal timing, an in-flight CSS transition) can produce
this. See also LESSON-0036 for the specific scroll-reveal-vs-visual-baseline root cause.

**Apply next time:** never trust a black or visually-blank preview_screenshot alone as proof of a real
rendering bug — cross-check via DOM state first (`preview_eval`, `img.complete`/`naturalWidth`,
accessibility tree) before concluding the app is actually broken. Treat screenshot capture as fallible
for any surface with below-fold or opacity-transitioning content.
