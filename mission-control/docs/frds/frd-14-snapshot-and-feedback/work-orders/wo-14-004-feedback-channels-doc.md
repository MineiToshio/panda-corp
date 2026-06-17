---
id: WO-14-004
type: work-order
slug: feedback-channels-doc
title: 'WO-14-004 — Manual: the three feedback channels (doc)'
status: DRAFT
parent: FRD-14
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-14-004 — Manual: the three feedback channels (doc)

**Feature:** FRD-14 · **Implements:** REQ-14-006 · (doc deliverable, hosted by the FRD-08 Manual)
**Deploy unit:** a Manual content section (Guides/Concepts) — no app logic.

## Acceptance criteria (copied)
- **AC-14-006.1** The Manual SHALL document the three feedback channels (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`) as file-based, picked up at the next safe point.

## Scope
- Author the "Feeding an in-progress build" section in the Manual (FRD-08 surface) explaining the
  three channels:
  - `/pandacorp:bug` — report a bug found while testing the probable snapshot.
  - `/pandacorp:iterate` — add a feature / change behavior.
  - `/pandacorp:decide` — answer a pending decision point.
  All three write **files** that the build picks up at the **next safe point** (it never interrupts
  mid-work-order). Cross-link the snapshot panel (CMP-14-snapshot-panel) and FRD-04's decision points.
- Spanish, hand-authored Guide content (the Manual's Reference is derived; this is a Guide).
- **Out of scope:** the Manual app shell/derivation (FRD-08); MC code.

## Dependencies
- **Intra:** none.
- **Cross:** FRD-08 (Manual must exist to host the section).

## Definition of done
- [ ] Section authored in the Manual, naming the three channels and the "next safe point" semantics.
- [ ] Cross-links the snapshot panel and the workspace decision points.
- [ ] Consistent with `factory/standards/infra.md` (state written by the gate, not the agent).
- [ ] No code change → the gate is N/A for the doc itself; if it ships as an MC Manual page, that
      page's render is covered by FRD-08's tests and `bash .pandacorp/verify.sh`.
