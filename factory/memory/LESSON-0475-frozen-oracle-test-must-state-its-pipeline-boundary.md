---
id: LESSON-0475
type: pattern
domain: testing
tags: [frozen-test, oracle, scope-boundary, test-methodology, real-data]
context: a direct/frozen test that isolates one part of a pipeline (renderer, fonts, storage, notifications) using real assets, without exercising the admission/filter/UI layers in front of it
trigger: use this when designing a frozen/isolated acceptance test with real data that deliberately skips upstream admission, filtering, or UI layers
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — real200-acceptance/source-audit/private200-reference-cleanup-receipt.json"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0390]
---

**Situation:** a direct frozen test isolated the renderer, fonts, storage (R2) and notifications
using real official reference assets, without publishing fabricated/fake data. It was a genuinely
useful acceptance signal, but it did NOT exercise admission, filtering, or the UI layer around that
pipeline. The boundary was kept explicit, and only the technical references themselves were later
withdrawn (with atomic guards), while the results and the real catalog data were preserved.

**Lesson:** a frozen/isolated test proving one segment of a pipeline against real data is valuable
evidence, but it is evidence FOR THAT SEGMENT ONLY — it says nothing about the layers it deliberately
didn't touch (admission rules, filters, the UI that drives the pipeline). Treating it as broader
coverage than it is overstates what's been verified.

**Apply next time:** when designing or reporting on a frozen/isolated real-data test, state its
pipeline boundary explicitly (which stages it covers, which it does not) in the test's own
documentation/receipt, so a later reader cannot mistake segment-level coverage for end-to-end
coverage. If technical reference assets must later be withdrawn, use atomic guards that remove only
those references while preserving the test's results and any real catalog data.
