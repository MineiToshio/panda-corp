---
id: LESSON-0693
type: library-verdict
domain: infra
tags: [vercel, hobby, cpu-quota, caching, deploy]
context: diagnosing which traffic/activity actually drives Vercel Hobby's CPU-time quota on a content-heavy app with both cached and dynamic routes
trigger: use this when a Vercel Hobby project is burning CPU quota faster than expected and the instinct is to blame a background job (ingest, a cron, "owner traffic") rather than request-serving traffic right after a deploy
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11 (agent-inferred): measured that the CPU overrun correlated with request volume immediately after deploys (every deploy resets the route cache) plus dynamic/0%-cached piece pages and a broad proxy route, not with the ingest job or owner's own traffic; quiet days cost under 1 minute of CPU"
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Vercel Hobby-hosted app intermittently overran its CPU-time quota. The obvious suspects
(the data-ingestion job, elevated owner/admin traffic) were investigated first, but measurement showed
quiet days cost under 1 minute of CPU total, and the overruns instead correlated with ordinary visitor
request volume occurring right after a deploy.

**Lesson:** every Vercel deploy resets the route-level cache, so the first wave of requests after a
deploy serves from cold cache regardless of how well-cached the route normally is. Combined with routes
that are dynamic or effectively 0%-cached (per-piece detail pages) and a broad catch-all proxy route, this
produces a CPU spike attributable to ordinary request-serving traffic timed around a deploy — not to any
background job or privileged traffic. Diagnosing a Hobby CPU overrun by looking at WHO is generating
requests (ingest vs owner vs visitors) misses the actual driver, which is WHEN the requests land relative
to the last deploy and WHICH routes they hit (cached vs dynamic).

**Apply next time:** when triaging a Vercel Hobby CPU-quota overrun, first correlate the spike timing
against the deploy history (does it cluster right after a deploy?) before investigating background jobs
or specific traffic sources; audit which routes are dynamic/uncached and whether a broad proxy route is
serving traffic that could be narrowed or cached, since those — not ingest or owner activity — are the
likely dominant cost on a content-heavy app.
