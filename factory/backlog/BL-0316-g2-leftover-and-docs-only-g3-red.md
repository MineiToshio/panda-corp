---
id: BL-0316
type: bug
area: build-engine
title: "Remove engine-owned G2 snapshot leftovers and stop docs-only G3 reds from spending patch attempts"
status: done
severity: p1
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-13-02 (journal seq 45-62, jobs land-25-1/land-25-2)"
closes: "plugin 10.4.2 — disposable ignored files for owned detached G2 snapshots; docs-only G3 red retry then env-infra hand-back; unblock restores integrated WO-less units"
links: [DR-157, DR-150, BL-0312, BL-0315]
---

## Problem
In funko-tracker run `br-2026-11-13-02` a G3 went red on a batch made only of a docs unit: one ingest test timed out
under heavy swap (`land-25-1`/`land-25-2` out.log). The engine opened the unattributed fallback `u-patch-g3`, whose
worker found nothing to fix and was handed back as env-infra, spending patch executions on a red the batch could not
cause. Afterwards the leftover G2 snapshot `build/g2/frd-01-catalog-browsing-ce047e0b...` could not be removed: every
G2 admission failed with "G2 snapshot is protected: unclassified-ignored-files" (seq 55-61), `next` returned
`deadlock` and the run stopped, also after `start --resume`, which is documented to remove leftover G2 snapshots.

## Root cause
1. `removeWorktree` applies the shared DR-157 cleanliness predicate (`worktree-sweep.mjs` `worktreeCleanReason`) to G2
   snapshots like to any worktree. That predicate refuses ignored files it cannot classify (here `.env.local`, copied
   prototype assets and the snapshot's own `.pandacorp/run/*` gate files), although a G2 snapshot is a detached checkout
   of a pinned commit that only the engine's bootstrap and verify ever write into.
2. The G3 red policy always attributes or opens a patch; it never asks whether the batch could have caused the red.

## Fix plan
1. `worktree-sweep.mjs`: `worktreeRemovalReason`/`worktreeCleanReason` accept `disposableIgnored`, which skips only the
   ignored-file classification. `integrate/worktrees.mjs` `removeWorktree` passes it only for a DETACHED worktree whose
   ownership `engineWorktreeOwnershipReason` already proved (under `build/g2/`, HEAD = the pin, pin reachable from
   `lane/<run>/integration`). Tracked and untracked changes, locks, live cwds and running jobs still protect it.
2. `land/harvest.mjs`: a G3 red on a batch whose landable units are all `docs`, with no doc-lint failure and no implicated
   docs-surface path (`docsOnlyRedNotFromBatch`), opens no patch: the first red on an integration tip retries the landing
   (`nothing_to_land`, reason `g3_red_docs_only_retry`); a second red on the same tip hands the docs units back with cause
   `env-infra` (reason code `g3_red_not_from_batch`). Any other red keeps the existing patch path.
3. `failure/unblock.mjs` (BL-0312): a WO-less unit blocked after it was `committed`, `integrated` or `verified` returns to
   that state, so after fixing the machine `unblock` simply retries the landing; build/patch units are still re-queued.
4. Document in the CLI reference (3.11 landing, 3.14b unblock) and BUILD-15.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-build-v2-g2-leftover.mjs` (owned snapshot with generated ignored files removed; untracked or tracked
change, unreachable pin and a branch worktree kept) and `test-build-v2-land.mjs` BL-0316 cases (retry then env-infra
hand-back with no patch unit, unblock back to integrated and landing; doc-lint red, docs-path red and a mixed batch keep
the patch path; the pure predicate). Both fail on the previous `main`.

## Done when
Tests green, engine and worktree-cleanup suites green, CLI reference and BUILD-15 updated, plugin bumped, decision log.

## Out of scope
Automatic G3 retries for code batches; treating timeouts in code batches as env-infra.
