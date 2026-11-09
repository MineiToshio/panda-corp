---
id: LESSON-0635
type: gotcha
domain: database
tags: [neon, prisma, p2028, cold-start, interactive-transaction, retry]
context: a Prisma interactive transaction (or the Ops CLI/catalog-lookup commands built on one) against a Neon serverless Postgres branch
trigger: use this when a Prisma call against a Neon database intermittently fails with error P2028 ("Transaction already closed"/transaction-start timeout) — before concluding the underlying data is missing or the feature is broken
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07/08 (agent-inferred, two incidents): Ops CLI P2028 on Neon DEV when connect latency spiked to 2-5s against a 2s default maxWait (plain psql worked, retry succeeded once latency dropped); `catalog:find` via pnpm env:run intermittently returned the same P2028 (transaction-start timeout), resolved by retrying every 3-4s within 1-4 attempts"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0431, LESSON-0656]
---

**Situation:** two separate Prisma call sites against a Neon serverless Postgres branch (an Ops CLI
command, and a `catalog:find` lookup) intermittently failed with Prisma's `P2028` (the interactive
transaction's `maxWait`, 2s by default, exceeded before the transaction could even start) whenever Neon's
connection/wake latency spiked to 2-5 seconds. A plain `psql` connection worked fine at the same moment,
and retrying the same Prisma call 1-4 times, a few seconds apart, always succeeded once the latency
dropped.

**Lesson:** `P2028` against Neon is very often not a real data/logic failure — it is Neon's serverless
compute waking up (or a transient connection-pool/latency spike) outlasting Prisma's short default
`maxWait` for starting an interactive transaction. Reading a `P2028` as "the record/franchise is absent"
or "the feature is broken" is the wrong diagnosis; the same query against the same data succeeds a few
seconds later with no code change.

**Apply next time:** when a Prisma call against Neon serverless intermittently throws `P2028`, retry the
call (every 3-5s, up to ~4 attempts) before treating it as a real result; for production code paths that
read from Neon, raise the interactive-transaction `maxWait`/`timeout` above the 2s Prisma default (e.g. in
a read-only CLI's `main.ts`) rather than accepting the default tuned for a low-latency same-region
Postgres. Never conclude "absent"/"failed" from a bare `P2028` without a retry.
