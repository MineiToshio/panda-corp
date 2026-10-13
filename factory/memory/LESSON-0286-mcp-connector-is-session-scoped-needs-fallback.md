---
id: LESSON-0286
type: gotcha
domain: agent-tooling
tags: [mcp, posthog, review-launch, unattended, connector-scope, fallback]
context: a scheduled/unattended routine needs project-scoped external data (analytics, a third-party API) but only has an MCP connector tied to the current session/account
trigger: use this when designing or debugging a scheduled/unattended routine that reads from an external service via an MCP connector, especially across multiple portfolio projects that may each need a DIFFERENT account/org scope
source: "panda-corp 2026-10-12, pandacorp-review-launch scheduled sweep — step 2b (PostHog MCP provenance) failed portfolio-wide because the running session had NO PostHog MCP connector configured at all (not even a wrongly-scoped one); every sweep since personal-page-v2's 2026-10-07 launch has fallen back to 'sin datos' even though its events verifiably fire in production; corroborates the personal-memory finding that a PostHog MCP connection, when present, is scoped to one org only (not swappable per-project mid-run)"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0198, LESSON-0199, BL-0087, BL-0232]
---

**Situation:** `review-launch`'s PostHog step is written assuming an MCP connector to PostHog exists in
the running session. In practice an MCP connector is bound to the SESSION/ACCOUNT it was configured in —
it is not a durable, per-project, always-available binding. A scheduled/unattended session may have no
PostHog connector at all, or one scoped to a single org that doesn't cover every portfolio project, and
there is no mechanism to re-scope it per-project mid-routine. The routine's only observed fallback is to
report "sin datos", even when the underlying metrics are independently verifiable (e.g., by checking the
live site directly).

**Lesson:** an MCP connector is a SESSION-level capability, not a PROJECT-level one — a routine that
needs project-scoped external data across a multi-project portfolio cannot assume the connector it
happens to have this run covers (or even exists for) the project being reviewed. Silently degrading to
"no data" when the connector is simply absent/mis-scoped looks identical to "there really is no data",
which can mask real signal the routine should have reported.

**Apply next time:** when a scheduled/unattended routine depends on an MCP connector for project-scoped
external data, do not let its only fallback be a silent "sin datos" — detect and report explicitly
whether the connector is present and whether it is scoped to the project under review (not just "a
PostHog connector responded"), and prefer a durable, project-independent fallback (e.g., a per-project
read-only REST/API-key path) over depending on whatever MCP connector the session happens to carry.
