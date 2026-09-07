---
id: LESSON-0203
type: pattern
domain: release-planning
tags: [dns-cutover, redirects, migration, launch-checklist]
context: planning a redirect/301 strategy for a DNS cutover from an old site to a rebuilt one, based on the PRD's stated intent rather than the old site's actual live routes
trigger: use this before planning a DNS cutover's redirect work — when a PRD says something like "serve 301s from old URLs" without enumerating what those URLs actually are
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-0x (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a PRD's launch plan called for "serve 301s from old URLs" ahead of a DNS cutover, without
enumerating what those URLs actually were. Fetching the OLD site's live listing pages directly (rather
than estimating from the PRD's framing) showed its routes (`/{lang}`, `/{lang}/blog`,
`/{lang}/blog/{slug}`) matched the new site's structure exactly, and the old blog held exactly ONE post
(`welcome`) whose slug was preserved during migration — so the actual redirect work was essentially nil,
and only the retired `/admin/*` surface disappears.

**Lesson:** a PRD's redirect-strategy line describes INTENT, not the actual URL surface that needs
covering — the two can diverge enough that a "redirect work" line item is nearly free, or conversely,
much larger than assumed. Estimating from the PRD's prose risks either over-building unneeded redirect
machinery or under-covering a surface that was never actually enumerated.

**Apply next time:** before planning any DNS-cutover redirect work, fetch the OLD site's live listing/
sitemap pages directly and enumerate its actual routes/slugs — do not estimate from a PRD's stated intent.
Diff that enumerated surface against the new site's routes to scope the real redirect work.
