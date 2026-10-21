---
id: LESSON-0468
type: anti-pattern
domain: testing
tags: [mocking, storage, credentials, role-binding, security, false-green]
context: a storage-client mock/test-double used to verify a role-specific operation (e.g. an eraser/writer role) against an injected bucket
trigger: use this when writing or reviewing a storage-client mock that exercises a specific role's operations in isolation
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an "eraser" component with an injected storage bucket passed its tests, but its
DEFAULT wiring (outside the test's injection) actually used a read-only web credential — a
credential that cannot perform the erase operation in production. The tests only exercised the
injected-bucket path in isolation; they never checked which credential the component would bind to
when constructed the normal way.

**Lesson:** a storage mock that accepts an injected client/bucket proves the component's LOGIC is
correct given a working client, but says nothing about whether the component's own default
construction selects the RIGHT credential/role for that operation. A mock built to make the test
pass can hide a real misconfiguration in the production wiring path.

**Apply next time:** for any component with a role-specific storage/credential requirement, test both
the isolated operation (via an injected mock) AND the component's actual default binding (which
credential/role it selects when constructed normally) — a storage mock alone does not verify
credential selection, only the operations performed once a (possibly wrong) client is already in
hand.
