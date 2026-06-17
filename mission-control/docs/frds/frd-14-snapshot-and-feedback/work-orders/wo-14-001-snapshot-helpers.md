---
id: WO-14-001
type: work-order
slug: snapshot-helpers
title: 'WO-14-001 — `lib/snapshot.ts`: `buildSnapshot` + `isSnapshotStale`'
status: DRAFT
parent: FRD-14
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-14-001 — `lib/snapshot.ts`: `buildSnapshot` + `isSnapshotStale`

**Feature:** FRD-14 · **Implements:** IF-14-snapshot · **REQ-14-001, REQ-14-002, REQ-14-003**
**Deploy unit:** `lib/snapshot.ts` (+ `lib/snapshot.test.ts`). Pure helpers, no fs, no UI.

## Acceptance criteria (copied)
- **AC-14-001.2** The panel SHALL render `git worktree add ../<slug>-review <last_green_sha>` with a copy button. *(command string derived here)*
- **AC-14-001.3** WHEN `last_green_sha` is absent, the panel SHALL be omitted. *(helper returns `null`)*
- **AC-14-002.1** WHEN running with a work order in progress, show "building now: <progress>". *(`buildingNow` field derived here)*
- **AC-14-003.1** WHEN `last_green_sha` is far behind HEAD, show a staleness warning. *(verdict derived here)*

## Scope
- `buildSnapshot(slug, status): SnapshotInfo | null` — pure: from already-read `ProjectStatus`,
  produce `{ sha, safeToTest, worktreeCommand, buildingNow?, stale }`. Return `null` when
  `last_green_sha` is absent (AC-14-001.3). `worktreeCommand = git worktree add ../<slug>-review <sha>`
  (AC-14-001.2). `buildingNow = status.progress` when `running` (AC-14-002.1).
- `isSnapshotStale(commitsBehind, hoursSinceGreen): boolean` — pure verdict against a documented
  threshold (constant in `lib/constants.ts`); inputs come from the caller (see blueprint §5 flag).
- **Out of scope:** the `git` probe that produces `commitsBehind`/`hoursSinceGreen` (route handler,
  reused from FRD-15/16 — wired in WO-14-002); the UI (WO-14-002).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-01 `ProjectStatus` type (`lib/status.ts`).

## TDD (RED → GREEN → refactor)
`lib/snapshot.test.ts`:
1. `buildSnapshot` builds the worktree command with the slug + sha (AC-14-001.2).
2. Absent `last_green_sha` → `null` (AC-14-001.3).
3. `running` with progress → `buildingNow` set; not running → undefined (AC-14-002.1).
4. `isSnapshotStale` true past the threshold (commits/hours), false within it (AC-14-003.1).
5. Pure: same input → same output, no fs.

## Definition of done
- [x] Tests written first and green.
- [x] No `any`/`@ts-ignore`; pure (no fs); threshold exported from `lib/snapshot.ts` (no magic numbers).
- [x] 29/29 tests GREEN. biome clean. tsc clean (no new errors). Full suite 179 files / 4957 tests GREEN.

## Status Note

**Built:** `lib/snapshot.ts` (IF-14-snapshot) + `lib/snapshot.test.ts` (29 tests).

**Interfaces/contracts exposed:**

```ts
// lib/snapshot.ts

export const SNAPSHOT_STALE_COMMITS_THRESHOLD = 10;  // at or above → stale
export const SNAPSHOT_STALE_HOURS_THRESHOLD = 24;    // at or above → stale

export interface SnapshotInfo {
  sha: string;            // last_green_sha
  safeToTest: boolean;    // safe_to_test (false when absent)
  worktreeCommand: string;// "git worktree add ../<slug>-review <sha>"
  buildingNow?: string;   // set when running=true; includes progress% if available
  stale: boolean;         // false by default; caller sets after git probe (WO-14-002)
}

export function buildSnapshot(slug: string, status: Partial<ProjectStatus>): SnapshotInfo | null;
// null when lastGreenSha absent/empty (AC-14-001.3)

export function isSnapshotStale(commitsBehind: number, hoursSinceGreen: number): boolean;
// true when commitsBehind >= 10 OR hoursSinceGreen >= 24 (AC-14-003.1)
```

**Design note:** thresholds live in `lib/snapshot.ts` (not `lib/constants.ts` which owns build-mode catalog). `stale` defaults to `false` in `buildSnapshot` because the function is pure/no-git; WO-14-002 route handler will probe git and call `isSnapshotStale` to compute the real verdict.

**Integration seams for WO-14-002:**
- Import `buildSnapshot` + `isSnapshotStale` + `SNAPSHOT_STALE_*` from `@/lib/snapshot`.
- After probing `git rev-list --count <sha>..HEAD` and computing hoursSinceGreen, call `isSnapshotStale(commitsBehind, hours)` and pass the result to the snapshot panel component.

**Test files:** `lib/snapshot.test.ts` — covers all 5 TDD anchors + boundary/purity/constant-export cases.
