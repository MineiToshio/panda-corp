---
id: LESSON-0508
type: gotcha
domain: ci-cd
tags: [cron, github-actions, scheduling, slo, data-retention]
context: designing a feature whose correctness relies on a GitHub Actions scheduled (cron) workflow firing at a specific interval (e.g. hourly erasure/retention jobs)
trigger: use this when designing or reviewing a time-sensitive guarantee (data retention, erasure deadline, SLA) that depends on a GitHub Actions cron trigger firing on schedule
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred) — an hourly cron (`17 * * * *`) fired only 8 times in ~36h (observed every 4-6h, not hourly)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0476]
---

**Situation:** a cron scheduled hourly (`17 * * * *`) was observed firing only 8 times across a ~36-hour
window (an actual cadence of roughly every 4-6 hours), not the ~36 runs the nominal interval implies.

**Lesson:** GitHub Actions' scheduled triggers are best-effort and queue-dependent, with no SLA on actual
cadence — the real firing interval can be a multiple of the declared one, persistently, not just as an
occasional delay. Any feature whose correctness depends on a specific firing cadence (e.g. "erase data
within 24h of a request", "refresh within N hours") cannot assume the nominal cron interval holds.

**Apply next time:** when a feature's correctness depends on a scheduled cadence, build in generous
margin (target well under the stated deadline, or gate eligibility on elapsed wall-clock time rather than
an assumed run count) and add an observability check that alerts if the job hasn't actually run within
some multiple of its nominal interval. This is the design-time counterpart of LESSON-0476 (which covers
diagnosing why a schedule appears not to have fired) — this lesson is about not depending on the nominal
cadence being honored in the first place.
