---
id: LESSON-0160
type: gotcha
domain: nextjs
tags: [next-intl, i18n, app-router, navigation, localized-href]
context: rendering internal links in a Next.js App Router project that already owns its own locale-prefixing helper (e.g. a `localizedHref`) alongside next-intl v4's `createNavigation`-generated `Link`
trigger: use this when wiring internal links in a next-intl v4 App Router project and a codebase-owned href-localizing helper already exists
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-12 (agent-inferred, verified against installed next-intl v4.13) — feeding next-intl's `createNavigation` Link the output of a codebase's own `localizedHref` helper double-prefixed the locale in the resulting URL"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0016, LESSON-0168]
---

**Situation:** next-intl v4's `createNavigation()` returns a locale-aware `Link` component that PREPENDS the
active locale to whatever `href` it is given. A codebase that already owns a `localizedHref(path, locale)`
helper (e.g. to build hreflang alternates, sitemaps, or other non-Link contexts) fed that helper's ALREADY-
prefixed output into `createNavigation`'s `Link`, producing a double-prefixed path (e.g. `/en/en/about`).

**Lesson:** `createNavigation`'s `Link` expects UNPREFIXED paths (it owns the prefixing step itself) — it is
not a drop-in replacement for "any href-producing helper", it is specifically the component that DOES the
locale-prefixing. A codebase that already computes localized hrefs for other purposes (metadata, sitemap,
RSS) has two internally-consistent options, not one shared helper: either wrap `next/link` directly and keep
using the owned `localizedHref` helper for hrefs, OR use `createNavigation`'s `Link` everywhere and stop
prefixing manually — mixing the two by feeding one's output into the other's input silently double-prefixes.

**Apply next time:** before wiring next-intl v4's `Link`, check whether the codebase already owns a
locale-prefixing helper; if so, decide ONE prefixing owner (the helper, wrapping `next/link`, or
`createNavigation`'s `Link`) and route every internal link through it — never both.
