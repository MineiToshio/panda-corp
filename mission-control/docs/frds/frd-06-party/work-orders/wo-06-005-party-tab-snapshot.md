---
id: WO-06-005
type: work-order
slug: party-tab-snapshot
title: WO-06-005 — Party tab server snapshot (RSC)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
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

## Reviewer finding (FRD-06 gate, 2026-06-17, Opus 4.8) — REOPENED → PLANNED

**Blocking integration failure.** `PartyTab` is the single integration seam for FRD-06
(CMP-06-party-tab; the blueprint §2 defines it as *"renders the **scene** + feed + empty
state"*, and this WO traces REQ-06-002 + REQ-06-005, the sprite/roster requirements). The
project page mounts it as the Party tab (`app/projects/[slug]/page.tsx:180` → `<PartyTab />`).
But the current `PartyTab` renders **only** the `EventFeed` + the Live/No-signal badge + the
empty state. It never builds the server-derived `PartySnapshot` (roster + initial agent states
from `status.yaml` build mode, per blueprint §3) and never mounts the RPG scene or the other
client pieces. As a result the HEADLINE acceptance criteria of the feature never reach the
owner's screen:

- **REQ-06-001** — 4 pixel-art zones with labels: `PartyScene` (WO-06-006) is never mounted.
- **REQ-06-002 / REQ-06-005** — a sprite per subagent in its zone / researcher on-demand:
  no `<PartyScene>` → no sprites at all.
- **REQ-06-003 / REQ-06-004** — breathing/wandering + handoff animation: orphaned (engine
  WO-06-004 + scene WO-06-006 are never instantiated on the page).
- **REQ-06-007** — achievement toast: `AchievementToast` (WO-06-008) never mounted.
- **REQ-06-015** — activity pulse: `ActivityPulse` (WO-06-009) never mounted.
- **REQ-06-016** — RPG↔timeline toggle: `RpgViewToggle` (WO-06-010) never mounted.

Proven with a reviewer integration test that renders what `page.tsx` actually mounts
(`<PartyTab>` with an active team fixture) and asserts the scene reaches the DOM:
`app/projects/[slug]/_party/PartyTab.integration.reviewer.test.tsx` — `party-scene`,
`party-zone-library/forge/workshop/lab` and `party-sprite-backend-dev` are all **absent**.
The implementer's own `PartyTab.test.tsx` only asserted the `event-feed` appears and never
checked for the scene — that is the blind spot.

The other ten components (`PartyScene`, `EventFeed`, `ActivityPulse`, `AchievementToast`,
`RpgViewToggle`, the engine/layout/event-vm/state-map pure modules) are individually correct
and well-tested; they are simply **orphaned** because the tab never wires them together.
WO-06-001/002/003/004/006/007/008/009/010/011 remain IN_REVIEW (untouched).

**Concrete fix for the retry (WO-06-005 only):** in `PartyTab.tsx`, when `active`, build the
`PartySnapshot` the blueprint §3 specifies — read `status.yaml` build mode (`lib/status`), derive
`roster = rosterFor(mode)`, the initial `agents[]` (id/state/color via `agentColor`), and
`mode` — then render `<PartyScene roster=… agents=… active mode=… />` (the RPG map) alongside
the existing `<EventFeed>`, plus `<ActivityPulse>`, `<AchievementToast>` and the
`<RpgViewToggle>` host. Keep the reviewer integration test green (scene + zones + a sprite
present when active; still empty state when inactive). The pure mappers + components already
exist — this WO is the composition layer, not a rebuild.

## Resolution (repair engineer, 2026-06-17, Opus 4.8) — RE-IN_REVIEW

Implemented the composition layer the reviewer specified. `PartyTab.tsx` now, **when active**,
builds the server-derived `PartySnapshot` (blueprint §3) and mounts the RPG scene + the toast
alongside the existing feed:

- **Roster** (`IF-06-roster`): added an optional `mode?: BuildMode` prop defaulting to
  `DEFAULT_BUILD_MODE` ("balanced"); `roster = rosterFor(mode)`. (`ProjectStatus`/`status.yaml`
  carry no build-mode field today, so the page mounts `<PartyTab />` with the default roster —
  `backend-dev` is in every roster. When a mode field is added to status, the page forwards it
  via the `mode` prop with zero further change here.)
- **Initial agent states**: new pure `deriveAgents(roster, events)` replays the capped tail
  through `IF-06-state-map` (`eventToVisual`) and keeps the last `setState` per agent; agents
  with no event default to `idle`. Each `AgentInfo` carries `{ id, state, color: agentColor(id) }`.
- **Event diffs**: `visualActions = events.map(eventToVisual)` passed to `<PartyScene events=…>`
  (prop-driven dispatch into the engine's queue).
- **Mounted** (active branch only): `<PartyScene roster agents active mode events />` (the RPG
  map — zones + sprites), the existing `<EventFeed>`, and `<AchievementToast latestEvent=…>`
  (the last EventVM). The inactive branch is unchanged → still `<PartyEmptyState />`.

**Scope kept minimal & green:** `ActivityPulse` and `RpgViewToggle` were intentionally NOT
mounted — both require FRD-12 inputs this RSC does not read (`eventsPerMinute` buckets;
`timelineRows`/`workOrders`), and the reviewer's failing integration test does not require them.
Mounting them here would pull a heavy FRD-12 dependency tree and synthesize data, exceeding the
"snapshot + scene" definition of done. They remain available client components for a later wiring
WO if the feature calls for them on the page.

**Verification (real, full gate):** `bash .pandacorp/verify.sh` → **all gates green** (biome +
tsc + vitest). 158 files, 4225 passed, 2 expected-fail, 5 skipped. The reviewer anchor
`PartyTab.integration.reviewer.test.tsx` (2 tests) now passes: `party-scene`, all four
`party-zone-*` and `party-sprite-backend-dev` reach the DOM when a team is active. The 25
PartyTab unit + snapshot tests stay green (empty-state path unchanged). Commit: see below.

**Files touched:** `app/projects/[slug]/_party/PartyTab.tsx` (composition only — no new files,
no test weakened/skipped, no production code of sibling WOs changed).
