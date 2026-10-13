---
id: LESSON-0296
type: gotcha
domain: agent-tooling
tags: [artifact, artifact-comments, claude-tooling]
context: reading and responding to comments on a published Artifact via the ArtifactComments tool
trigger: use this when reading or replying to comments on a published Artifact and deciding whether a comment is visible/actionable
source: "panda-corp, mission-control .pandacorp/run/lessons.md 2026-10-12 (owner-stated test)"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** tested `ArtifactComments`' `read` action against a published artifact carrying comments the
owner had left but NOT explicitly sent to Claude. The read returned those unsent comments too — full text,
anchor, and location — not just the ones addressed to Claude.

**Lesson:** `read` surfaces every comment on the artifact regardless of whether it was sent to Claude; "not
sent to Claude" only gates the REPLY/RESOLVE actions (which require the comment's thread to be activated
first), not visibility. Don't assume an unread/unsent-looking comment is invisible to a read pass.

**Apply next time:** when auditing feedback on a published artifact, `read` ALL comments (sent or not) to
get the complete picture; only gate `reply`/`resolve` on whether the thread has actually been activated —
check that state explicitly rather than inferring it from whether the comment "looks" addressed to Claude.
