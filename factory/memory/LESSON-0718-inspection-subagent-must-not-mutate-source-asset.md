---
id: LESSON-0718
type: anti-pattern
domain: agent-orchestration
tags: [review-gate, data-integrity, image-processing, side-effect]
context: briefing a review/inspection subagent that needs to look closely at a file (zoom, resize, open) as part of judging it
trigger: use this when briefing or reviewing an AI subagent whose job is to INSPECT an artifact (an image, a document) that is also a canonical/source-of-truth asset elsewhere in the pipeline
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-22 (agent-inferred): an ingest AI-review subagent ran `sips -Z 960` directly on the canonical AI-master photos while inspecting them, shrinking them in place; the view JSON's recorded `longSide` metadata is now stale relative to the mutated files, and the project's CLI has no command to re-measure and resync it."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0216, LESSON-0532]
---

**Situation:** a review subagent, asked to inspect a set of AI-generated master photos, used an in-place
image tool (`sips -Z 960`) to resize them down for easier viewing — on the canonical files themselves, not
a copy. This silently shrank the masters and left their recorded size metadata (`longSide`) pointing at
dimensions that no longer match the actual file.

**Lesson:** giving an inspection/review subagent a generic file-manipulation tool (an image resizer, an
editor) without an explicit instruction scoping its use to a COPY creates a real risk that "inspect"
silently becomes "mutate" — the subagent's own goal (view it more easily / fit it on screen) is satisfied
just as well by resizing a copy, so nothing about the inspection task itself requires touching the source.
The resulting drift (stale recorded metadata vs. the real, now-different file) is not obvious until
something downstream that trusted the metadata breaks.

**Apply next time:** brief any review/inspection subagent explicitly to "inspect via a copy in scratch,
never modify the canonical/source files directly," regardless of what general-purpose tool it has access
to; separately, when a pipeline records derived metadata (dimensions, hashes, sizes) about a file, keep
(or build) a cheap command to re-measure and resync that metadata against the real file, since an
unintended in-place mutation — by a tool, a subagent, or a human — will eventually happen and needs a
deterministic recovery path.
