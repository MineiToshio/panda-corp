---
id: WO-06-005
type: work-order
slug: party-tab-snapshot
title: WO-06-005 — Party tab server snapshot (RSC)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-005 — Party tab server snapshot (RSC)

**Components/Interfaces:** `CMP-06-party-tab` · **Traces:** REQ-06-008, REQ-06-002, REQ-06-005, REQ-06-010
**Deploy unit:** Party tab (Server Component) · **Location:** `app/projects/[slug]/_party/PartyTab.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-008.1: The view SHALL feed off the workflow events written by the subagents (`emit-event.sh`) and the `SubagentStop` hook (`~/.claude/dashboard-events.ndjson`) and off the task state (`~/.claude/tasks/`), **without calling Claude**.
- AC-06-010.1: IF there is no active team, it SHALL show an empty state gracefully.
- AC-06-002.1: EACH workflow subagent SHALL appear as a sprite placed in its zone.

## Scope
- Server Component that, for the project slug: reads the **capped** event tail via `lib/events` (cap 100–200) and task state via `lib/tasks`; reads the build mode via `lib/status`; builds `PartySnapshot` (roster via `IF-06-roster`, initial agent states from the tail, events mapped via `IF-06-event-vm`, `active`, `lastEventAt`).
- Passes the serializable snapshot to `CMP-06-scene`/`CMP-06-feed` (client). No `fs` reaches the client.
- `active=false` (no team / no events / `~/.claude/tasks/` absent) → render `CMP-06-empty`.

## Dependencies
- FRD-01 `lib/events`, `lib/tasks`, `lib/status`, `lib/config` (cross-feature, hard).
- WO-06-001 (mapper), WO-06-002 (roster).

## TDD / Definition of done
- Tests with `PANDACORP_FACTORY_ROOT` fixtures: builds a snapshot from a fixture ndjson tail; respects the cap (drops oldest); absent `tasks/` → `active=false`; malformed lines tolerated (never throws); never imports a Claude/AI client (auditable). `lastEventAt` is the newest `at`.
- Gate green.

## Status Note

**Built:** `CMP-06-party-tab` — Party tab Server Component with full `lib/tasks` + `lib/events` integration.

**Interfaces/contracts exposed:**

```ts
// lib/tasks.ts — IF-06-tasks
export type TasksState = { active: boolean; teamCount: number };
export function readTasksState(tasksDir: string): TasksState;
// Never throws. Absent dir → { active: false, teamCount: 0 }.
// Only subdirectories count (files are ignored). Fully serializable.

// app/projects/[slug]/_party/PartyTab.tsx — CMP-06-party-tab
export interface PartyTabProps {
  eventsPath?: string;   // NDJSON path; defaults to ~/.claude/dashboard-events.ndjson
  tasksDir?: string;     // tasks dir; defaults to TASKS_DIR (~/.claude/tasks)
  cap?: number;          // event tail cap; default 200
}
export function PartyTab(props: PartyTabProps): React.JSX.Element;
```

**Active flag logic:** `active = tasksState.active && eventVMs.length > 0`. Both conditions required:
tasks directory must have at least one subdirectory AND events must be present. This implements
AC-06-010.1 ("no active team → empty state gracefully") and the WO TDD requirement ("absent tasks/ → active=false").

**Integration seams:**
- Consumes `readEvents` (lib/events, WO-01-007) for the capped event tail.
- Consumes `readTasksState` (lib/tasks, new) for the active-team gate.
- Produces `EventVM[]` via `toEventVM` (event-vm.ts, WO-06-001) and passes to `EventFeed` (WO-06-007).
- `data-testid` map: `party-tab` (container), `party-tab-live-indicator` (active+events), `party-tab-no-signal` (no active team or no events), `party-tab-empty` (empty state body).

**Fixture added:** `tests/fixtures/tasks/team-001/` (empty dir = one team subdir, active=true).
Exported as `FIXTURE_TASKS_ACTIVE_DIR` and `FIXTURE_TASKS_ABSENT_DIR` from `tests/fixtures/index.ts`.

**Test files:**
- `lib/tasks.test.ts` — 13 tests (absent dir, empty dir, dirs with subdirs, files-only, shape invariants, auditable import).
- `app/projects/[slug]/_party/PartyTab.test.tsx` — 12 tests (all now pass explicit `tasksDir` fixture to avoid environment-dependence on `~/.claude/tasks`).
- `app/projects/[slug]/_party/PartyTab.snapshot.test.tsx` — 11 tests (tasks gate, active flag, container invariants, lastEventAt, malformed tolerance).

**Gate:** 145 test files, 3924 tests GREEN + 2 expected-fail + 5 skipped. tsc clean. biome clean on scope (pre-existing errors in engine.ts/engine.test.ts, WO-06-004, unchanged).
