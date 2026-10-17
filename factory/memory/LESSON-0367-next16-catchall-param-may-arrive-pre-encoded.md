---
id: LESSON-0367
type: gotcha
domain: nextjs
tags: [nextjs16, catch-all-route, url-encoding, double-encoding, rsc]
context: a Next.js 16 catch-all dynamic route segment handling a param that contains an encoded delimiter (e.g. `%2F` standing in for a literal slash within one segment)
trigger: use this when a Next.js 16 catch-all route's params need to be normalized/canonicalized and the value may already be URL-encoded
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-17: Next 16's catch-all can deliver a delimiter like %2F still encoded inside params; blindly re-applying encodeURIComponent produced %252F (double-encoded) and broke documents at canonicalization, confirmed against real HTML/RSC output"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Next.js 16 catch-all route segment can deliver a param value that still carries a
URL-encoded delimiter (`%2F` standing in for a literal `/`) rather than the decoded form. Code that
unconditionally re-encoded every param value before serializing/canonicalizing it (assuming params always
arrive decoded) produced a double-encoded value (`%252F`), confirmed against real HTML/RSC output, which
broke document canonicalization downstream.

**Lesson:** a catch-all route's param values are not guaranteed to arrive consistently decoded or encoded —
a pure round-trip test (encode what you expect, decode it back) can pass while the REAL production HTTP
path still delivers a different encoding state than assumed.

**Apply next time:** normalize encoding state explicitly in one adapter layer (detect and decode an
already-encoded delimiter before re-encoding, rather than assuming either state) before validating or
serializing a catch-all param, keep an explicit read allowlist for which characters are expected, and test
against real production HTTP responses — not just a synthetic encode/decode round trip — before trusting the
canonicalization.
