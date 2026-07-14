---
id: LESSON-0153
type: gotcha
domain: agent-orchestration
tags: [quota, provider, unattended, r11, codex]
context: certifying or resuming an unattended/overnight agent run after a session or conversation was restored/reconnected
trigger: use this when an unattended or overnight run resumes after a conversation/session restore and must confirm it can actually keep working
source: "panda-corp R11 unattended-certification work, 2026-07-11 — factory/decision-log.md 'Provider diagnostics are classified, redacted and non-retriable' entry"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** during Codex unattended-certification work, a restored conversation (session/transcript
state reconnected successfully) was treated as evidence the run could continue — but the underlying CLI
provider quota was a SEPARATE resource that restoring the conversation did not restore. The two overnight
attempts hit real failures classified this way (one process-lifecycle failure, one provider `usage_limit`
after an otherwise-green implementation).

**Lesson:** "the session/conversation is back" and "the provider will actually answer the next call" are
independent facts. A session/token restore proves continuity of CONTEXT, not availability of QUOTA/rate
limit/credit. An unattended or long-running certification flow that resumes after any interruption must
PROBE the real provider (a cheap real call, not an assumption) before trusting it can keep working, and
must classify a quota failure durably (so a later resume doesn't blindly retry into the same wall) without
persisting raw provider error text (which may carry sensitive account detail) and without silently
converting an uncertain/quota-exhausted state into an automatic retry.

**Apply next time:** when building or reviewing an unattended-run resume path for any LLM provider CLI,
add an explicit real-provider health probe distinct from session/context restoration, classify quota-type
failures as their own durable non-retriable state, and never persist raw provider stderr.
