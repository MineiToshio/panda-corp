---
id: LESSON-0042
type: pattern
domain: content-generation
tags: [portfolio, case-study, screenshot, privacy, design-mock]
context: choosing what to screenshot for a portfolio/case-study page showcasing an internal tool
trigger: use this when producing portfolio/case-study screenshots of an internal tool that a public audience will see
source: "personal-page-v2 .pandacorp/run/lessons.md (owner-stated). Second facet, 2026-09-05 (agent-inferred, harvested 2026-09-07): when live-data screenshots ARE used instead of a mock, a dedicated PII scan pass is still required before publish — demo-tenant screenshots (Work Connect captures) carried worker names, a real-looking @jobleap.ai address and a requisition id that reads as real to a public viewer even though the underlying data is a demo tenant."
provenance: owner-stated
created: 2026-07-03
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** deciding what to screenshot for a portfolio/case-study page about an internal tool.

**Lesson:** default to the design-phase static HTML/JS mock (populated with a few extra sample data rows
so it doesn't look sparse) rather than screenshotting the live app with real data. This avoids exposing
sensitive internal information and reads fuller/more polished for a public audience than a live screen
with sparse real data.

**Apply next time:** when a portfolio/case-study page needs to showcase an internal tool, reach for the
design-phase mock (with added sample rows for density) instead of a live-data screenshot, by default. If a
live/demo-data screenshot is used anyway (mock not available or not representative enough), run an
explicit PII pass over it before publish — check names, emails, ids and any other field that could read as
real to a public viewer, even when the underlying data is a demo tenant.
