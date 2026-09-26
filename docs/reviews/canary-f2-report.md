# Canary F2: report, F1/F2 verdict and final defaults

- **Run:** workflow `wf_8bab7752-702`, engine artifact of plugin 9.115.1 (overlay 8.92.1, worktree
  `/Users/Shared/Proyectos/panda-corp-canary-f2`, branch `canary-f2`), replay of D2's four gates from `c575adfc`
  (same `src/` as D2/E2/F1), pin `7b44a772`, `last_green_sha` at launch `d9addc89`.
- **Args** (read from `workflows/wf_8bab7752-702.json`): `mode:powerful, maxAgents:60, parallelGates:true,
  gateSlots:2, gateEvidence:'digested', driftFinder:true`, frds 02/03/04/05. `gateContextScope` and
  `gateInventoryCache` not passed (off).
- **Result:** `builtFrds` = all four, `blockedFrds:[]`, `reopenedFrds:[]`, `stopReason:null`; engine log
  "Run ended: 4 verified, 0 reopened, 0 blocked". 52 agent records, **4 in state `error`** (§4.1), 48 that ran.
- **Wall clock:** 05:46:49.6Z (`baseline-precheck`) → 07:03:06.7Z (`notify-end` end), **76.3 min**
  (`wall_clock_s` 4577.1).
- **Measurement:** `plugin/scripts/usage-rollup.mjs` 9.115.1 (BL-0181 dedupe) over the run dir, joined to
  `workflows/wf_8bab7752-702.json`. Appended as `usage_summary` (`canary:"F2"`, `corrected:"BL-0181"`,
  `partial:false`) to the canary's `mission-control/.pandacorp/track.jsonl` (line 83, uncommitted in the canary
  worktree). F1/E2/D2 figures are quoted from `canary-f1-report.md` and `canary-e2-report.md`, which used the same
  script and dedupe.

---

## Executive summary

**F2 fails its pre-registered bar.** Recall is 4/5, but it misses #1, and the plan required #1 and #2
explicitly. Total cost is 30.63 $, against a bar of ≤ E2 + 25 % ≈ 19 $. Only the partial bar passes: Σ evidence +
finder + gate is 14.80 $, under the 18.5 $ cap.

- **#1 is now lost in 3/3 `digested` runs** (E1, E2, F2), and it was lost even with the finder. The FRD-02 finder
  opened `phases.ts` 4 times but never inventoried AC-02-010.8: it grouped AC-02-010.1-.3 and checked only .4 and
  .9. The judge passed "AC-02-010.1..10" in a single row. `explore` found #1 in 2/2 runs (D2, F1).
- **The finder added one defect over E2's `digested` judge: #2.** It found REQ-03-001, wrote the probe, DR-122
  proved it, and it was carded.
- **The judge found the other three:** #3, #4 and #5, all in-diff.
- **The finder measurement is compromised in three ways:**
  1. Its prompt names the canary's own answer key (`ACTIVE_PHASES`, `"N/A 3"`/`"2026-02-30"`, "the Campaign cards
     had lost the current-factory content in a revert", "MOUNTED", "UTC calendar day"). That is engine line 102.
  2. Two of the four finders (FRD-03, FRD-04) audited the wrong tree. Bash cwd resets between calls, so they read
     the factory's `main` checkout instead of the pinned slot, and reported the already-fixed validators as
     "implemented".
  3. All four ran under the fallback `pandacorp:reviewer` agent type. The launching session had a stale agent
     registry, and those are the 4 `error` records.
- **A mech relay fault caused a spurious reopen.** The haiku runner dropped one `]` when copying `drift-proof`'s
  JSON. The engine then fail-closed a *proven* pre-existing spec drift into a cycle fault, and a patch ladder ran:
  12.3 min and 4.01 $ on the critical tail.
- **Time was the best of the four replays.** BL-0194 held: FRD-05 gated while FRD-04 was still in review, all four
  gates had started by minute 21.4 (E2: 46.5), and idle slot-minutes were 0. The serial **landing lane** (40.1 min of
  the 54.3-min gate segment) is now the critical path.
- **Per verified WO: 19.1 min / 7.66 $**, i.e. 1.70× faster and 0.85× the cost of the baseline (32.4 min / 6.53 $),
  and 1.15× / 1.18× vs D2. That is better than F1 (1.55× / 0.59×) and worse than E2 (1.99× / 1.72×). E2 had parity
  2/5 and a no-op visual-qa.

**Final defaults:** `gateEvidence: explore` (unchanged). `driftFinder` stays coupled to `digested` (on only with
it) and is not proven. `parallelGates` **on**, `gateSlots: 2`: this deviates from the pre-registered time bar, see
§6. `gateContextScope` off, and proposed for retirement. `gateInventoryCache` off. `driftPolicy: record`.

**Sprint:** the 4× goal is **not reached and not reachable with this pipeline**. The serial non-gate tail alone
(landing lane, visual-qa and close-out) is ≈ 15 min per WO, against a 4× target of 8.1 min per WO.

---

## 1. Measurement

### 1.1 Per agent (chronological; `$` = billed input + output + cache-read; `ctx/call` includes cache reads/writes)

The 4 `error` records have no transcript, cost or duration. Each is `find:drift:<frd>` with
`agentType 'pandacorp:drift-finder' not found`, and each was re-queued within 13 ms as the fallback below (§4.1).

| Start (UTC) | End | Min | Model | $ | Calls | ctx/call | Label |
|---|---|---:|---|---:|---:|---:|---|
| 05:46:49 | 05:47:26 | 0.6 | haiku | 0.037 | 7 | 35k | baseline-precheck |
| 05:47:26 | 05:48:27 | 1.0 | opus | 0.494 | 10 | 73k | plan |
| 05:48:27 | 05:48:31 | 0.1 | haiku | 0.005 | 2 | 30k | pin (4 FRDs) |
| 05:48:31 | 05:48:57 | 0.4 | haiku | 0.037 | 9 | 33k | gate-worktree:1 |
| 05:48:31 | 05:48:52 | 0.3 | haiku | 0.029 | 7 | 32k | gate-worktree:2 |
| 05:48:53 | 05:52:15 | 3.4 | haiku | 0.081 | 8 | 38k | evidence:frd-03-portfolio |
| 05:48:53 | 05:54:25 | 5.5 | sonnet | 1.092 | 47 | 85k | find:drift:frd-03-portfolio (fallback agentType; read the WRONG tree, §4.2) |
| 05:48:57 | 05:51:55 | 3.0 | haiku | 0.071 | 10 | 40k | evidence:frd-02-ideas-board |
| 05:48:57 | 05:53:31 | 4.6 | sonnet | 1.094 | 52 | 83k | find:drift:frd-02-ideas-board (fallback agentType) |
| 05:53:32 | 06:03:34 | 10.0 | opus | 3.484 | 42 | 109k | gate:frd-02-ideas-board (slot 1) → **pass**, 2 drift claims (AC-02-011.1/013.1) |
| 05:54:25 | 06:01:27 | 7.0 | opus | 2.102 | 24 | 100k | gate:frd-03-portfolio (slot 2) → **reopen** (#3, #4) + REQ-03-001 drift (#2, finder probe) |
| 06:01:27 | 06:01:58 | 0.5 | haiku | 0.015 | 2 | 31k | drift-proof:frd-03-portfolio |
| 06:01:58 | 06:02:05 | 0.1 | haiku | 0.008 | 2 | 31k | drift-record:frd-03-portfolio |
| 06:02:05 | 06:02:38 | 0.5 | haiku | 0.054 | 13 | 33k | gate-release:frd-03-portfolio |
| 06:02:38 | 06:02:51 | 0.2 | haiku | 0.016 | 3 | 32k | port-reviewer-tests:frd-03-portfolio |
| 06:02:38 | 06:05:19 | 2.7 | haiku | 0.081 | 9 | 39k | evidence:frd-04-project-workspace |
| 06:02:38 | 06:04:31 | 1.9 | sonnet | 0.296 | 15 | 71k | find:drift:frd-04-project-workspace (fallback agentType; read the WRONG tree, §4.2) |
| 06:02:51 | 06:10:32 | 7.7 | opus | 3.280 | 50 | 104k | patch:frd-03-portfolio |
| 06:03:34 | 06:04:09 | 0.6 | haiku | 0.015 | 2 | 31k | drift-proof:frd-02-ideas-board |
| 06:04:09 | 06:04:17 | 0.1 | haiku | 0.009 | 2 | 31k | drift-record:frd-02-ideas-board |
| 06:04:17 | 06:04:45 | 0.5 | haiku | 0.040 | 8 | 33k | gate-release:frd-02-ideas-board |
| 06:04:45 | 06:08:13 | 3.5 | haiku | 0.100 | 11 | 40k | evidence:frd-05-work-orders |
| 06:04:45 | 06:07:14 | 2.5 | sonnet | 0.542 | 27 | 81k | find:drift:frd-05-work-orders (fallback agentType) |
| 06:05:19 | 06:15:07 | 9.8 | opus | 3.307 | 39 | 105k | gate:frd-04-project-workspace (slot 2) → **reopen** (#5) |
| 06:08:13 | 06:16:11 | 8.0 | opus | 2.548 | 27 | 118k | gate:frd-05-work-orders (slot 1, launched while FRD-04 still in review — BL-0194) → pass + 1 spec-drift claim |
| 06:10:32 | 06:10:44 | 0.2 | haiku | 0.014 | 3 | 31k | reviewer-test-hash:frd-03-portfolio |
| 06:10:44 | 06:15:33 | 4.8 | sonnet | 0.606 | 25 | 76k | verify-patch:frd-03-portfolio |
| 06:15:07 | 06:15:32 | 0.4 | haiku | 0.039 | 9 | 33k | gate-release:frd-04-project-workspace |
| 06:15:33 | 06:17:16 | 1.7 | haiku | 0.189 | 33 | 47k | certify-patch:frd-03-portfolio |
| 06:16:11 | 06:16:36 | 0.4 | haiku | 0.012 | 2 | 31k | drift-proof:frd-05-work-orders (**relay dropped one `]`** → cycle fault, §4.3) |
| 06:16:36 | 06:17:07 | 0.5 | haiku | 0.048 | 10 | 33k | gate-release:frd-05-work-orders |
| 06:17:16 | 06:17:21 | 0.1 | haiku | 0.005 | 2 | 30k | stale-pin:frd-02-ideas-board |
| 06:17:21 | 06:18:59 | 1.6 | haiku | 0.038 | 8 | 41k | reverify:frd-02-ideas-board (stale pin, main moved) |
| 06:18:59 | 06:20:22 | 1.4 | haiku | 0.172 | 33 | 43k | apply-gate:frd-02-ideas-board |
| 06:20:22 | 06:20:33 | 0.2 | haiku | 0.014 | 3 | 31k | port-reviewer-tests:frd-04-project-workspace |
| 06:20:33 | 06:24:38 | 4.1 | opus | 1.474 | 28 | 72k | patch:frd-04-project-workspace |
| 06:24:38 | 06:24:46 | 0.1 | haiku | 0.009 | 2 | 31k | reviewer-test-hash:frd-04-project-workspace |
| 06:24:46 | 06:28:56 | 4.2 | sonnet | 0.654 | 34 | 83k | verify-patch:frd-04-project-workspace |
| 06:28:56 | 06:30:26 | 1.5 | haiku | 0.153 | 27 | 45k | certify-patch:frd-04-project-workspace |
| 06:30:26 | 06:30:37 | 0.2 | haiku | 0.014 | 3 | 32k | port-reviewer-tests:frd-05-work-orders |
| 06:30:37 | 06:36:38 | 6.0 | opus | 3.299 | 45 | 111k | patch:frd-05-work-orders (**spurious**: docs-only blueprint rewrite, §4.3) |
| 06:36:38 | 06:36:48 | 0.2 | haiku | 0.010 | 2 | 31k | reviewer-test-hash:frd-05-work-orders |
| 06:36:48 | 06:41:08 | 4.3 | sonnet | 0.503 | 30 | 73k | verify-patch:frd-05-work-orders |
| 06:41:08 | 06:42:45 | 1.6 | haiku | 0.184 | 33 | 44k | certify-patch:frd-05-work-orders |
| 06:42:45 | 06:43:00 | 0.2 | haiku | 0.024 | 6 | 35k | safe-point |
| 06:43:00 | 06:58:09 | 15.2 | sonnet | 3.981 | 138 | 124k | visual-qa (real pass: 1 fix + 7 punch-list items) |
| 06:58:09 | 06:58:42 | 0.6 | haiku | 0.038 | 8 | 33k | close-out-verify-reuse-check |
| 06:58:42 | 07:03:06 | 4.4 | haiku | 0.309 | 48 | 54k | notify-end (full `verify.sh`, no reuse) |
| | **76.3 wall** | | | **30.625** | 960 | | 48 agents ran (+4 `error` records, 0 $) |

By model: opus 19.99 $ (265 calls), sonnet 8.77 $ (368), haiku 1.87 $ (327). By engine phase: Review 30.07 $,
Plan 0.49 $, Baseline 0.04 $, Build 0.02 $. The cache-write estimate, **+9.96 $** at 1.25× input (unverified rate),
is not folded in.

### 1.2 Phases

| Phase | Agent-min | $ | Calls | Note |
|---|---:|---:|---:|---|
| Precheck + plan | 1.6 | 0.531 | 17 | **BL-0124 fast path held.** No opus baseline, where E2 escalated for 2.5 min / 0.17 $ |
| Slot setup (pin + 2 worktrees) | 0.8 | 0.070 | 18 | |
| Evidence ×4 (digested collectors) | 12.5 | 0.332 | 38 | 2.7-3.5 min each |
| **`find:drift` ×4** | 14.5 | **3.024** | 141 | FRD-02 4.6 min / 1.094 $ / 52 calls. FRD-03 5.5 / 1.092 / 47. FRD-04 1.9 / 0.296 / 15. FRD-05 2.5 / 0.542 / 27 |
| Gates ×4 (opus, digested) | 34.8 | 11.442 | 132 | FRD-02 10.0 / 3.484 / 42. FRD-03 7.0 / 2.102 / 24. FRD-04 9.8 / 3.307 / 39. FRD-05 8.0 / 2.548 / 27 |
| drift-proof ×3 + drift-record ×2 | 1.8 | 0.060 | 10 | 1 of 3 proofs lost to a relay fault (§4.3) |
| gate-release ×4 | 2.0 | 0.182 | 40 | |
| Landing FRD-03 (port, patch, hash, verify, certify) | 14.6 | 4.105 | 114 | reopen, correct |
| Landing FRD-02 (stale-pin, reverify, apply) | 3.1 | 0.215 | 43 | PASS on a stale pin |
| Landing FRD-04 (port, patch, hash, verify, certify) | 10.1 | 2.303 | 94 | reopen, correct |
| **Landing FRD-05 (port, patch, hash, verify, certify)** | 12.3 | **4.010** | 113 | **spurious** (§4.3). A PASS landing would have cost ≈ 3 min / ≈ 0.2 $ |
| Safe-point | 0.2 | 0.024 | 6 | |
| Visual-qa | 15.2 | 3.981 | 138 | real pass (§5.6) |
| Close-out (reuse-check + notify-end) | 4.9 | 0.347 | 56 | full `verify.sh`, BL-0179 `scope-not-eligible` |
| **Total** | **76.3 wall** | **30.625** | 960 | +9.96 $ cache-write, estimated |

Σ evidence + finder + gate = **14.798 $**:

- vs E2's evidence + gate: 9.26 $, so **+60 %**.
- vs D2's gates: 24.61 $, so **−40 %**.
- vs F1's gates (core): 23.38 $, so **−37 %**.

Per FRD, all of evidence + finder + gate + landing: FRD-02 4.93 $, FRD-03 7.46 $, FRD-04 6.03 $, FRD-05 7.26 $.

### 1.3 Concurrency, gate segment and idle slots

- **`concurrency_max` 4**, the highest of any replay (E2 3, F1 3). Time at each level: 1 agent 47.7 min,
  2 agents 12.3, 3 agents 9.0, 4 agents 7.3. The opus judges ran two at a time for 15.2 min.
- **The finder is on the gate's critical path when it is the slower sidecar.** The gate awaits it (engine
  `await awaitDriftFinding(frd)` before building the prompt).
  - FRD-02: collector 3.0 min, finder 4.6 min. The gate started 1.6 min later than it would have without the
    finder.
  - FRD-03: collector 3.4 min, finder 5.5 min, so +2.1 min.
  - FRD-04 and FRD-05: the collector was the slower sidecar, so +0.
  - **≈ 3.7 min** of finder-induced gate delay in total.
- **Start → first verdict: 14.6 min** (gate:frd-03 end 06:01:27.6). E2 took 14.3 min and F1 13.8 min.
- **All four gates had launched by minute 21.4** (gate:frd-05 at 06:08:13). E2 took 46.5 min (gate:frd-05
  01:24:07 vs 00:37:36), and F1 about 19.9 min (gate:frd-05 04:41:28).
- **Idle slot-minutes waiting on a gate-ready FRD: 0.** Slot 2 took FRD-04 at 06:02:38.4, the same second that
  FRD-03's release ended. Slot 1 took FRD-05 at 06:04:45.9, the same second FRD-02's ended. For comparison, E2 had
  39.9 slot-minutes idle, and F1 had ≈ 0.
- **Gate segment** (pin 05:48:27.4 → last landing, certify-patch:frd-05 end 06:42:45.7): **54.3 min**. That is
  **81 %** of D2's 66.9-min serial equivalent; the pre-registered bar was ≤ 60 %. E2 was 55.0 min (82 %) and F1
  63.8 min (95 %).
- **The landing lane is the new bottleneck.** It ran without a break from 06:02:38 (port:frd-03) to 06:42:45
  (certify:frd-05): **40.1 min, 74 % of the segment**.
  - FRD-02's PASS was ready at 06:04:46 and waited **12.5 min** in the lane behind FRD-03's patch ladder.
  - Without the spurious FRD-05 ladder, the segment projects to ≈ 45 min, ≈ 67 % of serial (PROJECTION).

### 1.4 Gate by gate: F2 vs E2 vs F1 vs D2

| FRD | D2 `explore` min / $ / calls / ctx | E2 `digested` ev+gate min / $ · calls / ctx | F1 `explore`+scope min / $ / calls / ctx | **F2 ev + finder + gate $ · gate calls / ctx** | F2 verdict |
|---|---|---|---|---|---|
| 02 | 17.60 / 7.48 / 80 / 143k | 9.20 / 1.95 · 24 / 95k | 15.3 / 7.254 / 80 / 135k | **4.649 · 42 / 109k** | pass + 2 proven drift cards (not ground truth) |
| 03 | 11.84 / 5.77 / 66 / 126k | 14.58 / 3.16 · 32 / 105k | 11.5 / 5.092 / 59 / 117k | **3.275 · 24 / 100k** | reopen (#3, #4) + #2 carded |
| 04 | 13.53 / 6.46 / 78 / 125k | 11.39 / 2.05 · 21 / 92k | 11.6 / 6.801 / 84 / 124k | **3.684 · 39 / 105k** | reopen (#5) |
| 05 | 9.63 / 4.89 / 59 / 130k | 12.26 / 2.10 · 25 / 94k | 13.6 / 4.230 / 56 / 110k | **3.190 · 27 / 118k** | pass + spec drift (mis-routed, §4.3) |
| **Σ** | **52.6 / 24.61** | **47.4 / 9.26** | **52.0 / 23.38** | **14.80** | |

F2's opus gates ran 24-42 calls at 100-118k of context per call. That is more than E2 (21-32 calls, 92-105k): the
finder report sits in the prompt, and some judges went past the reads the digest offered them. It is still far
below `explore` (56-84 calls, 110-143k).

### 1.5 Per verified WO: F2 vs F1 vs E2 vs D2 vs baseline

| Run | Config | Wall min | $ real | WOs | **min / WO** | **$ / WO** | vs baseline (time / cost) | Parity (5 known defects) |
|---|---|---:|---:|---:|---:|---:|---|---|
| FRD-24 baseline | serial, with build | 64.8 | 13.05 | 2 | 32.4 | 6.53 | 1.00× / 1.00× | n/a |
| D2 | `explore`, serial gates, with build | 87.5 | 36.24 | 4 | 21.9 | 9.06 | 1.48× / 0.72× | 4/5 (lost #4) |
| E2 | `digested` + parallel, visual-qa no-op | 65.1 | 15.20 | 4 | 16.3 | 3.80 | 1.99× / 1.72× | **2/5** |
| F1 | `explore` + scope + parallel | 83.5 | 44.04 | 4 | 20.9 | 11.01 | 1.55× / 0.59× | 4/5 + #4 partial |
| **F2** | `digested` + finder + parallel | **76.3** | **30.63** | 4 | **19.1** | **7.66** | **1.70× / 0.85×** | **4/5 (lost #1)** |
| F2 without the spurious FRD-05 ladder *(PROJECTION)* | same | ≈ 67.0 | ≈ 26.8 | 4 | ≈ 16.8 | ≈ 6.71 | ≈ 1.93× / ≈ 0.97× | same |
| F2 composite *(PROJECTION: + D2's build wave 8.5 min / 4.43 $ + foundation-gate 0.99 / 0.48)* | | ≈ 85.8 | ≈ 35.5 | 4 | ≈ 21.4 | ≈ 8.88 | ≈ 1.51× / ≈ 0.74× | |
| F1 composite *(PROJECTION, same additions)* | | ≈ 93.0 | ≈ 49.0 | 4 | ≈ 23.2 | ≈ 12.24 | ≈ 1.39× / ≈ 0.53× | |
| 4× target | | | | | 8.1 | 1.63 | 4× / 4× | |
| Red-team bar (38 addendum) | | | | | ≤ 20 | ≤ 7.5 | | |

F2 vs D2 per WO: **1.15× time, 1.18× cost**. F2 vs F1: 1.09× time, 1.44× cost. F2 raw meets the time bar (19.1 ≤ 20)
and misses the cost bar by 0.16 $/WO. Without the spurious ladder it meets both (PROJECTION).

**Like-for-like against E2's ≤ +25 % cost criterion:**

| | $ |
|---|---:|
| F2 as measured | 30.63 |
| minus visual-qa (E2's did nothing) | − 3.98 |
| minus the spurious FRD-05 ladder, net of the ≈ 0.2 $ PASS landing it replaced | − 3.81 |
| **F2 like-for-like** | **22.84** |
| E2 (15.20 minus its 0.03 $ visual-qa) | 15.17 |

That is **+51 %**, still over the +25 % bar. What drives it: the finder (+3.02 $), heavier opus gates (+2.61 $),
and costlier patch ladders on FRD-03/04 (+2.04 $).

---

## 2. Finding parity (the central question)

### 2.1 The five known defects

| # | Defect | Finder (`find:drift`) | Judge (opus, digested) | DR-122 proof | Ended as | E2 (digested, no finder) | F1 (`explore`) |
|---|---|---|---|---|---|---|---|
| 1 | AC-02-010.8 Campaign fichas lack current-factory content (`phases.ts`) | **not inventoried**: 21 contracts, AC-02-010.8 absent; grouped as ".1/.2/.3", ".4" checked (team arrays), ".9" checked; opened `phases.ts` 4× | **pass** ("AC-02-010.1..10 … pass" in one row); 0 touches of `phases.ts` | — | **lost** | lost | found, carded |
| 2 | REQ-03-001 `ACTIVE_PHASES` includes `architecture` | **drift**, probe `req-03-001.finder.drift-probe.ts` | adopted the finder's entry ("the judge already recorded it as a fail; its entry governs", BL-0203) | proven: identical assertion at pin `7b44a772` and base `d9addc89` | **drift card** `frd-03-portfolio-drift-req-03-001.md` | lost | found, carded |
| 3 | `formatLastSync` V8 lenient `Date.parse` | **false "implemented"**: quoted a "strict ISO-8601 regex plus isRealCalendarDay()" that exists only on the factory `main` checkout, not at the pin (§4.2) | **fail** AC-03-007.2 (independent of the finder) | n/a (cycle) | **reopen** → fixed `2d3834dc` | lost | found |
| 4 | REQ-03-007 chip only on unmounted `PortfolioTable` | **drift** (claim `cycle`) | **fail** REQ-03-007 | n/a (cycle) | **reopen** → chip mounted on the rail, `2d3834dc` | found | seen, waved off (partial) |
| 5 | `formatChangeDate` UTC day + lenient parse | **false "implemented"** (same wrong-tree cause) | **fail** AC-04-011.1/.2 + limit/error rows | n/a (cycle) | **reopen** → fixed `0a8f7112` | found | found |
| | **Recall** | **2/5** | **3/5 on its own; 4/5 with the finder's #2** | | **4/5** | **2/5** | **4/5 + partial** |

The ground truth still holds at pin `7b44a772`. `phases.ts` has 0 matches for "Claude Design|components.md|foundation",
and `portfolio.ts:329-330` still lists `"architecture"` in `ACTIVE_PHASES`.

**What the finder bought, vs E2's plain `digested`:** one defect, #2. That is the out-of-diff drift the 8-read budget
structurally cannot reach. **What it did not buy:** #1, the other out-of-diff drift, even though its own prompt
describes that exact defect.

**Is #1 a finder lapse or structural?** Structural so far. #1 needs a literal comparison of a long AC text
(the Design ficha must name Claude Design, `components.md` and the tokens; the Architecture ficha must name
foundation) against string content in a data file. The finder did open `phases.ts`, but it inventoried the Campaign
ACs as a group and checked only the structural ones (order, team arrays). `explore` found it in 2/2 runs, with 9
touches of `phases.ts` in D2.

### 2.2 The finder's claims, the tool budget, and what the engine discarded

- **Claims (`drift`):** 3 in total, all true.
  - REQ-03-001: proven and carded.
  - REQ-03-007: a cycle claim, which the judge also made.
  - FRD-05 blueprint staleness: a spec-direction drift, genuinely stale (`blueprint.md` `last_updated` 2026-06-21,
    REQ table lacks the Fail column and REQ-05-007).
- **Discarded by the engine:**
  - **0 claims were refuted by a DR-122 proof.**
  - 2 were merged under a judge entry (BL-0203 dedupe; not wrong, just duplicates).
  - 1 FRD-05 claim was mis-routed by the relay fault (§4.3). That was the engine's fault, not the claim's.
- **Unreliable `implemented`:** 2 false negatives (#3, #5), both from the wrong-tree read. They are the more
  dangerous error class, because "a false `implemented` hides the defect" (the directive's own words). Here the
  opus judge overrode both.
- **`unknown`:** 5 (FRD-02 2, FRD-04 3). All honest, with a stated reason.
- **Tool budget (cap 60, prompt-enforced only):** respected.

  | FRD | billed calls | self-reported `toolCalls` | `budgetExhausted` |
  |---|---:|---:|---|
  | 02 | 52 | 34 | false |
  | 03 | 47 | 27 | false |
  | 04 | 15 | 8 | false |
  | 05 | 27 | 17 | false |

  - The self-count undercounts billed calls by 35-47 %.
  - The FRD-04 finder wrote in prose that "the 60-call budget was spent" at 15 billed calls, which is false. Its
    3 `unknown`s were a choice, not exhaustion.
- **Judge-originated drift claims (not ground truth):**
  - **AC-02-011.1** and **AC-02-013.1**: the spec and architecture digest readers `catch { return null }` on a
    present-but-unreadable file, while the FRD says "the reader is fail-loud (DR-078)". `read-spec.ts`'s own
    comment admits the degrade. The finder had marked this "implemented", reading the FRD's "missing digest is the
    absent state" clause.
  - Both were proven pre-existing and carded (`frd-02-ideas-board-drift-ac-02-011-1.md`, `…-ac-02-013-1.md`).
  - I count them as plausible true positives of low severity. Owner intent is not verified.

### 2.3 Contamination: F2 is not a blind test of the finder

The finder directive (`pandacorp-build.js` line 102 in the F2 engine artifact, identical in the MC overlay on `main`)
quotes all five ground-truth defects as examples:

- `ACTIVE_PHASES` still containing `"architecture"`;
- "the Campaign cards had lost the current-factory content in a revert";
- "a surface the spec requires is MOUNTED";
- `"N/A 3"` / `"2026-02-30"`;
- "a UTC calendar day is not the local day".

The judge prompts do not (grep: the only hit is line 102). So:

- **#2's recovery is not blind evidence.** The finder was pointed at the exact set.
- **Missing #1 despite the hint is strong negative evidence.**

Any future finder canary must use a held-out defect set, or a replay whose defects the directive does not name.

---

## 3. Comparison with E2 and F1 (same code, same ground truth)

| | E2 `digested` | **F2 `digested` + finder** | F1 `explore` (+scope) |
|---|---|---|---|
| Out-of-diff drift (#1, #2) | 0/2 | **1/2** (#2) | 2/2 |
| In-diff CORRECTION (#3, #4, #5) | 2/3 | **3/3** | 2/3 + partial |
| Σ review $ (evidence + finder + gate) | 9.26 | **14.80** | 23.38 (+6.54 repair loop) |
| Run total $ | 15.20 | **30.63** | 44.04 |
| Run wall min | 65.1 | **76.3** | 83.5 |

The honest reading:

- **`digested` + finder is cheaper and faster than `explore`, with the same recall count.**
- **The sets differ, though.** It trades the out-of-diff content drift #1 for a cleaner in-diff record. The in-diff
  difference (#3 in F2, not in E2; #4 in F2, only partially in F1) matches the judge variance already seen at
  n = 1-2.
- **The out-of-diff difference (#1) is the only systematic one,** at 0/3 digested vs 2/2 explore.

---

## 4. The 4 agents in `error`, and the other new defects

### 4.1 The 4 `error` records: stale agent registry, not budget, not 429, not mech

- **What they were:** indices 6, 9, 18 and 25, one `find:drift:<frd>` per FRD. The error, verbatim:
  `agent({agentType}): agent type 'pandacorp:drift-finder' not found. Available agents: …`. The list has no
  `drift-finder`.
- **The cause:** the launching session's agent registry predates 9.115.1.
  - `plugin/agents/drift-finder.md` exists, and so does the installed cache `…/pandacorp/9.115.1/agents/drift-finder.md`
    (installed 04:20Z, `installed_plugins.json`).
  - But the session that launched F2 resolves its hooks from `…/pandacorp/9.109.0/…`: a `PreToolUse:Bash hook error:
    [bash "/Users/sergio/.claude/plugins/cache/panda-corp/pandacorp/9.109.0/scripts/block-dangerous.sh"]` appears in
    the transcripts, 52 lines reference `9.109.0`.
  - Plugin changes apply on session restart, so agent types added after the session started do not exist in it.
- **What it was not:** 0 API errors in the transcripts (no `isApiErrorMessage`, no `rate_limit` or
  `overloaded_error`). It was not budget (the records never started), and not mech.
- **The effect:**
  - The engine's `fallbackAgentType` fired 4/4 (engine log "usando pandacorp:reviewer como fallback"). Each fallback
    was queued 13 ms after its error, so **0 s and 0 $ were lost, and no finding was lost directly**.
  - The finders ran with the reviewer agent's system prompt and its Write/Edit tools, instead of the read-only
    `Read, Grep, Glob, Bash` definition. The task prompt carried the whole method, so the specialised definition's
    absence is not shown to have changed any result.
  - The definition has no cwd guidance either, so it would not have prevented §4.2.

### 4.2 Two finders audited the wrong tree (cwd resets between Bash calls)

**What happened.** Each finder was told to `cd` into the pinned slot first. It did so in its first Bash call. Every
later call without an explicit `cd` ran from the launching session's cwd:
`/Users/Shared/Proyectos/panda-corp/mission-control`, the factory `main` checkout, where F1/D2's fixes have landed.

**How many calls carried the slot path:**

| Finder | Bash calls with the slot path |
|---|---:|
| FRD-02 | 50 / 50 |
| FRD-03 | **2 / 42** |
| FRD-04 | **1 / 13** |
| FRD-05 | 25 / 26 |

**The proof:**

- FRD-03's finder ran `cat src/lib/portfolio/formatLastSync.ts` and got a file containing `isRealCalendarDay` /
  `ISO_DATE_TIME`. `git show 7b44a772:…/formatLastSync.ts` has neither (`Date.parse` + `Number.isNaN` only); `main`'s
  copy has both (commit `0ecdc144`, not an ancestor of the pin).
- FRD-04's finder listed `ChangesPanel.relativeDate.reviewer.test.tsx`: 0 matches in `git ls-tree 7b44a772`, present
  on `main`.

**The effect:**

- The 2 false "implemented" on #3 and #5.
- FRD-03's #2/#4 claims happen to hold in both trees. Its probes were written by absolute path into the slot, so the
  DR-122 proof itself ran at the right commits.

**Sibling risk.** The opus gates prefix most calls (35/40, 22/24, 30/38, 25/27). Their verdicts match the pin code,
but the un-prefixed calls were not audited one by one.

### 4.3 A mech relay fault reopened FRD-05 on a proven pre-existing drift

- **What the proof said.** `drift-proof:frd-05` (haiku mech) ran `drift-proof.mjs prove`. Its stdout, a 2,207-char
  JSON, **parses**: re-parsed from the transcript's tool_result. It proved the judge's spec-drift probe
  (`blueprint-req-05-001.drift-probe.ts`) fails identically at pin and base.
- **What broke.** The agent relayed it by hand into `output`, and **dropped one `]`** (`…"}]}],"cleanup"` →
  `…"}],"cleanup"`, 2,205 chars, `Expecting ',' delimiter` at char 2205).
- **The engine's reaction.** It logged "the drift-proof output is not valid JSON — every drift claim stays a cycle
  fault (BL-0178 fail-closed)" and routed it patch-first. Fail-closed is the right default, but here it turned a
  proven pre-existing spec drift into a reopen.
- **The cost:** `patch:frd-05` (opus, 6.0 min, 3.30 $) rewrote `blueprint.md` §1 (`b2be2723`, docs-only), and a full
  verify/certify ladder followed. In total **12.3 min on the critical tail and 4.01 $**, with no owner card.
- **A telemetry side effect.** `track.jsonl` records FRD-05 as `review_end pass` only. There is no reopen line,
  unlike FRD-03/04.
- **The fix direction:** the engine reads the proof from a file written by `drift-proof.mjs`. A model must never
  transcribe machine JSON.

### 4.4 Other observations

- **The agent-weight cap is saturated.** Engine log: "Agent ceiling reached (60 ≥ maxAgents 60) but no work remains
  (F5/BL-0177)". A 4-FRD, gates-only replay with the finder used the whole `maxAgents: 60` weight. One more reopen
  would have ended the run as an agent-cap stop.
- **REQ-04-003 is surfaced again but still not carded.** It is the "Mission Objectives" detailed bar: F1 proved it
  pre-existing and never carded it, and F2's visual-qa put it on the punch list as a structural spec/blueprint gap.
- **The repair brake is still coarse.** Engine log: "repair brake on agent-weight, usage unreliable — 2 parallel
  gate(s) were reviewing while its repair rung ran" (D1/BL-0138, known).

---

## 5. Fixes exercised live

| Fix | Exercised? | Evidence |
|---|---|---|
| **BL-0194** (a dependent gate launches freely; only its landing is ordered) | **Yes.** FRD-05 (deps include frd-04) gated 06:08:13-06:16:11 while FRD-04's gate ran 06:05:19-06:15:07. Its landing started at 06:30:26.2, the same instant FRD-04's certify ended. All 4 gates had launched by minute 21.4 (E2 46.5) | per-agent table; `track.jsonl` `review_start frd-05` 06:08:20 |
| **BL-0192** (the lane does not starve slots) | **Yes, for slot refill:** 0-s gaps at 06:02:38.4 and 06:04:45.9. **The lane itself is serial:** FRD-02's PASS waited 12.5 min behind FRD-03's ladder, and the lane was busy for 40.1 min without a break | §1.3 |
| **BL-0191** (certify after an independent verify) | **Yes, 3/3:** FRD-03, 04, 05 each ran verify-patch → certify-patch, "VERIFIED (patched in place, independently verified)". 0 reverts | engine log ×3 |
| **BL-0193** (bounded collector) | **Yes.** 2.7-3.5 min each, 0 `no such file … evidence-verify.log` residues (E2 had 2) | transcript grep |
| **BL-0124** (nested-project baseline) | **Yes.** Precheck returned `projectPrefix:"mission-control/"`, and the engine took the fast path ("Baseline verde (fast path BL-0124…)"). No opus baseline | engine log line 2 |
| **DR-122** (differential drift proof) | **2 of 3 proofs valid**, proving 3 pre-existing drifts (REQ-03-001, AC-02-011.1, AC-02-013.1); 2 `drift-record` agents wrote 3 cards. The 3rd was lost to the relay fault (§4.3) | `drift-proof:*` outputs; `.pandacorp/inbox/changes/*-drift-*.md` |
| **BL-0203** (drift finder) | Ran 4/4 via fallback. 3 true drift claims, 0 refuted, 2 false "implemented" (wrong tree), 5 honest unknowns; recall contribution #2 | §2 |
| **BL-0179** (close-out verify reuse) | **Did not fire** (`canReuse:false, reason:"scope-not-eligible"`, `reportScope:"since"`), the same as F1. notify-end re-ran the full `verify.sh` (4.4 min, 48 calls) | `close-out-verify-reuse-check` output |
| **Slot hygiene** | Both slots clean at the end (`git status` empty, detached at `7b44a772`); 0 legacy fallbacks (no "legacy" line in the engine log) | `git -C gate-worktree-N status` |

### 5.6 Visual-qa did real work

It ran 15.2 min, 3.98 $, 138 calls, sonnet: the costliest single sonnet agent, and 13 % of the run.

- **One bounded fix** was committed: `e3083d5e`, the FRD filter chip's `maxWidth: 200px` let a long FRD slug be
  painted over by the next chip. A focused `verify.sh --since 53ab6a72` was green.
- **Seven items went to `.pandacorp/comms/visual-punch-list.md`:**
  - two a11y (non-focusable raw-date tooltip; two "Todos" buttons with the same accessible name);
  - one i18n ("To do" among Spanish pills);
  - one label asymmetry;
  - one DR-115 duplicate map;
  - REQ-04-003 as a structural gap;
  - one Campaña scrim legibility nit.
- **The cost is in line with D2 and F1.** D2's visual-qa was 12.05 min / 3.01 $, F1's 13.2 min / 3.63 $. E2's was a
  no-op, so E2's totals understate a real run by about that much.

---

## 6. Verdict on the defaults (decision; the plugin change is a separate follow-up)

The rule: a flag is on by default only with a clear gain and no lost findings. "Lost finding" means a ground-truth
defect that the default configuration finds and the candidate does not.

| Flag | Default | Criterion → measured | Why |
|---|---|---|---|
| `gateEvidence` | **`explore`** (unchanged) | ≥ 4/5 recall including #1 and #2 → `digested` + finder **4/5 without #1**. `explore` 4/5 with #1 (D2 and F1) | `digested` + finder is cheaper (Σ review −37 % vs F1) and faster (−7 min), but it **loses #1 in 3/3 digested runs**, a defect `explore` finds in 2/2. See the trade-off below |
| `driftFinder` | **coupled to `digested`** (the engine default: on only when `gateEvidence:'digested'`) | recovered #2 (primed); cost 0.76 $/FRD; adds ≈ 1-2 min to a gate's start when it is the slower sidecar | `digested` without it is strictly worse (2/5), so keep the coupling. It is **not validated**: 2 of 4 finders read the wrong tree, the prompt names the answer key, and it ran under a fallback agent type. **It cannot justify a flip of `gateEvidence`** until it is re-measured blind after the §4.2 fix |
| `parallelGates` | **on**, `gateSlots: 2` (**deviates from the pre-registered bar**) | segment ≤ 60 % of serial → **not met in any run** (E2 82 %, F1 95 %, F2 81 %). No-regression evidence: 3/3 runs with 0 legacy fallbacks, both slots clean, 0 `last_green_sha` violations (E2 audit; not re-audited for F1/F2); 0 idle slot-minutes after BL-0194 (F1, F2); no parity loss (F1 `explore`+parallel 4/5 = D2 serial 4/5); cost overhead ≈ 0.3-0.4 $ per run (F2: slots 0.07 + releases 0.18 + stale-pin/reverify 0.04; E2: +0.38 $) | The 60 % bar assumed the gates were the bottleneck. F2 shows they no longer are: the serial landing lane is 74 % of the segment. Parallel gates remove all the gate-wait they can, and the rest is lane plus close-out. With no measured downside and a consistent segment gain vs serial (−5 % to −19 %), on is the right default. **Owner may veto** on the grounds that the pre-registered bar failed. The residual risks (RAM on 16 GB with 2 dev servers, the agent-weight cap) were not measured |
| `gateContextScope` | **off; propose retiring it** | ≥ 25 % review-cost cut → F1: context/call −7.3 %, calls unchanged (56-84), Σ gate cost −5 % | The cost driver is turns, not per-turn context, and this flag cannot cut turns. Retiring the code path removes a branch for nothing measured |
| `gateInventoryCache` | **off** | not measured (needs the repeat-gate canary, 38 §A6 #6) | No evidence |
| `driftPolicy` | **`record`** (unchanged) | F1: 5 differential proofs sound; F2: 2/2 parsed proofs sound | No counter-evidence. The §4.3 relay fault is an engine defect, not a policy defect |

### The `explore` vs `digested` + finder trade-off, and the decision

- **What each buys.**
  - `digested` + finder saves about 8.6 $ of review per 4 FRDs, ≈ 2.1 $ per FRD gate. It finds the in-diff
    CORRECTIONs, which block and matter most, as well as `explore` does (3/3 here).
  - `explore` additionally catches out-of-diff *content* drift like #1. That drift never blocks (DR-122 files it as
    a card), but it goes unreported under `digested`.
- **The suggested hybrid would not recover #1.** That hybrid was "`explore` only on the first gate of an FRD never
  gated with the whole-FRD oracle", and FRD-02 had been gated before the drift appeared (E2 report §5, confirmed
  here).
- **A hybrid that would work is not measured.** For example, `explore` whenever commits outside the reviewed WOs'
  artifacts have touched files mapped to the FRD's contracts since its last `explore` gate, or a periodic whole-FRD
  `explore` drift sweep at milestone close.
- **Decision: `explore` stays the default.** `digested` + finder stays an opt-in cost mode for runs where the owner
  accepts that out-of-diff content drift may go unreported.
- **Re-open this decision** after a blind re-measure of the finder, meeting these conditions:
  1. the §4.2 cwd defect is fixed;
  2. the §4.3 relay is removed;
  3. the directive's examples do not name the test's defects;
  4. recall is ≥ the `explore` set on the same replay, #1 included.

---

## 7. Sprint verdict (final)

- **Best measured configuration with parity ≥ 4/5: F2** (`digested` + finder + parallel).
  - Per verified WO: **19.1 min / 7.66 $**, i.e. **1.70× faster, and 1.17× the baseline's cost** (0.85× cost
    factor).
  - ≈ 1.93× / 0.97× without the spurious ladder (PROJECTION).
  - vs D2: **1.15× / 1.18×**.
  - But it loses #1, and its finder is not validated.
- **The default adopted here** (`explore` + `parallelGates`, i.e. F1 without `gateContextScope`, which showed no
  effect): **F1 1.55× time / 0.59× cost** raw. That is 1.69× the baseline's cost per WO; 6.54 $ of F1's total (1.64 $/WO) is
  the one-off BL-0001 repair loop. As a composite with the build wave, ≈ 1.39× / ≈ 0.53× (PROJECTION).
- **4×: not reached, and not reachable with this pipeline shape.** On F2's measured spans:

  | Stage | min | $ |
  |---|---:|---:|
  | Serial landing lane | 40.1 | |
  | Visual-qa | 15.2 | |
  | Close-out | 4.9 | |
  | **Total per 4 WOs** | **≈ 60** | |
  | **Per WO** | **≈ 15** | |
  | Opus judges (4 gates) | | ≈ 11.4 |
  | 4× target per WO | 8.1 | 1.63 |

  The first three stages alone take ≈ 15 min per WO before any gate runs, almost twice the time target. The opus
  judges alone cost ≈ 2.9 $ per WO, 1.7× the cost target.
- **What the sprint did deliver:**
  - parallel gates that are clean, with 0 idle slots (BL-0194);
  - a certify-then-land patch path (BL-0191, 5/5 across E2 and F2);
  - a bounded collector;
  - the nested-project baseline fast path;
  - DR-122 proofs that are methodologically sound;
  - a ground-truth corpus that caught a contaminated finder and a wrong-tree read.
- **What remains, by measured leverage:**
  1. **The landing lane (40 min of a 54-min segment).** Overlap the verify/certify of independent FRDs' ladders, or
     land several PASSes behind one verify.
  2. **Visual-qa (13-15 min, 3-4 $).** Scope it to the routes the landed diff touched.
  3. **Close-out reuse (BL-0179)** has never fired in a multi-FRD run: 4.4-4.9 min every run.
  4. **The F2 defects:**
     - §4.2 cwd (affects any slot agent);
     - §4.3 mech relay of machine JSON;
     - §4.1 stale-registry preflight (check the session's loaded plugin version against the installed one before
       launch);
     - the agent-weight cap with the finder;
     - the finder directive's answer-key examples.
  5. **Only then, a blind finder re-measure** (the §6 re-open condition).
  6. **Cache-write cost is unpriced:** +9.96 $ estimated on F2 (+33 %), not verified.

## 8. Proposed backlog items (not filed)

1. Slot agents lose their `cd` between Bash calls. They read the launching session's tree, not the pin (§4.2).
   Every slot prompt should demand `cd <slot> && …` per call, or absolute paths, and the finder should echo
   `git rev-parse HEAD` next to each evidence quote.
2. `drift-proof` output is relayed by a model and can be corrupted (§4.3). The engine should read a result file.
   Sibling audit: every mech step whose output the engine parses as JSON.
3. Preflight should refuse to launch, or warn, when the session's loaded plugin version is older than the
   installed one. Agent types added since then do not exist in the session (§4.1).
4. The finder directive names the canary ground truth. Keep the generic checks, and move canary-specific examples
   out of the prompt (§2.3).
5. `maxAgents` weight is saturated by the finder on 4 FRDs. Scale the default, or count the finder's weight
   separately (§4.4).
6. `track.jsonl` misses the reopen line when a reopen comes from the engine's fail-closed routing rather than the
   judge's verdict (§4.3).
7. REQ-04-003 drift is proven (F1) and surfaced (F2 visual-qa), but still has no card (§4.4).

## 9. Not verified

- **Judge variance:** n = 1 per FRD per mode. The in-diff differences between F1/F2/E2 (#3, #4) are not
  attributable.
- **Whether the finder would have found #1 with the right agent definition, or without the hints.** It did not
  with them.
- **The owner's intended semantics for AC-02-011.1/013.1.** "Fail-loud" vs "absent state" for an unreadable digest.
- **Whether the opus gates' un-prefixed Bash calls read the wrong tree anywhere.** Their verdicts match the pin; the
  calls were not audited individually.
- **Exactly when the launching session loaded plugin 9.109.0.** The 9.109.0 hook paths in the transcripts are the
  evidence; I did not read the session's own start record.
- **The PROJECTION rows** (F2 without the spurious ladder; the composites). They are arithmetic over measured spans,
  not runs.
- **The cache-write rate** (1.25× input) and the opus-5-5 price (assumed equal to opus-5).
- **`vm_stat` / RAM contention** with 2 slots and `concurrency_max` 4. Not captured.
- **`last_green_sha` publications in F2** (`8dd7532b`, `3a6fe077`, `263746ce`, `3f96850e`). Not audited against
  their landings (BL-0190 still open).
