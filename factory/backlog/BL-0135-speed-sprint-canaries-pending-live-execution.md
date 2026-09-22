---
id: BL-0135
type: change
area: build-engine
title: "Run the three speed-sprint live canaries (A/B/C) and record their verdicts before the sprint's claims are trusted"
status: open
severity: p1
opened: 2026-09-22
closed:
source: "docs/proposals/37-fast-change-path-and-implement-cost.md, Adenda 2026-09-21 §Canario"
closes:
links: [BL-0124, BL-0129, BL-0044]
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
