---
id: LESSON-0512
type: pattern
domain: testing
tags: [playwright, e2e, verify.sh, attribution, race-condition, merge]
context: a Playwright e2e test fails only when run as part of the full verify.sh suite (e.g. right after a merge) but passes when run in isolation
trigger: use this when a Playwright e2e test fails only inside verify.sh/CI (never standalone) and the instinct is to blame the just-merged change
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0185, LESSON-0040, LESSON-0079]
---

**Situation:** an e2e test failed only inside `verify.sh` right after a merge, and passed when run
standalone. Before concluding the merge caused a regression, the SAME test harness/command was run
against the pre-merge PARENT commit (unmerged) — already green there — and then a probe run with
network/console logging was used to characterize the actual failure. It turned out to be a pre-existing
product-level race (a metadata save triggered by a URL round-trip), unrelated to the merge.

**Lesson:** "fails only inside verify.sh, passes isolated" has two very different possible causes — a
defect the merge introduced, or a pre-existing flake/race that the full suite's timing/ordering happens to
expose while an isolated run doesn't. Blaming the merge without first ruling out the second is how a
correct merge gets reverted or endlessly re-patched for someone else's bug.

**Apply next time:** when an e2e test fails only inside the full gate, first reproduce with the SAME
harness/command against the pre-merge PARENT commit, unmerged — if it's already red there, the merge is
exonerated and the search moves to the pre-existing code; if it's green there, THEN suspect the merge.
Either way, add a network+console probe (not just pass/fail) to characterize the actual failure mode
before writing a fix. See LESSON-0185 for the broader family of harness-level false positives this
attribution technique helps rule in/out, and LESSON-0040 for one specific member of that family.
