# SEO and internationalization (web)

> Domain: Product/Documentation · Severity: **SHOULD** (SEO on web; i18n only if the PRD requires it). Enforcement: checklist.

## Rule — owner scope first (DR-131)
- Architecture always asks separately about SEO now/deferred/excluded and single-locale vs multilingual scope. Record explicit answers before planning; a suggested stack or public-web classification is not approval.
- Only approved SEO work gets metadata/OG, canonical, sitemap/robots, structured data where applicable and verification work orders. Internal/private apps normally need no public indexing; keep basic page identity (the app name as a browser-tab title, no SEO descriptions/OG) and access control (robots/noindex is not security).
- Deferred/excluded multilingual features add no extra locales, language switcher, locale routing or hreflang; centralized launch-locale messages remain mandatory (conventions.md).

## Rule — SEO / metadata (when approved for now)
- Plan the approved deliverables only: **Next's Metadata API** for selected page titles/descriptions, Open Graph images, canonical URLs, `sitemap.ts`, `robots.ts` and structured data where applicable. A titles/descriptions-only choice does not enable the rest.
- Content rendered in an indexable way (Server Components by default helps).

## Rule — multilingual i18n (when approved for now)
- Subpath routing (`/es/`, `/fr/`) with `app/[lang]/…` + message catalog with **next-intl**. The default/launch locale comes from the spec's launch-language research (DR-041), not automatically Spanish; see `conventions.md`.
- No hardcoded visible text: everything via i18n.

## Rule — multi-language SEO (when both multilingual i18n and SEO are approved for now)
- `hreflang` and `canonical` per locale via the Metadata API's `alternates.languages`/`canonical`; localized metadata.

## How it is verified
- Architecture contradiction gate checks locked scope against FRDs, blueprints, work orders, packages and env; `/pandacorp:release` verifies metadata/sitemap/robots and multilingual behavior only when approved for now, plus centralized copy for all projects.

## Why
Without metadata/sitemap, a web product is invisible to search engines. i18n done right from the routing avoids expensive rewrites later.

Sources: nextjs production-checklist · nextjs guides/internationalization · Metadata API (`alternates`)
