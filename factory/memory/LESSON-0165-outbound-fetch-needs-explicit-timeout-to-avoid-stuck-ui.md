---
id: LESSON-0165
type: pattern
domain: resilience
tags: [fetch, timeout, abortsignal, forms, resilience]
context: a client-side form or action makes an outbound fetch to a third-party API and disables its submit control while the request is pending
trigger: use this when reviewing or building any client-side fetch to a third-party/external API that gates UI state (a disabled submit button, a loading spinner) on the request settling
source: "personal-page-v2 docs/decision-log.md 2026-07-11 (Full-site QA overhaul) — a fixed production bug: a contact form's outbound fetch to a third-party form provider had no timeout, so a hung provider could leave the submit button disabled forever; fixed with an explicit 10s `AbortSignal.timeout(10000)`, treating a timeout/abort the same as any other rejected fetch (a provider_error status)"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a contact form's submit handler called `fetch()` against a third-party provider with no
timeout. The success and rejection paths were both handled, but a hung connection (provider stalls without
ever resolving or rejecting) left the UI in its pending state indefinitely — the submit button stayed
disabled with no way for the user to recover short of reloading the page.

**Lesson:** any outbound `fetch` to a third-party/external service that a UI's interactive state depends on
settling needs an EXPLICIT upper bound — `fetch(url, { signal: AbortSignal.timeout(ms) })` — even when both
the success and the rejection branches are already handled, because "hangs forever without resolving OR
rejecting" is a distinct failure mode neither branch covers. Treat the resulting abort/timeout error the same
as any other request failure (one more case feeding the existing error-state UI), not as a special case.

**Apply next time:** when reviewing a form/action with an outbound fetch, check specifically for an explicit
timeout on the request, not just success/error handling — a fetch with no `AbortSignal.timeout` (or
equivalent) is an unbounded wait risk regardless of how well the two settled outcomes are handled.
