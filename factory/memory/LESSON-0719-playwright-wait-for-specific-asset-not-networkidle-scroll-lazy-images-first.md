---
id: LESSON-0719
type: pattern
domain: testing
tags: [playwright, networkidle, next-image, lazy-loading, e2e-hygiene]
context: "a Playwright e2e assertion needs to know a specific asset (an image, a fetch) has actually finished loading, and `waitUntil: \"networkidle\"` is the default instinct for \"wait until the page is done loading\""
trigger: use this when a Playwright spec needs to deterministically wait for a specific asset/image request to complete, instead of waiting for the whole page/network to go quiet
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-11-21, agent-inferred: investigating a mobile `networkidle` 30s timeout (see LESSON-0185's 11th folded mechanism) on a blog-cover-alt spec"
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0036, LESSON-0062, LESSON-0066, LESSON-0079, LESSON-0185]
---

**Situation:** a Playwright spec asserting on a specific image/asset (e.g. a blog cover's `alt` text) used
`waitUntil: "networkidle"` to make sure the asset had loaded before the assertion ran. This is the exact
anti-pattern LESSON-0066 already warns about (networkidle is unreliable/structurally wrong against a
busy or long-lived-connection page) — but simply switching to `domcontentloaded` + a generic ready signal
isn't enough here, because the thing being waited for is a *specific* asset request, not "the page is
interactive."

**Lesson:** when the goal is "this specific asset finished loading" rather than "the page is ready",
replace `networkidle` with `Promise.all([page.waitForResponse(assetUrlOrPredicate),
page.goto(path, { waitUntil: "load" })])` — this resolves deterministically on the exact request you care
about instead of a network-quiet heuristic. Two sharp edges: (1) `next/image` covers/images below the
fold are `loading="lazy"` by default (compounding LESSON-0062's IntersectionObserver gate and LESSON-0036's
"fullPage baseline never scrolls" blind spot) — on a narrow/mobile viewport an image that's below the fold
never fires its network request at all unless the element is scrolled into view first, so
`scrollIntoViewIfNeeded()` (or an equivalent explicit scroll) must run BEFORE `waitForResponse` is awaited,
or the promise simply never resolves. (2) the SET of assets that finish loading by the `load` event differs
by viewport (what's below-the-fold on mobile may be above-the-fold on desktop, loading eagerly) — don't
assume the same asset list holds across breakpoints; probe the real requests first with a throwaway spec
that logs `page.on("request"/"response", …)` for the actual viewport under test, rather than guessing which
assets to wait for from the markup alone.

**Apply next time:** for a Playwright assertion gated on a specific asset's load, use
`Promise.all([page.waitForResponse(asset), page.goto(path, { waitUntil: "load" })])` instead of
`networkidle`; before waiting on a below-the-fold `next/image`, scroll it into view first; and before
writing the wait predicate, run a throwaway spec that logs real request/response traffic at the TARGET
viewport, since the asset set that loads eagerly vs. lazily is viewport-dependent.
