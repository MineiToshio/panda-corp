---
id: LESSON-0611
type: gotcha
domain: content-sourcing
tags: [instagram, scraping, social-media, worker-limitations]
context: a background worker/agent needs to read content from a specific Instagram post as part of a data-sourcing or verification task
trigger: use this when a task needs content from an Instagram post and the plan is to fetch it programmatically from a worker
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): Instagram posts are not fetchable by workers (throttled/login wall); ask owner for screenshots instead"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a worker/agent tried to fetch the content of a specific Instagram post programmatically
(no official API access) and was blocked by throttling/a login wall.

**Lesson:** Instagram posts are not reliably fetchable by an automated worker without authenticated API
access — a plain scrape attempt hits a login wall or aggressive throttling. This is a platform
characteristic, not a one-off network issue worth retrying around.

**Apply next time:** when a task needs the content of a specific Instagram post and no authenticated API
integration exists, don't spend effort on scraping workarounds — ask the owner for a screenshot of the
post instead.
