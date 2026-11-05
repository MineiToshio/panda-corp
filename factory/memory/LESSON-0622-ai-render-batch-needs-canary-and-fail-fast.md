---
id: LESSON-0622
type: anti-pattern
domain: batch-processing
tags: [canary, fail-fast, batch-jobs, ai-generation, ops]
context: launching a large batch of independent AI-generation/render jobs (e.g. background-removal, upscale, image generation) with no canary run and no abort-on-failure logic
trigger: use this when about to launch (or design the runner for) a multi-job AI-generation/processing batch — before the full run, and before trusting a runner with no failure cutoff
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-04 (owner-stated): a 117-job AI render batch (Naruto step8) was launched with no canary and no fail-fast; 110/117 jobs 'failed' and it went unnoticed for hours before anyone checked the output"
provenance: owner-stated
created: 2026-11-05
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0092, LESSON-0260, LESSON-0624]
---

**Situation:** a 117-job AI render batch was launched directly at full scale, with no small-scale canary
run first and no logic to stop the runner after repeated failures. 110 of the 117 jobs failed, and because
nothing surfaced or stopped on failure, this went completely unnoticed for hours — the batch "ran to
completion" with a 94% failure rate and looked, from the runner's point of view, like nothing was wrong.

**Lesson:** a batch runner that reports "all jobs dispatched" or "run finished" gives no signal about
whether the jobs actually SUCCEEDED — at real batch scale, a systemic failure (a changed API, a bad
prompt template, a broken post-processing step) fails nearly every job the same way, but a runner with no
canary and no fail-fast treats that identically to a healthy run. The cost of catching this early (a
handful of jobs) is trivial compared to the cost of discovering it hours later across the whole batch.

**Apply next time:** before launching any multi-job AI-generation/processing batch, run a small END-TO-END
canary first (e.g. 3 jobs through the FULL pipeline — generate → post-process → every downstream gate —
not just the generation call) and confirm those canary jobs pass every check a real job would need to
pass. Build the runner itself to ABORT after N consecutive job failures (not just log them) rather than
continuing to burn through the rest of the batch — a systemic failure should stop the run loudly, not
complete silently with a near-total failure rate buried in per-job logs nobody checked yet.
