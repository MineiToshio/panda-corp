---
id: LESSON-0638
type: gotcha
domain: testing
tags: [headless-chrome, screenshot, viewport, mobile-testing, false-positive]
context: taking a screenshot or measuring layout with headless Chrome (`--headless=new`) at a narrow/mobile viewport width to check for overflow or responsive bugs
trigger: use this when headless Chrome is used to screenshot or measure a page at a viewport narrower than ~500px (a phone-width check) and the result looks like unexpected horizontal overflow
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07 (agent-inferred): Headless Chrome (--headless=new) never renders narrower than 500px — a 400px --window-size screenshot crops the right edge and looks like mobile overflow that isn't real"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a visual-overflow check ran headless Chrome with `--window-size=400,<h>` to simulate a
phone viewport and screenshot the page. The screenshot showed the right edge cropped/cut off, which
looked exactly like a real mobile horizontal-overflow bug — but the page had no actual overflow.

**Lesson:** `--headless=new` Chrome has a floor on how narrow it will actually render (observed: it never
goes below ~500px even when told a smaller `--window-size`); below that floor it silently clips the
viewport instead of rendering at the requested width, producing a screenshot that LOOKS like overflow but
is actually the tool's own rendering limit. Trusting that screenshot as evidence of a mobile layout bug
is a false positive caused by the tool, not the page.

**Apply next time:** to measure or screenshot a true phone-width viewport (< 500px) with headless
Chrome, don't rely on `--window-size` alone — render the target page inside an `<iframe>` of the desired
width (e.g. 390px) on an HTML harness page loaded with `--allow-file-access-from-files`, and measure/
screenshot inside that iframe. Verify any "mobile overflow" finding this way before reporting it; a raw
sub-500px `--window-size` screenshot is not trustworthy evidence by itself.
