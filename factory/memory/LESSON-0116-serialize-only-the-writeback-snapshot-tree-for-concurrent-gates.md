---
id: LESSON-0116
type: pattern
domain: build-orchestration
tags: [worktree, concurrency, gate, dr-118, pinned-worktree]
context: letting a review/verification gate run concurrently with ongoing build work when the gate needs a quiet, non-moving tree to evaluate
trigger: use this when a gate/review step needs a stable snapshot of the tree but freezing the whole pipeline until it finishes would waste wall-clock
source: "panda-corp — implement-overhaul 2026-07-07 (DR-118 concurrent FRD gates), factory/memory/_inbox.md, factory/standards/build-orchestration.md"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [factory/standards/build-orchestration.md]
---

**Situation:** the build engine needed review gates to overlap with build work instead of serializing the
whole pipeline (build → wait for gate → build next), but a gate evaluating a moving tree is unsound — it
needs the code frozen at the exact SHA it's judging.

**Lesson:** don't freeze the pipeline to get a quiet tree — snapshot the tree instead. Pin a detached
worktree at the FRD's enqueue SHA and run the gate against that isolated checkout while the main tree keeps
moving with the next unit of build work. The only thing that still needs to serialize is the WRITE-BACK: a
single apply-gate step that stamps `VERIFIED`/`last_green_sha` on the main branch, so two concurrently
finishing gates can't race each other's rollup writes. This generalizes past this one engine: whenever a
verification step needs isolation-in-time from a mutating shared resource, prefer an isolated snapshot of
the resource over blocking all mutation, and narrow the serialization point down to the smallest write that
actually needs it.

**Apply next time:** when a gate/check needs a non-moving input but blocking all producers would cost too
much wall-clock, reach for a pinned/detached worktree (or equivalent snapshot) per gate instance, and keep
the critical section to just the final state-mutating write-back, not the whole evaluation.
