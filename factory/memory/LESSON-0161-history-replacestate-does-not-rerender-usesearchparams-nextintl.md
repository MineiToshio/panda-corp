---
id: LESSON-0161
type: gotcha
domain: nextjs
tags: [next-intl, app-router, useSearchParams, history-api, shallow-routing]
context: implementing a URL-backed client-side filter (e.g. a blog tag filter) in a Next.js App Router project that also uses next-intl for locale routing
trigger: use this when a URL-backed client filter built with `window.history.replaceState` fails to update `useSearchParams()` consumers in a next-intl app-router project
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-12 (agent-inferred) — a blog tag filter used the Next-documented `window.history.replaceState` shallow-URL-update technique to keep the tag filter in the URL, but components reading `useSearchParams()` never re-rendered under next-intl's app-router setup"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0160, LESSON-0168]
---

**Situation:** Next.js documents `window.history.replaceState(null, "", url)` as a way to update the URL
shallowly (no navigation, no server round-trip) for client-driven state like a filter. `useSearchParams()`
elsewhere in the tree is expected to reflect that URL change reactively.

**Lesson:** under a next-intl app-router setup, calling the raw `window.history.replaceState` DOES change the
visible URL bar, but does NOT trigger a re-render of components subscribed to `useSearchParams()` — that hook
reads from Next's router state, not from `window.location` directly, and a bare History API call bypasses the
router entirely, so the router's internal search-params snapshot goes stale even though the address bar is
correct. The documented Next.js technique assumes a router wiring this codebase's next-intl setup doesn't
provide for granted.

**Apply next time:** for a URL-backed client filter (or any state that must both update the URL AND stay
reactive to `useSearchParams()` consumers) in a next-intl App Router project, use
`router.replace(url, { scroll: false })` from next-intl's/`next/navigation`'s router instead of a raw
`window.history.replaceState` call — it updates the URL AND keeps the router's search-params state (and every
`useSearchParams()` consumer) in sync.
