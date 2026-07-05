---
id: LESSON-0048
type: gotcha
domain: web-performance
tags: [caching, immutable, static-assets, next-start, browser-cache]
context: replacing the CONTENT of a static asset (image, file) while keeping the same URL, served from a production (`next start`) build with immutable caching
trigger: use this when a static asset's content was updated but the browser keeps showing the OLD version indefinitely, especially after the asset was once served from a production build
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — pandacorp case-study imagery saga, owner symptom 'se revierte solo cada 5 min'"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a static asset whose CONTENT changed but kept the same URL appeared to "revert" to the
old version periodically in the browser. Root cause: the asset had once been served by `next start`
(production), which sends long-lived immutable cache headers for static assets; the browser cached that
response keyed by URL and never re-requested it, even though `next dev`'s `must-revalidate` behavior on
a later dev session could not override an entry the browser had already cached as immutable.

**Lesson:** once a URL has been served with an immutable/long-lived cache header by ANY prior response
(including a past production build the browser saw), that cache entry can outlive the asset's content
change indefinitely — a same-URL content swap is not a reliable way to force a static asset update, and
symptoms like "it reverts on its own" are usually the browser silently serving a stale cached response,
not the server actually reverting anything.

**Apply next time:** when a static asset's content changes, change its URL (filename/hash) to force a
cache bust, rather than overwriting the file in place at the same path — especially for any asset that
may have been served from a production (`next start`) build at some point.
