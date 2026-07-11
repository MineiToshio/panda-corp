---
id: LESSON-0120
type: gotcha
domain: research
tags: [webfetch, linkedin, anti-bot, fact-verification, career-history]
context: verifying a person's career-history facts (job titles, dates, companies) by fetching their public LinkedIn profile URL
trigger: use this when a task needs to verify career/professional facts and the plan is to WebFetch a linkedin.com/in/* profile URL
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-09 — WebFetch on the owner's linkedin.com/in/* profile URL returned HTTP 999 (anti-bot block, redirects to a country-code subdomain first) during the copy-truth pass, blocking automated verification of career facts (agent-inferred)"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0025]
---

**Situation:** a copy/content pass needed to verify career-history facts (job titles, employers, dates) and
attempted to `WebFetch` the person's public `linkedin.com/in/*` profile page as the source of truth.

**Lesson:** LinkedIn profile URLs consistently return HTTP 999 to automated fetchers (an explicit
anti-bot block, often preceded by a redirect to a country-code subdomain) — this is not a flaky
network error, it is LinkedIn's fixed policy. `WebFetch` cannot be used to verify or scrape LinkedIn
profile content, ever. This corroborates LESSON-0025's broader finding that LinkedIn is a "hostile
platform" for automation (there: browser-extension account-ban risk; here: the same hostility shows up
as a flat WebFetch block).

**Apply next time:** never plan a fact-verification step that depends on fetching a `linkedin.com/in/*`
URL. When career-history facts need verification, ask the owner directly (or use a document/screenshot
the owner already provided) instead of attempting to scrape LinkedIn.
