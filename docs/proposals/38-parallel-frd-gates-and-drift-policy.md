# 38 — Parallel FRD gates and a uniform pre-existing-drift policy

**Status:** proposed · **Date:** 2026-09-25 · **Owner:** factory maintainer
**Home:** FACTORY proposal (the build engine's own know-how), not a product project.
**Repo state when audited:** `main` at `ed915b43`, clean tree, plugin 9.109.0. Strictly read-only audit: nothing here has been implemented or executed.

> Self-contained memo with **two independent yes/no decisions** for the owner. Every claim carries its evidence (`file:line`, command, or measured artifact). Numbers marked **PROJECTION** are not measurements: they are built from the measured canary-D2 agent timeline plus the stated assumptions.

---

## TL;DR

1. **What is actually parallel today (DR-118 / C2):** a gate overlaps the **build** — it reviews a frozen worktree while the next wave builds on main. **Gates never overlap each other**: there is exactly **one** gate worktree and every gate is chained on one mutex (`gateWorktreeChain`, `pandacorp-build.js:2817`; the standard says so plainly, `build-orchestration.md` §5a "Gate reviews serialize with each other"). On top of that, **any reject quiesces the loop until every in-flight gate settles** (`settleGates(true)` before `drainConverge()`, `:3024-3026`), so a 1-minute block write can wait 12 minutes behind an unrelated review.
2. **Canary D2, re-measured from the primary artifacts:** the post-wave gate segment was **57.6 min of the 87.5-min run (65.8 %)**; the gate ladder (4 opus reviews + 2 patches + 2 independent verifies + apply/persist) cost **44.12 $ of 58.58 $ (75 %)**, and the four opus reviews alone **38.22 $ (65 %)**. D2 actually ran the **legacy synchronous path** for FRD-03/04/05 (BL-0175 dirty worktree), but I re-simulated the healthy C2 path on 9.109.0 and it lands **within ~1 min of the same 57.6 min** — the seriality is structural, not the BL-0175 accident.
3. **Decision 1 — recommendation: DO IT, WITH CONDITIONS, behind `parallelGates` (default off).** A pool of N gate worktrees (default 3), one **single-lane landing queue** on main (apply / converge / persist, one at a time), a **stale-pin guard** at landing, and dependency-aware gate eligibility. **PROJECTION on D2: −27.5 to −33 min (−31 % to −38 %), cost ±0.** It is a **time** lever only: **0 benefit on single-FRD changes** (the canary A/B/C shape) and **no cost benefit anywhere** (same agents, reordered). Implementation ≈ 14 test scenarios, 2-3 days, **medium-high risk** (concurrency at the trust boundary). Measurement: canary E, ≈ 60 $ metered (+ ≈ 20 $ unmetered cache-write, as in D2).
4. **Decision 2 — BL-0178 — recommendation: option (a), with a mechanical pre-existence proof.** Pre-existing drift never blocks the cycle's work orders; it is **always** recorded (on every gate path, identically) as a `draft` drift card in the change queue, and Mission Control shows the FRD as "VERIFIED · N drift" **derived** from those cards. "Pre-existing" is **not the reviewer's say-so**: the engine proves it (the contract is owned by no reviewed WO **and** its evidence files are untouched by this cycle's diff) — otherwise it is a normal cycle fault (reopen → patch). `verifyPatched` inherits the first gate's unresolved `fail` entries and refuses green while any remain. ≈ 9 scenarios, ≈ 1 day, **low-medium risk**; no dedicated canary (canary E replays both FRD-02 and FRD-03 shapes).
5. **Order (§4):** BL-0178 first (cheap, and it removes an order-dependence that parallel landings would otherwise amplify) → parallel gates behind the flag + tests → canary E measures both.

---

## §0 · Own re-verification before writing (CONV-13)

| # | What | How | What I saw |
|---|---|---|---|
| a | The canary-D scratchpad reports named in the brief (`canary-d-report.md`, `canary-d-frd02-forensics.md`) | `ls -la …/e4c52a6e-…/scratchpad/` | **The directory is empty** (recreated 2026-09-25 08:21). **I could not read either report.** Everything below is re-derived from primary artifacts instead (rows b-f), plus the text of BL-0178 and memo 37 that quote them. |
| b | D2 run parameters and log | `workflows/wf_faf48b18-881.json` → `args`, `logs` | `mode: powerful`, `maxAgents: 40`, engine from plugin **9.108.0**; log line: `⚠ C2: gate worktree could not be prepared (… dirty …) — falling back to the LEGACY synchronous gate path for the whole run` |
| c | D2 agent timeline (start/end of every agent) | first/last `timestamp` of each `subagents/workflows/wf_faf48b18-881/agent-*.jsonl` | the timeline in §1.2 (27 agents, 01:25:42 → 02:53:13 UTC) |
| d | D2 cost and duration per agent | last `usage_summary` line of `panda-corp-canary-d/mission-control/.pandacorp/track.jsonl` | `cost_usd_total: 58.576658`, `wall_clock_s: 5250.37`, `concurrency_max: 4`, `cache_creation_cost_usd_estimated: 19.504171` (**excluded** from the 58.58) |
| e | The brief's "15+11+12+11 min" | `review_start`/`review_end` in the same `track.jsonl` | frd-02 **15.1** · frd-03 **10.1** · frd-04 **12.1** · frd-05 **11.0** min (review only, from the in-prompt TRACK lines). The agent spans are longer (17.6 / 11.8 / 13.5 / 9.6) because they include pre/post-emission work; §1.2 uses agent spans. |
| f | BL-0178's two drift facts, live | `sed -n 329,333p …/src/lib/portfolio/portfolio.ts`; `sed -n 15,22p …/frd-03-portfolio/frd.md` | `ACTIVE_PHASES` = `"architecture","implementation","release"`; REQ-03-001 says projects in `architecture` "SHALL NOT appear". **Confirmed.** AC-02-010.4 / .8 exist in `frd-02-ideas-board/frd.md:84,93` (the drift *verdict* on them I take from BL-0178, not re-judged). |
| g | BL-0175 residue in the canary worktree | `git -C …/panda-corp-canary-d/mission-control/.pandacorp/run/gate-worktree status --porcelain` | 3 untracked frd-02 reviewer tests (`frd-02.empty-column.reviewer.test.tsx`, `frd-02.oracle-gaps.reviewer.test.tsx`, `e2e/board-empty-column.spec.ts`) — exactly the BL-0175 mechanism that forced D2 to legacy. |

---

# DECISION 1 · Parallel FRD gates

## 1.1 What is serialized today, and by what

Read from `plugin/templates/shared/.claude/engines/pandacorp-build.js` (9.109.0):

| Serializer | Where | Effect |
|---|---|---|
| **One gate worktree** | `GATE_WORKTREE` (`:491`), `worktreeState`/`lastWorktreeSha` single values (`:2812-2813`) | Only one checkout exists, at one sha. |
| **One worktree mutex** | `gateWorktreeChain` (`:2817`), chained in `launchGate` (`:2929-2948`) and `launchEvidence` (`:1503-1516`) | Gate reviews run strictly one after another even when `MAX_CONCURRENT_GATES` (`:490`, default 2) lets two promises exist. The comment says it: "they still serialize on the single worktree; this bounds the backlog". |
| **Quiesce-before-converge** | `if (convergeQueue.length) { await settleGates(true); await drainConverge(); continue }` (`:3024-3027`) | Any non-pass verdict waits for **every** in-flight gate to finish before its ladder (patch / verify / persist-block) runs on main. |
| **Converge on main, one FRD at a time** | `drainConverge` (`:2983-2989`) → `gateConverge` (`:2549`) | patch-first (`attemptPatch`, `:1989`) and `verifyPatched` (`:2054`) write and commit on main. |
| **One git writer on main** | `commitChain` shared by WO commits, `applyGate` (`:1772`), `persistGateBlock` (`:1812`) | No `index.lock` races. **This one is correct and must stay.** |
| **Repair-token brake assumes a quiet window** | `chargedRepair` (`:1895`) measures `budget.spent()` deltas; the comment at `:1847-1856` justifies it because "drainConverge() awaits every in-flight gate" | If reviews keep running during a patch, the delta absorbs their spend. |

What is **not** a serializer any more: the e2e port (BL-0154 hashes a per-worktree port in `worktree-bootstrap.sh:78-108`, and D2 used 6 distinct ports); the lease (renewed at safe points, unaffected by gate count); `verify.sh`'s report (written inside each worktree's own `.pandacorp/run/`).

So the brief's premise needs one correction: the engine does **not** "serialize gates at wave boundaries (quiet tree)" any more — that is the pre-C2 text still in `build-orchestration.md:95-98` and the module description (`:3`). Since DR-118, gates are **concurrent with builds** and **serial with each other**. The lever is the second half.

## 1.2 D2, measured (agent spans, UTC, 2026-09-25)

```
01:25:42 ─ baseline / plan / pin / safe-point / gate-worktree / foundation / dispatch   (4.9 min)
01:28:43 ═ gate:frd-02 (opus) ══════════════════════════════════╗ 17.6 min, 11.67 $  — overlaps the build (C2 working)
01:30:38 ─ build WO-03-006 ─┐ build WO-04-008 ─┐ build WO-05-007 ─┐  (3 in parallel)
01:38:12 ─ last WO commit  ─┴──────────────────┴──────────────────┘  ← wave barrier (T0)
01:38:12 … idle-wait for frd-02 (single worktree)                     8.1 min
01:46:19 ─ gate-worktree probe → DIRTY → LEGACY for the rest of run   0.2
01:46:32 ─ persist-block:frd-02 (needs-owner, BL-0178 drift)          1.4
01:47:55 ─ gate:frd-03 11.8 → patch 2.8 → verify-patch 2.7            17.3  (8.81+1.33+1.23 $)
02:05:11 ─ gate:frd-04 13.5 → patch 3.0 → verify-patch 2.1            18.6  (9.93+1.59+1.10 $)
02:23:49 ─ gate:frd-05 9.6  → apply-gate 2.4                          12.0  (7.81+0.45 $)
02:35:49 ─ visual-qa 12.0 → reuse-check 0.3 → notify-end 5.1          17.4
02:53:13 ─ end                                                        total 87.5 min, 58.58 $
```

Post-wave gate segment **01:38:12 → 02:35:49 = 57.6 min** (= memo 37's 3457 s). Gate ladder cost **44.12 $** (reviews 38.22 + patches 2.92 + verifies 2.33 + apply/persist 0.65).

**Counterfactual — healthy C2 on 9.109.0 (BL-0175 fixed, flag off).** Walking the loop at `:3000-3100` by hand: frd-03 is launched but chains behind frd-02 on the mutex (starts 01:46:19); frd-02's block waits in `convergeQueue` for `settleGates(true)` → until frd-03's review ends (~01:58:45); persist-block; frd-03 patch+verify (→ ~02:05:40); only then frd-04 and frd-05 launch, chained; frd-04's reject waits for frd-05's review; frd-04 patch+verify; frd-05 apply → **~02:36**. **Within ~1 min of the measured run.** BL-0175's fix restores C2 but buys ~nothing on this shape. *(Hand simulation, not measured.)*

## 1.3 Minimal design

Everything below is behind **`args.parallelGates`** (default `false` → today's C2 byte-for-byte) and **`args.maxParallelGates`** (default **3**).

1. **Worktree pool.** Slots `…/.pandacorp/run/gate-worktree` (slot 0 — the existing path, for back-compat) and `…/gate-worktree-<k>`. `ensureGateWorktree(sha, slot)` keeps today's contract per slot (register-check, clean-check, `worktree-bootstrap.sh`, never delete residue — BL-0067), memoized per slot (BL-0150's promise-sharing, keyed by slot+sha). A failed slot **shrinks the pool**; only when every slot has failed does the run fall to legacy. Per-slot chains replace the single `gateWorktreeChain`; `launchEvidence` (digested mode) runs on the same slot as its gate.
2. **Dependency-aware eligibility.** A gate-ready FRD launches only if **none of its WOs `dependsOn` (transitively) a WO whose FRD has an unlanded verdict** (in flight or waiting in the landing queue). Reason in §1.5-R6.
3. **Single-lane landing queue.** Every settled verdict — PASS, REJECT, BLOCK — enters **one FIFO**, drained **one item at a time** on main: PASS → `applyGate` (with the guard of point 4); REJECT → the unchanged DR-072/073/117 ladder (`gateConverge`); BLOCK → `persistGateBlock`. **The `settleGates(true)` quiesce is removed under the flag**: reviews in other slots do not touch main, so a landing does not need them finished. **Builds still never overlap a landing** (the loop still `continue`s after draining, so no wave is dispatched while the lane is busy) — main keeps exactly one writer at a time.
4. **Stale-pin guard at landing (the reproducibility fix).** The apply step computes `git diff --name-only <pin>..HEAD`.
   - Only `.pandacorp/**` / `docs/**` (other FRDs' stamps, rollups, blocks) → stamp as today.
   - Any other path (another FRD's ported tests, a patch, a revert) → run `bash .pandacorp/verify.sh --since <pin>` **on main** before stamping; red → the verdict is converted into a REJECT with that report as findings and goes down the normal ladder.
   - `docs/frds/<this-frd>/frd.md` or its work orders changed normatively since the pin (a change drained at a safe point) → **discard the verdict and re-gate** (at most once; a second hit runs the gate on the landing lane, synchronously).
5. **Per-slot evidence and report paths.** `applyGate` ports test files from **the slot's** path (today's `sourceDir`), and the WP-08 cage reads **the slot's** `.pandacorp/run/gate-report.json` — see §5 latent defect L1. Punch-list nits are appended with `>>` to the **absolute main-tree path** (N concurrent reviewers doing a read-modify-write `Edit` on one file would lose lines).
6. **Honest repair-token accounting.** While any gate is in flight, a repair rung's `budget.spent()` delta is marked **unreliable** and the brake falls back to agent-weight — the same fallback `recordWaveBuildTokens` already uses for multi-FRD waves (`:1867-1882`). Never read a polluted delta as real (it would overcount and trip a false needs-owner).
7. **Run-end invariant kept.** On any brake stop (`agents`, `budget`, `blocks`), every settled verdict is still harvested and landed before close-out (today's C2-v guarantee, `:3274-3278`).

**Explicitly rejected:** running the **patch** inside the gate worktree and rebasing it onto main. It would save another ~5 min on D2 but turns an append-only landing into a code merge with conflict handling on the trust boundary. Not worth it before a canary proves the minimal design.

## 1.4 Honest projection (PROJECTION, not measured)

Assumptions: reviews start at the wave barrier T0 in their own slots; **b** = extra slot create+bootstrap (reuse measured at 0.6 min; a fresh pnpm-hardlinked create is **not measured**, assumed 2-3 min); **c** = contention factor on review duration when 3-4 opus reviewers each run vitest/tsc/Playwright on one Mac (**not measured**, bracketed 1.0-1.4); patch+verify and apply durations as measured.

| Post-wave gate segment | Serial (measured D2) | Healthy C2, flag off (simulated) | Parallel, c=1.0, b=2 | Parallel, c=1.4, b=3 |
|---|---:|---:|---:|---:|
| Minutes | **57.6** | ≈ 58 | **≈ 24.6** | **≈ 30.1** |
| Saving vs D2 | — | ≈ 0 | **−33.0** | **−27.5** |
| Whole run | 87.5 | ≈ 88 | ≈ 54.5 | ≈ 60.0 |

How the parallel column is built (c=1.0): frd-02's block lands at 01:46:19 (1.4 min); frd-05 is ready at T0+11.6 and lands by 01:52:12; frd-03 ready at T0+13.8, patch+verify 01:52:12→01:57:42; frd-04 ready at T0+15.5, waits for the lane, lands 02:02:48. **The landing lane (12.6 min of serial patch/verify/apply) becomes the new critical path** — which is why the saving is ~30 min and not "57.6 − max(review)".

- **Per verified WO (D1+D2 combined, 3 WOs, the sprint's metric):** 34.4 → **≈ 23.4-25.3 min**, i.e. ≈ 1.3× faster than the 32.4-min FRD-24 baseline. **Cost per verified WO stays 21.62 $ (2.07× baseline).** Parallel gates do not move cost; the cost lever remains the reviewer's own loop (`gateEvidence: 'digested'`, still uncertified) — memo 37 §A.
- **Where it pays and where it does not.** Benefit ∝ the number of FRDs that become gate-ready together. A `/change` touching one FRD (canaries A, B, C): **zero**. A multi-FRD change (D2): ~−30 %. A full greenfield build (10-25 FRDs released in bursts by the global waves, BL-0021): the saving scales with burst width — plausibly hours on an overnight build, **not measured**.
- **The next serial wall.** After this, D2's tail (visual-qa 12.0 + notify-end 5.1 = 17.4 min) would be ~30 % of the run. That is the next lever, out of scope here.

## 1.5 Red-team (the six questions, plus what the brief did not ask)

**R1 · Artifact conflicts between patches of different FRDs.** Build WOs are disjoint by DR-060 (`artifactsOverlap`, fail-safe on undeclared). **Patches are not** — a patch may touch any file its finding names. Mitigation: patches never run concurrently (single lane), each patch starts from the current `HEAD` (which already contains the earlier landings) and re-gates whole-project (`attemptPatch` mandates `knip`+`biome`+`tsc` whole-project, `:2011`); `verifyPatched` re-runs at `HEAD`. A later **PASS** landing whose pin predates that patch is caught by the stale-pin guard (point 4). Residual: a patch that silently breaks a **third** FRD's behavior not covered by that FRD's tests → only the close-out full suite catches it. Same residual as today's DR-118 "honest limit", just a wider window.

**R2 · The whole-FRD oracle reads shared docs another gate is writing.** It cannot happen: gates are review-only and read their **frozen pin**; every doc write (decision-log, decisions.md, rollups via `sync-rollups`, work-order frontmatter, status.yaml) happens on main, one landing at a time. The real risk is the opposite — a **stale** read: a change drained at a safe point edits this FRD's `frd.md` while its gate reviews the old one. Today's C2 already has this window (safe points run during idle-waits, `:3038-3040`); the spec-drift check in point 4 closes it for both modes. **Not verified:** whether `sync-rollups`'s blocks in `frd.md` carry markers that let a diff separate "rollup-only" from "normative" edits; if not, the rule degrades to "any `frd.md` diff since pin → re-gate", which is safe but may re-gate more than needed.

**R3 · `maxAgents` and cost.** `maxAgents` is a **total cost-weighted budget**, not a concurrency cap (D1's finding, BL-0173). Parallel gates spend the same units, earlier: 3 opus gates launched together commit 9 units in one iteration, so a tight budget overshoots by up to one gate-wave (same class as today's documented ~11-unit overshoot). Tokens: identical total. **Burn rate** roughly doubles during the gate segment (≈ 1.1 M cache-read tokens/min per opus reviewer, from frd-02's 19.6 M over 17.6 min × 3-4 reviewers) → an account-level rate limit or a subscription usage window could throttle reviewers, which shows up as a larger `c`. **Not verified:** the account's Opus rate limits. Machine: 3-4 concurrent Playwright/Chromium + Next dev servers; per-slot footprint ≈ 0.9 GB apparent (560 MB `node_modules`, hardlinked from the pnpm store) — **RAM contention not measured.** Hence `maxParallelGates: 3`, not unbounded.

**R4 · `verify.sh` full at close-out is still one.** Yes, and it must stay the final backstop: it is the only check that runs **every** FRD's tests against the final tree. Parallel gates neither add nor remove it. Note BL-0179: its reuse fast-path has never fired live, so today it always runs in full — correct, just not free.

**R5 · Verdict reproducibility when main advances between gate and landing.** Today's DR-118 already trusts the pin at `applyGate` ("applyGate trusts the worktree gate's green without a main-side re-run", `build-orchestration.md` §5a). With N gates the `[pin, landing]` window can now contain **unplanned code** (patches, reverts), not just disjoint build WOs. The stale-pin guard re-runs `verify.sh --since <pin>` **only** when non-docs paths changed since the pin — a light, objective, MECH-run re-gate (not a second opus review), so `last_green_sha` is never advanced on an unverified combination. Cost: ≈ 2 min haiku per affected PASS landing (full `verify.sh` averaged 133.6 s on the Stop hook, memo 37 §0.2; `--since` is at most that). In the D2 ordering it would not have fired at all.

**R6 · `needs-owner` in one while others pass.** Independent per FRD, with two traps:
- **Dependency trap.** `doneIds` counts `IN_REVIEW` as satisfying `dependsOn` (`:2850`). If FRD-B built on FRD-A's unverified WO and both gate in parallel, B can PASS on its pin while A's ladder **reverts** A's WO (`revertAndReopen`) → B lands VERIFIED on a broken tree. Point 2 (dependency-aware eligibility) forbids that pairing; the stale-pin guard catches undeclared import dependencies (A's revert is a non-docs change since B's pin → `verify.sh --since` → `tsc` red → B converges).
- **Breaker.** `MAX_CONSECUTIVE_BLOCKS` (3, `:199`) now counts blocks in **landing** order. Three FRDs blocking on one shared root cause still trips it (desired); the run-end invariant (point 7) guarantees the already-settled PASS verdicts land before stopping.

**R7 · (not asked) the BL-0178 interaction.** Today the drift outcome depends on which ladder rung a gate takes. Under parallel landings that rung also depends on **landing order** (a PASS that becomes a REJECT at the stale-pin guard enters the patch path, where drift is silently lost). Implementing Decision 2 first removes the path-dependence entirely. This is why §4 puts it first.

**R8 · (not asked) the fallback matrix grows.** Flag off / on × slot healthy / failed × explore / digested. The flag-off path must stay byte-identical: the existing 177 engine scenarios plus a spawn-label snapshot are the guard.

## 1.6 Recommendation and cost

**Do it, with conditions**: points 1-7 of §1.3, flag default **off**, Decision 2 merged first, and flip the default only after canary E shows (i) the post-wave gate segment ≥ 30 % shorter than D2's 57.6 min, (ii) **zero** VERIFIED FRD red on the close-out full `verify.sh`, and (iii) no false needs-owner from the repair brake. If the owner's priority this month is **cost**, not wall-clock, this is the wrong next item — the reviewer's own loop is.

| Item | Estimate |
|---|---|
| Engine change | ≈ 250-400 lines in `pandacorp-build.js` (pool, eligibility, landing lane, guard, accounting); standard §5a + DR-118 amendment; `SKILL.md` args |
| Test scenarios (`test-pandacorp-build.mjs`) | **≈ 14**: flag-off byte-identity (spawn-label snapshot); 3 gates overlap (promise ordering); per-slot failure shrinks the pool; all slots fail → legacy; landing lane is single-writer; PASS with docs-only drift lands directly; PASS with code drift runs `--since` then stamps; that re-gate red → converge; spec drift since pin → re-gate once; downstream FRD waits for upstream landing; needs-owner in one while two land; brake stop still lands settled verdicts; repair-token delta marked unreliable with gates in flight; apply reads the slot's gate report |
| Effort / risk | 2-3 days of agent work; **medium-high** risk (concurrency at the trust boundary, git worktree lifecycle ×N) |
| Measurement | **Canary E** ≈ 60 $ metered (D2 was 58.58 $) + ≈ 20 $ unmetered cache-write estimate — replaying the `canary-d-parallelism` change on a fresh branch, flag on, same `maxAgents: 40`, compared against §1.2 |

---

# DECISION 2 · BL-0178 — pre-existing drift found by the gate

## 2.1 The facts

- The oracle (`WHOLE_FRD_ORACLE`, `:262`, mirrored in `plugin/agents/reviewer.md:19-21`) was hardened by **BL-0078** (2026-07-13) after a reviewer **dismissed** a contradiction in the code it was reviewing (R10-I: `Number.isInteger` accepting unsafe integers). Its text: "any contradiction is RED … there are no reviewer waivers for approved spec text".
- **FRD-02 (direct path):** the reviewer declared WO-02-014 **correct** ("must NOT be reverted", D2 log) but found AC-02-010.4/.8 contradicted by code the cycle never touched → it had no reopen target, so it took the "broken, can't pinpoint WOs" exit with `needs-owner` (`frdGateSerial`, `:1584`) → `persistGateBlock` → FRD BLOCKED. **Cost of that gate: 11.67 $**, plus D1's build of WO-02-014; the correct WO never reached VERIFIED.
- **FRD-03 (patch path):** the same class of drift (REQ-03-001 vs `ACTIVE_PHASES`, confirmed live in §0-f) was a `fail` entry, but the gate **also** had a patchable cycle fault → `reopen` → `attemptPatch` → `verifyPatched`, which re-runs vitest/tsc/biome **only** (`:2059`) and never looks at the first gate's traceability → **VERIFIED, drift lost** (0 mentions in inbox/comms/decision-log per BL-0178).
- `enforceWholeFrdTraceability` (`:795`) only turns a `fail` into red when the **same** verdict is green (`waivedFailure`); a reject that later gets patched green carries nothing forward.

The outcome is a function of **which rung** the gate lands on, not of the defect. BL-0178's own analysis (F3, i-iii) is sound; what it lacks is the policy.

## 2.2 The options, red-teamed

| | (a) never blocks the cycle; always recorded as a queue card | (b) always blocks `needs-owner` | (c) blocks only code drift; doc drift → sync card |
|---|---|---|---|
| **DR-015 (judge ≠ builder)** | Holds **if** "pre-existing" is proven by the engine, not asserted by the reviewer (see 2.3-1). Without that proof it reopens exactly the BL-0078 hole: a reviewer relabels a cycle fault as legacy. | Holds trivially. | Holds, but the gate's **judge now also decides direction** (is the code wrong or the spec stale?) — a judgment that needs intent the reviewer does not have. REQ-03-001 is the example: was `architecture` added on purpose later (stale spec) or by mistake (bug)? Unknowable from the tree. |
| **DR-115 (SSOT)** | Safe **if** the drift has one home: the card. MC derives "VERIFIED · N drift" from open cards; **no new frontmatter field** (a `drift:` flag on the FRD would be a replica nothing keeps in sync). FRD rollups stay derived from WO frontmatter, unchanged. Honest at the WO level (the WO is the certified unit, DR-050). The FRD's "VERIFIED" means "every WO certified", with the known gap visible next to it. | Safe (no new fact). But it stamps a **correct** WO `BLOCKED`, a false fact about that WO. | Same as (a) for doc drift; same as (b) for code drift. |
| **BL-0078 intent** | Preserved: a contradiction in the reviewed code is still RED (it fails the mechanical pre-existence test). | Preserved. | Preserved for code; doc drift waved to a card. |
| **Speed** | Best. The gate certifies what the cycle built; legacy debt stops taxing unrelated work. | **Worst, and compounding.** BL-0178 notes most MC FRDs never passed a gate after the oracle existed (forensics H2, not re-verified by me). Every future change touching an old FRD would surface its legacy drift and stop for the owner — the fast `/change` path dies on MC. Under (b) D2 ends 2 verified / 2 blocked. | Middle, but **unpredictable**: the block depends on a classification the reviewer cannot make reliably, so it re-creates BL-0178's arbitrariness one level up. |
| **Right actor** | The owner triages direction on the card (the `/pandacorp:sync` rule: "the direction decides the action … never degrade the spec"). | Sends a *known bug* to the owner as a *decision*, the wrong channel. | Splits direction in the gate, the wrong place. |
| **Failure mode** | False "pre-existing" → a cycle fault ships. Closed by the proof. Card fatigue → cards are deduped and `draft`. | Owner fatigue; correct work stranded; wasted gates. | Mis-classification either way. |

## 2.3 Recommendation: (a), with these rules

1. **Pre-existence is proven by the engine, fail-closed.** A traceability `fail` is `preexisting` only if **both**: (i) its contract is **not owned by any reviewed WO** (the planner already extracts each WO's owned ACs verbatim as `acText`, `reviewedAcText` at `:1474`); (ii) every evidence path the reviewer cites (`path:line`, now required on a drift claim) is **untouched by this cycle's diff** (`git diff --name-only <last_green_sha>..<pin>`, captured once at pin time by the existing MECH pin step). Fails either test, or carries no evidence → it is a **cycle fault** → normal reopen → patch-first. This keeps R10-I (the contradiction was in the reviewed diff) RED, and blocks the sneaky case of a WO that should have built the AC but did not (owned by a reviewed WO → never pre-existing).
2. **One output, every path.** The gate schema gains `preexistingDrift: [{ contract, evidence: ["path:line"], direction: "code" | "spec" | "unknown", note }]`; each item must also appear as a `status: fail` traceability entry. A single engine function `recordPreexistingDrift(frd, items)` runs at the **landing** of every gate outcome — `applyGate`, `verifyPatched`, `persistGateBlock`, the B2 re-ask and the in-run retry — so direct/patch/retry produce the **identical** result. That is BL-0178's "done when".
3. **`verifyPatched` inherits the open `fail` entries.** It receives the first gate's `fail` list minus the proven-pre-existing ones and must show, for each, a passing test path; otherwise it returns red. The FRD-03 hole closes for real cycle faults, not only for drift.
4. **`enforceWholeFrdTraceability` changes one line of meaning:** `waivedFailure` is computed over `fail` entries **not** in the engine-verified pre-existing set. An unverified pre-existing claim still makes a green verdict red, exactly as today.
5. **The card.** Written on main by the landing step into `.pandacorp/inbox/changes/`, `type: bug` (code) or `type: change` (spec/unknown), **`status: draft`** (the build drains only `ready`, per the change template, so it can never loop into the same run), with an idempotency key (`frd` + contract id) so a re-gate never files twice. Body in Spanish: the contradiction, the evidence, and the direction question for the owner. An event line goes to the committed `build-journal.jsonl` (history, not a second truth). **Not verified:** whether MC's queue reader tolerates two new frontmatter keys (`origin: gate-drift`, `drift_key`); check before shipping.
6. **Route quarantine question (BL-0178's open item) disappears:** no synthetic BLOCKED WO is created, so no route enters `PANDACORP_GATE_SKIP_ROUTES`.
7. **Oracle text amendment** (engine const + `reviewer.md` markers + Codex mirrors): add that a contradiction whose evidence lies wholly outside this cycle's diff and whose contract no reviewed WO owns is **reported as `preexistingDrift`, never dropped and never waived**; the "no reviewer waivers" sentence stays verbatim.

Under this policy D2 would have ended **4 FRDs VERIFIED + 3 draft drift cards** (AC-02-010.4, AC-02-010.8, REQ-03-001), instead of 3 VERIFIED + 1 BLOCKED + 1 drift silently lost.

**Cost:** ≈ 9 test scenarios (FRD-02 shape direct → VERIFIED + card; FRD-03 shape patched → **identical** card; drift whose evidence is in the cycle diff → demoted to reopen (R10-I shape); drift on a contract a reviewed WO owns → demoted; drift claim without evidence → demoted; `verifyPatched` refuses green with an unresolved inherited `fail`; re-gate dedupes the card; B2 re-ask and in-run retry produce the same card; an unrelated needs-owner block still files its drift cards) + prompt-content tests for the oracle amendment. ≈ 1 day; **low-medium** risk (it touches the trust boundary, so it deserves one independent red-team review before merge). Needs a new DR (next free id after DR-121) and the factory decision-log entry BL-0178 asks for.

---

## §4 · What I would do tomorrow

| Order | What | Cost | Gate to move on |
|---|---|---|---|
| **1** | **BL-0178 policy (a)** as in §2.3, one PATCH/MINOR release | ≈ 1 day, ≈ 9 scenarios, no canary of its own | engine suite green; the FRD-02 and FRD-03 scenarios produce byte-identical cards |
| **2** | **Parallel gates** as in §1.3, behind `parallelGates` (default off) | 2-3 days, ≈ 14 scenarios | engine suite green **with the flag off byte-identical**; one independent red-team review of the landing lane |
| **3** | **Canary E** — replay the `canary-d-parallelism` change on a fresh branch, flag on, `maxAgents: 40`; measures both items at once (FRD-02 = direct-path drift, FRD-03 = patched-path drift, 3 FRDs gate-ready together) | ≈ 60 $ metered + ≈ 20 $ unmetered cache-write est. | flip the default only if: gate segment ≥ 30 % shorter than 57.6 min, zero VERIFIED FRD red at the close-out full suite, no false needs-owner, D2's FRD-02 ends VERIFIED + 2 cards and FRD-03 VERIFIED + 1 card |

Pre-condition for canary E, independent of both items: clean the dirty gate worktrees BL-0175 left behind (§0-g, and MC's real one per BL-0175) — otherwise the run starts on the legacy path again and measures nothing.

---

## §5 · Latent defects found in passing (code reading, NOT exercised live)

- **L1 — the WP-08 cage in `applyGate` reads the wrong report on the concurrent path.** The apply prompt (`:1784`) says "read `.pandacorp/run/gate-report.json` — the report the gate you are applying left behind", but it runs on the main tree, while a concurrent gate wrote its report inside the worktree. Seen in the canary tree: main's report is `scope: full` (close-out, 21:51) and the worktree's is `scope: since` (the gate's, 20:43). Effect: on the C2 path the "partial" cage checks an unrelated file. Fold the fix into §1.3-5, or file it as its own BL.
- **L2 — stale description.** The module header (`:3`) and `build-orchestration.md:95-98` still say gates run "SERIALIZED at wave boundaries (quiet tree)"; §5a (DR-118) supersedes it. A DR-116 "supersedes" sweep candidate.

## §6 · What I could NOT verify

- The two scratchpad reports (`canary-d-report.md`, `canary-d-frd02-forensics.md`): **gone** (the scratchpad is empty). Their conclusions are used only where BL-0178 or memo 37 quote them; forensics H2 ("most MC FRDs never passed a gate after 2026-07-13") is unverified.
- Contention factor `c`, fresh slot bootstrap time `b`, the account's Opus rate limits, and the Mac's RAM headroom: **assumed**, bracketed in §1.4.
- The healthy-C2 counterfactual in §1.2: **simulated by reading the loop**, not run.
- Whether `sync-rollups` marks its blocks inside `frd.md` (affects how precise the spec-drift check can be) and whether MC's queue reader tolerates new card frontmatter keys.
- The drift **verdicts** on AC-02-010.4/.8 (I confirmed the ACs exist, not that the code contradicts them); REQ-03-001's contradiction I did confirm live.

---

## Red-team addendum (2026-09-25)

**Reviewer:** independent red-team (not the author). **Repo state:** `main` at `083894de` (3 memory-chore commits on top of `48f07b09`; `git diff --stat 48f07b09 HEAD -- plugin/` is empty), plugin **9.110.0**, clean tree; the MC engine copy is byte-identical to the template (`cmp`). Everything below is code reading plus re-analysis of primary artifacts; nothing was run live. Line numbers are 9.110.0 (≈ +5 vs the memo's 9.109.0 citations).

### Verdicts

| Decision | Verdict | One-line reason |
|---|---|---|
| **D1 · parallel FRD gates** | **GO-with-changes, but NOT next** (position 5 of 7 below) | It is a pure time lever on multi-FRD runs (0 on single-FRD changes, 0 on cost), and as designed it inherits **three live C2 defects** (X1-X3) that make the pool decay to legacy after the first verdict and break DR-080 on the reject path. Fix those first (they are bugs today, flag off), then ship D1 behind the flag with the changes in §A3. |
| **D2 · BL-0178 policy** | **GO-with-changes: option (a) with a *differential* pre-existence proof (a\*)** | The memo's static predicate (not owned + cited evidence untouched) is defeated by two realistic cases (§A4, T1/T2). Replace it with "the reviewer's probe fails at `last_green_sha` too" — a mechanical, engine-run proof. |
| **Measurement baseline** | **Must be corrected before any criterion is set** | `usage-rollup.mjs` overcounts every run's cost by **1.60-1.72×** (§A1). All $ figures in memos 37/38 are inflated; ratios roughly survive. |

### A0 · Own evidence (CONV-13)

| # | Claim | How verified |
|---|---|---|
| e1 | First gates in `powerful` are **serial opus/xhigh**; the split (4 sonnet finders + sonnet verifiers + opus closer @high) only runs on re-gates (C1a) | `frdGate` `:1394` `useSplit = P.reviewSplit && (priorAttempts >= 1 \|\| anyReopened)`; `frdGateSerial` `:1585`; `frdGateSplit` `:1627,1662,1704` |
| e2 | The D2 dirty probe was the **chained** `ensureGateWorktree` for frd-03, fired the instant frd-02's review returned — *before* `persist-block` could salvage | wf json: second `gate-worktree` spawn (13.5 s) at 01:46:19 = frd-02 gate start 01:28:43 + 1055.9 s; `persist-block:frd-02` starts 01:46:32. Code: `launchGate` chains on `gateWorktreeChain` (`:2938`); salvage lives only in `persistGateBlock` (`:1821`), reached after `settleGates(true)` (`:3030`) |
| e3 | A **PASS** leaves the gate worktree dirty too | `applyGate` *copies* `${sourceDir}/<path>` → `<path>` (`:1776`); no clean step anywhere (`grep 'clean -f'` → only `persistGateBlock`) |
| e4 | A **REJECT** on the C2 path strands the reviewer's RED-proven tests in the worktree | reject schema carries `findings[].failingTest` (text), no `testFiles` (`:744` is PASS-only); `attemptPatch` runs on main (`:2022`); `verifyPatched` runs "the FULL FRD test files" on main (`:2064`) |
| e5 | `vitest --changed <sha>` runs **untracked** files | installed vitest **4.1.9**, `dist/chunks/cli-api.*.js:12768`: `getUnstagedFiles()` = `git ls-files --other --modified --exclude-standard`; `verify.sh:549` passes `--changed "$SINCE"` |
| e6 | Machine: **16 GB RAM, Apple M5, 10 cores (4P+6E)**; per-slot footprint 700 MB on disk | `sysctl hw.memsize hw.ncpu …`; `du -sh …/gate-worktree` |
| e7 | Each gate's browser layer starts its own `next dev` (180 s webServer timeout) | `mission-control/playwright.config.ts:63-68` |
| e8 | Derived e2e ports for MC's slot paths: slot0 3957, slot1 3988, slot2 3902, **slot3 3900 (= main's reserved port)**; the free-port probe only sees servers already listening at bootstrap time | `worktree-bootstrap.sh:88-113` recomputed with `shasum -a 256` |
| e9 | The owner's account has a **session usage limit** that already killed a canary mid-run and left the lease `running:true` | `BL-0135` progress note 2026-09-22 (Canary C `wf_71f78bae-dbd`) |
| e10 | The canary-D worktree/branch is gone; `canary-d-parallelism` was fast-forwarded into `main` (`9b7bde44`), and **AC-02-010.4 was already reconciled** (`c34ba57c`); AC-02-010.8 and REQ-03-001 became queue cards | `git reflog`, `git show --stat c34ba57c`, the two cards' bodies |
| e11 | `c575adfc` is a perfect replay base for the gate segment: WO-02-014/03-006/04-008/05-007 all `IN_REVIEW`, `last_green_sha: d9addc89` (the base D2's gates used) | `git show c575adfc:…` on the four WO files and `status.yaml` |
| e12 | MC's real gate worktree is dirty right now (`?? …/decision-id.reviewer.test.ts`) | `git -C mission-control/.pandacorp/run/gate-worktree status --porcelain` |

### A1 · The cost baseline is overstated by ~1.6× (new finding, blocks every $ criterion)

Claude Code subagent transcripts write **one line per content block** of the same API message; every line repeats the message's full `usage` (same `cache_read_input_tokens`, a partial then final `output_tokens`). `usage-rollup.mjs` (`:215-230`, `addUsage` `:195`) sums **per line**. Re-pricing the same transcripts with the rollup's own price table, deduplicated by `message.id` (last line wins):

| Run | Rollup (per line) | Deduplicated (per message) | Ratio |
|---|---:|---:|---:|
| FRD-24 baseline `wf_ddcc95c6-1d7` | 20.86 $ | **13.05 $** | 1.60 |
| Canary A `wf_4cef213a-463` | 13.42 $ | **7.97 $** | 1.68 |
| Canary D1 `wf_6e88dd68-8e4` | 6.28 $ | **3.64 $** | 1.72 |
| Canary D2 `wf_faf48b18-881` | 58.58 $ | **36.24 $** | 1.62 |
| D2 "unmetered cache-write" (1.25× input) | 19.50 $ | **9.14 $** | 2.13 |

My per-line recomputation reproduces the rollup's 58.58 $ to the cent, so the method is the rollup's own. Consequences: (i) D2's true cost is ≈ **36 $ metered + ≈ 9 $ cache-write ≈ 45 $**, not 58.58 + 19.5 ≈ 78 $; (ii) relative comparisons in memo 37 survive within ±7 % (ratios 1.60-1.72), so its *conclusions* stand; (iii) **absolute targets** ("≤ 12 $/WO", "≈ 60 $ canary") must be restated in deduplicated dollars; (iv) memo 38 R3's "≈ 1.1 M cache-read tokens/min per opus reviewer" is really **≈ 0.64 M/min** (11.25 M over 17.6 min for frd-02). Per verified WO, deduplicated: D (D1+D2) **13.29 $** vs baseline **6.53 $** — still **2.04×**, time unchanged (34.4 vs 32.4 min). Fix: dedupe by `message.id` in `usage-rollup.mjs`, with a D2-transcript fixture asserting 36.24 $. File it as its own BL (tooling defect, DR-103), not inside D1/D2.

D2 gate ladder, deduplicated: reviews **24.61 $** + patches 1.65 + verify-patch 1.35 + apply/persist 0.34 = **27.95 $ of 36.24 $ (77 %)**.

### A2 · Q1 — Does D1 attack the right bottleneck? Alternatives, compared honestly

Where a gate's money goes (deduplicated turn classification of the four D2 gate transcripts, input-side tokens): **avg context per turn 125-143 k**, 59-80 turns per gate; tree/code exploration via bash (`grep`/`sed`/`cat`) **25-54 %**, `git` archaeology 6-15 %, browser/server 6-17 %, writing adversarial tests 6-17 %, vitest+verify.sh+static 15-25 %. Cache reads are ~80 % of a gate's cost, so **cost ≈ turns × context**. The frd-02 gate also spent turns on the whole-FRD inventory (`for id in AC-02-…` loops, `git log -S` archaeology) and even read the engine source (`plugin/templates/…` — the nested MC topology puts the factory in the worktree).

Base = D2 as measured: 87.5 min, **36.24 $ dedup** (58.58 rollup); post-wave gate segment 57.6 min; the four reviews 52.5 agent-min / 24.61 $.

| Option | Δ time on D2 | Δ cost on D2 (dedup $) | Risk | Effort | DRs touched | Verdict |
|---|---|---|---|---|---|---|
| **(f) Fix the rollup (A1)** | 0 | 0 real; reported −38 % | very low | 0.25 d | none (BL-0096 tool) | **do first** — every criterion depends on it |
| **(P) C2 hygiene X1-X3 (§A3)** | 0 on D2 as run (it went legacy); enables C2 to stay concurrent | ≈ 0; removes false-red/contamination retries | low-medium | 0.5-1 d | DR-118 amendment, DR-080 | **do second** — bugs today, flag off |
| **(b) `gateEvidence:'digested'`, measured clean** | −5 to −13 min (−10..−25 % per gate, serial) | **−4.9 to −8.6** on reviews (−20..−35 %) | medium (oracle input narrowed; B tie + B2 superset, n=2, both contaminated) | ≈ 0 code (flag exists) | none new (WP-06) | **flip after E** |
| **(g) Gate context hygiene** (heavy output to files + tails, forbid reading factory/engine source, cap context) | −1 to −3 min | −1.2 to −3.7 (−5..−15 %) | low | 0.5 d prompt | none | bundle with (b) |
| **(D1) Parallel gates (2 slots, fixed)** | **−24 to −33 min** (c = 1.0-1.6) | **+0.3 to +1.5** (slot bootstraps, stale-pin re-verifies, contention-induced false reds) | medium-high | 2-3 d after P | DR-118 amendment | GO-with-changes, behind flag |
| **(d) Delta-scoped whole-FRD oracle + cached inventory** ("FRD baseline gated at SHA": contract → test paths, written by `applyGate` only, reused when `frd.md` is unchanged and the contract's evidence import-closure ∩ diff = ∅) | 0 on D2 (first gates since the oracle); −20..−30 % per **repeat** gate | 0 on D2; **−1.2 to −2 $ per repeat gate** | medium-high (touches BL-0078's oracle; must be a DR-115 honest cache: single writer, re-derived at each full gate, never read by a display surface) | 1.5-2 d + canary F | new DR; oracle text; DR-115 | later — pays from the 2nd touch of an FRD, which is the owner's daily `/change` pattern |
| **(a) "sonnet reviewer, opus only for the verdict"** | literal form: n/a | literal: ≈ −60 % | **violates DR-015** (the builders are sonnet; `reviewer.md`: "DR-015 is never traded for cost") | — | DR-015 | **NO-GO** |
| **(a′) split-first** (the DR-015-legal form: sonnet finders + opus closer on first gates) | +0 to +3 min (a serial finder stage before the closer) | 0 to −3.7, **unmeasured** — the closer still writes tests, runs verify, inventories the FRD and smokes routes | low-medium | flag flip | reverses C1a | **NO-GO** (no evidence of saving; C1a's reason — first gates mostly pass — still holds) |
| **(c) One gate per wave** (one reviewer, N FRDs) | ≈ −14 min vs serial (worse than D1) | −15..−25 % (one verify/server/prefix instead of N; larger context per turn) | **high**: breaks DR-050's per-FRD verdict isolation, attention dilution (DR-072's research), one crash/needs-owner kills N verdicts, N whole-FRD inventories in one context | 3-4 d | DR-050, DR-072, DR-118 | **NO-GO** |
| **(e) Do nothing** | 0 | 0 | — | 0 | — | rejected: D2 is 2.04× baseline cost per WO |

**Answer to Q1.** D1 attacks the right *time* bottleneck for multi-FRD runs and nothing else: 0 on single-FRD `/change` (canaries A/B/B2/C shape), 0 on cost, and on this owner's account (session usage limit, e9) the binding constraint is **volume per window** — parallelism does not raise how many runs fit in a window, cost levers do. Optimal order by saving/effort: **(f) → (P) → a\* (D2) → (b)+(g) → D1 → (d)**; (a)/(a′)/(c) rejected. **D1 stays in the list at position 5.**

Combined projection on the D2 shape (PROJECTION: P + a\* + (b) + (g) + D1 with 2 slots): **≈ 50-60 min, ≈ 28-33 $ dedup**, and **4 verified WOs instead of 3** (under a\*, WO-02-014 lands VERIFIED + drift cards instead of BLOCKED). Per verified WO including D1's 3.64 $/15.8 min: **≈ 16.5-19 min and ≈ 8.1-9.2 $ dedup** (≈ 13-15 $ rollup-equivalent): time ≈ 0.55× baseline, cost still ≈ 1.3× baseline. Closing the cost gap needs (d) and the serial tail (visual-qa: 12 min / 3.0 $ dedup on D2).

### A3 · Q2 — Red-team of D1 as designed

| # | Failure | Severity | Blocking? | Mitigation (concrete) |
|---|---|---|---|---|
| **X1** | **Every verdict dirties its slot** (PASS: `applyGate` copies without cleaning, e3; REJECT: stranded tests, e4; BLOCK: salvaged only in `persistGateBlock`). The clean-check in `ensureGateWorktree` then refuses reuse. With the memo's "a failed slot shrinks the pool", **N slots decay to legacy after N verdicts**. It is also why D2 went legacy (e2), and why the memo's "healthy C2 on 9.109.0" counterfactual (§1.2) does not happen: BL-0175's salvage runs *after* the chained probe. | critical | **yes** | Slot-release protocol: a verdict's landing ends with salvage-then-clean of **exactly** the slot's `git status --porcelain` paths into `.pandacorp/run/gate-evidence/<frd>/` (the BL-0175 procedure, BL-0067-safe), for PASS, REJECT and BLOCK alike; a slot returns to the pool only after it. Also fix the flag-off C2 path (it has the same bug). |
| **X2** | **Same-pin contamination.** All FRDs gate-ready at one wave barrier share one pin (`capturePin([...frds])`), so a chained gate at the same sha skips the checkout **and the clean-check** (`lastWorktreeSha === sha` → no spawn) and runs in a tree holding the previous reviewer's untracked tests. vitest 4.1.9 `--changed` runs untracked files (e5) and tsc/biome are global → a sibling's RED-proven failing test reds this FRD's gate (a false reject, a paid patch cycle). | high | yes (for C2 flag-off too) | X1 removes it with one-FRD-per-slot; for the single-worktree path, run the clean-check on **every** acquisition, not only on sha change. |
| **X3** | **Reject path breaks DR-080.** The patcher on main never has the reviewer's test file; it is told to "make the RED-proven failing test PASS" from a text description, so it may re-type the test that judges it; `verifyPatched` runs "the FULL FRD test files" on main, which do not include the reviewer's tests. | high | yes | On a REJECT landing, port the reviewer's test files to main **before** `attemptPatch`; `findings[].failingTest` must be a repo path; `verifyPatched` must run exactly those files and fail if any is missing or modified (compare the ported blob hash). |
| X4 | **Stale-pin guard ordering.** If `verify.sh --since <pin>` runs before the PASS's reviewer tests are ported, those adversarial tests never execute against the landing tree. `--since` = vitest `--changed` (import-affected tests), so non-import couplings (fixtures, JSON, CSS, e2e) are missed. | high | no | Port first, then guard, then stamp, in one lane item. Residual covered by the close-out full suite (already DR-118's stated limit). |
| X5 | **`last_green_sha` over an open ladder + head-of-line blocking.** A PASS may never land while another FRD's convergence ladder has an unverified patch/revert commit in `HEAD` (commit A of `LAST_GREEN_ORDERING` would certify it). So the lane must be exclusive for the **whole** ladder, including revert + in-run retry rebuild + re-gate on main (≈ 25-40 min in the worst DR-073/107 case) → every PASS waits behind it. | high | no (design constraint) | Keep the lane exclusive (the memo is right), but make it a **priority queue**: PASS and BLOCK items first, then patch ladders; a ladder that escalates past patch-2 is re-queued behind pending PASSes. Add a post-run audit: every `last_green_sha` publish commit has only verified-FRD commits since the previous one. |
| X6 | **Machine contention** (e6, e7): per gate `next dev` + Chromium + vitest jsdom with default workers + tsc, ×N, on 16 GB, possibly while a build wave runs on main. Swap pushes `c` above 1.4 and risks webServer timeouts (180 s) that a reviewer reads as a finding → spurious reopens that cost money. | medium-high | no | `maxParallelGates` default **derived from `hw.memsize`** (16 GB → **2**, ≥ 32 GB → 3); a machine-wide `flock` around the Playwright sub-gate; cap vitest `--maxWorkers` per slot (e.g. 3); log `vm_stat` pageouts per gate so E measures `c` instead of assuming it. |
| X7 | **Port collisions** (e8): hash-derived ports are probed only against servers already listening; concurrent bootstraps before any server starts cannot see each other (≈ 3 % pairwise for 3 slots), and slot 3 hashes to 3900 on MC. | medium | no | The engine passes `PANDACORP_E2E_PORT=<base + 10·slot>` explicitly to `worktree-bootstrap.sh` (the override already exists). |
| X8 | **Usage-window kill** (e9): same total volume but compressed; a limit hit with N reviewers in flight leaves N dirty slots and a held lease (the Canary C failure mode). | medium | no | Crash path (`ensure-stopped-crash`) must salvage every slot; default 2 slots; document that D1 does not change volume. |
| X9 | **Repair-token brake.** The memo says a polluted `budget.spent()` delta could "trip a false needs-owner". It cannot: the token check in `canAffordRepair` is an OR-**rescue** over the floored agent-weight brake, so an inflated delta only removes rescues and degrades to the pre-BL-0138 agent-weight behaviour. | low | no | Keep §1.3-6 (mark unreliable while gates are in flight): cheap and honest, but the severity is low. |
| X10 | **`maxAgents` accounting race.** N gates charge on spawn; the split-affordability check (`remaining >= splitGateEstimatedCost()`) can pass for two gates at once, overshooting by up to 2 × 15 units. | low | no | Reserve the estimated units at launch and reconcile at settle. |
| X11 | Concurrent appends: the punch-list via `Edit` (read-modify-write) loses lines (the memo already says use `>>`); `track.jsonl`/`build-journal.jsonl` are appended by slot agents to main's absolute path while lane commits stage them, leaving main "dirty" at a crash → next run's baseline escalates to the judge. | low | no | `>>` everywhere; the lane's commit re-stages both files last. |
| X12 | `needs-owner` in one FRD while others land; lease/`stateCli` | low | no | Unchanged: gates are review-only and never call `stateCli`; all state writes stay on `commitChain`. Lease cadence is BL-0153's issue, not made worse. |
| X13 | Digested collectors: `launchEvidence` chains on the single mutex; with slots, N collectors run N `verify.sh` concurrently at wave close → X6 again | medium | no | Per-slot chains, and the collector counts against the same machine semaphore. |

### A4 · Q3 — Red-team of D2 (a) and the final predicate

**How the memo's rule falls.** "Contract owned by no reviewed WO **and** cited evidence files untouched by this cycle's diff" trusts the reviewer's choice of evidence and uses file identity as a proxy for causality. Two realistic shapes break it in opposite directions:
- **T1 · shared-helper regression.** WO-A edits a shared `src/lib/date.ts` (its own artifact); an old AC owned by a VERIFIED WO, implemented in untouched `Card.tsx`, now fails. The cited evidence is `Card.tsx` (untouched) → memo rule: *pre-existing* → **a cycle fault ships as a draft card.** (d) has the same hole: no intersection → VERIFIED.
- **T2 · genuine legacy drift inside a touched file.** WO-A edits `portfolio.ts` for its own feature; `ACTIVE_PHASES` has contradicted REQ-03-001 since June. Memo rule: evidence touched → cycle fault → the patcher is asked to fix a direction question it cannot own → give-up → revert of a **correct** WO → needs-owner. (d) blocks WO-A; (c) blocks. (In D2 itself WO-03-006 did not touch `portfolio.ts`, verified by `git show --stat 6086d0b8`, so the memo's rule would have got D2 right; the next card will not be so lucky.)

**Final predicate (a\*) — a differential proof, computed by the engine, never asserted by the reviewer.** For each traceability entry `C` with `status:"fail"`, let `base = last_green_sha` (captured at pin time), `Owned` = the `REQ-/AC-` ids **grepped deterministically from the reviewed WO files at the pin** (not the planner's LLM-extracted `acText`), and `probe(C)` = a reviewer-authored test file, named after `C`'s id, returned in the verdict's `preexistingDrift[].probe`:

```
run(p, sha)  := MECH, in the slot: checkout --detach sha; `vitest run p --reporter=json`;
                returns the raw JSON VERBATIM; the ENGINE parses it (fail-closed, like validateEvidence)
state(p,sha) ∈ { passed, assertion-failed, load-error, flaky }   // flaky = two runs disagree

cycleFault(C)  := C.id ∈ Owned
preexisting(C) := C.id ∉ Owned ∧ state(probe,pin) = assertion-failed
                  ∧ state(probe,base) = assertion-failed          // it was already broken before this cycle
regression(C)  := C.id ∉ Owned ∧ state(probe,base) = passed ∧ state(probe,pin) = assertion-failed
unproven(C)    := C.id ∉ Owned ∧ ¬preexisting ∧ ¬regression      // no probe, load-error at base, or flaky
```

Routing: `cycleFault` → today's reopen/patch-first. `regression` → cycle fault, reopening the unverified WOs (of **any** FRD in `base..pin`) whose diff intersects the probe's import closure (madge); if none intersects, all reviewed WOs (fail-closed); if the culprit belongs to another FRD, this FRD cannot pass until that one is patched. `preexisting` → a `draft` drift card with the probe embedded (it becomes the card's ready-made RED test); it never blocks and is excluded from `waivedFailure`. `unproven` → static fallback: a card with `proof: static` only if the cited paths **and their import closure** ∩ `git diff --name-only base..pin` = ∅; otherwise a cycle fault. The probe is **never committed as a failing test** (it would red `verify.sh`); it lives in the card and in `gate-evidence/<frd>/drift/`.

Why the implementer cannot hide its own fault here (DR-015/DR-080): it never touches the probe (reviewer-owned, DR-080), never runs the classification (MECH + engine parse), and a probe only fails at `base` if the contract was really broken before the cycle. The residual is the judge's own honesty (a probe that tests something else), which is the trust already placed in the judge for every other verdict.

**Tests that would topple a wrong rule** (engine harness, mocked MECH JSON):
1. **T1 shared-helper regression** → must reopen WO-A, **no card** (memo rule and (d) fail this).
2. **T2 touched-file legacy drift** → WO-A VERIFIED + 1 card, **no reopen** (memo rule, (c) and (d) fail this).
3. **T3 probe not loadable at base** (it imports a symbol the cycle introduced) → `unproven` → static fallback; a naive "red at base ⇒ pre-existing" check fails this.
Plus: T4 owned contract labelled drift → cycle fault; T5 cross-FRD regression (the culprit WO is in a sibling FRD of the same pin) → neither FRD lands VERIFIED over it; T6 the FRD-02 shape (direct path) and the FRD-03 shape (patch path) produce **byte-identical** cards; T7 a flaky probe → `unproven`; T8 re-gate dedupes the card (idempotency key `frd` + contract id).

| Case | memo (a) static | (c) code-blocks / doc-cards | (d) block intersecting WOs | **(a\*) differential** |
|---|---|---|---|---|
| D2 FRD-02 (direct, untouched legacy) | ✔ | ✘ blocks (code drift) | ✔ | ✔ |
| D2 FRD-03 (patch path) | ✔ | ✘ | ✔ | ✔ |
| T1 shared-helper regression | ✘ ships | ~ blocks, wrong reason | ✘ ships | ✔ |
| T2 legacy inside a touched file | ✘ reverts a correct WO | ✘ | ✘ blocks WO-A | ✔ |
| T3 probe unloadable at base | n/a | n/a | n/a | ✔ (static fallback) |
| Needs direction judgment in the gate | no | **yes** (unknowable) | no | no |

**Best on the evidence: a\*.** It keeps the memo's §2.3 items 2-7 (one `recordPreexistingDrift` at the landing of every path, `verifyPatched` inheriting unresolved non-pre-existing `fail`s, the `waivedFailure` change, `draft` cards, the oracle-text amendment) and replaces only item 1's predicate. Cost: one MECH probe run at pin and at base per drift claim (≈ 1-2 min haiku, ≈ 0.1 $), rare. Add a rollback switch `args.driftPolicy: 'record' | 'block'` (sprint rule: everything behind an `args.*`). Residual (low): drift cards live in the gitignored inbox, so a clone sees "VERIFIED" without them; the committed `build-journal.jsonl` line is the only portable trace.

### A5 · Q4 — Canary E

**The real queue as workload.** Of the six cards: `campaign-pipeline-ac02-010-8-rebuild` (FRD-02), `portfolio-rail-architecture-phase-leak` (FRD-03), `fragua-snapshot-multi-frd-ambiguity` (FRD-06) and `informe-phase-transitions-duplicate-key` (FRD-10) are usable: 4 FRDs, disjoint single-file artifacts, rigor normal. Not usable: `decision-id-shared-emitter` (FRD-24 is fully VERIFIED, since it was the baseline build itself; the card is stale and its remaining item is a factory edit) and `portada-seal-coverage-commits-funnel-ideas` (FRD-23; it asks the PM to choose between options a/b/c, a likely needs-owner, and its WO-23-007 lives on the unmerged `canary-c-portada-seal` branch). Caveats: the informe card says `frd: frd-10-achievements` but the folder is `frd-10-achievements-hall` (fix before draining), and two cards *fix* the known drift (they own AC-02-010.8 and REQ-03-001; AC-02-010.4 was reconciled in `c34ba57c`), so **a real-card run cannot exercise D2 deterministically**, and it reviews different FRDs than D2, so it cannot isolate (b).

**E = a replay of D2's gate segment** (measurement run), then **E2 = the four real cards** (validation run that also delivers product work).

- **Setup.** A throwaway worktree at **`c575adfc`** (e11: the exact code D2's gates reviewed, all 4 WOs `IN_REVIEW`, `last_green_sha d9addc89`, AC-02-010.4/.8 and REQ-03-001 drift intact). Install the candidate engine (f + P + a\* + D1 flag + (g)), quiesce the D2 lease left in that tree's `status.yaml`. Pre-flight: MC's real gate worktree is dirty today (e12), so salvage it; `run-engine-tests.sh` green.
- **Args.** `mode: powerful`, `maxAgents: 40`, `frds: [02,03,04,05]`, `parallelGates: true`, `maxParallelGates: 2` (16 GB, X6), `gateEvidence: 'digested'`, a `maxSpend` cap. No build or plan phase happens: all four FRDs are resume gates.
- **What E isolates in one run.** **D1** through the overlap ratio (Σ of E's own ladder spans ÷ E's gate-segment wall-clock) and against D2's serial-equivalent gate work (frd-02 17.6 + 1.4, frd-03 17.3, frd-04 18.6, frd-05 12.0 = **66.9 min**); this cancels digested out of the D1 measure. **(b)** through per-FRD deduplicated review cost against D2's gates **on byte-identical code** (24.61 $ total; cost is contention-insensitive), plus findings parity. **D2 (a\*)** deterministically on FRD-02 (direct path) and FRD-03 (whichever path the gate takes). **`c`** through per-gate `vm_stat` pageouts and span inflation.
- **Pass criteria.** D1: gate segment **≤ 40 min** (≤ 60 % of 66.9) with 2 slots, **0** legacy fallbacks, all slots clean at the end, 0 `last_green_sha` audit violations, 0 environment-noise reds (webServer timeout, `Cannot find module`). (b): Σ review cost **≤ 18.5 $ dedup** (−25 %) **and** re-finding both date-validation CORRECTIONs (frd-03, frd-04) and frd-05's pass, 0 lost findings (else roll back to explore). D2: FRD-02 **VERIFIED + draft cards for AC-02-010.4/.8** with base-red probes; FRD-03 **VERIFIED + 1 card** for REQ-03-001; 0 cards on owned contracts. Safety: close-out full `verify.sh` green.
- **Budget.** ≈ **22-30 $ dedup** (≈ 36-48 $ in rollup units): the gate ladder (27.95 $ dedup in D2) minus (b) plus close-out, with no build or plan.
- **Known noise.** n = 1 per FRD, and reviewers are stochastic; the replay removes builder noise, not judge noise. Say so in the report.
- **E2** (after the flips): the 4 real cards from MC `main`, defaults flipped. Pass: per verified WO **≤ 20 min and ≤ 7.5 $ dedup (≈ 12 $ rollup-equivalent)**, 0 VERIFIED red at close-out, and any drift in FRD-06/FRD-10 (first gates since the oracle there) filed as cards rather than blocks.

### A6 · Q5 — Implementation order, flags and success criteria

| # | Item | Ships as | Measured before flip | Success criterion |
|---|---|---|---|---|
| 1 | **Rollup dedupe** (A1) | fix, default | fixture | D2 transcripts → 36.24 $ ± 0.01; all later criteria in dedup $ |
| 2 | **C2 hygiene X1-X3** (+ X2 flag-off) | fix, default (bug) | harness + E | scenarios: PASS/REJECT/BLOCK each leave the slot clean with evidence salvaged; same-pin chained gate never sees a sibling's file; reject tests ported and run by `verifyPatched`. E: 0 legacy fallbacks |
| 3 | **BL-0178 a\*** | default on, `args.driftPolicy` rollback | harness T1-T8 | T1-T8 green; E: the FRD-02/FRD-03 outcomes in A5 |
| 4 | **(b) digested + (g) context hygiene** | flag → default after E | E | ≥ 25 % review cost reduction (dedup) on identical code, 0 lost CORRECTION findings (n = 3 with B/B2); avg context per gate turn ≤ 100 k (from 125-143 k) |
| 5 | **D1 parallel gates** with the §A3 changes (priority lane, port-first guard, explicit ports, RAM-derived default, browser `flock`, vitest worker cap, unit reservation) | `parallelGates` flag, default off | E | gate segment ≤ 60 % of serial-equivalent; 0 invariant violations; 0 environment-noise reds; then default on with `maxParallelGates` from RAM |
| 6 | **(d) cached inventory** | new DR, flag | canary F (second touch of one FRD) | repeat-gate cost ≤ 70 % of that FRD's first gate, with an identical pass/fail traceability set |
| — | (a), (a′), (c) | rejected | — | — |

**Sprint-level success bar (E2, real work):** per verified WO **≤ 20 min and ≤ 7.5 $ dedup** (≈ 12 $ in the old rollup units), against today's 34.4 min / 13.29 $ dedup (21.62 $ rollup) and the baseline 32.4 min / 6.53 $ dedup. Honest expectation: the time bar is reachable with items 1-5; the cost bar probably needs item 6 and a cheaper serial tail (visual-qa).

### A7 · Could not verify

- The **opus-5-5 price** in `usage-rollup.mjs` is an assumption (its own comment says so); every dedup $ figure inherits it. The per-line duplication was checked on 4 runs only (ratios 1.60-1.72).
- `vitest --changed` "affected-by-import" expansion in 4.1.9: I verified that untracked files are included, not the related-graph semantics.
- `c` (contention), per-gate RAM, the account's opus concurrency/rate limits, and whether 2 slots fit comfortably in 16 GB: **not measured**.
- X3 (stranded reject tests) was **never exercised live**: every D2 reject ran on the legacy path. It follows from the code, not from a run.
- All (b), (d), (g) and (a′) savings are **estimates** (digested has no clean run; the inventory's share of gate turns comes from reading two transcripts' command lists, not a systematic classification; the split closer's cost was never measured).
- Whether a replay from `c575adfc` reproduces D2's reviewer findings (judge stochasticity); whether `git checkout --detach` in a slot stays safe across shas given the `skip-worktree` `server-env.json`.
- The memo's own unverifieds stand (forensics H2; MC's queue reader tolerating new card keys; `sync-rollups` markers in `frd.md`).

## Canary E2 result and adopted defaults (2026-09-26)

The E2 run: workflow `wf_405eeb21-f9e`, engine 9.113.0, a replay of D2's four gates from `c575adfc`,
`parallelGates:true, gateSlots:2, gateEvidence:'digested'`, `maxAgents:60`. Evidence:
`docs/reviews/canary-e2-report.md`. All $ are BL-0181-deduped.

**Criteria from §A5/§A6, scored:**

| Item | Pre-registered criterion | E2 measured | Verdict |
|---|---|---|---|
| D1 `parallelGates` | gate segment ≤ 60 % of D2's 66.9-min serial equivalent | 55.0 min = **82 %** (D2's segment was 67.1 min, so −18 %) | **not met** |
| D1 | 0 legacy fallbacks · slots clean · 0 env-noise reds · 0 `last_green_sha` violations | 0 · both clean · 0 · 0 (manual audit; BL-0190 still open) | met |
| (b) `digested` | ≥ 25 % review-cost cut on identical code | Σ evidence + gate 9.26 $ vs 24.61 $ = **−62 %** | met |
| (b) | re-find both date CORRECTIONs (frd-03, frd-04) and frd-05's pass, 0 lost findings | frd-04 ✓, frd-05 ✓, **frd-03 date CORRECTION lost**. Also lost: AC-02-010.8 drift and REQ-03-001 drift | **failed → roll back to explore** |
| (g) context | ≤ 100 k average context per gate turn | 96 k (92-105 k) vs D2 125-143 k | met (digested only; `gateContextScope` itself not run) |
| D2 (a\*) | FRD-02 VERIFIED + draft cards for the drift; FRD-03 VERIFIED + REQ-03-001 card | both VERIFIED, **0 cards**: no drift was claimed, because the digested gates never looked (0 touches of `phases.ts` / `ACTIVE_PHASES`) | not exercised (E1 exercised it: 0.02 $) |
| Safety | close-out full `verify.sh` green | green | met |
| Sprint bar | ≤ 20 min and ≤ 7.5 $ per verified WO | raw 16.3 min / 3.80 $ (no build, visual-qa no-op); composite ≈ 21.5 min / ≈ 5.77 $ (PROJECTION); ≈ 9.6 $ with explore gates | raw met; composite time missed; cost met only with digested |

**Correction to §A5 (e11).** At `c575adfc`, AC-02-010.4 was already reconciled: `c34ba57c` is an ancestor. Only
AC-02-010.8 and REQ-03-001 were live drift in E. Both are still live at E2's HEAD.

**Parity, on the five real defects of the replay code:**

- D2 `explore` found 4/5.
- E1 `digested` found 3/4.
- E2 `digested` found 2/5.

The out-of-diff drift loss is structural. `EVIDENCE_READ_BUDGET = 8` and the diff scoped to the reviewed WOs keep
the judge out of VERIFIED code, where drift lives. E2's gates made 21-32 calls vs D2's 59-80. The in-diff misses
were one per mode, and at n ≤ 2 they are not attributable.

**Adopted defaults** (the plugin change is a separate follow-up; this memo records the decision):

| Flag | Default | Reason |
|---|---|---|
| `parallelGates` | **off** (opt-in; `gateSlots: 2` when on) | Below the time bar. Parity cannot be isolated from `digested`. A dependent can be judged at a pin without its upstream's patch. Flip after (1) gating dependents early and ordering only their landing, (2) fixing the reverify → apply doubled-prefix test commit, and (3) one confirm replay in `explore` with segment ≤ 60 % and unchanged recall |
| `gateEvidence` | **`explore`** | The pre-registered rollback fired: a CORRECTION was lost, and AC-02-010.8 drift was lost in 2/2 digested runs |
| `driftPolicy` | **`record`** | Validated end to end in E1; no counter-evidence |
| `gateContextScope` | **off** | Unmeasured. Next: **canary F1**, the same `c575adfc` replay in `explore` + `gateContextScope`, scored against the 5-defect ground truth and D2's 24.61 $ |
| `gateInventoryCache` | **off** | Unmeasured. Next: the §A6 #6 repeat-gate canary |

**Open levers, by measured leverage:**

1. **Gate-launch dependency** (`gateConflict` rule 1): FRD-05 waited 23.2 min with two idle slots (39.9
   slot-minutes). It was then gated at the old pin anyway. Launching early and ordering only the landing projects
   to ≈ −12 min on E2 (PROJECTION). This makes "BL-0192 phase 2 (pin in the top-up)" moot on this evidence: FRD-05
   was already pinned.
2. **A recall-preserving cost lever:** F1 as above, or F2, `digested` + a sonnet whole-FRD drift finder whose claims
   go through the a\* proof. A "drift oracle only for never-gated FRDs" would not have caught either live drift:
   both FRDs had been gated before the drift appeared.
3. **Close-out:** visual-qa returned `done:false` with 0 tool calls (cause unconfirmed). BL-0179 cannot fire in a
   multi-FRD run: bookkeeping commits sit past `last_green_sha`, and the last report is a `since`-old-pin reverify.
4. **Hygiene:**
   - the nested-project status.yaml exclusion (the baseline escalated, 2.5 min);
   - the collector's `mkdir` in a fresh slot;
   - the final rollup flip left uncommitted;
   - BL-0190.

## Canary F1/F2 result and adopted defaults (2026-09-26)

(Resultado F1/F2 y defaults adoptados. The runs are F1 `wf_d8545504-d0a` and F2 `wf_8bab7752-702`, both on the
plugin 9.115.1 engine, both replaying D2's four gates from `c575adfc`. Evidence: `docs/reviews/canary-f1-report.md`
and `docs/reviews/canary-f2-report.md`. All $ are BL-0181-deduped.)

**Criteria (`docs/reviews/canary-f-plan.md` §2), scored:**

| Item | Criterion | F1 measured | F2 measured |
|---|---|---|---|
| Recall | ≥ 4/5 including #1 AC-02-010.8 and #2 REQ-03-001 | 4/5 + #4 partial; #1 and #2 found and DR-122-proven → **met** | 4/5; **#1 lost** (the finder never inventoried it; the judge passed AC-02-010.1..10 in one row) → **failed** |
| Review cost | Σ ≤ 18.5 $ | 23.38 $ core (29.92 $ with the BL-0001 repair) → **failed** | 14.80 $ (evidence + finder + gate) → **met** |
| Total cost | F2: ≤ E2 + 25 % (≈ 19 $) | — | 30.63 $; 22.84 $ like-for-like (no visual-qa, no spurious ladder), i.e. +51 % → **failed** |
| Gate segment | ≤ 60 % of D2's 66.9-min serial equivalent | 63.8 min = 95 % → **failed** | 54.3 min = 81 % → **failed** |
| BL-0194 | dependent gated in parallel, landing ordered, idle ≈ 0 | met (0 idle) | met (0 idle; 4 gates launched by min 21.4 vs 46.5 in E2) |
| DR-122 | sound differential proofs | 5/5 sound (1 proven drift not carded: REQ-04-003) | 2/2 parsed proofs sound; the 3rd was lost to a mech relay fault → spurious FRD-05 reopen (4.01 $, 12.3 min) |

**The drift finder is not a clean measurement:**

- Its directive (engine line 102) names all five ground-truth defects.
- The FRD-03 and FRD-04 finders ran their Bash calls without a `cd` and read the factory `main` checkout instead of
  the pinned slot. That produced 2 false "implemented" verdicts, on #3 and #5.
- All four ran under the fallback `pandacorp:reviewer` agent type: the launching session's registry predates
  `drift-finder`. Those are the 4 `error` records.

**Adopted defaults (final; the plugin change is a separate follow-up):**

| Flag | Default | Reason |
|---|---|---|
| `gateEvidence` | **`explore`** | `digested` + finder saves ≈ 2.1 $ per FRD gate at equal recall *count*. But it loses #1, the out-of-diff content drift, in 3/3 digested runs, and `explore` finds it in 2/2. A lost finding blocks the flip. The "`explore` on an FRD's first-ever gate" hybrid would not recover #1 (FRD-02 had been gated before the drift appeared). Re-open only after a blind finder re-measure: cwd fixed, relay removed, directive free of the test's defects, recall ≥ `explore`'s set |
| `driftFinder` | **coupled to `digested`** (on only with it) | `digested` alone is strictly worse (2/5). The finder recovered #2 for 0.76 $ per FRD. Not validated |
| `parallelGates` | **on, `gateSlots: 2`** | **Deviates from the pre-registered ≤ 60 % bar,** which no run met (82 / 95 / 81 %). The reason: the serial landing lane, not the gates, is now 74 % of the segment (40.1 of 54.3 min in F2). There is no measured downside: 0 legacy fallbacks and clean slots in E2/F1/F2, 0 idle slots after BL-0194, recall unchanged (F1 = D2 serial 4/5), overhead ≈ 0.3-0.4 $ per run. Not measured: RAM with 2 dev servers, and the agent-weight cap. The owner may veto on the pre-registration |
| `gateContextScope` | **off; propose retiring it** | F1: context per call −7.3 %, calls unchanged, cost flat. Turns drive cost, and this flag does not cut them |
| `gateInventoryCache` | **off** | Unmeasured (repeat-gate canary §A6 #6) |
| `driftPolicy` | **`record`** | Proofs sound in F1 and F2; the relay fault is an engine defect |

**The next levers, by measured leverage:**

1. **The serial landing lane** (40 min in F2). Overlap the verify/certify of independent FRDs, or batch several PASSes
   behind one verify.
2. **Visual-qa scoped to the touched routes** (13-15 min, 3-4 $ per run).
3. **BL-0179 close-out reuse** (never fired in a multi-FRD run).
4. **The F2 defects:**
   - per-call `cd` for slot agents;
   - file-based `drift-proof` results, with no model relay of machine JSON;
   - a preflight check for a stale session plugin version;
   - agent-weight headroom for the finder.

