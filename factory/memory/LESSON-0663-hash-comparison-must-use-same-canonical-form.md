---
id: LESSON-0663
type: gotcha
domain: data-integrity
tags: [hash-comparison, canonicalization, whitespace, idempotency-check]
context: two independent code paths each hash or otherwise fingerprint the same logical artifact (a file, a config blob, a candidate list) to decide whether it changed, before gating a mutating action on the comparison
trigger: use this when two code paths independently hash or fingerprint the same logical artifact for an equality check that gates a mutating action
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (agent-inferred): assertActiveDelivery hashed the raw bytes of candidates.json while the approval step hashed the PARSED (trimmed) value of the same file — byte-identical content (differing only in trailing whitespace) was reported as a mismatch, blocking ingest:apply. Fixed (f40e056f)."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0574]
---

**Situation:** a delivery/approval gate compared a hash of a candidates file taken at one point (raw
file bytes) against a hash of the SAME logical content taken at a different point (the parsed, trimmed
value). The two hashes disagreed purely because of a trailing-whitespace difference the parse step
normalized away on one side but not the other — logically identical content was reported as changed,
and the mismatch blocked a real operation.

**Lesson:** "hash the same artifact" is not the same guarantee as "hash the same bytes" unless both
sides agree on exactly which representation (raw bytes vs. parsed/normalized value) they are hashing.
Two otherwise-correct pieces of code can each reasonably choose a different representation for their own
purposes and still silently disagree on equality checks whenever any part of a file is cosmetic
(whitespace, trailing newline, key ordering) — and the resulting false mismatch looks exactly like a
real content change from either side's point of view.

**Apply next time:** when two independent code paths hash or fingerprint the same artifact for an
equality/idempotency check, pin down and document the EXACT canonical representation both sides hash
(e.g. "always hash the parsed-and-trimmed value, never raw bytes") — and add a test with byte-identical
content differing only in whitespace/trailing-newline to catch a future divergence before it blocks a
real operation.
