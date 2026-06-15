# SEO and internationalization (web)

> Domain: Product/Documentation · Severity: **SHOULD** (SEO on web; i18n only if the PRD requires it). Enforcement: checklist.

## Rule — SEO / metadata
- **Next's Metadata API** per page: own `title` and `description`; Open Graph images; `sitemap.ts`; `robots.ts`.
- Content rendered in an indexable way (Server Components by default helps).

## Rule — i18n (if the PRD requires it)
- Subpath routing (`/es/`, `/fr/`) with `app/[lang]/…` + message catalog with **next-intl**. The default/launch locale comes from the spec's launch-language research (DR-041), not automatically Spanish; see `conventions.md`.
- No hardcoded visible text: everything via i18n.

## Rule — multi-language SEO (if there is i18n)
- `hreflang` and `canonical` per locale via the Metadata API's `alternates.languages`/`canonical`; localized metadata.

## How it is verified
- Checklist in `/pandacorp:release`: metadata per page? sitemap/robots? i18n without loose strings (if applicable)?

## Why
Without metadata/sitemap, a web product is invisible to search engines. i18n done right from the routing avoids expensive rewrites later.

Sources: nextjs production-checklist · nextjs guides/internationalization · Metadata API (`alternates`)
