---
id: LESSON-0540
type: gotcha
domain: testing
tags: [playwright, test-results, artifacts, retry, flaky, root-cause]
context: a Playwright test fails once, and the instinct is to just re-run it to see if it was a fluke
trigger: use this when a Playwright (or similar) e2e test fails and you are about to retry it, especially under time pressure to reach a green gate
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-25 (agent-inferred) — observed closing out the Reservado/export-codexGate baseline: a Playwright test timed out once, the retry run's `outputDir` was wiped by the new run, the retry came back green, and the original timeout's trace/context was gone with nothing left to explain why it happened the first time"
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0512, LESSON-0480]
---

**Situation:** a Playwright test timed out during a gate run. Before investigating, it was simply
re-run; Playwright's default behavior wipes `outputDir` (test-results, traces, screenshots, videos) at
the start of a new run, so by the time the retry came back green, the artifacts from the ORIGINAL
failing run were gone. A green retry was treated as "resolved" with no evidence of what actually
happened the first time.

**Lesson:** a green retry proves the test CAN pass, not WHY it failed the first time — and the single
piece of evidence that could answer that (the failing run's trace, console/network log, and
screenshot) is destroyed by the very act of retrying with default settings. This silently converts a
potentially real, recurring defect (a race condition, a resource-contention flake per LESSON-0480, a
genuine regression) into an unfalsifiable "it passed on retry" with no way to later confirm which one
it was.

**Apply next time:** before retrying a failed Playwright run, copy its `test-results`/trace directory
to a dedicated, timestamped location (or configure a non-overwriting `outputDir` for the retry) so the
original failure's evidence survives the new run. Only after the artifact is preserved, retry — and
treat "passes on retry" as inconclusive, not resolved, until the preserved trace has actually been
examined to classify the failure (see LESSON-0512 for the specific technique of reproducing against
the pre-change parent commit before blaming a just-landed change).
