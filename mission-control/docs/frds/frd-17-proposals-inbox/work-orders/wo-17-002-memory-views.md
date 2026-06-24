---
id: WO-17-002
type: work-order
slug: memory-views
title: >-
  WO-17-002 — `lib/memory` views: candidates / promotionQueue / prunable /
  memoryHealth
status: DRAFT
parent: FRD-17
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-17-001]
last_updated: '2026-06-18'
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

## Status Note

**Built (2026-06-18):** Implemented `memoryHealth()` + all derived views (`candidateLessons`, `promotionQueue`, `prunable`) for WO-17-002.

**What was built:**
- `src/lib/memory/memory-health.ts` — new module with `memoryHealth(): MemoryHealth` and all private helpers. Split from `memory.ts` to respect the 500-line limit. Avoids circular dependency by importing `readLessons` (not `candidateLessons`) from `./memory` and inlining the filter.
- `candidateLessons()`, `promotionQueue()`, `prunable()` already existed in `src/lib/memory/memory.ts` (from WO-17-001); no changes needed.

**Interfaces/contracts exposed:**
```ts
// src/lib/memory/memory-health.ts
export type MemoryHealth = {
  rawNotes: number;           // non-empty lines in _inbox.md + per-project run/lessons.md
  candidates: number;         // lessons with status === "candidate"
  lastMemoryRunAt: string | null;  // ISO 8601, most recent LESSON-*.md/_inbox.md mtime
  staleDays: number | null;   // integer days since lastMemoryRunAt
};
export function memoryHealth(): MemoryHealth;
```

**Integration seams:**
- Consumers import `memoryHealth` from `@/lib/memory/memory-health` (not from `@/lib/memory/memory`).
- `candidateLessons`, `promotionQueue`, `prunable` are imported from `@/lib/memory/memory`.

**Test files:**
- `src/lib/memory/_tests/memory-health.test.ts` — 28 tests covering AC-17-002.1 through AC-17-002.6 (real fs fixture trees, no mocks).
- `src/lib/memory/_tests/memory.test.ts` — 46 pre-existing tests for `readLessons` + view functions.
- `src/lib/memory/_tests/memory.adversarial.test.ts` — 5 adversarial `parseProjects` tests.

**Verification:** 74/74 tests pass in memory module; 5279/5279 in full suite. tsc --noEmit clean. No circular dependencies (madge). Biome formatting clean on touched files; pre-existing complexity warning in `readLessons()` (complexity=39) is from WO-17-001, not this WO.
