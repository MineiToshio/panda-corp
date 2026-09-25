---
id: BL-0186
type: change
area: build-engine
title: "Parallel FRD gates behind args.parallelGates (default off): a pool of gate worktrees, dependency- and artifact-aware eligibility, and one serialized landing lane with a stale-pin guard"
status: done
severity: p2
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md, Decision 1 (§1.3) with the conditions of its Red-team addendum (2026-09-25) §A3 (X1-X13) and §A6 row 5; canary D2 wf_faf48b18-881 (57.6 of 87.5 min in the post-wave gate segment)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js — D1 PARALLEL FRD GATES (gatePool, launchParallelGates, launchGateInSlot, gateConflict, stalePinGuard, landParallelVerdict, drainParallelGates; ensureGateWorktree/releaseGateWorktree per slot) + factory/standards/build-orchestration.md §5c — shipped in 51390909 + 8663a34c"
links: [BL-0187, BL-0182, BL-0183, BL-0184, BL-0185, BL-0178, BL-0138, BL-0154, BL-0179, DR-118, DR-060, DR-122]
---

## Problem
Since DR-118 (C2) a per-FRD gate overlaps the **build**, but gates still serialize with **each other**: one gate
worktree (`GATE_WORKTREE`), one mutex chain (`gateWorktreeChain`), and any reject quiesces every in-flight gate
(`settleGates(true)` before `drainConverge()`) before its ladder runs. Canary D2 spent 57.6 of its 87.5 minutes
in that post-wave gate segment with four independent FRDs gate-ready together (proposal 38 §1.2). The proposal
recommended parallel gates behind a flag; its red-team addendum accepted that with conditions: fix the C2
hygiene first (done: BL-0182..0185), explicit per-slot e2e ports (X7 — the BL-0154 path hash is not injective:
Mission Control's `gate-worktree-3` hashes to 3900, main's reserved port), port-then-guard-then-stamp (X4), an
exclusive landing lane (X5), unit reservation (X10), honest repair-token accounting (X9) and no concurrent
read-modify-write of shared files (X11).

## Fix plan
Everything is behind `args.parallelGates` (argBool, **default false**). Off, the engine is the C2 topology
byte-for-byte: the single worktree's state moved into a `LEGACY_SLOT` object whose prompts, labels and logs are
unchanged. On:
1. **Pool.** `args.gateSlots` (default **2**, the 16 GB machine the red-team measured, X6; integer 1..8,
   alias `args.maxParallelGates`) slots at
   `.pandacorp/run/gate-worktree-<k>`, each bootstrapped with `PANDACORP_E2E_PORT=3800+10·k`.
   `ensureGateWorktree(sha, slot)` / `releaseGateWorktree(frd, gate, slot)` keep the BL-0150 memo, the BL-0183
   clean proof and the BL-0182 salvage per slot. A gate owns its slot from probe to release (`finally`), so a
   crash frees and cleans it. A slot failing its probe leaves the pool loudly. Its FRD is re-queued to another
   slot only when the failure was dirt, and at most once; otherwise it is gated on main. When every slot has
   failed, the run takes the legacy synchronous path. A probe whose agent throws drops the slot's clean proof. Digested evidence is collected inline in the slot (`launchEvidence` is a no-op under the
   flag). `persistGateBlock` drops the BL-0175 backstop salvage under the flag, because another gate may occupy
   that slot.
2. **Eligibility** (`gateConflict`). No cross-FRD dependency either way (WO `deps` transitive + FRD-level deps)
   with any FRD whose verdict has not landed, and disjoint reviewed artifacts (`artifactsOverlap`, fail-safe on
   undeclared). A dependent also waits while its upstream is still building or queued, so the upstream lands
   first. The idle path waives that last rule for the head of the queue, so mutually dependent FRDs cannot
   deadlock. An FRD a safe-point drain enrolled already gate-ready is pinned at HEAD before it takes a slot.
3. **Budget.** The estimated cost of each launched gate is reserved (`gateReserved`, released at settle). A
   second concurrent gate starts only if `maxAgents` still covers its estimate + one landing
   (`GATE_LANDING_COST` = 2); otherwise `gate deferred: agent budget`. With nothing in flight the first eligible
   gate always starts. The wave picker subtracts the same reservation.
4. **Landing lane** (`landParallelVerdict`). One verdict per loop iteration, in arrival order, no quiesce, no
   wave overlap. PASS → `stalePinGuard` (MECH `stale-pin:<frd>`: code commits since the pin outside
   `.pandacorp/` and `docs/`) → when non-zero or unknown, MECH `reverify:<frd>` ports the reviewer's tests
   first, runs `verify.sh --since <pin>` on main and the tests by path. Red, partial or no verdict → the PASS
   becomes a reopen through `convergeOne` (the unchanged ladder, BL-0184 port). Reject, block and crash go
   through `convergeOne`. The run-end invariant is `drainParallelGates`. A verdict carries snapshots of the
   reviewed ids and the launch pin. One FRD never has two gates: `enqueueGateIfComplete` and the launcher refuse
   an FRD whose verdict has not landed, and the landing re-queues it, re-pinned at HEAD, when a safe-point
   unblock gave it new work meanwhile. A PASS with no salvaged evidence is re-gated on main and never read from
   a slot. A landing that ported the reviewer's tests but did not certify its FRD removes those copies when they
   are untracked and byte-identical (MECH `unport-reviewer-tests:<frd>`); the originals stay in the evidence
   dir.
5. **BL-0138.** `markTokensUnreliable`: a build wave or repair rung that runs while gates are in flight
   switches that FRD's token layer off for the run, logs the reason, and never records the polluted delta.
6. **Launcher.** `launch-implement.sh --parallel-gates [--gate-slots N]` (validated before the lease), since the
   skill forbids hand-editing the printed `Workflow()` call.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, section `// ---- D1 parallelGates ----`. Gate responses are promises
the scenario resolves itself, so concurrency is read from the recorded timeline and not assumed:
- D1a: 3 disjoint FRDs. 3 gates start before the first result, each in its own slot, landings in arrival order
  (3 → 1 → 2), and the lane runs at most one writer at a time.
- D1b: a dependent FRD waits for its upstream's landing, and its wave's token layer is marked unreliable.
- D1c: overlapping artifacts are queued while a disjoint third FRD runs alongside.
- D1d: budget. `gate deferred: agent budget`, one gate at a time, and the first always runs.
- D1e1/D1e2: main advanced. The guard ports the tests first and re-verifies with `--since <pin>`. Green → apply;
  red → reopen, then port, patch and independent verify.
- D1f: needs-owner in slot 2 lands while slots 1 and 3 are still reviewing, and persist-block never touches a
  slot.
- D1g: a crash in slot 1 still releases the slot, and the queued FRD reuses it while slot 2 still reviews.
- D1h (×3): flag absent, `false` or `"false"` → the single C2 worktree and no D1 spawn.
- D1i (+4): explicit ports 3810/3820/3830, pool size, alias, and invalid values.
- D1j: a patch that runs alongside a gate falls back to agent-weight, logged.
- D1k: parallel drift proofs read their own slot, and `drift-proof.mjs` keys its tmp dir by FRD + pid + clock.
- D1l: gates are review-only in their slot, digested evidence is collected in the slot, and landing steps run on
  main.
- D1m/D1n: upstream lands first, and a mutual dependency is waived without a deadlock.
- D1o: a drained gate-ready FRD is pinned before it takes a slot.
- D1p: an in-review regression from the independent review. A safe point unblocks a WO of an FRD whose gate is
  in flight. The engine runs no second concurrent gate, and the first landing stamps only its reviewed WO at
  its own pin. A fresh gate then runs at a new pin. Against the first commit: two concurrent gates, the
  unreviewed WO stamped, and the second verdict never landed.
- D1q: a reopen that ends deferred removes its untracked ported test copies. A certified landing does not (the
  control is in D1e2).
- D1r (×2): a dirty probe re-queues once into slot 2; a non-dirt probe failure gates on main without burning
  slot 2.

`test-build-run-id.mjs`: the launcher passes `--parallel-gates`/`--gate-slots`, omits both keys without the flag,
and rejects `--gate-slots` without the flag or outside 1..8 before taking the lease.

RED: all 17 D1 scenarios except the three D1h controls fail against the pre-D1 engine (`git show main:…`), and so
does D1o with its pin step disabled. The pre-D1 launcher dies on `unknown launcher argument: --parallel-gates`.
Only one existing scenario changed: WP03a, a static MECH site count, 21 → 24 (`stale-pin:`, `reverify:`,
`unport-reviewer-tests:`, all reached only under the flag).
Flag-off differential (not committed): every pre-existing scenario (218) was run on the pre-D1 and the new
engine, and the agent calls (label, prompt, opts), logs, phases and results were identical.

## Done when
- [x] `node plugin/scripts/test-pandacorp-build.mjs`: 245/245. `bash plugin/scripts/run-engine-tests.sh`:
  26/26 suites.
- [x] `mission-control/.claude/engines/pandacorp-build.js` is byte-identical to the template (`cmp`).
- [x] `validate-backlog.sh`, `check-derived-drift.sh` and `claude plugin validate plugin/` are green.
- [x] `factory/standards/build-orchestration.md` §5c and `plugin/skills/implement/SKILL.md` (constants table +
  launcher syntax) are documented.

## Out of scope
- The plugin/overlay version bump and the `plugin/docs/decision-log.md` entry (the release batch owns them).
- Flipping the default. Canary E measures first (gate segment, zero `VERIFIED` red at the close-out full
  suite, no false needs-owner).
- A RAM-derived default (X6), a machine-wide Playwright `flock`, and a per-slot vitest worker cap: `gateSlots`
  is set by hand.
- The X5 priority lane: landing is FIFO by arrival, as specified. The X5 post-run `last_green_sha` audit is
  filed as BL-0187 (open).
- A behavioural test for the probe-throw reset (1-line fix, verified by reading only) and for the no-evidence
  PASS path, which is unreachable today because `releaseGateWorktree` always returns an evidence object.
- The C2 flag-off path has the same live-`reviewIds` and untracked-port exposures. Fixing them there would break
  flag-off byte-identity, so a separate item should take them.
- Salvaging slots from the crash fail-safe (X8): a killed session leaves dirty slots, which the next run drops
  loudly.
- The punch-list `>>` append (X11): prompt zone.
- A pre-existing flag-off gap seen in passing: C2 gates that overlap a single-FRD wave also pollute that wave's
  `budget.spent()` build-token delta. Left untouched so that flag off stays byte-identical.
