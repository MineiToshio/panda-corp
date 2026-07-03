---
id: LESSON-0037
type: gotcha
domain: nextjs
tags: [next-og, satori, turbopack, og-image, fontsource, oklch, tailwind]
context: generating build-time Open Graph images with next/og (Satori) in a Next.js project using custom local fonts and Tailwind v4 OKLCH design tokens
trigger: use this when generating build-time OG images with next/og (Satori) that need custom fonts loaded from disk or reuse of the project's CSS design tokens
source: "personal-page-v2 .pandacorp/run/lessons.md — next/og OG image generation build"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** building OG images at request/build time with `next/og` (Satori), loading custom font
binaries via `fs.readFileSync` and reusing the project's Tailwind v4 `@theme` OKLCH color tokens, hit
three separate Turbopack/Satori incompatibilities.

**Lesson:**
1. A dynamic `require.resolve(`${pkg}/…`)` template-string specifier fails Turbopack's static import
   analysis ("Module not found: Can't resolve <dynamic>") — Turbopack needs a statically analyzable
   specifier.
2. Even a fully STATIC `require.resolve("pkg/file.woff")` makes Turbopack try to bundle the `.woff` as a
   module ("Unknown module type") — `require.resolve` itself is the problem, not just dynamism.
   `path.join(process.cwd(), "node_modules", ...)` read via `fs.readFileSync` is opaque to Turbopack's
   module graph and avoids both failures.
3. `@fontsource/<font>` packages (OFL-1.1, static `.woff` files, no runtime code) are a clean source of
   real font binaries when the project has no `next/font/local` fonts already — but they trip `knip`'s
   unused-dependency check (used via filesystem path, not a traceable import), so they need a
   `knip.json` `ignoreDependencies` entry.
4. Satori does not support the CSS `oklch()` function — a project whose design tokens are OKLCH
   (Tailwind v4 `@theme`) needs a one-time static hex conversion (CSS Color 4 OKLab reference formula)
   for any Satori-rendered element; the CSS custom properties can't be reused directly.

**Apply next time:** for build-time image generation with `next/og` under Turbopack: read font files via
`path.join(process.cwd(), "node_modules", ...)` + `fs.readFileSync`, never `require.resolve`; source fonts
from `@fontsource/*` when no local font already exists (remembering the `knip.json` exemption); and
pre-convert any OKLCH design tokens to static hex before handing colors to Satori-rendered markup.
