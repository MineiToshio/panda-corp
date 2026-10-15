---
id: LESSON-0348
type: gotcha
domain: testing
tags: [playwright, stretched-link, click-target, axe, animation, testing-fidelity]
context: "automating a click test against a card whose clickable area is implemented as a stretched pseudo-element overlay (`a::after { position: absolute; inset: 0 }`), and verifying accessibility during reveal/entrance animations"
trigger: use this when a Playwright test clicks a card whose whole surface is a "stretched link" (an `::after` overlay covering the card), or when axe runs during a reveal/entrance animation
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): a stretched-link card (a::after inset 0) intercepted clicks on the cover specifically in Playwright, requiring a click at the cover's own coordinates; reveal/entrance animations were kept transform-only so axe never measured text mid-fade"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047]
---

**Situation:** a card used the "stretched link" pattern — a single `<a>`'s clickable area extended over
the whole card via `::after { position: absolute; inset: 0 }` — so any click anywhere on the card
activates the link, including clicks visually "on" an inner cover image. A Playwright test clicking the
inner cover element specifically needed to account for the overlay actually intercepting the hit-test.
Separately, reveal/entrance animations that faded text's opacity in made axe's color-contrast check
measure a transient, partially-faded frame mid-animation as if it were the settled state (see
LESSON-0047's seventh mode).

**Lesson:** a stretched-link overlay is, by design, the actual click target for the whole card — testing
"does clicking the cover work" is really testing "does the overlay's hit-test cover the cover's
coordinates," and the test should click at the cover's own screen coordinates (what a real person does)
rather than targeting the cover element's locator directly, since the overlay is what actually receives
the event. Separately, any opacity/fade-based reveal animation is a latent axe-contrast false-positive
source during the animation window (confirmed again on this project, corroborating LESSON-0047's
seventh mode) — restricting reveal/entrance animations to transform-only properties (never animating
opacity on text) avoids the whole class of false positive.

**Apply next time:** when testing a stretched-link card pattern with Playwright, click at the visually-
relevant element's coordinates rather than asserting on its own locator being the hit target; and design
reveal/entrance animations to use `transform` only (never fade text opacity) so axe's contrast check
never samples a mid-animation frame in the first place.
