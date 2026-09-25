---
id: BL-0185
type: bug
area: build-engine
title: "Integration gaps between the C2 worktree release (BL-0182..0184) and the drift policy (BL-0178): a failed concurrent apply re-applies as if the tests were on main, and a lifted drift block reports both blocked and pass"
status: done
severity: p2
opened: 2026-09-25
closed: 2026-09-25
source: "Cross-review of the serial merge bl-0181-rollup -> bl-0182-0184-c2 -> bl-0178-drift-policy (plugin 9.111.0); the C2 branch left case (a) open and the D2 branch noted case (b)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js gateConverge (green re-apply from reviewerEvidence; needs-owner block persisted un-alreadyTracked when deferred; post-repair fallback), finalizeGate (__outcomeDeferred), frdGateSerial/frdGateSplit blocked branch (deferral clause) — fixed in the 9.111.0 integration commit"
links: [BL-0178, BL-0182, BL-0184, BL-0159, BL-0180, DR-122]
---

## Problem
Two gaps appear only once BL-0182..0184 (C2 hardening) and BL-0178 (drift policy) run together.

(a) **Concurrent PASS whose apply fails.** `harvestGateResults` applies a concurrent pass from the gate
EVIDENCE dir (`gate.reviewerEvidence`, salvaged by `releaseGateWorktree`). When that apply fails (the
MECH returns `done:false`, throws, or hits the WP-08 cage), the verdict goes to `convergeQueue` and
`gateConverge` re-applies it with `applyGate(frd, ids, gate.testFiles, null)`. With `sourceDir: null` the
prompt says the reviewer's tests "are already on the main tree" and the cage reads main's own
`.pandacorp/run/gate-report.json`. After BL-0182 neither is true: the worktree was cleaned and the only
copy of the tests and report is in `.pandacorp/run/gate-evidence/<frd>/`. The re-apply would stamp
VERIFIED without porting the reviewer's tests, and read an unrelated report (the BL-0180 hole again).

(b) **Duplicate terminal telemetry on a lifted drift block.** The reviewer's own "can't pinpoint" blocked
branch emits `review_end blocked` + `frd_end` + `GateVerdict blocked` from inside its prompt. When
`adjudicateDrift` later proves every red is pre-existing drift and lifts the block (canary D2 FRD-02
shape), `applyGate` emits `pass`. The dashboard and `track.jsonl` then show the same gate as both
blocked and passed.

## Root cause
(a) `gateConverge`'s green branch predates C2's evidence dir. It only knew two sources: the gate ran on
main (tests in place) or the harvest ported from the worktree.
(b) The reviewer emits its terminal outcome before the engine adjudicates. The engine cannot take back
an event the agent already appended.

## Fix plan
1. (a) `gateConverge`: when the verdict carries `reviewerEvidence`, re-apply exactly as the harvest does:
   `applyGate(frd, ids, ev.tests.map(path), ev.dir)`. That is an idempotent overwrite port plus the
   evidence copy of the gate report. Only a gate that ran on main applies in place.
2. (b) The blocked branch of both gate prompts (serial and split) gets one clause: when the reason is
   `needs-owner` AND a `fail` entry carries `claim: "preexisting"`, emit nothing, because the engine
   emits the one terminal outcome. `finalizeGate` applies the same predicate (`deferredGateOutcome`) to
   the RAW verdict. If the adjudicated result is still a block, it is marked `__outcomeDeferred`, and:
   - `gateConverge`'s needs-owner branch persists it with `alreadyTracked = !__outcomeDeferred`, so
     `persistGateBlock` emits it;
   - the post-repair fallback persists a deferred needs-owner block (which emits it) instead of only
     calling `blockFrd`.
   A lifted block emits only the apply's `pass`. A block turned into a reopen emits nothing terminal,
   because the later patch or verify emits the outcome. `external` and DR-072 non-progress blocks are
   untouched: adjudication can never lift them.

## Tests (prove the fix — TDD, RED → GREEN)
In `plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0185 … ----`:
- BL-0185a (RED before): a concurrent pass, first apply `done:false`. The re-apply ports from
  `gate-evidence/<frd>/`, reads `gate-evidence/<frd>/gate-report.json`, and never says "already on the
  main tree".
- BL-0185b1 (RED before): the gate prompt carries the deferral clause.
- BL-0185b2: a lifted block produces no persist-block, one apply with `pass`, and no engine-side
  blocked emission.
- BL-0185b3 (RED before): a block that still stands after adjudication (another open fail) is persisted
  WITH its emission.
- BL-0185b4: control. A block without claims keeps `alreadyTracked` (BL-0159 unchanged).
- BL-0185b5 (RED before): a post-repair re-gate that is a deferred block is persisted and emitted once.
- BL-0185c: C2 × D2 combined. A reopen with 1 cycle fail and 1 proven drift. The proof runs inside the
  gate link before the release; the drift card is filed once; the reviewer test is ported and
  hash-checked; the patch is not asked about the drift; `verifyPatched` inherits only the cycle fail,
  runs the ported test by path and stamps `drift: [...]`; the FRD reaches VERIFIED with no revert.

## Done when
All BL-0185 scenarios are green in `node plugin/scripts/test-pandacorp-build.mjs`,
`run-engine-tests.sh` is green, the engine copy in `mission-control/.claude/engines/` is byte-identical
(`cmp`), and plugin 9.111.0 / overlay 8.88.0 are shipped.

## Out of scope
The reviewer's inline emission for a `reopen` that the engine turns into a cycle-fault reopen, and for
`error` blocks that go through `attemptRepair`. Neither is terminal-duplicated by BL-0178.
