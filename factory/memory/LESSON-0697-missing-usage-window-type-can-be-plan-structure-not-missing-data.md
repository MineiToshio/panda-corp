---
id: LESSON-0697
type: gotcha
domain: build-engine
tags: [capacity, quota, usage-rollup, dr-162, plan-structure, data-modeling]
context: reading a model/account provider's usage-rollup data (windows, limits, resets) and deciding whether an expected window type that is absent means "data not reported yet" or "this plan doesn't have that window"
trigger: use this when a usage/quota reader finds a window type (e.g. a 5-hour rolling window) missing from an account's rollup and is tempted to treat it as missing/stale data requiring a fallback or a retry
source: "mission-control .pandacorp/run/lessons.md 2026-11-13, during the DR-162 shared-capacity-allocator build (owner-stated): the owner's Codex plan has only a weekly usage window, no 5-hour window — its absence from the Codex rollout data is normal for that plan, not a missing-data bug. Confirmed in plugin/docs/capacity.md and the 2026-11-14 decision log ('Codex's absent five-hour window does not apply to this account')."
provenance: agent-inferred
created: 2026-11-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-162, LESSON-0698]
---

**Situation:** building the cross-tool capacity allocator (DR-162), a usage-window reader expected both
a 5-hour and a weekly window per account; one account's data genuinely has no 5-hour window entry at
all, because that provider plan simply doesn't offer that window type — not because the read failed or
the data hasn't arrived yet.

**Lesson:** a provider's usage/quota rollup can vary SHAPE by plan, not just by VALUE — a given window
type being absent can be a structural fact about what that plan tracks, distinct from "unknown" (not yet
reported) or "stale" (reported once, now old). Conflating "structurally absent" with "missing data" leads
to the wrong remediation: retrying, waiting, or falling back to a conservative default for a field that
will never arrive, instead of simply treating that window type as not applicable for that account.

**Apply next time:** when a usage/quota/telemetry reader encounters an expected field that is absent for
one account/plan but present for another, first check whether the provider's plan tiers structurally
differ in which fields they report before writing fallback/retry logic for "missing" data — a schema
difference across plan tiers is not the same failure mode as a late or dropped reading, and treating it
as the latter wastes effort chasing data that was never going to appear.
