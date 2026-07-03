---
id: LESSON-0038
type: gotcha
domain: nextjs
tags: [biome, lint, barrel-file, generateMetadata, nextjs, seo]
context: co-locating a route's generateMetadata in its own file and re-exporting it from page.tsx, under Biome's noBarrelFile lint rule
trigger: use this when a Biome-linted Next.js project co-locates generateMetadata (or similar route exports) in a separate file and re-exports it from page.tsx
source: "personal-page-v2 .pandacorp/run/lessons.md — per-route *.metadata.ts pattern"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Biome's `noDangerouslySetInnerHtml`/lint config had `lint/performance/noBarrelFile:
error` enabled. A per-route `generateMetadata` co-located in its own `*.metadata.ts` file (the standard
Next.js SEO pattern of one file per route) could not be re-exported from `page.tsx` with
`export { generateMetadata } from "./page.metadata"` — Biome treats that re-export syntax as a barrel
file regardless of file size or intent.

**Lesson:** Biome's `noBarrelFile` rule pattern-matches on `export { x } from "./y"` syntax itself, not
on whether the file is actually acting as a barrel (aggregating many re-exports). A single, intentional
re-export of one named binding still trips it.

**Apply next time:** to co-locate `generateMetadata` (or any single Next.js route export) in its own file
under Biome's `noBarrelFile`, use an import-then-const-export instead of a direct re-export:
`import { generateMetadata as x } from "./page.metadata"; export const generateMetadata = x;` — this
passes Biome and Next.js still resolves `generateMetadata` from the page module correctly.
