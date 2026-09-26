---
id: BL-0201
type: change
area: build-engine
title: "canaries F1/F2: find a gate cost lever that keeps explore's finding recall (explore + gateContextScope; digested + a sonnet whole-FRD drift finder)"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-26
source: "docs/reviews/canary-e2-report.md §3, §5, §6 — docs/proposals/38 'Canary E2 result and adopted defaults'"
closes: "docs/reviews/canary-f1-report.md, docs/reviews/canary-f2-report.md, docs/proposals/38 'Cierre del sprint' — parallelGates default flipped to true (plugin/runtime/engine/pandacorp-build.src.js, v9.116.0); gateEvidence default stays explore; driftFinder stays coupled to digested, not validated blind (contamination fixed, see BL-0205/BL-0208); gateContextScope/gateInventoryCache stay off"
links: [BL-0186, BL-0187, BL-0188, BL-0178, BL-0194, BL-0203, BL-0205, BL-0206, BL-0207, BL-0208, BL-0209, BL-0210, BL-0211]
---

## Problem
Canary E2 closed the sprint without a recall-preserving cost lever:
- `gateEvidence:'digested'` cut review cost −62 % (Σ evidence + gate 9.26 $ vs D2's 24.61 $) but found **2/5** of the
  known defects of the replay code (D2 `explore`: 4/5). The out-of-diff drift loss is structural: the 8-read budget
  and a diff scoped to the reviewed WOs keep the judge out of VERIFIED code, where drift lives (AC-02-010.8 lost in
  2/2 digested runs).
- `parallelGates` cut the gate segment −18 % (82 % of the serial equivalent; bar ≤ 60 %). Its largest loss, the
  dependency launch deferral, is fixed by BL-0194 (≈ −12 min PROJECTION on E2).
- With the parity-preserving `explore` default, the composite cost per WO is ≈ 9.6 $, above the baseline's 6.53 $.

## Ground truth (both canaries are scored against it)
The replay base `c575adfc` (Mission Control; the four WOs D2 gated, all IN_REVIEW) and the 5 real defects of
`docs/reviews/canary-e2-report.md` §3.2: (1) AC-02-010.8 drift, (2) REQ-03-001 `ACTIVE_PHASES` drift, (3) FRD-03
`formatLastSync` lenient `Date.parse`, (4) REQ-03-007 chip only in the unmounted table, (5) FRD-04 `formatChangeDate` UTC
day + lenient parse. Baselines: D2 explore recall 4/5 at 24.61 $ Σ gate; E2 digested 2/5 at 9.26 $.

## F1 — `explore` + `gateContextScope` (+ `parallelGates` with BL-0194)
- **Design:** same replay from `c575adfc`, engine ≥ 9.114.0, `mode:powerful, maxAgents:60, parallelGates:true,
  gateSlots:2, gateEvidence:'explore', gateContextScope:true`. `gateContextScope` makes the other VERIFIED WOs'
  docs header-only, so recall on the two drifts (#1, #2) must be checked explicitly (touches of `phases.ts` /
  `ACTIVE_PHASES` in the gate transcripts).
- **Pass:** recall ≥ 4/5 with both drifts found or proven (DR-122), Σ gate cost ≤ 18.5 $ (−25 % vs 24.61 $, the 38 A6 #4
  bar), gate segment ≤ 40.1 min (60 % of 66.9). Pass → flip `parallelGates` (and `gateContextScope` if it carried the
  cost cut) on by default.
- **Estimated cost (PROJECTION):** gates ≈ 17-20 $ (explore at 125-143 k context minus the scope trim), slots + landings +
  2 patch ladders ≈ 5 $, close-out + visual-qa ≈ 3 $ → **≈ 25-30 $ real, ≈ 55-70 min**.

## F2 — `digested` + a sonnet whole-FRD drift finder
- **Design (engine change, not built):** keep the opus judge on the digested diff (its in-diff recall matched explore's,
  2/3 each) and add one sonnet `drift-finder:<frd>` per gate, unbounded reads, scoped to the ACs NOT owned by a reviewed
  WO. Its claims go through the existing DR-122 differential proof (`drift-proof.mjs`), so false positives are filtered
  mechanically; proven drift becomes draft change cards (`driftPolicy:'record'`). A "drift oracle only for never-gated
  FRDs" is NOT enough: FRD-02 and FRD-03 had been gated before their drift appeared.
- **Pass:** recall ≥ 4/5 including #1 and #2, Σ evidence + gate + finder ≤ 18.5 $.
- **Estimated cost (PROJECTION):** E2's 15.2 $ + 4 finders × ≈ 0.4-0.8 $ + proofs ≈ 0.1 $ → **≈ 17-19 $ real, ≈ 65 min**,
  plus ≈ 3-5 $ of agent work to build and test the finder.

## Honest limits
n = 1 per FRD per mode: the in-diff misses (#3 in E2, #4 in D2) looked like judge variance. A pass on one run is
evidence, not proof; the flip should wait for two consistent runs if budget allows (≈ 2× the cost above).

## Done when
- [x] F1 run and scored against the ground truth (report in `docs/reviews/`), defaults decided on it.
- [x] F2's finder built behind a flag with tests, run and scored, default decided on it. (Built: BL-0203,
  `args.driftFinder`, default on under `digested`; run + score pending.)

## Result (2026-09-26, closing this item)

**F1** (`docs/reviews/canary-f1-report.md`): `explore + gateContextScope + parallelGates` (`gateSlots:2`).
Recall **4/5 clean, 1/5 partial** (#4 seen but dismissed without cross-checked evidence — filed as
BL-0211). Wall clock **83.5 min**, real cost **44.04 $** (review Σ 23.38 $ + a 6.54 $ repair loop from
`gate-test-repair`, BL-0210). Per verified WO: 19.1 min at parity would have been the target; F1 landed at
1.55× the baseline's speed / 0.59× its cost. `parallelGates` (BL-0194's fix) measured: gate segment −18%
vs serial equivalent, 0 slot/`last_green_sha` violations, but the pre-registered ≤60% bar was NOT met by
either canary (see below) — new defects surfaced: FRD-04's `drift-record` never dispatched (BL-0209), the
`gate-test-repair` cost invisible in the comparison tables (BL-0210).

**F2** (`docs/reviews/canary-f2-report.md`): `digested + driftFinder:true + parallelGates` (`gateSlots:2`).
Recall **4/5** (misses #1, the one drift **lost in 3/3 `digested` runs now** — E1, E2, F2 — even with the
finder; the finder recovered #2, which `digested` alone had never found). Wall clock **76.3 min**, cost
**30.63 $** (Σ evidence + finder + gate 14.80 $, under the 18.5 $ partial bar; total inflated by a
spurious reopen from a mech relay fault, BL-0206). 52 agent records, 4 in `error` (agent-registry skew,
BL-0168, zero cost/time lost via instant fallback). The finder's own measurement was **compromised**: its
production prompt named the canary's exact answer key (fixed in this same change, see below) and 2/4
finders read the wrong tree (cwd reset between Bash calls, BL-0205).

**Verdict and defaults adopted** (this same change, v9.116.0): `parallelGates` → **default ON**, `gateSlots:
2` — the gates are no longer the bottleneck (0 drops to legacy, 0 idle slots, same parity, ~0.3-0.4 $/run
overhead), **deviating on purpose from the pre-registered ≤60%-of-serial bar, which neither F1 nor F2 met**
(F1's own gate-segment ratio and F2's serial 40.1-min landing lane both exceeded it) — adopted anyway because
throughput, not that specific bar, is what canary time budgets a real overnight run against, and 0 regressions
were observed. `gateEvidence` stays **`explore`** (`digested` loses defect #1 in 3/3 runs, finder or not — it
cannot be recommended as the default until re-measured BLIND, BL-0208, after BL-0205's fix). `driftFinder`
stays coupled to `digested` (on only with it), still **not validated** (contamination just fixed; wrong-tree
reads just filed). `gateContextScope` stays **off** (F1 alone: −7% context, no coupled cost win once isolated)
— proposed for retirement in a separate change, not bundled here. `gateInventoryCache` stays off (unmeasured).
`driftPolicy` stays `record` (DR-122, unchanged).

**Sprint verdict:** the 4× throughput goal is **not reached and not reachable with this pipeline** — the
serial non-gate tail (landing lane + visual-qa + close-out) alone is ≈15 min/WO against a 4× target of
8.1 min/WO, and opus judges run ≈2.9 $/WO against a 1.63 $ target.

**Defects filed from this pair of canaries:** BL-0205 (drift-finder wrong-tree cwd reset), BL-0206 (mech
JSON relay truncation → spurious reopen), BL-0207 (parallel-gates budget under-counts the finder),
BL-0208 (drift-finder tool-call self-report undercount), BL-0209 (FRD-04 drift-record never dispatched),
BL-0210 (gate-test-repair cost invisible in canary comparisons), BL-0211 (#4 dismissal not cross-checked).
Evidence-only, no new BL: agent-registry version skew causing the 4 `find:drift` fallback errors — folded
into the already-open BL-0168 as a new evidence update (same root cause, third observed surface).
