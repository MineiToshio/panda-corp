---
id: LESSON-0725
type: gotcha
domain: build-engine
tags: [verify-sh, playwright, no-bail, benchmarking, gate-cost]
context: measuring, comparing or reasoning about the wall-clock cost of a `verify.sh --no-bail` diagnostic run against a normal certification gate run
trigger: use this when timing or comparing `verify.sh --no-bail` runs against normal full-gate certification, or when deciding whether a `--no-bail` measurement is representative of real merge-queue cost
source: "mission-control .pandacorp/run/lessons.md 2026-11-20 (agent-inferred), read against playwright.config.ts:142,165-166"
provenance: agent-inferred
created: 2026-11-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `--no-bail` was used to collect every failing test in one pass instead of stopping at the
first failure (DR-158's `bail=1`/`maxFailures=1` default). Reading `playwright.config.ts` showed that
`--no-bail` also drops Playwright's worker count to 1 (lines ~142, ~165-166) — a diagnostic run under
`--no-bail` is NOT just "the same gate, minus early exit": it also loses the normal run's parallel-safe
worker tier (DR-143).

**Lesson:** `--no-bail` changes TWO things at once — it accumulates failures instead of stopping at the
first one, AND it forces single-worker execution — so its wall-clock cost is not comparable to a normal
certification run's cost. Treating a `--no-bail` timing as representative of what the merge queue's real
gate run costs (or will cost after a fix) silently inflates the estimate, because the single-worker
tier is strictly slower than the parallel-safe tier it replaces.

**Apply next time:** when benchmarking gate speed or explaining a slow run to the owner, always check
which mode produced the number — a `--no-bail` diagnostic timing is a repair-phase cost, never a stand-in
for certification cost. Compare like for like: normal-mode timings against normal-mode timings,
`--no-bail` timings only against other `--no-bail` timings.
