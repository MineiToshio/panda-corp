---
id: LESSON-0220
type: gotcha
domain: nextjs
tags: [nextjs, scroll-behavior, app-router, hash-navigation, playwright, testing-methodology]
context: a Next 16 App Router site sets scroll-behavior smooth via CSS on <html> and navigates to another route with a URL hash (e.g. /about#section)
trigger: use this when a hash-anchored cross-route link in a Next 16 App Router site changes the URL but does not actually scroll the reader to the target section
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-10 (agent-inferred, 2 related notes) — a link to /about#how-i-work navigated and changed the URL but left the reader at the top (scrollY 3 with the target visible at 570px); console warned missing-data-scroll-behavior; fixed by adding data-scroll-behavior=smooth to <html>; separately, Playwright headless Chromium did not reproduce the cut-short scroll at all, even with the fix attribute removed and confirmed absent via curl of the served HTML"
provenance: agent-inferred
created: 2026-09-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0036]
---

**Situation:** Next 16 no longer honors a CSS-only `scroll-behavior: smooth` on `<html>` during a
route-change navigation to a hash target — it requires the explicit `data-scroll-behavior="smooth"`
attribute on `<html>` as well, logging `missing-data-scroll-behavior` to the console when it's absent.
Without it, Next calls `scrollIntoView()` on the hash target but the page mount interrupts the smooth
scroll immediately, leaving the reader near the top even though the URL and hash both updated correctly.
A naive automated check ("is the target in the viewport" or "did scrollY change from 0") does not catch
this — the page had scrolled slightly (scrollY 3) while the actual target sat far below (570px), so the
right assertion is the DISTANCE from current scroll position to the target's scroll offset, not a binary
in-viewport/moved check. Separately, headless Chromium under Playwright did not reproduce the cut-short
scroll at all — a behavioral e2e test asserting "the section reaches its scroll target" stayed green even
with the fix attribute removed (confirmed absent via a direct curl of the served HTML, ruling out a stale
build).

**Lesson:** this Next 16 gotcha has two independent traps stacked: (1) the fix itself is a small,
easy-to-miss HTML attribute requirement, not a CSS-only concern, and stacking `scroll-margin-top` on top
of an already-set `scroll-padding-top` on `<html>` double-counts the offset; (2) the regression it produces
is invisible to headless Chromium, so a behavioral e2e test alone is not sufficient proof the fix works —
the only reliable oracle here is a structural invariant check
(`getComputedStyle(html).scrollBehavior === "smooth"` implies `<html data-scroll-behavior="smooth">`), and
any regression test needs to be proven RED first (revert the fix, confirm the SERVER actually serves the
broken state — a `sleep` after editing does not guarantee the dev server recompiled) before trusting it
GREEN.

**Apply next time:** when a Next 16 App Router site needs smooth scroll to persist across a hash-anchored
cross-route navigation, set BOTH the CSS `scroll-behavior: smooth` and the `data-scroll-behavior="smooth"`
attribute on `<html>` (via the root layout), and avoid combining `scroll-margin-top` per-section with an
already-present `scroll-padding-top` on `<html>`. Write the regression test as a computed-style structural
invariant, not a scroll-position behavioral assertion (headless Chromium does not reproduce this bug), and
prove any new regression test fails on the broken state (verified via a fresh server response, not a
timed sleep) before trusting it as a guard.
