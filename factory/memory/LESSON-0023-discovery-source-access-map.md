---
id: LESSON-0023
type: gotcha
domain: discovery-research
tags: [discovery, web-fetch, access, market-research, scraping]
context: fetching pain/demand signals from third-party sites during /pandacorp:discover research
trigger: use this when a discovery/research pass needs to fetch reviews, forums or market data from third-party sites without login
source: "panda-corp discover run 2026-07-01 — access-tested against the live sites; docs/proposals/21"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a discovery pass needs real signal (reviews, pain points, pricing, ARR estimates) from
third-party sites, fetched directly (no login) rather than via a general web search.

**Lesson:** access is highly source-specific and mostly stable across runs. Fetchable without login as
of 2026-07-01: Chrome Web Store reviews (sort by 1-star for pain), `hn.algolia.com` API (JSON, no key),
`*.canny.io` boards (with vote counts), `microns.io` (price/ARR estimates), `alternativeto.net`,
`apps.apple.com` (reviews + charts), Capterra, Indie Hackers, `support.google.com` community threads.
Blocked/hostile: g2.com (403), trustpilot.com (403), x.com search (402 paywall), play.google.com
(JS-rendered, no static fetch), reddit.com direct fetch (only reachable via WebSearch with a single
short quoted phrase — a long or unquoted query returns empty).

**Apply next time:** when a discovery/research task needs a specific source, check this list before
spending a fetch attempt; route reddit queries through WebSearch with a short quoted phrase, not a
direct fetch; treat g2/trustpilot/x.com/play.google.com as unreachable without an authenticated
browsing tool and fall back to an alternate source in the same category (e.g. Capterra instead of G2).
