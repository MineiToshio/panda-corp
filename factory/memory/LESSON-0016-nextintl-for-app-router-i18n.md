---
id: LESSON-0016
type: library-verdict
domain: nextjs
tags: [i18n, next-intl, app-router, nextjs, seo, hreflang]
context: choosing an i18n library for a Next.js App Router project
trigger: use this when adding i18n or multi-locale routing to a Next.js App Router project
source: factory/memory/_inbox.md (2026-06-2x)
provenance: agent-inferred
created: 2026-06-30
status: active   # 2026-10-17 (librarian review) — eval-gate: cross-corroborated by 2 distinct projects (pandacast, pandasaga), activating per DR-047 lifecycle step 2
promotion: proposed   # 2026-10-17 (librarian review) — target: factory/standards/seo-i18n.md (add `next-intl` as the recommended App Router i18n library, with the `hreflang`-via-`generateMetadata` note). Corroborated across 2 distinct projects (pandacast, pandasaga) with zero contradicting evidence — App Router has no built-in i18n mechanism, so this verdict saves every future i18n project from re-discovering the same library choice.
confidence: medium
times_applied: 3
applied_in: [pandacast, pandasaga, funko-tracker]
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
