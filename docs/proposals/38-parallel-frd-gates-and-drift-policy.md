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
