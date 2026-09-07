---
id: LESSON-0198
type: gotcha
domain: analytics-tooling
tags: [posthog, project-id, silent-redirect, verification]
context: navigating to a PostHog project URL (`/project/<id>`) to read metrics/dashboards
trigger: use this when reading PostHog metrics via a direct project URL, especially across sessions/accounts that may not all have access to the same project
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-05 (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** navigating to `/project/<id>` when the current session lacks access to that project
silently redirects to the session's DEFAULT project — the URL changes on its own and the page looks like a
normal, successful load of the requested project.

**Lesson:** PostHog does not error or warn on this redirect; a reader who doesn't check has no signal they
are looking at the wrong project's data.

**Apply next time:** before trusting any PostHog reading, verify the `Project ID` in Settings → General
(or the final URL after any redirect) matches the project you intended to read — do not assume a
successful-looking page load means you're looking at the requested project.
