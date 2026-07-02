---
id: BL-0021
type: change
area: build-engine
title: "Global wave scheduler: build ready WOs across ALL FRDs in parallel; gates serialized at wave boundaries"
status: open
severity: p1
opened: 2026-07-01
closed:
source: "owner/conversation 2026-07-01 (Party audit session) — confirmed against personal-page-v2 track.jsonl"
closes:
links: [DR-050, DR-060, DR-100, DR-108, BL-0019]
---

## Problem

The build engine (`plugin/templates/shared/.claude/workflows/pandacorp-build.js`) builds strictly
**FRD by FRD**: the main loop is a sequential `for (const f of plan.frds)` (line ~652) — it builds one
FRD's waves, runs its gate, and only then moves to the next feature. The wave parallelism
(`parallel(wave.map(...))`, up to 8 in `powerful`) exists ONLY inside one FRD. FRD-level `deps` are
used solely to SKIP an FRD whose parent is blocked — never to schedule independent FRDs concurrently.

**Evidence (personal-page-v2 run, 2026-06-30/07-01, `.pandacorp/track.jsonl`):** after FRD-01
(foundation) verified, SIX FRDs were simultaneously ready — every WO of FRD-02/03/04/05/07/08 declares
`dependsOn` only toward FRD-01's WOs. The engine built them single-file anyway: FRD-02 22:04→22:40,
FRD-03 22:47→23:29, FRD-04 23:31→00:45, FRD-05 00:50→01:46, FRD-07 01:47→02:08, FRD-08 02:09→02:31 —
**~4.5 hours of single-lane queue** with zero concurrency. In `powerful` mode (wave 8) the owner paid
for 8-agent parallelism and got 1 agent at a time.

**Aggravator:** DR-100 right-sizing produces small FRDs (personal-page-v2: almost all 1 WO per FRD),
which turns the intra-FRD wave into a no-op. The mode's wave size is now theoretical for typical
projects. Estimated saving on that run's mid-section: ~4.5h → ~2h.

## Plan

Generalize the Build phase scheduler from per-FRD waves to a **global ready set**, preserving every
existing invariant:

1. **Global wave**: each wave is picked from ALL pending WOs across FRDs whose `dependsOn` are
   satisfied (dep committed → `IN_REVIEW`/`VERIFIED`, same rule as today's intra-FRD `doneIds`),
   with **artifact disjointness (DR-060) checked across the whole wave** (today `pickDisjointWave`
   runs per-FRD; run it over the global ready set) and the mode's wave cap unchanged.
2. **Gates queue, run serialized at wave boundaries**: when an FRD's WOs are all `IN_REVIEW`, its gate
   enters a FIFO; gates run ONE at a time **between waves** so the whole-project suite always sees a
   quiet tree (the current trust boundary, unchanged). A gate reject/reopen re-queues that FRD's WOs
   into the ready set (DR-107 in-run retry semantics preserved).
3. **Unchanged**: foundation-first barrier (`ensureFoundationComplete` already global), Option B
   single serialized commit writer (already a global promise chain), `maxAgents`/budget brakes
   (checked at wave boundaries — same points), safe-point drain (DR-069; runs between waves instead of
   between FRDs — same or better frequency), blockFrd/consecutiveBlocks containment, `wo_commit`/
   `gate`/`achievement` Party emitters (v9.44.0).
4. **Docs**: amend `factory/standards/build-orchestration.md` §1-3 (the "FRD by FRD" phrasing → global
   wave + serialized gates) and DR-050 in `factory/decisions/registry.yaml`; note in
   `plugin/docs/decision-log.md` with a version bump (MINOR).
5. **Mission Control**: no changes required — the Party already derives structure from frontmatter and
   the Campaña strip (planned) will show several FRDs in-flight; `listWorkOrders` is FRD-agnostic.

## Proof

- Unit-level: a dry-run fixture plan (3 FRDs: one foundation + two independent 1-WO FRDs) where the
  schedule trace shows both independent WOs dispatched in the SAME wave after the foundation greens,
  and their gates running serialized afterwards.
- DR-060: a fixture where two ready WOs of DIFFERENT FRDs declare overlapping artifacts → serialized
  into different waves.
- Real validation: next `/pandacorp:implement` run — `track.jsonl` must show overlapping `wo_start`/
  `wo_end` intervals across FRDs, and every gate's `review_start` must not overlap any `wo_start..wo_end`
  interval (quiet-tree invariant).
