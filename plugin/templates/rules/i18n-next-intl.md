---
description: next-intl usage — hooks in components, server helpers only outside React; never hardcode copy.
applies_when: next-intl
globs: ["**/*.tsx", "src/i18n/**", "messages/**"]
source: Pandacorp stack — next-intl
---

# i18n (next-intl)

- **In React components, use the hooks**: `useTranslations`, `useLocale`.
- **Use the server helpers** (`getTranslations`, `getLocale`) **only in non-React code**: route handlers, `metadata`, and Next.js framework functions.
- **Never hardcode user-facing copy** — every string is a translation key. Keys/content live under the locales folder (`src/i18n/locales/<locale>/`).
- The default/launch locale comes from the product's launch-language decision, not automatically the owner's language.
