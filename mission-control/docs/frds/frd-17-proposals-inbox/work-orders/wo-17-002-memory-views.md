---
id: WO-17-002
type: work-order
slug: memory-views
title: >-
  WO-17-002 — `lib/memory` views: candidates / promotionQueue / prunable /
  memoryHealth
status: DRAFT
parent: FRD-17
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-002 — `lib/memory` views: candidates / promotionQueue / prunable / memoryHealth

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-17-memory`) · [architecture §4.6, §4.7](../../../product/architecture.md).

## Goal
The derived views over `readLessons` that drive the inbox streams + the memory-health panel.

## Scope
- `candidateLessons()` — `status === "candidate"`.
- `promotionQueue()` — `promotion === "proposed"`.
- `prunable()` — `status === "deprecated"` (or flagged for reconciliation).
- `memoryHealth()` — `rawNotes` (lines of `factory/memory/_inbox.md` + each project's
  `.pandacorp/run/lessons.md`), `candidates` count, `lastMemoryRunAt` (proxy: most recent
  `LESSON-*.md` / `_inbox.md` mtime), `staleDays`.

## Acceptance criteria
- **AC-17-002.1** (REQ-17-002) `candidateLessons` returns exactly the `status: candidate` lessons.
- **AC-17-002.2** (REQ-17-006) `promotionQueue` returns exactly the `promotion: proposed` lessons,
  preserving each lesson's `links`/`source` (target + evidence for the queue).
- **AC-17-002.3** `prunable` returns deprecated/reconciliation-flagged lessons.
- **AC-17-002.4** (REQ-17-005) `memoryHealth.rawNotes` counts inbox lines + per-project lesson-note
  lines; tolerates missing files (count 0, no throw).
- **AC-17-002.5** (REQ-17-005) `lastMemoryRunAt` is the most recent available mtime proxy, labelled
  approximate; `null` + `staleDays: null` when no memory files exist (fresh factory).
- **AC-17-002.6** `staleDays` is the integer day delta from `lastMemoryRunAt` to now.

## TDD
Extend `lib/memory.test.ts`; fixtures with candidate/proposed/deprecated lessons + an `_inbox.md` with
N lines + a project `lessons.md`; and an empty-memory fixture for the fresh-factory case.

## Definition of done
- ACs RED → GREEN; empty-tolerant. `.pandacorp/verify.sh` green.

## Dependencies
- WO-17-001; FRD-01 `lib/config.ts`, `lib/portfolio.ts` (to locate per-project `.pandacorp/run/lessons.md`).
