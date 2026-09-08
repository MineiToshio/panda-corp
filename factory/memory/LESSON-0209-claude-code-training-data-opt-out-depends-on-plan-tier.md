---
id: LESSON-0209
type: gotcha
domain: privacy
tags: [claude-code, training-data, privacy, api-vs-consumer, retention]
context: building any pipeline or subagent flow that reprocesses a user's own Claude Code session transcripts, when that Claude Code usage is on a consumer plan
trigger: use this when designing a tool/pipeline that reads or reprocesses Claude Code transcripts from a Free/Pro/Max consumer account, especially via subagents
source: "personal-page-v2 scratchpad research (blog-generator v2 spike), .pandacorp/run/lessons.md 2026-09-07, agent-inferred and verified against Anthropic's official docs/Commercial Terms as of 2026-09-07"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** verifying against Anthropic's official documentation and Commercial Terms (2025-06-17): on
Free/Pro/Max consumer plans, Claude Code session content is used for model training whenever the "Help
improve Claude" account setting is ON, with a 5-year retention window on that data. Under API/Team/
Enterprise usage, the same content is NOT used for training, with a 30-day retention window instead.

**Lesson:** whether a Claude Code session's content may be used for training is NOT a property of Claude
Code itself — it is entirely determined by which plan/surface generated the session (consumer vs.
API/Team/Enterprise) and, for consumer plans, a per-account toggle. A pipeline that reprocesses a
consumer-plan user's own transcripts (e.g. with subagents, for content generation) inherits whatever
training/retention policy that account's setting implies, and this is easy to overlook because it is not a
property of the pipeline's own code.

**Apply next time:** before building or shipping any tool that reprocesses Claude Code transcripts,
confirm which surface generated them (consumer Free/Pro/Max vs. API/Team/Enterprise) and, for consumer
data, check the account's "Help improve Claude" setting. If the training/retention implications matter for
the use case, route the reprocessing through the API surface instead of consumer transcripts, or have the
user turn the setting off — do not assume transcripts are outside the training pipeline by default.
