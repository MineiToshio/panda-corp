# Canary F1: report

- **Run:** workflow `wf_d8545504-d0a`, engine ≥ 9.114.0 (worktree `/Users/Shared/Proyectos/panda-corp-canary-f1`),
  replay base `c575adfc` (same code as D2/E2), pin `7740eb95`. **Args:** `mode:powerful, maxAgents:60,
  parallelGates:true, gateSlots:2, gateEvidence:'explore', gateContextScope:true`, frds 02/03/04/05.
- **Result:** 4/4 FRDs VERIFIED (`frd_end` for frd-02/03/04/05 in `track.jsonl`), 0 blocked, close-out
  `notify-end` ran the full `verify.sh` (`close-out-verify-reuse-check`: `reportGreen:true, dirty:false,
  canReuse:false, reason:"scope-not-eligible"`, same non-firing BL-0179 class as E2). 41 agents.
- **Wall clock:** first agent 04:21:36.819Z (`baseline-precheck`), last agent end 05:45:07.101Z
  (`notify-end`), **83.5 min** (matches the brief exactly).
- **Measurement:** `usage-rollup.mjs` 9.115.1 (BL-0181 dedupe) run over the run dir, joined to
  `workflows/wf_d8545504-d0a.json`. Appended as `usage_summary` (`canary:"F1"`) to this canary's
  `mission-control/.pandacorp/track.jsonl` (line 83, uncommitted in the canary worktree — F1 is
  read-only for this measurement per the task's own constraint).

---

## Executive summary (≤15 lines)

**F1 preserves the D2 finding parity it was built to prove, but misses every cost/time bar it was
pre-registered against.** Recall: 4/5 clean (#1 AC-02-010.8, #2 REQ-03-001, #3 `formatLastSync` lenient
parse, #5 `formatChangeDate`), all four filed through a correct DR-122 differential proof (identical
failure at HEAD and BASE). #4 (chip on unmounted `PortfolioTable`) was **seen** by the gate — its own
report says so explicitly — but explicitly waved off as "matches what the owner's change card asked
for", so it never became a blocking or drift finding; call it a partial. BL-0194 is fully fixed live:
FRD-05's gate launched at 04:41 while FRD-04 was still reopened, but FRD-05's *landing* correctly waited
for FRD-04's certify to land first (05:24 reverify, after FRD-04's 05:23 certify) — **0 idle slot-minutes**
waiting on a gate-ready FRD (vs E2's 39.9). But `gateContextScope` did not deliver the hoped-for cost cut:
gate calls stayed at D2's `explore` volume (56-84, not E2's 21-32) and context per gate turn fell only
5-15% (110-135k vs D2's 125-143k) — nowhere near the −25% cost bar. Total run: **83.5 min / $44.04 real
($54.67 with estimated cache-write)**, worse than BOTH comparators on wall-clock (D2 87.5 min, E2 65.1
min — F1 sits between them but closer to D2) and cost (D2 $36.24, E2 $15.20 — F1 is the most expensive of
the three). A new BL-0001 "gate-test-repair" cycle fired for FRD-02 (a reviewer-authored drift probe was
itself over-broad/unsatisfiable) adding 12.1 min / $6.54 not present in D2/E2's pipelines. A confirmed
preexisting drift (REQ-04-003, FRD-04) never got a `drift-record` card — an asymmetry with FRD-02/03.
**Verdict: criteria not met.** Recall bar: pass. Cost bar (≤$18.5 Σ gate): fail ($23.38 core / $29.92 with
repair). Gate-segment bar (≤40.1 min): fail (~63.8 min, 95% of D2's serial-equivalent — barely better than
running gates in series). Total-time-vs-E2 bar: fail (83.5 min > 65.1 min).

---

## 1. Measurement

### 1.1 Per-agent table (chronological, `$` = billed input+output+cache-read; `cw est.` = cache-creation at
1.25× input, estimated only)

| Start (UTC) | End | Min | Model | $ | Calls | ctx/call | Label |
|---|---|---:|---|---:|---:|---:|---|
| 04:21:36.8 | 04:22:09.3 | 0.5 | haiku | 0.039 | 8 | 35.2k | baseline-precheck |
| 04:22:09.3 | 04:23:24.8 | 1.3 | opus | 0.572 | 12 | 63.7k | plan |
| 04:23:24.9 | 04:23:28.7 | 0.1 | haiku | 0.005 | 2 | 30.0k | pin (4 FRDs) |
| 04:23:28.7 | 04:23:56.3 | 0.5 | haiku | 0.035 | 8 | 32.8k | gate-worktree:1 |
| 04:23:28.7 | 04:23:54.0 | 0.4 | haiku | 0.031 | 7 | 32.6k | gate-worktree:2 |
| 04:23:54.9 | 04:35:24.6 | 11.5 | opus | 5.092 | 59 | 116.5k | gate:frd-03-portfolio (slot 2) → **reopen** |
| 04:23:56.3 | 04:39:16.8 | 15.3 | opus | 7.254 | 80 | 135.2k | gate:frd-02-ideas-board (slot 1) → **pass w/ drift** |
| 04:35:24.7 | 04:35:56.6 | 0.5 | haiku | 0.011 | 2 | 30.9k | drift-proof:frd-03 |
| 04:35:56.7 | 04:36:03.9 | 0.1 | haiku | 0.008 | 2 | 30.6k | drift-record:frd-03 → 1 card written |
| 04:36:03.9 | 04:36:34.5 | 0.5 | haiku | 0.040 | 9 | 32.8k | gate-release:frd-03 |
| 04:36:34.5 | 04:36:45.1 | 0.2 | haiku | 0.013 | 3 | 31.4k | port-reviewer-tests:frd-03 |
| 04:36:34.5 | 04:48:07.6 | 11.6 | opus | 6.801 | 84 | 124.0k | gate:frd-04-project-workspace (slot 2) → **reopen** |
| 04:36:45.2 | 04:41:03.7 | 4.3 | opus | 1.016 | 20 | 66.0k | patch:frd-03 |
| 04:39:16.8 | 04:40:46.5 | 1.5 | haiku | 0.020 | 2 | 31.8k | drift-proof:frd-02 |
| 04:40:46.5 | 04:40:56.7 | 0.2 | haiku | 0.012 | 2 | 31.4k | drift-record:frd-02 → 2 cards written |
| 04:40:56.7 | 04:41:28.1 | 0.5 | haiku | 0.042 | 8 | 33.3k | gate-release:frd-02 |
| 04:41:03.7 | 04:41:13.4 | 0.2 | haiku | 0.010 | 2 | 31.4k | reviewer-test-hash:frd-03 |
| 04:41:13.4 | 04:45:38.2 | 4.4 | sonnet | 0.537 | 28 | 79.4k | verify-patch:frd-03 |
| 04:41:28.1 | 04:55:02.2 | 13.6 | opus | 4.230 | 56 | 110.4k | gate:frd-05-work-orders (slot 1, dependency-deferred landing, **not** launch — BL-0194) → **pass** |
| 04:45:38.3 | 04:47:14.3 | 1.6 | haiku | 0.157 | 28 | 44.4k | certify-patch:frd-03 |
| 04:47:14.3 | 04:47:25.6 | 0.2 | haiku | 0.011 | 2 | 31.7k | port-reviewer-tests:frd-02 |
| 04:47:25.6 | 04:50:23.6 | 3.0 | opus | 1.778 | 36 | 77.8k | patch:frd-02 |
| 04:48:07.6 | 04:48:41.2 | 0.6 | haiku | 0.016 | 2 | 31.0k | drift-proof:frd-04 → confirmed preexisting, **no drift-record ran** |
| 04:48:41.2 | 04:49:07.4 | 0.4 | haiku | 0.033 | 7 | 32.8k | gate-release:frd-04 |
| 04:50:23.7 | 05:02:30.5 | 12.1 | opus | 6.544 | 81 | 126.3k | **gate-test-repair:frd-02** (BL-0001, new vs D2/E2) |
| 04:55:02.2 | 04:55:31.6 | 0.5 | haiku | 0.042 | 9 | 33.1k | gate-release:frd-05 |
| 05:02:30.5 | 05:02:42.1 | 0.2 | haiku | 0.012 | 2 | 31.1k | reviewer-test-hash:frd-02 |
| 05:02:42.1 | 05:08:59.5 | 6.3 | sonnet | 0.687 | 28 | 89.8k | verify-patch:frd-02 |
| 05:08:59.5 | 05:10:31.4 | 1.5 | haiku | 0.162 | 29 | 43.3k | certify-patch:frd-02 |
| 05:10:31.4 | 05:10:42.4 | 0.2 | haiku | 0.013 | 3 | 31.5k | port-reviewer-tests:frd-04 |
| 05:10:42.4 | 05:18:49.5 | 8.1 | opus | 4.015 | 57 | 114.7k | patch:frd-04 |
| 05:18:49.5 | 05:18:57.4 | 0.1 | haiku | 0.008 | 2 | 31.3k | reviewer-test-hash:frd-04 |
| 05:18:57.4 | 05:23:03.2 | 4.1 | sonnet | 0.514 | 26 | 81.2k | verify-patch:frd-04 |
| 05:23:03.2 | 05:24:39.1 | 1.6 | haiku | 0.171 | 31 | 43.8k | certify-patch:frd-04 |
| 05:24:39.1 | 05:24:44.1 | 0.1 | haiku | 0.005 | 2 | 30.2k | stale-pin:frd-05 |
| 05:24:44.1 | 05:26:02.7 | 1.3 | haiku | 0.031 | 7 | 34.4k | reverify:frd-05 (FRD-04 already landed) |
| 05:26:02.7 | 05:27:11.6 | 1.1 | haiku | 0.123 | 23 | 42.2k | apply-gate:frd-05 → last landing |
| 05:27:11.6 | 05:27:35.8 | 0.4 | haiku | 0.038 | 9 | 36.3k | safe-point |
| 05:27:35.8 | 05:40:45.5 | 13.2 | sonnet | 3.627 | 117 | 135.0k | visual-qa (real pass, not a no-op like E2) |
| 05:40:45.5 | 05:41:33.9 | 0.8 | haiku | 0.059 | 11 | 34.6k | close-out-verify-reuse-check |
| 05:41:33.9 | 05:45:07.1 | 3.6 | haiku | 0.227 | 42 | 44.2k | notify-end (full `verify.sh`) |
| | **83.5 wall** | | | **44.043** | 948 | | 41 agents |

By model: opus $37.30 (485 calls), sonnet $5.36 (199), haiku $1.38 (264). Cache-write estimated
**+$10.63** on top (never folded into the total above; unverified rate).

### 1.2 Phases

| Phase | Wall / agent-min | $ | Note |
|---|---:|---:|---|
| Precheck + plan | 1.8 | 0.611 | no baseline escalation this run |
| Slot setup (pin + 2 worktrees) | 0.9 | 0.070 | |
| Gates ×4 (`explore`) | 52.0 | 23.377 | 279 calls Σ — this alone already exceeds the $18.5 bar |
| **gate-test-repair:frd-02 (BL-0001)** | 12.1 | 6.544 | new phase, absent from D2/E2 |
| drift-proof + drift-record (×3 pairs run) | 2.9 | 0.067 | frd-04's drift-proof ran without a matching drift-record |
| gate-release ×4 | 2.0 | 0.158 | |
| Landing FRD-02 (port, patch, **repair**, hash, verify, certify) | 23.3 | 9.193 | reopen w/ drift, BL-0191 path + BL-0001 repair |
| Landing FRD-03 (port, patch, hash, verify, certify) | 10.7 | 1.734 | reopen, BL-0191 path |
| Landing FRD-04 (port, patch, hash, verify, certify) | 14.1 | 4.722 | reopen, BL-0191 path |
| Landing FRD-05 (stale-pin, reverify, apply) | 2.5 | 0.160 | pass on a stale pin, reverify AFTER FRD-04 landed |
| Safe-point | 0.4 | 0.038 | |
| Visual-qa | 13.2 | 3.627 | did real work (117 calls) — E2's no-op confounder absent here |
| Close-out (reuse-check + notify-end) | 4.4 | 0.286 | full `verify.sh`, no reuse (`scope-not-eligible`) |
| **Total** | **83.5 wall** | **44.043** | +10.63 $ cache-write, estimated |

### 1.3 Concurrency

- `concurrency_max` **3** (same ceiling as E2). Time at each level: **1 agent 51.5 min**, 2 agents 19.5
  min, 3 agents 12.5 min (E2: 42.9 / 19.8 / 2.4 — F1 spends 5× longer at 3-way concurrency than E2, but
  also has a longer single-agent tail overall because the run itself is longer).
- Gate overlap: `gate:frd-03` ∥ `gate:frd-02` for the full first ~11.5 min (both launched inside 2 s of
  each other — "arrancan a la vez a los 3 min" from run start, confirmed: 04:23:54.9 / 04:23:56.3 vs
  04:21:36.8 start = 2.3 min). `gate:frd-04` ∥ `patch:frd-03`. `gate:frd-05` ∥ `patch:frd-02` ∥ (briefly)
  `gate:frd-04`'s tail — this triple overlap is the source of the 12.5-min level-3 window.
- **Gate segment** (pin start 04:23:24.9 → last landing, `apply-gate:frd-05` end 05:27:11.6): **63.8 min**.
  D2's serial-equivalent bar was 66.9 min (≤60% = 40.1 min to pass). F1 is at **95.4%** of D2 serial — a
  bare 4.6% improvement, nowhere near the pre-registered bar, and *worse* than E2's 55.0 min (82%).
- **Idle slots: ~0 min.** This is the one clean win. Slot 1 (frd-02 → frd-05) and slot 2 (frd-03 → frd-04)
  both start their second gate the same second `gate-release` on the first gate ends (04:41:28.1→04:41:28.1
  for slot 1; 04:36:34.5→04:36:34.5 for slot 2) — zero gap. Compare E2's 39.9 slot-minutes idle waiting for
  FRD-05's gate-launch dependency deferral. **BL-0194 (gate dependents launch freely, only landing is
  ordered) is confirmed fixed and fully exercised live.**
- Start → first verdict: 13.8 min (04:21:36.8 → `gate:frd-03` end 04:35:24.6, first of the four to
  return). D2: 20.6 min. E2: 14.3 min. F1 is in the same band as E2, not worse.

### 1.4 Gate by gate, F1 vs D2 vs E2

| FRD | D2 (`explore`, serial) min/$/calls/ctx | E2 (`digested`) min/$/calls/ctx | **F1 (`explore`+`gateContextScope`) min/$/calls/ctx** | Verdict F1 |
|---|---|---|---|---|
| 02 | 17.60 / 7.48 / 80 / 143k | 9.20 / 1.95 / 24 / 95k | **15.3 / 7.254 / 80 / 135k** (+12.1/6.544 repair) | pass w/ 3 drift cards |
| 03 | 11.84 / 5.77 / 66 / 126k | 14.58 / 3.16 / 32 / 105k | **11.5 / 5.092 / 59 / 116.5k** | reopen (correct, #2/#3 caught) |
| 04 | 13.53 / 6.46 / 78 / 125k | 11.39 / 2.05 / 21 / 92k | **11.6 / 6.801 / 84 / 124k** | reopen (correct, #5 caught + new drift confirmed, uncarded) |
| 05 | 9.63 / 4.89 / 59 / 130k | 12.26 / 2.10 / 25 / 94k | **13.6 / 4.230 / 56 / 110k** | pass |
| **Σ (core 4)** | **52.6 / 24.61** | **47.4 / 9.26** | **52.0 / 23.377** | |
| **Σ + gate-test-repair** | — | — | **64.1 / 29.921** | |

Calls stayed in D2's `explore` band (56-84), not E2's `digested` band (21-32) — `gateContextScope` does not
cut turns, only per-turn context. Context/call fell a modest 5-15% vs D2 (FRD-02 −5.6%, FRD-03 −7.5%,
FRD-04 −0.8%, FRD-05 −15.4%; average ≈ −7.3%), far short of the −25% cost bar, and the Σ cost is
essentially flat vs D2 (−5% core, **+22% including the repair loop**).

### 1.5 Per verified WO: F1 vs E2 vs D2 vs baseline

| Run | Wall min | $ real | WOs verified | min/WO | $/WO | vs baseline |
|---|---:|---:|---:|---:|---:|---|
| FRD-24 baseline | 64.8 | 13.05 | 2 | 32.4 | 6.53 | 1.00× / 1.00× |
| D2 (`explore`, serial, w/ build) | 87.5 | 36.24 | 4 | 21.9 | 9.06 | 1.48× / 0.72× |
| E2 raw (`digested`+parallel, no build) | 65.1 | 15.20 | 4 | 16.3 | 3.80 | 1.99× / 1.72× |
| **F1 raw (`explore`+`gateContextScope`+parallel, no build)** | **83.5** | **44.04** | **4** | **20.9** | **11.01** | **1.55× / 0.59×** |
| 4× target | | | | 8.1 | 1.63 | 4× / 4× |
| Red-team bar (38 addendum) | | | | ≤ 20 | ≤ 7.5 | |

F1 is faster than the baseline (1.55×) but **more expensive per WO than the baseline itself** (0.59× —
i.e. costs 1.69× baseline), the worst cost ratio of the three runs measured to date. It also barely misses
the time red-team bar (20.9 vs ≤20) and clearly misses the cost one (11.01 vs ≤7.5).

---

## 2. Finding parity (the brief's central question)

### 2.1 The 5 known defects, scored against F1's actual gate reports

| # | Defect | F1 result | Evidence |
|---|---|---|---|
| 1 | AC-02-010.8: Campaign fichas lack current-factory content | **Found**, filed as drift | `gate:frd-02` traceability row: `status:"fail"`, `claim:"preexisting"`, `evidence_test:".../ac-02-010-8.drift-probe.ts"`. `drift-proof:frd-02` differential: identical `AssertionError` at HEAD (`7740eb95`) and BASE (`d9addc89`) → correctly proven preexisting. `drift-record:frd-02` wrote `frd-02-ideas-board-drift-ac-02-010-8.md` |
| 2 | REQ-03-001: `ACTIVE_PHASES` still includes `"architecture"` | **Found**, filed as drift | `gate:frd-03` traceability: `status:"fail"`, `claim:"preexisting"`. `drift-proof:frd-03`: identical failure (`expected […] to not include 'ProbeArch'`) at HEAD and BASE. `drift-record:frd-03` wrote `frd-03-portfolio-drift-req-03-001.md` |
| 3 | `formatLastSync` V8 lenient `Date.parse` | **Found**, blocked the FRD-03 verdict (reopen) | `gate:frd-03` traceability: AC-03-007.2 `status:"fail"`; the report's own `failure` narrative names both faults (UTC-day bucketing **and** the lenient-parse rollover) and the patch fixed both (`verify-patch:frd-03` green) |
| 4 | REQ-03-007 chip only on unmounted `PortfolioTable` | **Seen, not flagged as a defect** | Gate report's own finding text: *"PortfolioTable still has no production importer, so the chip is not visible anywhere in the running app. This matches what the owner's change card and the WO scope asked for."* — noticed, explicitly waved off, no traceability `fail` row, no card |
| 5 | `formatChangeDate` UTC day + lenient parse | **Found**, blocked the FRD-04 verdict (reopen) | `gate:frd-04` traceability: AC-04-011.1/.2 `status:"fail"`; failure narrative reproduces both faults live at 23:43 local; patch fixed both |

**Recall: 4/5 clean, 1/5 partial (#4 observed but dismissed).** Both drifts BL-0201 required specifically
(#1 and #2) were found **and proven** via the DR-122 differential test — the recall bar (≥4/5 including
#1+#2) is met on its own terms. #4 is the one soft spot: unlike E1/E2, which reported it as a defect, F1's
reviewer read the same fact and reasoned it was in-scope-as-is. Whether that reasoning is correct (the WO
scope may indeed not have asked for mounting the table) was **not independently re-verified** here — it is
reported as observed-but-not-flagged, not as a miss of fact.

### 2.2 Reviewer call volume vs the brief's bands

Gate calls: FRD-02 80, FRD-03 59, FRD-04 84, FRD-05 56 — squarely in **D2's 59-80 band** (one entry, 84,
slightly above it), nowhere near E2's digested 21-32. `gateContextScope` did not compress turns.

### 2.3 Did `gateContextScope`'s context recort cost anything in recall?

No evidence of a recall loss traceable to header-only docs for un-reviewed WOs: all three drift claims
that needed cross-FRD context (AC-02-010.8/.4 in Campaign fichas, REQ-03-001 in `portfolio.ts`) were still
caught, each backed by a drift-probe file the reviewer wrote and ran, not by reading another WO's
full doc. The mechanism the brief worried about (VERIFIED WOs' docs going header-only) did not visibly
block any of the 5 known findings.

### 2.4 Context-per-call reduction, quantified

| FRD | D2 ctx/call | F1 ctx/call | Δ |
|---|---:|---:|---:|
| 02 | 143k | 135.2k | −5.6% |
| 03 | 126k | 116.5k | −7.5% |
| 04 | 125k | 124.0k | −0.8% |
| 05 | 130k | 110.4k | −15.4% |
| **avg** | | | **≈ −7.3%** |

Real but modest — roughly a third of the −25% cost-bar's implied context cut, and it did not translate
into a Σ-cost win because call count did not fall (§2.2) and a new repair cycle (§3 below) added back more
than the context cut saved.

---

## 3. BL-0194 in vivo

- **FRD-05 gated in parallel before FRD-04 landed:** confirmed. `track.jsonl`: `review_start frd-05` at
  04:41:32 (engine) / `gate:frd-05` agent start 04:41:28.1, while FRD-04's gate was still open (`gate:frd-04`
  ran 04:36:34.5→04:48:07.6, reopen) and FRD-04 did not reach `frd_end` until 05:23:30. So FRD-05 was judged
  entirely inside FRD-04's still-open review window — this is the launch-freely half of BL-0194's fix,
  live.
- **FRD-05's landing waited for FRD-04's, and went through reverify:** confirmed. `certify-patch:frd-04`
  ends 05:24:39.1; `stale-pin:frd-05` starts 05:24:39.1 (same instant) → `reverify:frd-05` 05:24:44.1-05:26:02.7
  → `apply-gate:frd-05` 05:26:02.7-05:27:11.6. FRD-05 did NOT land at its original (stale) pin — the
  reverify step re-ran its objective suite against the post-FRD-04 tree before landing, exactly the ordered-
  landing half of BL-0194.
- **Idle slot-minutes vs E2's 39.9:** **≈0**. See §1.3 — both slots' handoff to their second FRD happens in
  the same instant `gate-release` ends, with no gap. This is the clearest confirmed win of the whole run:
  the specific defect BL-0194 was written to fix (a slot sitting idle while a gate-ready FRD waited on a
  launch-order rule) is gone.

---

## 4. DR-122 in `explore`

Three differential proofs were run and inspected directly (raw `drift-proof.mjs prove` output, not the
reviewer's paraphrase):

| Probe | HEAD result | BASE result | Verdict | Card filed |
|---|---|---|---|---|
| `ac-02-010-4.drift-probe.ts` | fail (identical assertion) | fail (identical assertion) | preexisting — correct | `frd-02-ideas-board-drift-ac-02-010-4.md` |
| `ac-02-010-8.drift-probe.ts` | fail (identical assertion) | fail (identical assertion) | preexisting — correct | `frd-02-ideas-board-drift-ac-02-010-8.md` |
| `req-03-001.drift-probe.ts` | fail (identical assertion) | fail (identical assertion) | preexisting — correct | `frd-03-portfolio-drift-req-03-001.md` |
| `req-04-003.drift-probe.ts` | fail (identical assertion) | fail (identical assertion) | preexisting — correct, **but no `drift-record` ran and no card exists** | none |
| `exclusion-bounded-writes.drift-probe.ts` | fail (identical) | fail (identical) | preexisting, **and the claim itself was later ruled unsatisfiable by `gate-test-repair`** | `frd-02-ideas-board-drift-exclusion-bounded-writes.md` (`origin: gate-test-repair`, `type: change`, correctly retargets the *spec* as stale rather than the code) |

All differential tests are methodologically sound: each compares the SAME probe against HEAD (`7740eb95`)
and BASE (`d9addc89`), and every one of the five failed identically both times, which is the correct
evidence for "this predates the reviewed work orders, don't reopen/block on it." `frd.md` frontmatter
confirms two of the four confirmed drifts are actually registered: `frd-02-ideas-board/frd.md:11: drift:
[AC-02-010.4, AC-02-010.8]`, `frd-03-portfolio/frd.md:10: drift: [REQ-03-001]`. **FRD-04 has no `drift:`
line** despite its own `drift-proof:frd-04` agent confirming REQ-04-003 preexisting — the `drift-record`
step that runs for FRD-02 and FRD-03 simply never got dispatched for FRD-04 in this run. Root cause not
determined (a scheduling gap vs a deliberate one-per-run cap were not distinguished from the transcripts
available); flagged in §5 as worth a BL, not filed here.

---

## 5. New defects observed (not filed as BL, evidence only)

1. **`gate-test-repair` (BL-0001) added a full second opus reviewer pass for FRD-02** (12.1 min / $6.544 /
   81 calls), absent from both D2's and E2's pipelines, triggered because the patch agent flagged the
   `exclusion-bounded-writes` drift probe as internally unsatisfiable (FRD-02's own "Does NOT include"
   spec bullet is stale against four *other*, already-approved FRDs that write outside `lib/discard/` +
   `lib/favorite/`). The mechanism worked as intended (it correctly redirected the finding at the stale
   spec, `type: change`, rather than blocking or mis-patching the code) but it is real, uncounted cost
   overhead any future D2/E2/F1 comparison should budget for.
2. **Asymmetric `drift-record` dispatch**: FRD-02 and FRD-03 each got a `drift-record` agent after their
   `drift-proof` confirmed a preexisting claim; FRD-04's `drift-proof` also confirmed one (REQ-04-003, "the
   Summary tab has no Mission Objectives bar") but no `drift-record` agent ever ran for FRD-04 — the finding
   is proven in the transcript and in `gate:frd-04`'s own report text but is invisible in `frd.md`
   frontmatter and absent from `.pandacorp/inbox/changes/`. A real drift silently failed to reach the
   owner's queue.
3. **#4's dismissal reasoning was not cross-checked.** The gate accepted "this matches what the owner's
   change card and the WO scope asked for" as sufficient grounds not to flag the unmounted `PortfolioTable`
   chip. That may well be correct, but it was not independently verified against the actual change-card/WO
   text in this measurement pass — worth a follow-up read before trusting the dismissal at face value.
4. **`patch:frd-03`'s builder-test note flags a sibling bug proactively**: its own failure narrative names
   `formatChangeDate.ts` (FRD-04) as sharing the same UTC-day bug *before* FRD-04's own gate ran — a
   correct sibling-audit instinct (this rule's own `debugging.md` "sibling audit before closing"), exercised
   spontaneously by a builder agent rather than the reviewer.

---

## 6. Not verified

- Whether #4's "matches WO scope" dismissal is actually correct against the real change-card text (not
  re-read in this pass).
- Root cause of FRD-04's missing `drift-record` dispatch (scheduling gap vs an intentional per-run cap) —
  not distinguishable from the available transcripts without reading the engine's own dispatch logic.
- `vm_stat`/RAM contention for 2 concurrent gate-worktrees on this run.
- Whether the cache-write estimate (1.25× input, unverified rate) materially changes any ratio above; all
  pass/fail calls in §Executive summary use the real (non-estimated) $44.043 total.
- Judge variance: n = 1 per FRD per mode, same limitation as D2/E1/E2.
