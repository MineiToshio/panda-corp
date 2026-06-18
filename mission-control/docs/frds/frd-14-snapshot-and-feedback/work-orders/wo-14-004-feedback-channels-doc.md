---
id: WO-14-004
type: work-order
slug: feedback-channels-doc
title: 'WO-14-004 — Manual: the three feedback channels (doc)'
status: DRAFT
parent: FRD-14
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-18'
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
- [x] Section authored in the Manual, naming the three channels and the "next safe point" semantics.
- [x] Cross-links the snapshot panel and the workspace decision points.
- [x] Consistent with `factory/standards/infra.md` (state written by the gate, not the agent).
- [x] No code change → the gate is N/A for the doc itself; if it ships as an MC Manual page, that
      page's render is covered by FRD-08's tests and `bash .pandacorp/verify.sh`.

## Status Note

**Built:** A new Manual Guide page documenting the three feedback channels for an in-progress build.

**Files delivered:**

- `content/manual/guides/alimentar-build.md` — the "Alimentar una construcción en marcha" guide (group: guides, order: 4). Covers:
  - The three channels (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`) each with file-based mechanism described.
  - Safe-point pickup semantics: the motor reads channels between WOs, never mid-work-order.
  - Cross-link to the snapshot panel (CMP-14-snapshot-panel): describes the `pending_bugs` (red chip) and `pending_decisions` (amber chip) as visible in the snapshot panel.
  - Cross-link to workspace decision points: references `decisions.md` and the `pending_decisions` counter in the FRD-04 workspace.
  - Consistency with `factory/standards/infra.md`: explicitly states that state (`last_green_sha`, `safe_to_test`, `pending_bugs`, `pending_decisions`) is written by the gate script, not the agent.

- `content/manual/wo-14-004.feedback-channels.test.ts` — 16 tests covering AC-14-006.1:
  - File existence and indexing by `readManualPages()`.
  - Page is in `guides` group with non-empty title and body.
  - All three channels named (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`).
  - File-based semantics documented.
  - Safe-point pickup semantics documented.
  - "Never interrupts mid-work-order" semantics documented.
  - Cross-link to snapshot panel (regex: `snapshot.*panel|punto.*probable|...`).
  - Cross-link to workspace decision points (regex: `decisi.*pendiente|decisions\.md|...`).
  - infra.md consistency: gate-driven state (not agent-direct).
  - Regression guard: prior WO-08-005 guides still present.

**Interfaces/contracts exposed:**
- The page is discovered automatically by `readManualPages(APP_ROOT)` (IF-08-manual-index from WO-08-001) — no registration needed beyond the `.md` file placement in `content/manual/guides/`.
- Rendered by `DocReader` (CMP-08-doc-reader, WO-08-002) via `react-markdown` when selected in `DocNav`.

**Integration seams:**
- Consumed by the FRD-08 Manual shell (WO-08-002): the guide appears in the "Guías" nav group automatically.
- The `readManualPages()` index picks it up at `order: 4` within the guides group.

**Test files:**
- `content/manual/wo-14-004.feedback-channels.test.ts` (16 tests, all GREEN)

**Gate:** 16/16 WO-14-004 tests GREEN. 180 test files, 4973 tests total GREEN (2 expected-fail, 5 skipped). tsc clean (pre-existing probe-file warnings unchanged). biome clean.
