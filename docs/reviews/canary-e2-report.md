# Canary E2: report, sprint verdict and default decisions

- **Run:** workflow `wf_405eeb21-f9e`, engine 9.113.0 (overlay 8.90.0), branch `canary-e-parallel-gates`
  (worktree `/Users/Shared/Proyectos/panda-corp-canary-e`), replay base `c575adfc` (the four WOs D2 gated, all
  `IN_REVIEW`), pin `82467476` (overlay-upgrade commit on top of it), `last_green_sha` at launch `d9addc89`.
- **Args:** `mode:powerful, maxAgents:60, parallelGates:true, gateSlots:2, gateEvidence:"digested"`, frds 02/03/04/05.
  `gateContextScope` and `gateInventoryCache` were not passed, so both were off.
- **Result:** `builtFrds:[frd-02, frd-03, frd-04, frd-05]`, `blockedFrds:[]`, `reopenedFrds:[]`, `stopReason:null`.
  Engine log line 30: "Run ended: 4 verified, 0 reopened, 0 blocked". Close-out full `verify.sh` was green
  (70/70 Playwright, preceded by the fail-fast static and vitest steps).
- **Wall clock:** first agent 00:37:36Z, last agent end 01:42:41Z, **65.1 min** (`wall_clock_s` 3905.5). 38 agents.
- **Measurement:** `usage-rollup.mjs` 9.113.0 (BL-0181 dedupe) run over the run dir and joined to
  `workflows/wf_405eeb21-f9e.json`. It was appended to the canary's `mission-control/.pandacorp/track.jsonl` as
  `usage_summary` with `canary:"E2"`, `corrected:"BL-0181"`, `partial:false`. That line is uncommitted in the
  canary worktree. The D2 and D1 numbers below were re-derived with the same script from their own run dirs.
  They reproduce the corrected lines in `mission-control/.pandacorp/track.jsonl` on `main`
  (D2: 36.235384 $, D1: 3.642766 $).
- **Confounder (harness):** every one of E2's 38 agent transcripts starts with a relayed owner question that has
  no bearing on the run ("¿todo el trabajo lo haces delegando subagentes…?"). It appears in 0 transcripts of D2 or
  E1. The FRD-04 gate answered it inside its verdict. It is the leading suspect for the no-op visual-qa (§4.5),
  but that cause is not confirmed.

---

## 1. Verdict summary

| Question | Answer | Evidence |
|---|---|---|
| Did E2 finish? | **Yes.** 4/4 FRDs VERIFIED, 0 blocks, close-out green | journal #76, engine log 30 |
| `parallelGates` time win | **Real but below the bar.** Gate segment 55.0 min vs D2 67.1 min (−18 %). That is 82 % of D2's 66.9-min serial equivalent; the pre-registered bar was ≤ 60 %. The largest single loss was **FRD-05 waiting 23.2 min on a gate-launch dependency rule** (§4.2), not the BL-0192 lane | §2.4, engine log 16 |
| `digested` cost win | **Large.** Σ evidence + gate: 9.26 $ vs D2 24.61 $ (−62 %). 21-32 calls per gate vs 59-80, and 92-105 k context per call vs 125-143 k | §2.3 |
| `digested` finding parity | **Lost.** Recall on the 5 known real defects of the replay code: E2 **2/5**, E1 3/4, D2 (explore) **4/5**. FRD-02's AC-02-010.8 drift was missed in **2 of 2** digested runs. FRD-03's date-validation CORRECTION (found by D2 and E1) was missed, so E2 certified `formatLastSync` with the V8 lenient-parse bug still in it | §3 |
| Sprint 4× | **Not reached.** Per verified WO, E2 is 16.3 min / 3.80 $ raw (gates only, no build, no visual-qa) and ≈ 21.5 min / 5.77 $ as a full-run composite. Against the baseline's 32.4 min / 6.53 $, that is **1.99× / 1.72× raw** and **≈ 1.5× / ≈ 1.1× composite**. The cost side depends on `digested`, which fails parity | §2.5, §6 |

---

## 2. Measurement (BL-0181-deduped; cache-write excluded, estimate shown separately)

### 2.1 Per agent

`$` is billed cost (input + output + cache-read). `cw est.` is cache-creation at 1.25× the input rate, which is
**estimated and not verified**. Times are UTC.

| Start | End | Min | Model | $ | cw est. | Calls | Label |
|---|---|---:|---|---:|---:|---:|---|
| 00:37:36 | 00:38:40 | 1.06 | haiku | 0.081 | 0.07 | 16 | baseline-precheck |
| 00:38:40 | 00:41:08 | 2.47 | opus | 0.170 | 0.29 | 7 | baseline *(escalation, §4.6)* |
| 00:41:08 | 00:42:04 | 0.93 | opus | 0.482 | 0.48 | 11 | plan |
| 00:42:04 | 00:42:09 | 0.09 | haiku | 0.005 | 0.04 | 2 | pin (4 FRDs) |
| 00:42:09 | 00:42:41 | 0.54 | haiku | 0.044 | 0.04 | 10 | gate-worktree:1 |
| 00:42:09 | 00:42:39 | 0.49 | haiku | 0.027 | 0.04 | 7 | gate-worktree:2 |
| 00:42:40 | 00:46:42 | 4.03 | haiku | 0.127 | 0.07 | 17 | evidence:frd-03 |
| 00:42:41 | 00:45:45 | 3.06 | haiku | 0.079 | 0.06 | 12 | evidence:frd-02 |
| 00:45:45 | 00:51:53 | 6.14 | opus | 1.870 | 0.76 | 24 | gate:frd-02 |
| 00:46:42 | 00:57:15 | 10.55 | opus | 3.033 | 0.78 | 32 | gate:frd-03 |
| 00:51:53 | 00:52:24 | 0.50 | haiku | 0.041 | 0.04 | 9 | gate-release:frd-02 |
| 00:52:24 | 00:52:29 | 0.09 | haiku | 0.005 | 0.04 | 2 | stale-pin:frd-02 (count 0) |
| 00:52:24 | 00:56:37 | 4.23 | haiku | 0.128 | 0.06 | 9 | evidence:frd-04 |
| 00:52:29 | 00:54:17 | 1.79 | haiku | 0.170 | 0.07 | 30 | apply-gate:frd-02 |
| 00:54:17 | 00:54:50 | 0.56 | haiku | 0.040 | 0.05 | 8 | safe-point |
| 00:56:37 | 01:03:47 | 7.16 | opus | 1.924 | 0.65 | 21 | gate:frd-04 |
| 00:57:15 | 00:57:48 | 0.55 | haiku | 0.047 | 0.04 | 9 | gate-release:frd-03 |
| 00:57:48 | 00:58:15 | 0.45 | haiku | 0.034 | 0.04 | 6 | port-reviewer-tests:frd-03 |
| 00:58:15 | 01:03:54 | 5.65 | opus | 2.263 | 0.75 | 36 | patch:frd-03 |
| 01:03:47 | 01:04:23 | 0.59 | haiku | 0.044 | 0.04 | 9 | gate-release:frd-04 |
| 01:03:54 | 01:04:06 | 0.20 | haiku | 0.015 | 0.04 | 3 | reviewer-test-hash:frd-03 |
| 01:04:06 | 01:07:36 | 3.49 | sonnet | 0.350 | 0.23 | 19 | verify-patch:frd-03 |
| 01:07:36 | 01:09:57 | 2.36 | haiku | 0.266 | 0.08 | 44 | certify-patch:frd-03 |
| 01:09:57 | 01:10:12 | 0.25 | haiku | 0.022 | 0.04 | 5 | port-reviewer-tests:frd-04 |
| 01:10:12 | 01:14:28 | 4.25 | opus | 0.824 | 0.43 | 19 | patch:frd-04 |
| 01:14:28 | 01:14:37 | 0.16 | haiku | 0.012 | 0.03 | 3 | reviewer-test-hash:frd-04 |
| 01:14:37 | 01:19:25 | 4.79 | sonnet | 0.425 | 0.24 | 22 | verify-patch:frd-04 |
| 01:19:25 | 01:21:02 | 1.63 | haiku | 0.159 | 0.07 | 27 | certify-patch:frd-04 |
| 01:21:02 | 01:24:07 | 3.07 | haiku | 0.093 | 0.06 | 10 | evidence:frd-05 |
| 01:24:07 | 01:33:18 | 9.19 | opus | 2.002 | 0.74 | 25 | gate:frd-05 |
| 01:33:18 | 01:33:44 | 0.43 | haiku | 0.035 | 0.04 | 8 | gate-release:frd-05 |
| 01:33:44 | 01:33:51 | 0.11 | haiku | 0.006 | 0.04 | 2 | stale-pin:frd-05 (count 5) |
| 01:33:51 | 01:35:48 | 1.96 | haiku | 0.044 | 0.05 | 9 | reverify:frd-05 |
| 01:35:48 | 01:37:02 | 1.23 | haiku | 0.102 | 0.06 | 18 | apply-gate:frd-05 |
| 01:37:02 | 01:37:20 | 0.30 | haiku | 0.011 | 0.04 | 2 | renew-lease |
| 01:37:20 | 01:37:56 | 0.60 | sonnet | 0.030 | 0.12 | 1 | visual-qa *(returned `done:false`, 0 tool calls)* |
| 01:37:56 | 01:38:31 | 0.58 | haiku | 0.040 | 0.05 | 8 | close-out-verify-reuse-check |
| 01:38:31 | 01:42:41 | 4.17 | haiku | 0.145 | 0.06 | 27 | notify-end (full `verify.sh`) |
| | | **65.1 wall** | | **15.195** | **6.82** | 529 | 38 agents |

By model: opus 12.57 $ (175 calls), sonnet 0.80 $ (42), haiku 1.82 $ (312). By engine phase: Review 14.41 $,
Plan 0.48 $, Baseline 0.25 $, Build 0.05 $ (safe-point and lease only; no WO was built).

### 2.2 Totals and phases

| Phase | Wall / agent-min | $ | Note |
|---|---:|---:|---|
| Precheck + baseline + plan | 4.5 wall | 0.733 | the baseline escalation (2.5 min, 0.17 $) was avoidable (§4.6) |
| Slot setup (pin + 2 worktrees) | 0.6 wall | 0.076 | |
| Evidence ×4 | 14.4 agent-min (max 4.23) | 0.427 | E1's stalled collector took 13.5 min |
| Gates ×4 | 33.0 agent-min | 8.829 | |
| Gate-release ×4 | 2.1 agent-min | 0.167 | |
| Landing FRD-02 (stale-pin + apply) | 1.9 | 0.175 | PASS, pin not stale |
| Landing FRD-03 (port, patch, hash, verify, certify) | 12.2 | 2.928 | reopen, BL-0191 path |
| Landing FRD-04 (port, patch, hash, verify, certify) | 11.1 | 1.442 | reopen, BL-0191 path |
| Landing FRD-05 (stale-pin, reverify, apply) | 3.3 | 0.152 | PASS on a stale pin |
| Safe-point + renew-lease | 0.9 | 0.051 | |
| Visual-qa | 0.6 | 0.030 | **did no work** (§4.5) |
| Close-out (reuse-check + notify-end) | 4.8 | 0.185 | full `verify.sh`, no reuse (§4 table) |
| **Total** | **65.1 wall** | **15.195** | +6.82 $ cache-write, **estimated** |

Review cost per FRD (evidence + gate + release + landing): FRD-02 2.17 $, FRD-03 6.14 $, FRD-04 3.54 $,
FRD-05 2.28 $, Σ 14.12 $.

### 2.3 Gate by gate, E2 vs D2 (same `src/`; see §3.1 for the one doc difference)

| FRD | D2 gate (explore) min / $ / calls / ctx | E2 evidence + gate (digested) min / $ | E2 gate calls / ctx | D2 verdict | E2 verdict |
|---|---|---|---|---|---|
| 02 | 17.60 / 7.48 / 80 / 143 k | 9.20 / 1.95 | 24 / 95 k | block (AC-02-010.4/.8 drift) | pass |
| 03 | 11.84 / 5.77 / 66 / 126 k | 14.58 / 3.16 | 32 / 105 k | reopen (lenient date parse) + REQ-03-001 drift reported | reopen (chip on unmounted table) |
| 04 | 13.53 / 6.46 / 78 / 125 k | 11.39 / 2.05 | 21 / 92 k | reopen (lenient parse + UTC day) | reopen (UTC day + lenient parse) |
| 05 | 9.63 / 4.89 / 59 / 130 k | 12.26 / 2.10 | 25 / 94 k | pass | pass |
| **Σ** | **52.6 / 24.61** | **47.4 / 9.26 (−62 %)** | | | |

The cost win comes from fewer turns (−63 % calls) and a smaller context per turn (−26 %). The
38-A6 context criterion (average ≤ 100 k per gate turn) is met: 96 k average.

### 2.4 Concurrency and the gate segment

- `concurrency_max` 3. Time at each level: **1 agent 42.9 min**, 2 agents 19.8 min, 3 agents 2.4 min. Opus agents in
  parallel: 0 for 30.1 min, 1 for 23.6 min, 2 for 11.3 min.
- Per minute (max live agents): 00:37-00:41 = 1 · 00:42-00:51 = 2 · 00:52-00:54 = 3 · 00:55-01:04 = 2 ·
  **01:05-01:42 = 1** (38 min single-agent tail).
- Gate overlap: gate:frd-02 ∥ gate:frd-03 5.2 min, gate:frd-03 ∥ gate:frd-04 0.6 min, gate:frd-04 ∥ patch:frd-03 5.5 min.
- **Gate segment** (pin → last landing): 00:42:04 → 01:37:02 = **55.0 min**. D2 (first gate → last landing):
  01:28:43 → 02:35:49 = 67.1 min, so **−18 %**. Against the pre-registered serial equivalent of D2's gate work
  (66.9 min), E2 is at **82 %**; the bar was ≤ 60 %. Σ of E2's own per-FRD ladder spans, without lane waits,
  is 77.9 min, which gives an overlap factor of 1.42.
- **Idle slots.** Slot 2 sat idle from 00:57:48 and slot 1 from 01:04:23, both until FRD-05 launched at 01:21:02.
  That is **39.9 slot-minutes idle while a gate-ready FRD waited**. The cause is not the lane (§4.2).
- Start → first verdict: 14.3 min (00:37:36 → 00:51:53). D2 took 20.6 min.

### 2.5 Per verified WO: E2 vs D2 vs baseline

E2 verified 4 WOs: WO-02-014, WO-03-006, WO-04-008 and WO-05-007.

| Run | Wall min | $ real | WOs verified | **min / WO** | **$ / WO** | vs baseline (time / cost) |
|---|---:|---:|---:|---:|---:|---|
| FRD-24 baseline | 64.8 | 13.05 | 2 | **32.4** | **6.53** | 1.00× / 1.00× |
| D1 + D2 (explore, serial gates, with build) | 15.8 + 87.5 | 3.64 + 36.24 | 3 | 34.4 | 13.29 | 0.94× / 0.49× |
| E1 (partial, 429 cut) | 35.5 | 12.18 | 0 | n/a | n/a | n/a |
| **E2 raw** (digested + parallel, **no build, visual-qa did nothing**) | 65.1 | 15.20 | 4 | **16.3** | **3.80** | **1.99× / 1.72×** |
| E2 composite, digested *(PROJECTION)* | ≈ 86.0 | ≈ 23.08 | 4 | ≈ 21.5 | ≈ 5.77 | ≈ 1.51× / ≈ 1.13× |
| E2 composite, explore gates *(PROJECTION)* | ≈ 86 | ≈ 38.4 | 4 | ≈ 21.5 | ≈ 9.61 | ≈ 1.51× / ≈ 0.68× |
| **4× target** | | | | 8.1 | 1.63 | 4× / 4× |
| **Red-team bar (38 addendum)** | | | | ≤ 20 | ≤ 7.5 | |

How the composite is built: take E2 as measured, subtract the no-op visual-qa (0.6 min / 0.03 $), and add costs
measured in other runs:

- D2's parallel build wave for WO-03/04/05: dispatch → last commit, 8.5 min / 4.43 $, including D1's WO-02-014
  build + commit (0.78 $), which fits in the same wave (3.5 min < the 6.5-min longest build).
- D2's foundation-gate: 0.99 min / 0.48 $.
- D2's visual-qa: 12.05 min / 3.01 $.

The explore variant then swaps E2's Σ evidence + gate (9.26 $) for D2's Σ gate (24.61 $). The composite rows are
arithmetic over measured spans, not a measured run.

Against D2 per WO: raw 2.11× time / 3.50× cost; composite ≈ 1.60× / ≈ 2.30×.

---

## 3. Finding parity: `digested` vs `explore`

### 3.1 First, a correction to proposal 38 §A5 (e11) and the E1 report

`c34ba57c` ("reconcile FRD-02/FRD-03 drift surfaced by the whole-FRD gate (canary D)") **is an ancestor of
`c575adfc`** (`git merge-base --is-ancestor`). It rewrote AC-02-010.4 from the code (the DR-085 roster). So at E's
base, AC-02-010.4 was **no longer drift**, and E1/E2 passing it is correct. D2 reviewed a tree without that commit.
Two claims were therefore wrong about AC-02-010.4: 38 §A5's "AC-02-010.4/.8 and REQ-03-001 drift intact", and the
E1 report's "FRD-02 lost D2's AC-02-010.4/.8 drift". The `src/` is byte-identical, so the gate comparison below holds.

The other two drifts are real at E2's final HEAD:

- **AC-02-010.8**: `phases.ts` has no mention of Claude Design, components.md or foundation (grep).
- **REQ-03-001**: `ACTIVE_PHASES` in `portfolio.ts:335` still includes `"architecture"`, while REQ-03-001 says
  architecture projects SHALL NOT appear.

### 3.2 Ground truth: the 5 real defects in the replay code, and who found them

| # | Defect (real, verified in code) | Class | D2 explore | E1 digested | E2 digested |
|---|---|---|:-:|:-:|:-:|
| 1 | AC-02-010.8: Campaign fichas lack the current-factory content (lost in revert `76054e96`) | pre-existing drift, out of diff | **found** | missed | **missed** |
| 2 | REQ-03-001: `ACTIVE_PHASES` includes `architecture` | pre-existing drift, out of diff | **found** (reported) | **found** (DR-122 proved) | **missed** ("pass, foundation, not re-reviewed") |
| 3 | FRD-03 `formatLastSync`: V8 lenient `Date.parse` fabricates ages (`"N/A 3"` → 2001-03-01, `"2026-02-30"` → 2026-03-02, verified with `node`) | CORRECTION, in diff | **found** | **found** | **missed**: it tested only strings V8 rejects (`month 13`, `dd/mm` with month 15) and passed AC-03-007.2 |
| 4 | REQ-03-007 chip rendered only in the unmounted `PortfolioTable` | CORRECTION, in diff | missed | **found** | **found** |
| 5 | FRD-04 `formatChangeDate`: UTC calendar day + V8 lenient parse | CORRECTION, in diff | **found** | not gated | **found** |
| | **Recall** | | **4/5** | **3/4** | **2/5** |

So neither mode is a perfect oracle. D2 certified FRD-03 with the chip unmounted, and **E2 certified FRD-03 with
the lenient-parse bug still at HEAD**: `formatLastSync.ts` only checks `Number.isNaN(Date.parse(date))`.

### 3.3 Mechanism: why digested loses the out-of-diff drift (structural, not noise)

The digested prompt caps exploration at `EVIDENCE_READ_BUDGET = 8` extra reads. ATTACHMENT 2 is the diff of the
reviewed WOs' artifacts only (`pandacorp-build.js:1849,1969-1970`). Drift lives in VERIFIED code outside that diff.

- **Tool calls per gate:** D2 56-80, E2 21-31, E1 21-24.
- **Touches of the drift files:** D2 gate:frd-02 opened `phases.ts` 9 times and gate:frd-03 hit `ACTIVE_PHASES` 4
  times. E2 gate:frd-02 and gate:frd-03 opened **neither**, 0 times each. E1 gate:frd-03 hit `ACTIVE_PHASES` once,
  and that is the one digested drift find.
- **FRD-02 in E2:** it put all ten Campaign ACs in a single traceability row ("AC-02-010.1..10 … pass").

The in-diff CORRECTION misses (#3 in E2, #4 in D2) look like judge variance (each mode missed one). At n = 1-2 they
cannot be attributed.

**Answer to the brief:** FRD-02's AC-02-010.8 drift was **not detected in 2 of 2 digested runs**, and the mechanism is
the read budget. **That is a serious finding against `digested` as the default.**

### 3.4 Per FRD

- **FRD-02:** both passes confirm WO-02-014 is correct (D2: 11 adversarial tests + 9/9 mutants; E2: 2 reviewer test
  files, pass). The whole-FRD oracle: D2 audited it, E2 did not (#1).
- **FRD-03:** different real findings each run (#3 vs #4). E2's patch mounted the chip on the rail (`2eeac7c7`) and
  was verified independently.
- **FRD-04:** parity (both faults found by both modes). D2 also sibling-audited `formatLastSync` and
  `decisionAgeLabel`; E2 did not (0 touches of `formatLastSync`).
- **FRD-05:** parity (pass). Both marked the error class N/A for the same reason.
- **DR-122 drift proof:** **not exercised in E2** (no drift claim was made, which is itself a consequence of #1/#2).
  E1 exercised it end to end at 0.02 $.

---

## 4. Fixes exercised live

| Fix | Exercised? | Evidence |
|---|---|---|
| **BL-0191** (certify after verify, no post-hoc revert) | **Yes, 2/2.** FRD-03 and FRD-04: `verify-patch` green → `certify-patch` → "VERIFIED (patched in place, independently verified)". 0 reverts, 0 no-op rebuilds (E1 lost 1.28 $ / 4.1 min to this) | journal #44-46, #54-56; log 19, 21 |
| **BL-0192** (landing lane no longer starves slots) | **Partly.** Pre-landing refill: yes, gate:frd-04 launched at 00:52:24 before FRD-02's landing. Mid-landing refill (`laneTopUp`): it ran but found no eligible FRD, so it is not positively exercised | log 12-14 |
| **BL-0193** (bounded collector) | **Yes, with a residue.** Durations 3.06 / 4.03 / 4.23 / 3.07 min (E1: 13.5), all foreground with `timeout: 600000` + perl alarm, 0 polling loops. **Residue:** the first attempt failed in 2/2 *fresh* slots (evidence:frd-02, evidence:frd-03) with `no such file or directory …/.pandacorp/run/evidence-verify.log`, because the gitignored `.pandacorp/run/` does not exist in a new worktree. The agents recovered with `mkdir -p`; reused slots (frd-04, frd-05) passed first time | transcripts `ad875666…`, `a40648e4…` |
| **BL-0182 / 0183 / 0184** (slot hygiene, port + hash) | **Yes.** 4/4 `gate-release` salvaged the reviewer tests (untracked + sha256). Port + `reviewer-test-hash` on both reopens. Reverify ported first on the stale PASS. **Both slots clean at the end** (`git status` empty, detached at `82467476`). 0 legacy fallbacks | journal #21, #33-35, #40-41, #43, #47-52, #62; `git -C gate-worktree-N status` |
| **Stale-pin guard / reverify** | **Yes, both branches.** FRD-02: count 0 → landed as reviewed. FRD-05: count 5 → `reverify` green (1.96 min, 0.04 $) → landed | log 13, 24-25 |
| **DR-122** (`driftPolicy:record`) | **Not exercised** (no claims, §3.4) | journal: no `drift-proof` label |
| **BL-0179 / BL-0147** (close-out reuse) | **Did not fire.** `canReuse:false, reason:sha-mismatch`. All three conditions failed: (1) HEAD `5fd7d919` was two bookkeeping commits past `last_green_sha 4ceac8e0` (`publish last green snapshot`, `record … timelines`); (2) the latest report was FRD-05's reverify, `since 82467476` ≠ `last_green_sha`; (3) the tree was dirty. `notify-end` re-ran the full `verify.sh` (~2-3 of its 4.2 min). **0 `CloseOutVerifyReused` events** in the whole `dashboard-events.ndjson` history | journal #74; events grep |
| **BL-0190** (post-run `last_green_sha` audit) | Still open; audited by hand instead. The 4 publications point to `2da09658`, `6f871f6c`, `7d113bc1`, `4ceac8e0`, each the tip of a verified landing: **0 violations** | `git show <c>:…/status.yaml` |
| **Precheck baseline** | **Escalated, avoidably.** Precheck returned `dirtyPaths:["mission-control/.pandacorp/status.yaml"]`. The BL-0124 exclusion compares `dirtyPaths[0] === '.pandacorp/status.yaml'` with strict equality (`pandacorp-build.js:1414`). `git status --porcelain` prints **repo-root-relative** paths, so for a nested project the match can never succeed. That is a BL-0160 residue specific to nested projects. It was not `.pandacorp/run/` leftovers. Cost: an opus judge baseline, 2.47 min / 0.17 $, on the critical path | journal #2; engine :1398, :1414 |
| `GateEvidenceFallback` | 0 | events grep |

### 4.1 D1 invariants

- 0 legacy fallbacks, both slots clean at the end, 0 environment-noise reds in any gate report.
- 0 `last_green_sha` violations (manual audit).
- `vm_stat` contention was not captured.

### 4.2 New: FRD-05 waited 23.2 min on a gate-launch dependency, and then gated at the old pin anyway

- **The wait.** Engine log 16: "gate for frd-05-work-orders deferred: depends on frd-04-project-workspace (verdict
  not landed yet)". The plan gives FRD-05 `deps: [frd-13, frd-04, frd-01]`. `gateConflict` rule (1) refuses to
  *launch* a gate while an upstream FRD's verdict is unlanded. Its stated reason is landing order: the dependent
  must not land before its upstream.
- **The old pin.** When FRD-05 finally launched (01:21:02) it was **not re-pinned**: its evidence report and gate
  both ran at `82467476` (journal #58; log 24). The judge therefore never saw FRD-04's landed patch. The wait bought
  no fresher review, only the stale-pin reverify that would have run anyway.
- **The brief's hypothesis does not hold.** The brief said "top-up only launches pinned FRDs". FRD-05 *was* pinned
  (the 00:42:04 pin covered all four FRDs), so pinning in the top-up (BL-0192 phase 2) would not have helped.
- **The fix direction.** Launch dependent gates freely and order only their *landing*, which is what the lane
  already serializes. The stale-pin reverify covers the objective suite. If a semantic re-review of the upstream
  patch is wanted, re-pin at launch instead.
- **PROJECTION:** FRD-05 in slot 2 at 00:57:48 → gate done ≈ 01:10:15 → lands after FRD-04 ≈ 01:24:45. That is
  **≈ −12 min** (run ≈ 53 min, segment ≈ 42.7 min ≈ 64 % of 66.9).

### 4.3 New: the stale-PASS + reverify path commits the reviewer test under a doubled prefix

`apply-gate:frd-05` committed the reviewer test as
**`mission-control/mission-control/src/app/projects/[slug]/_components/_tests/frd-05-wo-05-007.gate.reviewer.test.tsx`**
(`4ceac8e0`). The copy at the correct path, ported by `reverify`, stayed **untracked** on `main`. The two files are
byte-identical (`cmp`).

- vitest's `include: ["**/*.{test,spec}.{ts,tsx}"]` still runs both copies, so the close-out stayed green. But the
  committed tree has a stray nested directory, and the working tree is dirty.
- FRD-02, whose PASS was not stale, committed at the right path (`2da09658`), so the defect is specific to the
  reverify → apply path.

### 4.4 New: FRD-05's rollup flip left uncommitted (BL-0172 class)

At the end of the run, `frd-05-work-orders/frd.md` and `blueprint.md` have an uncommitted
`implementation_status: IN_REVIEW → VERIFIED`. `notify-end`'s narrative says "corrected: 0, no cambios en
frd.md/blueprint.md". The next run's precheck will see a dirty tree.

### 4.5 Visual-qa did nothing

`visual-qa` (sonnet) answered `{done:false}` in its first and only turn: 1 call, 0 tool uses, 0.03 $. The engine
degraded honestly (log 29, a `UiPassSkipped` event).

The cause is **not confirmed**. The only visible anomaly is the relayed owner question present in all 38 E2
transcripts, and in none from D2 or E1. So E2's total omits a visual pass that cost D2 12.05 min / 3.01 $.

### 4.6 Precheck escalation

See the table above: a nested-project path-prefix mismatch, not `.pandacorp/run/` debris.

---

## 5. Default decisions (the engine defaults follow this; `plugin/` is changed by a separate agent)

Rule applied: a flag is on by default only if E2 shows a clear time or cost gain **without** lost finding parity,
against the criteria pre-registered in proposal 38 (§A5, §A6).

| Flag | Default | Criterion → measured | Why |
|---|---|---|---|
| `parallelGates` | **off** (opt-in). `gateSlots: 2` when on | 38 A6 #5: segment ≤ 60 % of serial-equivalent → **82 %** (55.0 / 66.9). 0 invariant violations → met. 0 env-noise reds → met | The time gain is real but short of the bar (−18 % segment). Cost overhead is negligible (+0.38 $, ≈ 2.5 %: slots, releases, port/hash, stale-pin, reverify). Parity cannot be judged: E2 confounds it with `digested`. Parallel gating also adds a semantic risk: a dependent can be judged at a pin without its upstream's patch (§4.2). **Flip condition:** land the §4.2 dependency fix and the §4.3 path fix, then run one confirm replay in `explore` (canary F1 below) that shows segment ≤ 60 % with recall unchanged |
| `gateEvidence` | **`explore`** (unchanged). `digested` stays opt-in | 38 A6 #4 / A5: ≥ 25 % review-cost cut → **−62 %**, met. **0 lost CORRECTION findings → failed** (FRD-03 #3). Drift recall **0/2** on AC-02-010.8 and 1/2 on REQ-03-001 | The pre-registered rollback rule fires. Recall 5/9 across E1 + E2 vs explore's 4/5 on the same code. The out-of-diff drift loss is structural (§3.3), not noise |
| `driftPolicy` | **`record`** (unchanged) | E1: proof + card end to end at 0.02 $. E2: not exercised | No counter-evidence; the rollback switch `block` stays |
| `gateContextScope` | **off** | not measured | It would be measured by **canary F1**: the same `c575adfc` replay, `explore` + `gateContextScope`, scored against the §3.2 ground truth (5 defects) and D2's 24.61 $. It is the only cost lever left that keeps explore's unbounded exploration. Note that it makes the VERIFIED WOs' *docs* header-only, so recall on #1/#2 must be checked explicitly |
| `gateInventoryCache` | **off** | not measured | It needs a repeat-gate canary (38 A6 #6, "canary F"): a second gate of an already-gated FRD, pass ≤ 70 % of the first gate's cost with an identical traceability set |

**An alternative worth testing (PROPOSAL, not measured):** `digested` + a separate whole-FRD drift finder.

- The finder would be a sonnet agent, unbounded reads, scoped to the ACs **not** owned by a reviewed WO. Its claims
  go through the existing DR-122 differential proof, so false positives are filtered mechanically.
- It keeps the opus judge on the diff (where digested's recall matched explore's: 2/3 each) and moves drift
  hunting to a cheaper model.
- It must be scored on the §3.2 ground truth in canary F2 before it can be a default.
- The brief's variant ("drift oracle in explore only for never-gated FRDs") would **not** have caught #1 or #2:
  FRD-02 and FRD-03 had been gated before, and the drift appeared later (a revert, an FRD re-anchor).

---

## 6. Sprint verdict

- **The 4× goal was not reached, in time or in cost, on any honest reading.**
  - Per verified WO, E2 is **1.99× faster and 1.72× cheaper than the baseline** on the raw gate-only measurement.
    This is the best measured number of the sprint, but it excludes the build and a visual-qa pass.
  - As a full-run composite it is **≈ 1.5× time / ≈ 1.1× cost**.
  - Against D2 it is 2.11× / 3.50× raw and ≈ 1.60× / ≈ 2.30× composite.
- **The red-team bar (≤ 20 min, ≤ 7.5 $ per WO):**
  - Raw: met (16.3 / 3.80).
  - Composite: time just missed (≈ 21.5), cost met (≈ 5.77).
  - **But that cost only holds with `digested`, which fails parity.** With the parity-preserving `explore` default,
    the composite cost is ≈ 9.6 $/WO, *above* the baseline.
- **What the sprint did deliver:**
  - A working parallel-gate machinery with clean slot hygiene: 0 fallbacks, 0 dirty slots.
  - BL-0191, whose certify-then-land path now works (2/2).
  - A bounded evidence collector.
  - A measured map of where the time goes. The 38-min single-agent tail is serial landings + one dependency wait
    + close-out.
  - A ground-truth corpus (§3.2) that makes the next parity test objective.
- **What remains, in order of measured leverage:**
  1. **Dependency-gated launch (§4.2): ≈ −12 min** on this run (PROJECTION). Gate dependents early, order only the
     landing. Also carry the pin question: re-pin or rely on reverify.
  2. **A recall-preserving cost lever:** canary F1 (`explore` + `gateContextScope`) and/or F2 (`digested` + drift
     finder), both on the `c575adfc` replay against the §3.2 ground truth.
  3. **Close-out:** find out why visual-qa did nothing (§4.5), and make BL-0179 reachable in a multi-FRD run. Today
     it cannot fire: bookkeeping commits push HEAD past `last_green_sha`, and the last report is a `since`-old-pin
     reverify.
  4. **Hygiene:** the §4.3 doubled-prefix commit, the §4.4 uncommitted rollup, the §4.6 nested-path precheck
     escalation, and the BL-0193 residue (`mkdir -p` the slot run dir).
  5. **BL-0190** (X5 audit): still open.
  6. **Cache-write cost:** 6.82 $ estimated on top of 15.20 $ (+45 %), at an unverified rate.
  7. **Not a lever on this evidence:** "BL-0192 phase 2, pin in the top-up". FRD-05 was already pinned.

## 7. Proposed backlog items (not filed; filing is the owner's or a follow-up agent's call)

1. Gate-launch dependency deferral in `gateConflict` rule (1) wastes a slot and does not re-pin (§4.2).
2. Stale-PASS + reverify path commits the reviewer test under `mission-control/mission-control/…` and leaves an
   untracked copy (§4.3).
3. Final FRD's rollup flip left uncommitted after release, a BL-0172 residue (§4.4).
4. BL-0124/BL-0160 exclusion never matches for nested projects (repo-relative porcelain path) (§4.6).
5. BL-0193 residue: the collector's log redirect fails in a fresh slot (`.pandacorp/run/` missing) (§4).
6. BL-0179 unreachable in multi-FRD runs (bookkeeping commits past `last_green_sha`, since-old-pin report) (§4).
7. Visual-qa returned `done:false` with 0 tool calls, cause unconfirmed (§4.5).

## 8. Not verified

- Whether the relayed owner question caused the visual-qa no-op, or influenced any gate's depth or cost.
- Judge variance: n = 1 per FRD per mode (E1 adds a second digested sample for FRD-02/03 only). The in-diff misses
  (#3 in E2, #4 in D2) are not attributable.
- The composite and explore-variant rows in §2.5, and the §4.2 saving: arithmetic over measured spans, not runs.
- The cache-write cost (1.25× input is an assumption), and the opus-5-5 price (assumed equal to opus-5).
- `vm_stat` contention and RAM headroom for 2 slots: not captured.
- Parity of `parallelGates` in isolation (E2 confounds it with `digested`).
- Whether the close-out `verify.sh` covered vitest: the transcript kept only the tail (Playwright 70/70). `verify.sh`
  fails fast, so the earlier steps passed, but I did not read their lines.
