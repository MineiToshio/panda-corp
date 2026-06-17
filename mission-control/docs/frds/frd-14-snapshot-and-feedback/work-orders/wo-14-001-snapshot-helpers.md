---
id: WO-14-001
type: work-order
slug: snapshot-helpers
title: 'WO-14-001 — `lib/snapshot.ts`: `buildSnapshot` + `isSnapshotStale`'
status: DRAFT
parent: FRD-14
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
- [ ] Tests written first and green.
- [ ] No `any`/`@ts-ignore`; pure (no fs); threshold in `lib/constants.ts` (no magic numbers).
- [ ] `bash .pandacorp/verify.sh` passes.
