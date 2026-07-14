---
id: LESSON-0168
type: pattern
domain: nextjs
tags: [app-router, client-navigation, hydration, next-intl, dynamic-segment, synthesis]
context: a Next.js App Router route tree nests routing-sensitive, router-reactive, DOM-mutating, or pre-hydration machinery inside a dynamic segment that owns the document shell (e.g. `[locale]` for next-intl)
trigger: use this when auditing or debugging any Next.js App Router bug that reproduces ONLY on a client-side (soft) navigation and not on a fresh full-page load, especially in a tree where a dynamic segment like `[locale]` owns `<html>/<body>`
source: "synthesis of LESSON-0160, LESSON-0161, LESSON-0163, LESSON-0166 — all four found independently during personal-page-v2's 2026-07-11/12 full-site QA overhaul, same root class"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0160, LESSON-0161, LESSON-0163, LESSON-0166, LESSON-0162]
---

**Situation:** four independent bugs surfaced in the same App Router project during one QA pass, each
invisible to page-level or fresh-load testing and each caught only by exercising a CLIENT-SIDE
navigation: (1) next-intl's `createNavigation` `Link` double-prefixed a path that a codebase's own
`localizedHref` helper had already prefixed (LESSON-0160); (2) a raw `window.history.replaceState` URL
update was invisible to `useSearchParams()` consumers because it bypassed the App Router entirely
(LESSON-0161); (3) a `useEffect` that reparented React-owned DOM (a code-block copy-button enhancer)
crashed with `NotFoundError` only when React reconciled the subtree again on a client-side route change,
never on first mount (LESSON-0163); (4) `next-themes`' pre-hydration anti-flash `<script>`, nested inside
the `[locale]` layout, remounted outside React's hydration pass whenever a client-side navigation changed
the `locale` param, breaking its "run once before first paint" guarantee (LESSON-0166). A fifth, related
but mechanically distinct finding from the same audit (LESSON-0162: a missing root `not-found.tsx`/
`global-error.tsx` leaves URLs that never match the `[locale]` segment with no shell to render into) shares
the same structural cause — a dynamic segment owning the document shell — without sharing the
client-nav-vs-full-load trigger, so it is linked as a sibling rather than folded into this pattern's core
claim.

**Lesson:** a Next.js App Router tree where a dynamic segment (typically `[locale]` for i18n) sits at the
top and owns the document shell bundles several DISTINCT implicit contracts that a full page load and a
client-side (soft) navigation do NOT satisfy equally: routing helpers must agree on who owns prefixing
(else they compound); hooks like `useSearchParams()` only react to changes that go THROUGH the router,
never to direct History API calls; React's reconciliation on a client-side re-render can throw when a
DOM-mutating effect has taken direct ownership of nodes React still tracks; and any provider whose
correctness depends on running exactly once, before hydration, breaks the moment its host segment's param
can change via client-side navigation instead of a fresh document load. None of these four failure modes
reproduce on a fresh `GET` of the URL — they only reproduce when something ALREADY MOUNTED navigates
in-app across or within that segment, which is exactly the scenario most page-level and first-load tests
never exercise.

**Apply next time:** when building or auditing a Next.js App Router tree with a dynamic shell-owning
segment (`[locale]` or similar): (1) pick one single owner for any URL-prefixing logic and route everything
through it; (2) update URL-backed client state via the router's own `replace`/`push`, never a raw History
API call, if any `useSearchParams()`/router-reactive consumer must stay in sync; (3) never let a
`useEffect` directly mutate/reparent DOM that React still owns — express the same enhancement as a
React-owned component instead; (4) keep any pre-hydration/run-once provider ABOVE the dynamic segment, or
force navigations that change that segment's param to be full document loads. Most importantly: test every
piece of this tree via an in-app CLIENT-SIDE navigation that crosses or stays within the dynamic segment,
not just a fresh page load — that is where all four bugs were invisible until specifically exercised.
