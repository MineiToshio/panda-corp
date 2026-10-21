---
id: LESSON-0471
type: gotcha
domain: backend
tags: [readablestream, cancel, bounded-wait, maintenance-endpoint, byte-limit]
context: an endpoint that reads an untrusted/unsigned request body through a `ReadableStream` and relies on calling `.cancel()` to bound how long it waits when rejecting oversized or invalid input
trigger: use this when writing a handler that needs to bound-stop reading from a `ReadableStream` on a rejection path (oversized body, invalid signature, deadline)
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — maintenance endpoint + dispatcher reproduction, cross-checked by an independent auditor"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a maintenance endpoint called `.cancel()` on a `ReadableStream` to stop reading an
unsigned, oversized body early. The stream's own underlying `cancel` callback (on the emitter's side)
did not reliably resolve — the real endpoint reproduced hanging past 250ms with only 2 KiB read and no
signature yet seen. An independent auditor reproduced the SAME hang in a different dispatcher's
response path, confirming it was not a one-off.

**Lesson:** calling `.cancel()` on a `ReadableStream` is a request to the underlying source to stop,
not a guarantee that the call resolves within any bounded time — a misbehaving or slow emitter's own
cancel callback can simply never settle, leaving the caller waiting indefinitely even though it
"cancelled."

**Apply next time:** don't rely on `.cancel()` alone to bound how long a rejection path waits. Use (or
build) a common bounded reader that enforces an explicit byte limit AND an explicit deadline
independently of whether the underlying stream's cancellation resolves, and test each boundary input
(oversized body, slow/stalled stream, unsigned content) individually, not just the happy path —
alongside any CSP/revalidation checks that share the same reader.
