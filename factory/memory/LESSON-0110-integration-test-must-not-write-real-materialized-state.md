---
id: LESSON-0110
type: gotcha
domain: testing
tags: [test-isolation, fixture, materialized-cache, gate, dr-078]
context: an integration/e2e test suite that exercises a function whose real job is to WRITE a materialized cache/read-model file (not just read one), run as part of a repeatable gate (verify.sh, CI)
trigger: use this when writing or reviewing a test suite for a writer function that touches a real, live-state path (a materialized cache, a `.pandacorp/*.json` store, any file a running system depends on) rather than a throwaway fixture
source: "mission-control FRD-23 read-model test suite (2026-07-07) — statsWriter/factoryStoreWriter/backfill/regen `.test.ts` invoked the real writer functions against the REAL `.pandacorp/stats*.json` paths, so every `verify.sh` run in the repo both wrote AND then deleted (teardown) the live materialization — the 'evaporation': the FRD-23 read-model the factory depends on was destroyed by its own gate, not by an incident. Fix in flight (worktree branch worktree-agent-ac559d46fb2c325d3): introduces an isolated `gitFixture.ts` helper (ephemeral scratch repo/dir) so the writer tests exercise the real code path against a FIXTURE root, never the live one. Linked to BL-0053. Agent-inferred."
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0053, LESSON-0090, LESSON-0101]
---

**Situation:** a test suite for a materialized read-model's writer functions (`statsWriter`, `factoryStoreWriter`, `backfill`, `regen`) called those writers against the SAME paths the running factory reads from in production (`.pandacorp/stats*.json`, `.pandacorp/stats-factory.json`) instead of an isolated fixture. Every gate run (`verify.sh`, CI) therefore wrote throwaway test data into the real cache and then deleted it at teardown — silently destroying the live materialization on every single test pass, with no error surfaced (the reader's honest fail-loss fallback, DR-078, masked the damage by re-deriving live instead of crashing).

**Lesson:** a test that asserts "does this writer produce the right file" must never point the writer at the SAME path production reads — target a real path, target a real repo/root even, but never THE live one. This is a distinct trap from "the reader has a safe fallback" (DR-078 covers correctness, not availability): a fail-loud reader can still make an intermittently-destroyed cache LOOK fine (silently re-derives), which is exactly what let this ship unnoticed — the honesty contract hid the destructiveness instead of surfacing it. The more state a test's subject-under-test writes to disk, the more essential an isolated fixture root becomes; "it's just a test" does not protect a path that is also the production path.

**Apply next time:** when writing or reviewing tests for any function whose job is to WRITE a file the running system depends on, verify the test points at an ephemeral/fixture root (a `tmpdir`, a scratch git worktree, an injected base-path parameter) — never the repo's own live state paths — even if (especially if) the writer's contract is "operate on `.pandacorp/`" by default. Grep the test file for the literal live path before trusting a green run; a passing writer test proves nothing about isolation.
