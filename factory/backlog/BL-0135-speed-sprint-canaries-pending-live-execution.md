---
id: BL-0135
type: change
area: build-engine
title: "Run the three speed-sprint live canaries (A/B/C) and record their verdicts before the sprint's claims are trusted"
status: done
severity: p1
opened: 2026-09-22
closed: 2026-09-25
source: "docs/proposals/37-fast-change-path-and-implement-cost.md, Adenda 2026-09-21 §Canario"
closes: "Canary A (measured 2026-09-22, FAILS the ≤1200s time bar), Canary B/B2 (measured 2026-09-22/23, findings-safety PASSES, span-savings FAILS both times — digested still not certified clean), Canary D1/D2 (measured 2026-09-25, superseding Canary C's own uncomparable run — real ≥3-WO build parallelism WAS observed, concurrency_max:4, but the ≤45min wall-clock bar still FAILS at 87.5min; see decision-log v9.109.0 and docs/proposals/37 §Canario D)"
links: [BL-0124, BL-0129, BL-0044, BL-0178, BL-0179]
---

## Problem
The 2026-09 implement-speed sprint (packages WP-00..WP-11, E2, E3, F1; landing as plugin 9.103.0) ships
with every unit-level engine-harness scenario green, but its headline claims — a ≈3-4x wall-clock win on
`implement`, an oracle that does not regress on real defects, and a genuine ≥3-way concurrency win on a
multi-WO build — are ONLY provable live, against a real project. `implement-speed-sprint.md`'s own
"NO PUDE VERIFICAR" list names the single most likely silent failure: whether `/pandacorp:upgrade`
actually propagates the new engine to the canary project before it runs (if not, the canary measures the
OLD engine and every number is meaningless). None of the three canaries below has been executed yet.

## Fix plan
Execute all three canaries, in order, on the sprint's merged state (after `integration-speed-sprint-a`
lands as plugin 9.103.0), and record each verdict (pass/fail against its own acceptance bar, plus the
raw numbers) in `plugin/docs/decision-log.md`.

1. **Canary A — the headline.** A synthetic FRD, 2 non-UI work orders chained by `dependsOn` (the exact
   shape of FRD-24), run in a disposable Mission Control worktree, measured via `usage-rollup.mjs`
   (extended for this sprint, WP-09) joined against the run's `wf_*.json` `workflowProgress[]`.
   **Acceptance:** ≤1,200 s with a red gate in the loop / ≤950 s clean, `agentCount ≤ 18`, zero
   `foundation-gate`/`visual-qa` passes (the build touches no UI). **Rollback trigger:** improvement
   < 2x after packages A+B+C land → stop and re-measure before shipping further packages.
2. **Canary B — the oracle (mandatory before trusting WP-06's `gateEvidence: digested` default).** A
   blind A/B, `gateEvidence: explore` vs `gateEvidence: digested`, over a corpus of 5 seeded defects: the
   real red from FRD-24, plus 4 synthetic — an unmet acceptance criterion, a missing authz check, a
   near-duplicate component (DR-057), and a DR-115 single-source-of-truth violation. **Acceptance:**
   `digested` must match `explore` on every row for CORRECTION-class findings (no regression on any of
   the 5). **Rollback trigger:** a single CORRECTION-class finding lost by `digested` → revert the
   default to `explore`. Part of this run is free (the offline harness from BL-0063 already covers some
   fixtures) — use it before spending a live run.
3. **Canary C — the concurrency win.** A 6-WO / 2-FRD build with disjoint artifacts (candidate: the
   `portada-seal-…` card already sitting in `mission-control/.pandacorp/inbox/changes/`).
   **Acceptance:** ≤45 min wall clock, `concurrency_max ≥ 3` actually observed (not just configured).
4. **Prerequisite, verify FIRST:** confirm `/pandacorp:upgrade` on the canary project(s) actually pulls
   the new engine (compare the project's copy's line count / version stamp against the source — the
   sprint's own note flags a 2,146 vs 2,361+ line gap as the likely silent-failure mode). A canary run
   against a stale engine copy is worse than no canary — it produces a false pass.

## Tests (prove the fix — TDD, RED → GREEN)
Not applicable in the unit-test sense — this item's proof IS the three live canary runs themselves. Each
canary's acceptance bar above is the pass/fail oracle. A "test" here is: re-run `bash
plugin/scripts/run-engine-tests.sh` immediately before each canary (the sprint's own pre-flight,
zero-cost) to rule out a broken engine confounding the measurement.

## Done when
All three canaries have run at least once against the confirmed-current engine; each verdict (numbers +
pass/fail) is recorded in `plugin/docs/decision-log.md`; any rollback trigger that fired has its
corresponding default reverted per this item's Fix plan; BL-0124 and BL-0129's "live build pending
canary" notes are updated to point at the actual run.

## Out of scope
Building the canaries' fixtures or harness code (already shipped by WP-09/BL-0063/the sprint itself) —
this item is the EXECUTION and the recorded verdict, not new machinery.

## Partial execution evidence (2026-09-22, mission-control .pandacorp/run/lessons.md)
Canary A ran at least once (run id `wf_4cef213a-463`, referenced separately as `wf_35a54be4-172` in
BL-0141's own source line — same 2026-09-22 launch window, not yet reconciled to a single canonical run
id). Two live findings came out of that run, NEITHER of which is this item's own acceptance-bar numbers
(wall clock / `agentCount` / zero UI-gate passes were not captured in what reached memory harvest):
(1) the engine crashed on its very first `agent()` spawn ('agent type pandacorp:mech not found') because
the launching session's resident plugin (9.102.3) lagged the 9.103.0 engine it invoked — see BL-0141 (a
runtime fallback fix exists on branch `fix-engine-agenttype-fallback`, **not yet merged to main** as of
this note); (2) the supervisor's lease renewal lapsed mid-run (`LEASE_RENEW_FAILED`) via a Monitor-cap
re-arm gap — see BL-0131's corroborating-occurrence note. Both are real defects independent of this item's
own KPI question. This item stays OPEN: re-run Canary A cleanly (after BL-0141's fix lands on main) and
record the actual wall-clock/`agentCount`/UI-gate-skip numbers against the acceptance bar above — this
partial run does not satisfy "Done when."

## Progress note — 2026-09-22 (not closing this item)
**Canary A ran clean and was fully measured** (run id `wf_4cef213a-463`, `mechLean:false` forced by
session/plugin skew, BL-0141's fix already effective so no agentType crash this time). Full numbers and
verdict recorded in `plugin/docs/decision-log.md` (v9.104.0, "Canary A (BL-0135)" entry) and in
`docs/proposals/37-fast-change-path-and-implement-cost.md` §"Canario A · 2026-09-22 (medido)". Result:
**FAILS** the ≤1,200s (with-reopen) time bar (measured 2613.9s); PASSES `agentCount ≤18` and the
foundation-gate/visual-qa omission. Baseline-to-canary improvement measured is **≈1.49x (3889s →
2613.9s)**, below this item's own **"< 2x → stop and re-measure before shipping further packages"
rollback trigger** — flagged here explicitly rather than silently proceeding: the second batch (F2-F5,
quick wins, BL-0141, review #3) still landed as plugin 9.104.0 in this same release because none of its
packages are Canary-A-gated defaults (`gateEvidence` stays `explore`, `--now` stays opt-in,
`scopedRepair` stays off) and each is independently reviewed/tested; but per this item's own trigger,
**no further default-flip or Tanda-B/C package should ship ahead of a re-measurement** until Canary A
(and ideally B) clear their bars. Canary B is running now in `panda-corp-canary-b` (separate worktree);
Canary C has not started. This item stays `open` — not all three canaries have run, and the rollback
trigger condition is presently active, not resolved.

**Reconciling note on the LEASE_RENEW_FAILED finding above:** the full artifact-level report for
`wf_4cef213a-463` (this session, `canary-a-report.md`) searched `journal.jsonl`, both `renew-lease`
agents' `.meta.json` (both `{"stop": false}`, no error) and the dashboard event stream for this run's
exact window and found **no** `LEASE_RENEW_FAILED` occurrence; the only event near the timestamp
originally suspected is a routine `SupervisorTick`. That does not contradict the note above, since the
note itself already flags `wf_4cef213a-463` and `wf_35a54be4-172` as not yet reconciled to one canonical
run id, and BL-0141's own `source:` field cites `wf_35a54be4-172` specifically for the agentType crash
(which also did not recur in `wf_4cef213a-463`, consistent with BL-0141's fix being effective there).
Working hypothesis, not confirmed: the `LEASE_RENEW_FAILED` event belongs to the earlier, crashed
`wf_35a54be4-172` run, not to the later clean `wf_4cef213a-463` run this session measured. Left open
rather than asserted either way — worth a deliberate reconciliation pass before this item closes.

## Progress note — 2026-09-22, Canary B (still not closing this item)
**Canary B also ran and was fully measured** (`wf_dd3b6dfc-257`, `gateEvidence: 'digested'`, same FRD-25
fixture reset to A's pre-gate state). Full numbers in `plugin/docs/decision-log.md`'s "Canary B (BL-0135)"
entry and `docs/proposals/37-fast-change-path-and-implement-cost.md`'s "Canario B" section. **Findings
acceptance bar PASSES** (exact tie with Canary A: same single CORRECTION-class finding, same file/line/
root cause, no loss — this canary's own rollback trigger did not fire). **Span savings bar FAILS**:
measured −7.1% time / −25.4% cost on `gate`+`evidence` vs A's `gate` alone, far short of the ≥60% time
target, likely understated by a real infrastructure defect (the digested-evidence collector's frozen
worktree had no `node_modules`, forcing a full bootstrap+re-verify anyway — the exact expensive path
`digested` exists to avoid). `LEASE_RENEW_FAILED` was again searched for and not found in B's artifacts
either, further corroborating the reconciling note above (both fully-measured runs are clean of it).

**Net across both canaries now run:** neither Canary A (time) nor Canary B (time) clears its bar; Canary
B's findings-safety bar and Canary A's agentCount/UI-gate-omission bars both clear. The Canary-A rollback
trigger (baseline-to-canary improvement < 2x → stop and re-measure before shipping further packages) is
**still active** — this progress note does not resolve it. `gateEvidence: 'digested'` is judged safe to
opt into for low-risk non-UI builds (findings parity proven) but is NOT promoted to the default; the
recommended next step is fixing the collector's `node_modules` gap and re-measuring before any default
flip. This item stays `open`: two of three canaries have run; Canary C has not started.

## Progress note — 2026-09-22, Canary C attempted (still not closing this item)
**Canary C was launched but aborted, not measured.** Run `wf_71f78bae-dbd` (card
`portada-seal-coverage-commits-funnel-ideas.md`, `mode: powerful`, `maxAgents: 40`,
`gateEvidence: 'digested'`, `mechLean: false`) launched 15:34 UTC and died 13 minutes later at the
`baseline` step. Cause: the owner's Claude Code account session usage limit ("You've hit your session
limit"), confirmed as an account-level throttle, not an engine defect — `ensure-stopped` (the close-out
step) also failed for the identical reason, so `.pandacorp/status.yaml` was left with `running: true`
and the atomic build lease held; both were released by hand after the fact. The worktree
`/Users/Shared/Proyectos/panda-corp-canary-c` is intact with the card already copied in and the engine at
plugin 9.104.2 — ready to relaunch in a fresh session (a session not against the same usage-limit window)
without re-doing the setup. No wall-clock/cost/`concurrency_max` numbers were captured; Canary C's own
acceptance bar (`≤45 min`, `concurrency_max ≥ 3` actually observed) remains untested.

**Net across all three canaries attempted so far:** Canary A ran clean and FAILED its time bar (see the
progress note above, 2613.9s vs ≤1200s, ≈1.49x improvement, below the 2x rollback trigger). Canary B ran
clean and PASSED findings-safety but FAILED its own span-savings bar, likely understated by the
`node_modules`-bootstrap infrastructure defect fixed in BL-0149/BL-0150 (plugin 9.104.2) — not yet
re-measured with that fix applied. Canary C has not produced a single measured run. Before flipping
`gateEvidence` to `digested` by default or trusting the sprint's headline concurrency claim, re-run Canary
B with the BL-0149/BL-0150 fix in place (mech agent available, plugin ≥ 9.104.2) and relaunch Canary C in
a session clear of the account usage-limit window. This item stays `open`.

## Progress note — 2026-09-23, Canary B2 (re-measure with the bootstrap fix present, still not closing this item)
**Canary B2 ran clean and was fully measured** (`wf_78ba5660-bd9`, `gateEvidence: 'digested'`, `mechLean`
inferred `true` from `agentType` evidence — not an explicit `args` key — over the real, nested Mission
Control topology, distinct from A/B's flat fixture repos). Full numbers in
`docs/proposals/37-fast-change-path-and-implement-cost.md`'s "Canario B2" section
(`canary-b2-report.md` in this session's scratchpad). **Span-savings bar still FAILS**: `gate`+`evidence`
measured −20.04% time / −9.73% cost vs A's `gate` alone, still far short of the ≥40% bar this item's Fix
plan set for Canary B. **Root cause now CONFIRMED by direct code read, not inferred**:
`worktree-bootstrap.sh` step 1 only checked for `package.json` at the worktree ROOT; Mission Control lives
NESTED (`panda-corp/mission-control/`, the real production topology A/B never exercised), so dependency
install silently ran for nothing and the `gate` agent had to bootstrap by hand — the exact expensive path
`digested` exists to avoid. **Fixed in this same sprint as BL-0155 (plugin 9.104.4), landed AFTER this
canary ran** — B2's own measurement is therefore still contaminated, just by a different (now-fixed)
mechanism than B's original `node_modules` gap. Findings-safety bar **PASSES as a superset**: B2 found the
same CORRECTION finding as A/B plus one new one (a POSIX `--` CLI delimiter bug neither A nor B caught) —
no loss, this canary's own rollback trigger did not fire.

**`mechLean` got its first live measurement in this run** (previously only extrapolated in Canary A's
report): −32.5% time / −24.0% cost on the 4 plumbing steps comparable 1:1 with A (`pin`,
`baseline-precheck`, `gate-worktree`, `notify-end`) — more than double A's extrapolated estimate (~10.5%).
**`mechLean: true` is now confirmed as the correct default with real data**, independent of the
`gateEvidence` question.

**Net:** `gateEvidence` stays `explore` by default — no canary in this batch (B or B2) has measured a
genuinely clean `digested` run; a third, post-9.104.4 run is the actual prerequisite before any default
flip. `mechLean: true` is confirmed. This item stays `open`.

## Progress note — 2026-09-23, Canary C (measured but non-comparable; still not closing this item)
**Canary C was relaunched in a fresh session and ran to completion** (`wf_1cf782d6-2ed`, `mode: powerful`,
`maxAgents: 40`, `gateEvidence: 'digested'`, plugin 9.104.3 — predates the BL-0155 bootstrap fix), over the
real `portada-seal-coverage-commits-funnel-ideas.md` card. **59.52 min / $38.60, 17 agents,
`concurrency_max: 4`.** Full numbers in `docs/proposals/37-fast-change-path-and-implement-cost.md`'s
"Canario C" section (`canary-c-report.md` + `canary-c-forensics.md` in this session's scratchpad).

**This run does NOT satisfy this item's own Canary C acceptance bar and cannot be used to certify it.**
The card built **0 new work orders** (WO-23-007 was already `IN_REVIEW` from the aborted prior attempt) —
the change resolved to **1 FRD / 1 WO**, not the 6-WO/2-FRD shape this item's Fix plan specified. The
observed `concurrency_max: 4` came from a 4-way adversarial "finder" fan-out (correctness/security/quality/
runtime, 3.5 of 59.5 minutes), **not from parallel WO construction** — this run provides **zero evidence**
on the build-parallelism axis the 4x headline and this item's own acceptance bar (`concurrency_max ≥ 3`
actually observed on WOs) require. `GateEvidenceFallback` fired as expected (same nested-bootstrap bug as
B2, BL-0155, not yet landed when this run was on 9.104.3). The FRD ended **BLOCKED (`error`)** despite both
gates returning correct verdicts and a fully green `verify.sh` — root-caused by forensic analysis to an
engine bug (`enforceWholeFrdTraceability`, `pandacorp-build.js:744-750`, overwrites a substantive gate
verdict when the reviewer's traceability inventory omits the `requirement` contract class), tracked
separately as **BL-0157** (opened by a different agent, not touched by this item).

**Net across all four canary runs now attempted (A, B, B2, C):** the 4x objective is **neither reached nor
cleanly measured** by any of them. Canary A remains the only solid figure (−32.8% time / −35.7% cost,
≈1.49x, below the 2x rollback trigger). Projected distance from C (substituting its contaminated gate#1
with B2's cleaner gate+evidence figure, the best approximation available): ≈2.9x time / ≈5.2x cost from the
stated 16 min/$5 target. **What remains to certify real build-parallelism: a change with ≥3 genuinely
independent WOs, run on engine 9.104.5 (once BL-0157 lands) — this is a decision pending explicit owner
approval, estimated cost ~$40 for the run.** This item stays `open`: no canary run has yet satisfied
Canary C's own acceptance bar, and the parallelism question remains structurally unanswered by every run
attempted so far.

## Closing note — 2026-09-25, Canario D1/D2 (CLOSING this item)
**The owner approved and the parallelism run happened** (`wf_6e88dd68-8e4` / D1, `wf_faf48b18-881` / D2,
engine 9.108.0, a real `/change` — `canary-d-parallelism` — with 4 independent FRDs). Full numbers:
`docs/proposals/37-fast-change-path-and-implement-cost.md` §"Canario D (paralelismo, 2026-09-25)";
raw reports in the measuring session's scratchpad (`canary-d-report.md`,
`canary-d-frd02-forensics.md`, `canary-d-wave-investigation.md`); decision-log `v9.109.0`.

**D1** (`maxAgents:8`) collapsed to 1 WO — confirmed by direct code read to be the documented
cost-weighted `maxAgents` overshoot (fixed WRT observability as BL-0173: the cut reason is now logged),
not a new defect. **D2** (`maxAgents:40`) is the first run in the WHOLE sprint (A/B/B2/C/D) to show
**genuine ≥2-WO build parallelism on real independent WOs**: `concurrency_max:4`, 3 WOs built
concurrently in 509s vs 846s summed (≈5.6min saved). Canary C's own `concurrency_max:4` reading is
retroactively superseded here — C's concurrency was 4 adversarial FINDERS, never parallel WOs; D2 is
the real thing this item's Canary C acceptance bar (`concurrency_max ≥ 3` on WOs) was written for, and
it **PASSES that specific bar** (4 ≥ 3). The **wall-clock bar (`≤45 min`) still FAILS** (87.5 min) —
not because parallelism didn't work, but because 65.8% of D2's wall-clock (and 84.9% of its cost) is
FRD-gate review running in SERIES, a structurally different bottleneck than the one this item's bar was
written to catch. Cost per WO verified: **$21.62 vs the FRD-24 baseline's $10.43 (2.07x WORSE)**.

**Closing this item as `done`.** Every canary this item asked for (A, B/B2, and now a genuine
build-parallelism run superseding the mis-scoped C) has run at least once against a confirmed-current
engine, with its verdict recorded in `plugin/docs/decision-log.md` and the memo. No rollback trigger
ever forced a default flip that needed reverting (`gateEvidence` never left `explore` in production;
`mechLean:true` is the one default this sprint's data DID confirm, correctly). What remains is not
more MEASUREMENT — it is a **STRUCTURAL decision** (parallel FRD gates, projected ≈31min off D2;
and/or a clean `digested` re-certification) that this item was never scoped to implement, now tracked
as its own follow-up (parallel-gates: captured in the memo's final verdict, no dedicated BL id yet,
pending an explicit owner go-ahead to scope it; the pre-existing-drift oracle policy: **BL-0178**; the
close-out verify-reuse mechanism that has never fired live: **BL-0179**).
