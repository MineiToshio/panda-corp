---
id: LESSON-0436
type: gotcha
domain: nextjs
tags: [next-js, redirect, suspense, hydration, playwright, meta-refresh, flaky-click]
context: calling Next's `redirect()` inside a `<Suspense>` boundary AFTER the surrounding shell has already streamed to the client
trigger: use this when a Playwright test clicks a button whose handler should navigate, `toHaveURL` passes at commit, but the click appears to have no effect and the page stays on the prior route
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred), frd-05 repair"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Next `redirect()` thrown inside a `<Suspense>` boundary after the shell had already
streamed becomes a `<meta http-equiv="refresh" content="1;url=…">` tag rather than a client-side
navigation. When the page had not finished hydrating within that 1 second window (a realistic timing on
a loaded dev server), the browser performed a FULL document load of the target instead — so
`page.toHaveURL` could pass at the commit phase of that full load while `document.readyState` was still
`"loading"`. A Playwright click issued in that window landed on the OLD page's still-present, inert,
server-rendered `onClick` button (not yet wired up by React), and the click silently did nothing: the URL
never actually changed on the browser side even though the test's URL assertion reported success.

**Lesson:** a meta-refresh-based redirect races against hydration in a way a plain client-side
`router.push` never does — the target page's full reload can start, and a navigation assertion can
resolve, WHILE the originating page's own click handlers are still server-rendered and non-interactive.
A green `toHaveURL` is not proof the click that supposedly triggered it actually worked.

**Apply next time:** on the product side, render buttons that trigger navigation as `disabled` until
hydrated (e.g. `useSyncExternalStore(noop, () => true, () => false)` to detect client-only readiness),
so a click during this window is a no-op the user can retry rather than a silently lost interaction. To
reproduce this class deterministically for debugging, abort/delay the first page's JS chunks while
letting the target page's chunks load normally.
