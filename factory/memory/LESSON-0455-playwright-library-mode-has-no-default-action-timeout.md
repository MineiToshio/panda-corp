---
id: LESSON-0455
type: gotcha
domain: testing
tags: [playwright, library-mode, timeout, qa-scripts, hang]
context: writing a standalone Node script that drives Playwright directly (chromium.launch()/page.goto()) for QA/audit automation, rather than a test authored under the @playwright/test runner
trigger: use this when a hand-written Playwright script (not a `@playwright/test` spec) hangs indefinitely instead of failing with a timeout error when a locator never appears
source: "mission-control .pandacorp/run/lessons.md 2026-10 (agent-inferred) — a standalone QA script under mission-control/docs/design/explorations/visual-refresh-2026/scripts/ hung with no error on a missing locator"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a hand-written Node script used Playwright as a plain library (`chromium.launch()`, then
direct `page`/`locator` calls) to drive a QA/audit pass over a running app. A locator that never appeared
on the page caused the script to hang forever with no error or timeout — unlike a spec run under the
`@playwright/test` runner, which ships a project-level default action/expect timeout out of the box.

**Lesson:** Playwright's own default action timeout (`page.setDefaultTimeout`) is effectively infinite
(0) when Playwright is driven as a bare library — the familiar 30s-ish timeouts most people associate with
Playwright come from the `@playwright/test` runner's own `use.actionTimeout`/`expect.timeout` config, which
a standalone script never inherits. A script that forgets to set this explicitly doesn't fail loud on a
missing element; it just hangs, silently consuming the run (and, in an automated/unattended pass, the
whole budget) until something external kills it.

**Apply next time:** any standalone Node script that drives Playwright as a library (not via the test
runner) must call `page.setDefaultTimeout(<ms>)` (and/or pass an explicit `timeout` option to each
locator action) immediately after creating the page — never rely on an implicit default to bound how long
a missing-element wait can run.
