---
id: LESSON-0476
type: gotcha
domain: ci-cd
tags: [cron, scheduled-workflow, github-actions, latency, root-cause-attribution]
context: a scheduled (cron) CI workflow appears to have fired zero times, or very late, and the instinct is to attribute it to an account/config restriction specific to that workflow
trigger: use this when diagnosing why a scheduled CI workflow seems to have not run or run late, before attributing it to a workflow-specific cause
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — scheduler-investigation/historical-schedule-delay.json"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** before attributing "zero cron events" to an account/config restriction on a new
workflow, the OTHER scheduled workflows in the same repository were checked for their own cron runs
at the exact same HEAD. One of them (`CI39260069279`) ran 7h08m45s AFTER its 06:17 UTC scheduled time
— proof of a general, repo/platform-level historical scheduling delay, not evidence specific to the
workflow under investigation.

**Lesson:** GitHub Actions' (and similar CI platforms') scheduled/cron triggers can carry substantial,
sometimes multi-hour, historical delay independent of any particular workflow's own configuration.
Observing "this workflow didn't fire" or "fired late" without checking sibling scheduled workflows in
the same repo at the same point in time risks attributing a platform-wide latency pattern to a
workflow-specific bug or account restriction that doesn't exist.

**Apply next time:** before diagnosing a scheduled workflow's apparent non-firing or lateness as a
config/account-specific problem, pull the actual run history of OTHER scheduled workflows in the same
repository around the same HEAD/time window as comparative evidence. A shared, platform-level delay
pattern rules out a workflow-specific cause; its absence narrows the search to this workflow's own
configuration.
