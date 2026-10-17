---
id: LESSON-0380
type: gotcha
domain: playwright-testing
tags: [playwright, screenshot, touch-emulation, cdp, responsive-testing]
context: capturing a full-page screenshot of a page under Playwright's mobile/touch emulation (hasTouch + isMobile) for visual-regression or fidelity comparison
trigger: use this when a Playwright screenshot of a "mobile"/touch-emulated viewport unexpectedly shows `:hover` styles that should only apply on pointer devices
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047]
---

**Situation:** a Playwright capture emulated a phone viewport with touch (`hasTouch: true`,
`isMobile: true`), expected to keep `(hover: hover)`-gated styles inactive. Calling
`page.screenshot({ fullPage: true })` (which uses the CDP `captureBeyondViewport` protocol under the
hood) made `(hover: hover)` flip back on mid-capture, so the "phone" screenshot rendered desktop
hover styles that should have been impossible on a touch-emulated device.

**Lesson:** Playwright's `fullPage: true` screenshot option drops active touch/mobile emulation
during the capture itself (a CDP `captureBeyondViewport` quirk) even though the emulation was set
correctly before the call — the page's rendered state for that one screenshot silently reverts to a
hover-capable pointer environment.

**Apply next time:** instead of `fullPage: true` under touch emulation, grow the viewport to the
document's actual height with `page.setViewportSize({ width, height: documentHeight })` (touch
emulation survives this call) and take a normal viewport screenshot — never rely on
`fullPage: true` to preserve touch/mobile emulation.
