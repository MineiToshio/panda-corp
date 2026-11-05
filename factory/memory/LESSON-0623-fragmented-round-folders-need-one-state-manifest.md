---
id: LESSON-0623
type: pattern
domain: pipeline-state-management
tags: [state-manifest, single-source-of-truth, photo-pipeline, asset-pipeline, review-rework]
context: a multi-round photo/asset-sourcing pipeline where each round's output lands in its own numbered folder with its own partial manifest, rather than one tracked state per view/item
trigger: use this when designing or debugging a multi-round sourcing/review pipeline (photos, assets, any item that goes through several correction passes) and state is being tracked per-round instead of per-item/per-view
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-04 (agent-inferred): photo rounds fragmented into round3/4/5 folders with partial manifests, so the state of each view was unclear and reviewers re-found the same defects already fixed in a later round"
provenance: agent-inferred
created: 2026-11-05
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0609, LESSON-0598]
---

**Situation:** a photo-sourcing/review pipeline went through multiple correction rounds (round3, round4,
round5), each writing its output to its own numbered folder with its own partial manifest covering only
that round's changes. Because no single manifest tracked the current, authoritative state of each
view/item across rounds, reviewers couldn't tell which round's version was current for a given view and
repeatedly re-found defects that a later round had already fixed.

**Lesson:** per-round output folders are a natural way to WRITE a correction pass (isolate this round's
changes), but they are a poor way to READ the current state — anyone needing "what is the state of view X
right now" has to reconstruct it by scanning every round folder in order and reasoning about which one is
authoritative, and that reconstruction is exactly where stale/already-fixed defects get re-flagged as new.

**Apply next time:** for any multi-round correction pipeline, keep per-round folders for raw output/
history if useful, but maintain ONE state manifest per view/item (e.g. a single file or row tracking
source → candidate → gates → review → approved for that view) that is updated in place as each round
lands — never have the authoritative "current state" live only in whichever round folder happens to be
newest. A reviewer or downstream step should read that one manifest, not infer current state from folder
numbering.
