---
id: LESSON-0225
type: gotcha
domain: content-generation
tags: [linkedin, og-image, social-preview, case-study, portfolio]
context: publishing a portfolio/case-study link to LinkedIn Featured or any social-preview surface that renders a page's Open Graph image and metadata
trigger: use this when preparing a case-study/portfolio page's OG image or title/description for LinkedIn Featured (or any social-preview card), or diagnosing why multiple case studies look identical when shared
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 — (agent-inferred) the site's per-route OG images (src/lib/seo/og-template.ts via OgCard) render text-only cards on one dark template, so LinkedIn Featured thumbnails look identical across every case study; fix is to render the case-study's own cover image (public/projects/<slug>/cover.*) in the [slug] OG image, then re-scrape with LinkedIn Post Inspector (only affects new shares, not already-cached ones). (owner screenshot, 2026-09-11) LinkedIn Featured cards show the title on ONE line, truncated around 26 chars at desktop width, and about 4 lines of description — use the project name as the title and put the actual value proposition in the description."
provenance: owner-stated
created: 2026-09-13
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0037]
---

**Situation:** case-study/portfolio pages shared to LinkedIn Featured all looked the same (a generic
text-only dark card), and it wasn't obvious how much title/description text the card actually displays.

**Lesson:** two independent constraints govern how a page reads once shared on LinkedIn Featured: (1) if
every route's OG image is generated from one shared text-only template, every shared link looks visually
identical regardless of content — render the page's own distinguishing visual (e.g. a case study's cover
image) into its OG image instead of a generic template, and re-scrape via LinkedIn's Post Inspector after
changing it (a cache refresh only affects future shares, not ones already posted); (2) the card's own
layout truncates hard: the title renders on ONE line (~26 characters at desktop width) and the description
shows about 4 lines — put the short, recognizable identifier (e.g. the project name) in the title and the
actual value proposition in the description, not the reverse.

**Apply next time:** when building or auditing OG images for a multi-page portfolio/case-study site,
render page-specific visuals (not one shared generic template) and budget title copy to ~26 characters /
one line and description copy to ~4 lines before assuming a longer title will display.
