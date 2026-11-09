---
id: LESSON-0636
type: problem-solution
domain: database
tags: [neon, postgres, environment-attestation, branching, serverless]
context: a check that must prove two database connections point at genuinely DISTINCT databases (e.g. a dev-vs-prod environment attestation, or a universe/postverify guard before a destructive operation)
trigger: use this when building or auditing a "these are two different databases" attestation check against a Neon (or other branchable serverless Postgres) backend, before trusting name/oid/host/port as proof of distinctness
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07 (agent-inferred): databaseIdentity (postverify/universe attestation) hashed name+oid+inet_server_addr+port, and that hash was IDENTICAL on Neon dev and prod branches (neondb/16396/169.254.254.254/5432) — the check always reported 'requires distinct actual databases' even when the two connections genuinely were different branches; fixed by adding `neon.timeline_id` to the hashed identity"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0635, LESSON-0656]
---

**Situation:** a safety check meant to confirm "connection A and connection B are different actual
databases" (before allowing some destructive/migration step) hashed `name + oid + inet_server_addr +
port`. On Neon, every branch of the same project shares the same database name, the same internal
`inet_server_addr` (a private serverless-proxy address, not the branch's own host), and the same port —
so the hash collided across dev and prod branches, and the attestation permanently reported "not
distinct" even though the branches were genuinely separate.

**Lesson:** on a branchable serverless Postgres like Neon, the classic host-level identity tuple
(name/oid/address/port) does NOT uniquely identify a branch — Neon's connection-pooling/proxy layer makes
multiple branches look identical at that level. A distinctness check built from those fields alone will
systematically false-positive ("same database") between branches that are actually different.

**Apply next time:** when attesting database distinctness (or identity generally) against Neon, include
a Neon-specific branch identifier in the hash — `neon.timeline_id` (readable via a `SELECT
current_setting('neon.timeline_id')`-style query) uniquely distinguishes branches where the generic
host-level tuple does not. For a non-Neon/non-branchable Postgres the generic tuple is still fine; the gap
is specific to serverless-proxied, branch-per-environment providers.
