---
id: LESSON-0713
type: gotcha
domain: infra
tags: [vercel, cdn, bot-crawling, image-proxy, cost]
context: triaging an unexplained spike in a CDN/edge data-transfer cost metric (e.g. Vercel's Fast Origin/Data Transfer) on a route that proxies or serves many distinct images
trigger: use this when a data-transfer cost metric spikes on an image-proxy or similar per-resource route and the instinct is to blame application code or real user traffic
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-22 (agent-inferred): a Fast Origin Transfer spike traced to ClaudeBot crawling an `op-character-dex` `/card/[id]` image-proxy route, fetching ~4.6K unique ~2.5 MB PNGs (~1.5 GB total); an `s-maxage` cache header does not help because each of those PNGs was being fetched for the first time by the crawler, so nothing was yet cached to serve instead."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0693]
---

**Situation:** a per-resource image-proxy route showed an unexplained jump in CDN data-transfer cost.

**Lesson:** a known AI/search crawler (e.g. ClaudeBot) systematically walking a per-resource route
(`/card/[id]`, `/product/[sku]`, etc.) can generate a large one-time data-transfer bill by fetching
thousands of distinct large assets for the first time — a cache-control header like `s-maxage` only reduces
cost on a REPEAT fetch of the SAME resource, so it does nothing against a crawler's first-touch sweep
across many distinct resources. This can look identical to "real user traffic grew" or "the app got less
efficient" without checking WHO is generating the requests.

**Apply next time:** before investigating application code for a data-transfer cost spike on a
per-resource route, check the hosting provider's own bot-attribution view (e.g. Vercel Observability →
Fast Data Transfer → Bot Name) to rule out a crawler sweep; if a bot is the cause, consider a dedicated
response path for known bots (a lower-resolution asset, a `robots.txt` disallow, or a long-lived immutable
cache keyed so a repeat crawl doesn't re-fetch) rather than tuning cache headers that only help repeat
human traffic.
