---
id: BL-0150
type: bug
area: build-engine
title: "the WP-06 evidence collector and the C2 gate probe each requested the pinned gate worktree independently, spawning TWO concurrent gate-worktree agents for the same sha"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "canary B launch 2026-09-22 (canary-b-report.md §6.1), frd-25-canary-speed-sprint, journal.jsonl agents a0c7355874f43cc0f + a54f9bc0807fd09e5"
closes: "fix-gate-worktree-bootstrap worktree, ensureGateWorktree memoization in plugin/templates/shared/.claude/engines/pandacorp-build.js"
links: []
---

## Problem
Canary B's `journal.jsonl` recorded `concurrency_max: 2` where only 1 was expected: two agents both
labelled `gate-worktree`/phase `Review`, with DIFFERENT `key`s (`a0c7355874f43cc0f` key
`v2:c211b68a...`, `a54f9bc0807fd09e5` key `v2:0542ee74...`), starting 5ms apart
(14:12:45.136Z / 14:12:45.141Z UTC). Different keys rule out a simple retry-dedup of the same
logical step — these were two DIFFERENT invocations of the same step racing each other. One returned
`{"ok": true, "created": true}`; the other, arriving after the worktree already existed, returned only
`{"ok": true}`. The comparison canary A (`gateEvidence: 'explore'`, no WP-06 collector) spawned exactly
ONE `gate-worktree` agent — the duplicate is specific to the `digested` code path. Cost of the defect:
small in isolation (≈63s / $0.19 combined, mostly overlapping in wall-clock so the net time impact is
≈0), but it is a genuine race condition, not telemetry noise, and it compounds the BL-0149 contamination
(a redundant worktree-prep spawn on top of an already-wasted bootstrap+rerun).

## Root cause
Three call sites invoke `ensureGateWorktree(pinSha)` for a gate's FIRST FRD: (1) `launchEvidence`,
chained on the `gateWorktreeChain` mutex promise, fired at wave close right after `capturePin`; (2)
`launchGate`, also chained on `gateWorktreeChain`, fired when the FRD's gate is actually launched; (3)
the C2 concurrent-gate PROBE in the main scheduling loop (`concurrentGates = await
ensureGateWorktree(frdState.get(gateQueue[0]).pinSha)`), called DIRECTLY — bypassing
`gateWorktreeChain` entirely. `ensureGateWorktree`'s only existing guard was
`if (worktreeState === 'ready' && lastWorktreeSha === sha) return true` — a plain state check with no
protection against two calls racing BEFORE either's `agent()` spawn had resolved. Because
`launchEvidence`'s chained call is scheduled as a microtask (never awaited at its own call site) and the
probe runs synchronously later in the same tick before that microtask settles, both calls observed
`worktreeState !== 'ready'` and each spawned its own `agent()` — reproduced deterministically in the
engine's own in-memory test harness (no timers needed; pure promise-ordering).

## Fix plan
`ensureGateWorktree` (`plugin/templates/shared/.claude/engines/pandacorp-build.js`) now memoizes its
in-flight spawn on a SHARED promise, keyed by `sha`: two new module-level `let`s,
`gateWorktreeInFlight` (the pending promise) and `gateWorktreeInFlightSha` (the sha it is preparing). A
call for the SAME sha while one is already in flight returns that SAME promise instead of spawning a
second `agent()` call — regardless of which of the three call sites made it, and without needing to
reroute any of them through `gateWorktreeChain`. The `finally` block clears the in-flight slot once the
attempt settles (success or failure), so a later call for a NEW sha proceeds normally. This is the root
fix (the primitive itself is now safe under concurrent callers), not a patch to any one call site — the
collector and the gate already shared the same `pinSha` (from the same `frdState` entry), so no change
to how the callers pick their sha was needed.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, `FIX2b`: a `gateEvidence: 'digested'` scenario with a single
FRD asserts `byLabel(run, 'gate-worktree').length === 1` even though the evidence collector's chained
call AND the C2 probe's direct call both request the worktree for the FRD's `pinSha`. Confirmed RED
before the fix by an isolated debug harness reproducing the exact race (2 spawns, same as canary B);
GREEN after the fix (1 spawn) with `node plugin/scripts/test-pandacorp-build.mjs` — 143 passed, 0 failed,
and the FRD still verifies through the digested gate (no regression to the WP-06 contract).

## Done when
- [x] `FIX2b` is green in `test-pandacorp-build.mjs`.
- [x] `bash plugin/scripts/run-engine-tests.sh` green, run twice (22/22 suites both times).
- [x] `claude plugin validate plugin/ --strict` passes.
- [x] No other WP06/C2 scenario regressed (full suite 143/143, was 139/139 before FIX2).

## Out of scope
Routing the C2 probe call site through `gateWorktreeChain` for its own sake (the per-sha memoization in
`ensureGateWorktree` makes that unnecessary for the concrete race this item closes); a broader audit of
every OTHER path that might call `ensureGateWorktree` with a genuinely DIFFERENT sha concurrently is not
covered here — today's three call sites all share one FRD's `pinSha` at the point they fire.
