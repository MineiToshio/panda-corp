---
id: LESSON-0416
type: gotcha
domain: testing
tags: [playwright, webserver-timeout, sharp, avif, instrumentation, e2e-bootstrap]
context: an e2e bootstrap hook running inside Next.js's instrumentation register() that publishes a batch of images via sharp AVIF encoding before Playwright's webServer is considered ready
trigger: use this when a Playwright webServer times out (default/configured ~180s) intermittently on a project whose startup path does bulk image processing, especially via sharp's AVIF encoder
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): An e2e bootstrap inside instrumentation register() blocks the port; publishing ~40 images with sharp AVIF at default effort took 208s, over Playwright's 180s webServer timeout. Use avif effort 0 (11s) or a content-hash variant cache for e2e."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0185]
---

**Situation:** an e2e bootstrap step (seeding/publishing ~40 images, AVIF-encoded via `sharp` at its
default encoding effort) ran inside Next.js's `instrumentation.ts` `register()` hook, which blocks the
server from accepting connections on its port until it resolves. At `sharp`'s default AVIF effort setting,
encoding the batch took ~208 seconds — longer than Playwright's configured `webServer` readiness timeout
(180s) — so the e2e run failed on a server-never-became-ready timeout that had nothing to do with the
app's actual code; the server WOULD have come up, just too slowly for the test harness's patience.

**Lesson:** AVIF encoding effort is a steep, non-obvious time/quality tradeoff in `sharp` — a seemingly
small image batch (40 images) can take over three minutes at default effort, and anything that runs that
encoding synchronously inside a server-startup hook (gating port readiness) converts an image-pipeline
performance characteristic into a test-infrastructure timeout. The fix is either to make encoding cheap
enough for the bootstrap context, or to stop doing it on that critical path at all.

**Apply next time:** for e2e/test-only bootstrap paths that must publish or transform a batch of images
before the server is considered ready, either lower `sharp`'s AVIF `effort` to its minimum (0) for that
context (an 11s encode for the same ~40-image batch in this case) or cache encoded variants by a content
hash so repeat runs skip re-encoding unchanged source images entirely. Don't tune the webServer timeout
upward as the first fix — confirm whether the bottleneck is genuinely necessary synchronous work on the
startup path before extending how long the test harness waits for it.
