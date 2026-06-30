---
id: WO-01-005
type: work-order
slug: read-status
title: 'WO-01-005 — `readStatus` (yaml, partial-tolerant)'
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-000, WO-01-001]
last_updated: '2026-06-30'
---
# WO-01-005 — `readStatus` (yaml, partial-tolerant)

**Module:** `lib/status.ts`
**IDs touched:** `CMP-01-status`, `IF-01-readStatus`; REQ-01-005, REQ-01-006 (supplies `phase`), REQ-01-010
**Dependencies:** WO-01-000 (fixtures), WO-01-001 (`pathExists`)

## EARS criteria (from FRD-01)

- AC-01-005.1 — WHEN a project has `.pandacorp/status.yaml`, the system SHALL read phase, version,
  running, progress, work order count, `pending_decisions`, `pending_bugs`, `last_green_sha` and
  `safe_to_test`.
- AC-01-006.1 — WHEN a card is `in-pipeline`, its column comes from the linked project's `phase`;
  the project's `status.yaml` is the single source of truth for the phase. *(This WO exposes the
  `phase`; the column map is FRD-02 `lib/board.ts`.)*
- (Edge) — `status.yaml` absent or malformed → render partial data, without breaking.

## Contract

```ts
type Phase = "product" | "design" | "architecture" | "implementation" | "release";
type ProjectStatus = {
  project: string; phase: Phase; version: string; running: boolean;
  progress?: number; workOrdersTotal: number; workOrdersDone: number;
  pendingDecisions: number; pendingBugs: number; rethinkPending: boolean;
  advancePending: boolean; lastGreenSha: string; safeToTest: boolean;
  overlayVersion?: string; createdWith?: string; updatedAt?: string; repo?: string;
};
type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };

export function readStatus(projectPath: string): StatusResult;  // uses config.projectStatusPath
```

- Resolve `<projectPath>/.pandacorp/status.yaml` via `config.projectStatusPath`.
- Absent (use `pathExists`) → `{ present: false, malformed: false, status: null }`.
- Parse with `yaml`. Malformed → `{ present: true, malformed: true, status: {} }` (never throw).
- Map snake_case → camelCase (`work_orders_total`→`workOrdersTotal`, `last_green_sha`→`lastGreenSha`,
  `safe_to_test`→`safeToTest`, etc.). Missing keys stay `undefined`/omitted (partial-tolerant).

## Definition of done

- [x] `lib/status.test.ts` (RED first):
  - [x] `proj-a` → `present: true, malformed: false`, with `phase`, `version`, `running`,
    `workOrdersTotal/Done`, `pendingDecisions`, `pendingBugs`, `lastGreenSha`, `safeToTest` mapped.
  - [x] `proj-b` (malformed yaml) → `present: true, malformed: true, status: {}` (no throw).
  - [x] non-existent project path → `present: false`.
- [x] No write; fail-soft per blueprint §3.
- [x] `.pandacorp/verify.sh` green.

## Status: DONE

**Evidence:** `bash .pandacorp/verify.sh` — 669 tests passed, biome+tsc clean (2026-06-16).
`lib/status.test.ts`: 109 tests covering AC-01-005.1, AC-01-006.1, REQ-01-010, REQ-01-011,
regressions B1'/I2/I3, snake→camel sweep, idempotency, discriminated-union invariants.
`lib/status.adversarial.test.ts` also green (pre-existing adversarial suite).

## Status Note — 2026-06-30 addendum: `readStatusWithLiveDecisions` (DR-092 single source)

**Bug found by the owner:** the portfolio rail's "Decisiones pendientes" badge could show a stale
count — `pending_decisions` is a maintenance-only YAML counter (written as a skill side effect) that
drifts the moment a decision is resolved without that specific write (it happened here: the owner
resolved a decision in conversation on 2026-06-21; nobody decremented `status.yaml`).

**Fix:** new exported wrapper `readStatusWithLiveDecisions(projectPath)` — calls `readStatus` then
overrides `status.pendingDecisions` with the live count from `.pandacorp/inbox/decisions.md`
(`countPendingDecisions`, WO-04-001). `readStatus()` itself is UNCHANGED — still a pure YAML parser,
its own contract/tests untouched. The wrapper is the single source every owner-facing surface that
displays `pendingDecisions` must call (DR-092); see WO-03-001 and WO-09-006 for its two call sites.

**New tests:** 3 cases in `status.test.ts` — stale-counter override, decisions.md absent → 0 with
every other field untouched, status.yaml absent → `present:false` same as `readStatus`.

**verify.sh at this addendum:** GREEN (same run as WO-04-001's addendum above).
