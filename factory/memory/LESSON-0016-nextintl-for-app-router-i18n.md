---
id: LESSON-0016
type: library-verdict
domain: nextjs
tags: [i18n, next-intl, app-router, nextjs, seo, hreflang]
context: choosing an i18n library for a Next.js App Router project
source: factory/memory/_inbox.md (2026-06-2x)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Need:** i18n (multi-locale routing + translation) for a Next.js App Router project.

**Context:** Next's Pages-Router built-in i18n routing was removed in the App Router — there is no
framework-native i18n mechanism anymore.

**Use instead:** `next-intl` is the de-facto native-feeling option for App Router — it supports locale
routing and `hreflang` alternates via `generateMetadata`'s `alternates` field (needed for multi-language
SEO).

**Recommend next time** this need appears (a Next.js App Router project needing i18n): reach for
`next-intl`; don't look for the removed Pages-Router i18n mechanism.
