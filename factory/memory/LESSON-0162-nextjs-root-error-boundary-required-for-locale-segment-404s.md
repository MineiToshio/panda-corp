---
id: LESSON-0162
type: gotcha
domain: nextjs
tags: [app-router, error-boundary, not-found, i18n, root-layout]
context: a Next.js App Router project with an internationalized `[locale]` segment relies on `notFound()` calls and a localized not-found UI to handle unmatched URLs and invalid locale segments
trigger: use this when designing or auditing 404/error handling in a Next.js App Router project that has a dynamic `[locale]` (or any dynamic) segment at the top of its route tree
source: "personal-page-v2 docs/decision-log.md 2026-07-11 (Full-site QA overhaul) — a fixed production bug: the site had no root `not-found.tsx`/`global-error.tsx`, so the root layout's missing `<html>/<body>` made every unmatched URL, invalid locale (`/fr/about`), and page-level `notFound()` call fall back to Next's bare, unstyled, English-only 404 (`NEXT_MISSING_ROOT_TAGS`) instead of the designed, localized 404 — even though the page-level code calling `notFound()` was itself correct"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0168]
---

**Situation:** a route tree with `app/[locale]/layout.tsx` owning `<html>`/`<body>` (needed for per-locale
`lang` and theming) had a localized `error.tsx` and page-level `notFound()` calls, but NO root-level
`app/not-found.tsx` or `app/global-error.tsx`. Any URL that Next.js resolves OUTSIDE the `[locale]` segment
entirely — an unmatched path, or an invalid locale segment that never enters the layout — cannot reach the
localized error UI at all, because there is no `<html>/<body>` shell to render it in; Next silently falls back
to its own bare, English, unstyled 404 (`NEXT_MISSING_ROOT_TAGS`). This is invisible to page-level testing:
every `notFound()` call INSIDE a matched locale route worked and looked correct in isolation.

**Lesson:** in an App Router project where a dynamic segment (like `[locale]`) owns the document shell
(`<html>/<body>`), that segment's own `not-found.tsx`/`error.tsx` only covers routes THAT SEGMENT MATCHED. A
root-level `app/not-found.tsx` + `app/global-error.tsx` (each providing their OWN `<html>/<body>`) is required
to catch everything the dynamic segment never gets a chance to render — invalid segment values, completely
unmatched paths, and any error thrown before the segment resolves. Testing only "does `notFound()` render the
right UI inside `/en/whatever`" misses this whole class; it must be tested by hitting URLs that never match
the segment at all (an invalid locale, a path with no segment prefix).

**Apply next time:** any App Router project with a document-shell-owning dynamic segment needs BOTH a
segment-level error boundary (localized, in-shell) AND a root-level `not-found.tsx`/`global-error.tsx` pair
(bare, own shell) — verify by testing an invalid-segment URL and a completely unmatched URL, not just a
page-level `notFound()` call inside a valid segment.
