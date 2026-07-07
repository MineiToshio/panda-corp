---
id: BL-0053
type: bug
area: build-engine
title: "FRD-23 read-model writer tests (statsWriter/factoryStoreWriter/backfill/regen) write AND delete the REAL .pandacorp/stats*.json on every gate run"
status: doing
severity: p1
opened: 2026-07-07
closed:
source: "factory/memory/_inbox.md 2026-07-07 harvest, agent-inferred — fix already in flight on branch worktree-agent-ac559d46fb2c325d3 (uncommitted: gitFixture.ts new + statsWriter/factoryStoreWriter/backfill/regen .test.ts rewritten)"
closes:
links: [LESSON-0110, BL-0052]
---

## Problem

The FRD-23 materialized read-model's writer test suite
(`mission-control/src/lib/achievements/read-model/_tests/{statsWriter,factoryStoreWriter,backfill,regen}.test.ts`)
invokes the real writer functions against the REAL, LIVE `.pandacorp/stats*.json` paths instead of an
isolated fixture root. Every `verify.sh`/CI run therefore writes throwaway test data into the live
materialization and deletes it again at teardown — destroying the FRD-23 read-model the factory itself
depends on (the "evaporation"), on every single gate pass. The reader's honest fail-loud fallback (DR-078,
live-derive when the cache is missing) masks the destructiveness: nothing crashes, the Informe just quietly
re-derives at O(N) cost until the next `sync-portfolio`, so the loss was easy to miss.

**Concrete evidence (2026-07-07):** `stats-factory.json` was found missing/needing manual regeneration
during this harvest window; traced to the test suite's write-then-delete cycle against the live path.

## Root cause

The writer tests were written to exercise the real writer functions (good — they test the actual code path)
but without an injected/overridable base path, so "the real writer function" and "the live production path"
are the same call. No fixture/tmp-root indirection existed for these tests before this fix.

## Fix plan

Already in progress on branch `worktree-agent-ac559d46fb2c325d3` (uncommitted at time of filing):
1. A `gitFixture.ts` helper providing an ephemeral scratch root (a throwaway git repo/dir) for the writer
   tests to target.
2. `statsWriter.test.ts`, `factoryStoreWriter.test.ts`, `backfill.test.ts`, `regen.test.ts` rewritten to
   invoke the writers against the fixture root instead of the live `.pandacorp/` paths.

When that branch lands: verify the diff matches this shape, run the full suite, confirm no test path
string still references the live `.pandacorp/stats` paths (`grep` the test files), and land it via a
normal commit + this item's `closed:`/`closes:`.

## Tests (prove the fix — TDD, RED → GREEN)

- Before the fix: running the writer test suite against the repo's real `.pandacorp/stats*.json`
  demonstrably overwrites/deletes those files (RED — reproducible by diffing file mtimes/contents
  before/after a test run).
- After the fix: the same suite run leaves the repo's real `.pandacorp/stats*.json` untouched (mtime/
  content unchanged) while still passing its own assertions against the fixture root (GREEN).

## Done when

- `gitFixture.ts` (or equivalent) exists and all four writer test files use it exclusively — zero
  references to the live `.pandacorp/stats*` paths in test code.
- A gate run (`verify.sh`) no longer mutates the repo's real stats cache files.
- LESSON-0110 back-linked; branch merged to `main` (factory repo has no merge queue — direct commit,
  constitution §11).

## Out of scope

Does not touch BL-0052 (the missing regen-trigger wiring) — that is a separate, still-open gap (the
trigger to call the writers at all). This item is only about test isolation for the writers that already
exist.
