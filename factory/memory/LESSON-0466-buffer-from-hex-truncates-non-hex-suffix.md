---
id: LESSON-0466
type: gotcha
domain: web-security
tags: [hmac, signature-verification, buffer, hex-encoding, node, input-validation]
context: verifying an HMAC (or other) signature by decoding an untrusted hex string with Node's `Buffer.from(str, "hex")`
trigger: use this when untrusted input is decoded with `Buffer.from(str, "hex")` before a signature/integrity comparison
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — HMAC signature helper reproduction"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `Buffer.from(signature, "hex")` was used to decode an incoming HMAC signature before
comparing it to the computed digest. A reproduction against the real helper showed that a signature
string with a trailing non-hex suffix (e.g. `...zz`) was still ACCEPTED — Node's hex decoder silently
stops at the first invalid hex character and returns whatever it decoded up to that point, rather than
rejecting the malformed input.

**Lesson:** `Buffer.from(str, "hex")` is a lenient, best-effort decoder, not a validator. Any suffix
(or interior garbage, depending on parity) past the first non-hex character is silently dropped
instead of raising an error, so a string that is NOT a well-formed hex-encoded signature can still
decode to a buffer that happens to match (or get compared against) the expected digest.

**Apply next time:** before decoding an untrusted signature/token with `Buffer.from(str, "hex")`,
validate its exact ASCII form and length first (e.g. `/^[0-9a-f]+$/i` and the expected byte-length ×
2 characters). Keep a negative test that signs a value and appends a non-hex suffix, asserting
verification fails.
