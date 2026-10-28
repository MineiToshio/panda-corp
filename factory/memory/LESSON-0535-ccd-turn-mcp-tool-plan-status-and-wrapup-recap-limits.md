---
id: LESSON-0535
type: gotcha
domain: tooling
tags: [mcp, ccd-turn, update-plan, wrap-up, agent-harness]
context: operating the `mcp__ccd_turn__*` plan/wrap-up MCP tools (update_plan, wrap_up) available in some agent-harness sessions
trigger: use this when calling `mcp__ccd_turn__update_plan` or `mcp__ccd_turn__wrap_up` in a session that exposes them
source: "factory/memory/_inbox.md notes, 2026-10-26 (agent-inferred, 2 instances) — `update_plan` with an `items` array rejects the WHOLE call if even one item omits `status` (pending|in_progress|completed); `wrap_up`'s `recap` field has a practical ~300-character limit (2-3 short sentences) — exceeding it (seen at 364 chars) doesn't block the call but the tool returns feedback asking to shorten it, and when nothing is pending for the owner the app draws no box and explicitly says not to call wrap_up again that turn (the closing message goes as plain text instead)."
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** two independent, non-obvious traps surfaced using the `mcp__ccd_turn__*` plan-tracking
tools in one session: (1) `update_plan`'s `items` array requires the `status` field on EVERY element —
leaving it off even one item (with the rest fully populated) rejects the entire call with a validation
error, not a partial success; (2) `wrap_up`'s `recap` field has an unstated ~300-character practical
limit — going over (364 chars observed) does not hard-fail the call, but the tool responds asking to
trim it, and calling `wrap_up` again when there is nothing pending for the owner produces no UI box and
an explicit instruction not to call it again that turn (the agent should just write its closing message
as normal text instead).

**Lesson:** this MCP tool pair has strict, partially undocumented input contracts that fail in two
different modes — `update_plan` fails CLOSED (whole call rejected on one missing required field across
an array), `wrap_up` fails SOFT (accepts an over-length `recap` but asks for a retry, and self-reports
when it should not be called again). Neither failure mode is guessable from the tool name alone.

**Apply next time:** when calling `update_plan`, always set `status` explicitly on every item in the
array, never only on the ones that changed. When calling `wrap_up`, keep `recap` to 2-3 short sentences
(roughly under 300 characters) and stop calling it in a turn once it reports there is nothing pending for
the owner — finish with plain text instead of re-invoking it.
