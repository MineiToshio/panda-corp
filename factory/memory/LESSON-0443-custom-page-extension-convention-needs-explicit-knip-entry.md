---
id: LESSON-0443
type: gotcha
domain: tooling
tags: [knip, nextjs, pageextensions, unused-export, config-drift]
context: a project adds a custom Next.js `pageExtensions` convention (an alternate page/layout/route suffix beyond the framework defaults) without updating its lint/dead-code tooling
trigger: use this when a project introduces a custom `pageExtensions` suffix (e.g. a parallel "oracle"/comparison build convention) and knip starts flagging exports from those files as unused
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a project added a custom Next.js page-extension convention (`page.oracle.tsx`, via its own
`pageExtensions` config) to run a parallel build for comparison. knip's `next` plugin only recognizes the
framework's DEFAULT entry filenames (`page`, `layout`, `route`, …) — it has no awareness of a
project-added `pageExtensions` suffix — so an export like `export const instant = false` inside one of
these files is reported as an "unused export" and fails knip's gate, even though Next itself treats the
file as a live entry point.

**Lesson:** a tool's framework-aware plugin (knip's `next` integration, or any similar convention-based
entry detection) encodes the framework's OWN defaults, not a project's local extensions to them. Adding a
custom page-extension suffix is invisible to that plugin until told otherwise.

**Apply next time:** when a project adds a custom `pageExtensions` suffix, add a matching explicit entry
glob to the dead-code tool's config (e.g. `src/app/**/{page,layout,route}.<suffix>.{ts,tsx}` added to
knip's `entry` array) at the same time the Next.js config changes — don't wait for a false "unused
export" red to discover the gap.
