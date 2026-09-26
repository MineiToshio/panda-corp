---
id: BL-0201
type: change
area: build-engine
title: "canaries F1/F2: find a gate cost lever that keeps explore's finding recall (explore + gateContextScope; digested + a sonnet whole-FRD drift finder)"
status: open
severity: p1
opened: 2026-09-26
closed:
source: "docs/reviews/canary-e2-report.md §3, §5, §6 — docs/proposals/38 'Canary E2 result and adopted defaults'"
closes:
links: [BL-0186, BL-0187, BL-0188, BL-0178, BL-0194, BL-0203]
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
- [ ] F1 run and scored against the ground truth (report in `docs/reviews/`), defaults decided on it.
- [ ] F2's finder built behind a flag with tests, run and scored, default decided on it. (Built: BL-0203,
  `args.driftFinder`, default on under `digested`; run + score pending.)
