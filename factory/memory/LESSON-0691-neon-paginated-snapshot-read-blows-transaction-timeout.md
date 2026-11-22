---
id: LESSON-0691
type: problem-solution
domain: database
tags: [neon, prisma, interactive-transaction, pagination, latency, remote-vs-local]
context: a server-side read builds a snapshot by paging through a catalog via repeated per-page queries inside one interactive Prisma transaction
trigger: use this when a server read that works in every local/CI test intermittently 500s or times out only against a remote Neon database, especially if the read pages through its rows by ID inside one transaction rather than fetching them in one query
source: "funko-tracker, 2026-11-17, docs/decision-log.md + docs/frds/frd-12-web-performance/blueprint.md#public-snapshot-transaction-under-remote-latency--2026-11-17, fix commit a9914718: getPublicBrowseSnapshot kept one RepeatableRead transaction but originally issued one query per 100-ID page across the whole catalog (108 serialized statements for 832 pieces, ~90ms RTT each against Neon DEV); this outlasted the transaction's time bound and a 2.1s connection open exceeded the acquisition bound, so /explore and /universe returned 500 in production while every local-test-Postgres-backed run passed"
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: high
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0635, LESSON-0656, DR-140, DR-144]
---

**Situation:** a snapshot-read server action paged through its full result set by issuing one query per
ID-bounded page (100 IDs at a time) inside a single interactive Prisma transaction, to keep a consistent
read. Against a near-zero-latency local test Postgres (DR-140's native test DB) this ran fine and every
automated test passed. Against the real remote Neon database (~90ms round-trip per statement), the same
108 serialized page-queries for an 832-row catalog outlasted the transaction's bound, and the initial
connection-open itself (2.1s observed) exceeded the connection-acquisition bound — the route returned 500
in production with zero signal from any test.

**Lesson:** a transaction's cost under remote latency is dominated by its STATEMENT COUNT, not its total
row count — paging a snapshot read by ID multiplies round trips linearly with catalog size, and each
round trip pays the full remote RTT, not the near-zero local-loopback RTT a test database hides. This is
a DIFFERENT mechanism from LESSON-0635's cold-start `maxWait` (that one is about the transaction failing
to even START before latency drops); here the transaction starts fine and just serializes too many
statements once inside it. Both are instances of LESSON-0656's broader Neon pattern: code written/tested
against a fixed-instance, low-latency Postgres silently assumes round-trip cost is negligible.

**Apply next time:** when a read inside one interactive transaction must cover many rows, fetch them in
ONE bulk query (`WHERE id IN (...)` or an unbounded `SELECT`) instead of paging by ID across several
statements — keep the statement count O(1) regardless of catalog size. Bound the transaction's `maxWait`
by the actual remote connection-open latency (Neon cold-open was measured at ~2.1s, far above Prisma's
2s default), not by what a local instance needs. Add a regression test that counts statements/round
trips across catalog sizes (not just correctness), and exercise at least one test against a connection
with injected/real latency (a slow-connect `pg.Client`, or the remote dev branch itself) — a local-only
DB-backed suite, however large, cannot catch this class of bug by construction (DR-140/DR-144).
