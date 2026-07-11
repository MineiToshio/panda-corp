---
id: LESSON-0118
type: gotcha
domain: javascript
tags: [off-by-one, retry-cap, counter, comparison-operator]
context: writing a counter cap/retry-limit check where the counter is incremented before the comparison
trigger: use this when writing or reviewing any "increment a counter then compare it to a cap" retry/tolerance check
source: "panda-corp — implement-overhaul 2026-07-07 (DR-118, foundation gate-null off-by-one fix), factory/memory/_inbox.md"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a foundation gate tolerated transient nulls up to a cap, incrementing a counter on each
transient failure and checking `counter >= CAP` to decide whether to escalate. With `CAP = 2`, this
escalated on the FIRST transient null it should have tolerated a second one for — the check fired one
retry too early.

**Lesson:** when a counter is incremented BEFORE the comparison (`counter++; if (counter >= CAP) escalate`),
using `>=` makes the check trigger AT the Nth occurrence, not AFTER N occurrences — it silently tolerates
one FEWER retry/instance than the number written as the cap suggests. This is a generic off-by-one, not
specific to this one gate: any "increment-then-compare" cap check has this trap. The fix is not "always use
one operator" — it's to decide EXPLICITLY which semantic is wanted ("tolerate up to N, escalate on the
(N+1)th" vs "escalate exactly at N") and pick `>` vs `>=` (or adjust the increment order) to match that
decision, rather than defaulting to whichever operator reads naturally.

**Apply next time:** when writing or reviewing any increment-then-compare cap/retry check, write out in
a comment which semantic is intended (tolerate-N vs escalate-at-N) and verify the chosen operator against a
worked example at the boundary (N-1, N, N+1), not just against the happy path.
