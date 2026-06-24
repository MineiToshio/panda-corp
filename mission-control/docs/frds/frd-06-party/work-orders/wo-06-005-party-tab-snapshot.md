---
id: WO-06-005
type: work-order
slug: party-tab-snapshot
title: WO-06-005 — La Fragua tab + FraguaSnapshot (RSC, read-only)
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-06-001, WO-06-002, WO-06-003, WO-06-012]
last_updated: '2026-06-18'
---
# WO-06-005 — La Fragua tab + FraguaSnapshot (RSC, read-only)

> **REPAIRED → IN_REVIEW (2026-06-18, repair engineer).** The reviewer's blocking defect is fixed:
> the Bóveda shelf is now per-FRD and the global `project.done` counter is decoupled from it.
> `processAchievement` (`fragua-snapshot.ts`) now (1) adds every unique achievement WO to a new
> `globalDoneWoIds` set that feeds the cross-FRD `project.done` counter (AC-06-002.2), and (2) only
> pushes to the per-FRD `trophyWoIds` shelf when the achievement's `frd` matches the current FRD
> (absent `frd` → current scene, backward-compat AC-06-008.2). `project.done` reads
> `globalDoneWoIds.size`; `trophies`/`archivedCount`/`queuedCount` stay per-FRD. The reviewer RED
> anchor `_tests/fragua-snapshot.reviewer.test.ts` is now GREEN (foreign-FRD trophies no longer leak)
> and the existing `_tests/fragua-snapshot.test.ts` still holds (`project.done=2`).
> `bash .pandacorp/verify.sh` is fully green (219 files, 5618 tests; biome + tsc clean). Awaiting the
> FRD-06 gate's re-review.

> **REOPENED → PLANNED by the FRD-06 review gate (2026-06-18).** Blocking defect: the Bóveda
> shelf is NOT per-FRD. See "Reviewer reopen" below.

## Reviewer reopen — Bóveda leaks foreign-FRD trophies (AC-06-005.1 / AC-06-005.2)

**Defect (file:line):** `app/projects/[slug]/_party/fragua-snapshot/fragua-snapshot.ts:240` —
`processAchievement` pushes EVERY `achievement` event to `scan.trophyWoIds` regardless of `ev.frd`,
and `trophyWoIds` directly populates the **per-FRD** Bóveda (`displayedTrophies`/`archivedCount`,
lines 343-344, 365-366). Because the event tail is capped globally (200), a just-finished FRD's
achievement events linger in the tail while the next FRD builds, so those foreign trophies render on
the **current FRD's** shelf. AC-06-005.1 ("place it as a trophy on the Bóveda shelf **for the current
FRD**") and the whole "scene is per-FRD" contract are violated.

**Reproduced by** (red, anchored in EARS):
`app/projects/[slug]/_party/_tests/fragua-snapshot.reviewer.test.ts` →
"the Bóveda shelf is per-FRD (AC-06-005.1)" — a foreign-FRD achievement in the tail leaks into
`snapshot.trophies`.

**Concrete fix (keep the global counter global, make the shelf per-FRD):**
- In `processAchievement`, only push to `scan.trophyWoIds` when `ev.frd === ctx.currentFrdId`
  (the Bóveda is per-FRD). Achievements with no `frd` belong to the legacy/global bucket — decide
  per blueprint, but they must NOT land on a named current-FRD shelf.
- The **global** `project.done` counter (AC-06-002.2, correctly cross-FRD) must be **decoupled** from
  the now-per-FRD trophy list — track a separate global done count (all unique achievement WOs) so
  `project.done` stays global while `trophies`/`archivedCount`/`queuedCount` use only current-FRD
  trophies. Today all three share `trophyWoIds` (lines 343-344, 352, 356) — split them.
- Re-run `fragua-snapshot.reviewer.test.ts` (must go green) plus the existing
  `_tests/fragua-snapshot.test.ts` (project.done=2 etc. must still hold).

**Components/Interfaces:** `CMP-06-party-tab`, `IF-06-fragua-snapshot` · **Traces:** REQ-06-002, REQ-06-008, REQ-06-009, REQ-06-010
**Deploy unit:** Party tab (Server Component) · **Location:** `app/projects/[slug]/_party/PartyTab.tsx`, `app/projects/[slug]/_party/fragua-snapshot.ts` (+ `.test.tsx`/`.test.ts`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The old snapshot built a `PartySnapshot`
> (roster + per-agent initial states from `lib/tasks`). The faithful snapshot is **per-FRD**: current FRD
> + title, mode (from state), running WOs (≤ wave), queued count, gate, trophies (+ archived), global
> `{done,total}` counter. The mode selector and pause/reset are **demo-only** and must NOT ship. See the
> Status Note.

## Acceptance criteria (verbatim EARS)
- AC-06-002.1: THE system SHALL set the scene to the **single FRD currently in build** and SHALL display that FRD's **title**.
- AC-06-002.2: THE system SHALL display a **global project counter** of work orders done over total (e.g. `52 / 109 WO`).
- AC-06-008.1: THE system SHALL feed off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` and `SubagentStop`, read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude**.
- AC-06-008.2: WHEN an event omits the optional enriched fields, THE system SHALL still render gracefully (backward compatibility).
- AC-06-009.1: IN production, THE system SHALL display the run **mode read from state** as data (no mode selector) and SHALL NOT expose any pause / reset / agent-control affordance.
- AC-06-010.1: IF there is no FRD currently in build (no active team / no events), THEN THE system SHALL show a graceful empty state.

## Scope
- `toFraguaSnapshot(events, opts): FraguaSnapshot` (`IF-06-fragua-snapshot`, pure): from the capped enriched event tail derive the **current `frd` (+ title)**, the **mode** (from the `mode` field; default `powerful`), **running WOs** (≤ wave, the wave cap applied here), **queuedCount**, the **gate** state (open iff all of the FRD's WOs are `IN_REVIEW`), **trophies** (`VERIFIED` WOs, ≤9) + **archivedCount**, and the global `{done,total}` counter. Tolerant of missing optional fields (AC-06-008.2).
- `PartyTab` (RSC): reads the capped tail via `lib/events` (WO-06-012 enriched), builds the snapshot, maps the feed via `IF-06-event-vm`, and renders `<FraguaScene>` + `<EventFeed>` + `<AchievementToast>`; `active=false` → `<PartyEmptyState>`. No `fs` reaches the client.
- **Read-only (AC-06-009.1):** NO mode selector, NO pause/reset — render the mode as data. The selector/pause/reset exist only in the prototype.

## Dependencies
- FRD-01 `lib/events` + WO-06-012 (enriched fields), `lib/config` (cross-feature, hard).
- WO-06-001 (feed mapper), WO-06-002 (layout/wave), WO-06-006 (scene), WO-06-007 (feed), WO-06-008 (toast).

## TDD / Definition of done
- Tests with `PANDACORP_FACTORY_ROOT` fixtures: builds a snapshot from a fixture ndjson tail; respects the cap (drops oldest); absent `tasks/` → `active=false`; malformed lines tolerated (never throws); never imports a Claude/AI client (auditable). `lastEventAt` is the newest `at`.
- Gate green.

## Status Note (La Fragua redesign — what the retry must build)

**Why reopened:** the shipped `PartyTab` builds a `PartySnapshot` (roster from a default mode +
per-agent states from `lib/tasks`) and mounts the old zone scene. The faithful tab builds a **per-FRD
`FraguaSnapshot`** from the enriched event stream (current FRD+title, mode from state, running WOs ≤ wave,
queued count, gate, trophies + archived, the global `{done,total}` counter) and mounts `<FraguaScene>`.
Key changes for the retry:

- Add `toFraguaSnapshot(events, opts)` (new pure module) and TDD it against an enriched-event fixture:
  current-FRD detection, mode read from the stream (default `powerful`), running-WO cap = wave, queued
  count, gate open only when all WOs `IN_REVIEW`, trophy/archived split at 9, the global counter,
  tolerance of events missing `frd`/`phase`/`activity`/`mode` (AC-06-008.2).
- `PartyTab` mounts `<FraguaScene snapshot=…>` + `<EventFeed>` + `<AchievementToast>`; empty branch →
  `<PartyEmptyState>`. **Remove** the `lib/tasks` roster path and the `mode` default-roster prop.
- **Read-only:** assert (a reviewer-style integration test) that NO mode selector and NO pause/reset
  control reach the DOM (AC-06-009.1) — those are demo-only in the prototype.
- Keep the existing integration anchor discipline (the WO that mounts the scene asserts the scene
  actually reaches the DOM — the prior gate caught a tab that rendered only the feed).

---

### Previous build (obsoleted by the redesign — kept for history)

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

---

## Status Note (La Fragua redesign — Wave 3 implementation, 2026-06-18)

**Built:** `CMP-06-party-tab` (La Fragua redesign) + `IF-06-fragua-snapshot` + `FraguaScene` stub (WO-06-005 composition layer).

### Interfaces/contracts exposed

```ts
// app/projects/[slug]/_party/fragua-snapshot/fragua-snapshot.ts — IF-06-fragua-snapshot
export type WoState = "building" | "in_review" | "verified" | "blocked";
export type RelayState = { step: "test" | "backend" | "frontend"; contractPublished: boolean };
export type FraguaSnapshot = {
  frd: { id: string; title: string } | null;
  mode: BuildMode;       // 'pro' | 'balanced' | 'powerful' | 'deep'
  wave: number;          // wave size cap
  running: { wo: string; title: string; state: WoState; relay?: RelayState }[];
  queuedCount: number;
  gate: { open: boolean };
  trophies: { wo: string }[];
  archivedCount: number;
  project: { done: number; total: number };
  events: EventVM[];
  active: boolean;
  lastEventAt: string | null;
};

export interface ToFraguaSnapshotOpts {
  lastEventAt: string | null;
  modeOverride?: BuildMode;          // optional override (from project status.yaml)
  projectTotals?: { done: number; total: number };  // optional WO total override
}

// Pure — never throws. Tolerates missing optional fields (AC-06-008.2).
export function toFraguaSnapshot(
  events: readonly Event[],
  opts: ToFraguaSnapshotOpts,
): FraguaSnapshot;

// app/projects/[slug]/_party/FraguaScene/FraguaScene.tsx — CMP-06-scene (stub)
export interface FraguaSceneProps { snapshot: FraguaSnapshot; }
// Renders: data-testid="fragua-scene" (root), "fragua-room-forja", "fragua-room-tribunal",
//   "fragua-room-boveda", "fragua-frd-tracker", "fragua-frd-id", "fragua-frd-title",
//   "fragua-global-counter", "fragua-mode-display" (read-only data, not a selector),
//   "fragua-running-list", "fragua-queued-count", "fragua-gate", "fragua-trophies",
//   "fragua-archived-count".
// Observation-only: NO mode selector, NO pause/reset buttons (AC-06-009.1).
export function FraguaScene({ snapshot }: FraguaSceneProps): React.JSX.Element;

// app/projects/[slug]/_party/PartyTab/PartyTab.tsx — CMP-06-party-tab (redesign)
export interface PartyTabProps {
  eventsPath?: string;  // NDJSON path; defaults to ~/.claude/dashboard-events.ndjson
  cap?: number;         // event tail cap; default 200
}
// REMOVED: tasksDir (lib/tasks gate replaced by event-based FRD detection)
// REMOVED: mode prop (mode derived from event stream)
export function PartyTab(props: PartyTabProps): React.JSX.Element;
```

### Key design decisions

- **Active flag**: `snapshot.active = currentFrdId !== null`. The `lib/tasks` active-team gate is removed; the event stream is the sole source of truth (enriched `AgentWorking` events with a `frd` field).
- **Mode**: read from the most recent event with a valid `mode` field; default `'powerful'` (AC-06-009.1).
- **Wave table**: `{pro:2, balanced:4, powerful:8, deep:6}` — faithful to the engine (blueprint §3).
- **`FraguaScene`**: client-side stub that renders the three La Fragua rooms with observation-only layout. No animation loop yet (WO-06-006 scope).
- **Enriched events fixture**: `src/tests/fixtures/events/dashboard-events-enriched.ndjson` — `AgentWorking` events with `{frd, wo, phase, activity, mode, role}` fields (exported as `FIXTURE_EVENTS_ENRICHED_NDJSON`).

### Integration seams

- `PartyTab` calls `readEvents` (lib/events, WO-01-007) → passes to `toFraguaSnapshot` → passes `FraguaSnapshot` to `FraguaScene` + `EventFeed` (WO-06-007) + `AchievementToast` (WO-06-008).
- `FraguaScene` receives the snapshot as a prop; mounts rooms, running WOs, trophies, gate — no engine calls yet (WO-06-006 will wire the RAF loop).
- The `modeOverride` opt allows the page to forward a mode from `status.yaml` when that data is available, with zero change to `toFraguaSnapshot`.

### Test files

- `src/app/projects/[slug]/_party/_tests/fragua-snapshot.test.ts` — 31 tests (toFraguaSnapshot: empty state, FRD detection, mode/wave, running cap, trophies/archived, gate, counter, lastEventAt, backward compat, no Claude import).
- `src/app/projects/[slug]/_party/PartyTab/_tests/PartyTab.fragua.integration.test.tsx` — 14 tests (fragua-scene renders, active from enriched events, read-only: no mode selector/pause/reset, no lib/tasks required, container invariants).
- `src/app/projects/[slug]/_party/PartyTab/_tests/PartyTab.integration.reviewer.test.tsx` — updated reviewer test: fragua-scene + three rooms + FRD tracker + event feed reach DOM; no mode selector/pause/reset in DOM; empty state when no FRD.
- `src/app/projects/[slug]/_party/PartyTab/_tests/PartyTab.test.tsx` — updated (14 tests, enriched fixture).
- `src/app/projects/[slug]/_party/PartyTab/_tests/PartyTab.snapshot.test.tsx` — updated (11 tests, enriched fixture, no lib/tasks).

### Gate

183 test files, 5099 tests GREEN + 2 expected-fail + 5 skipped. tsc clean. biome clean. Commit: `2be06a6`.

Pre-existing failure: `agentColorTokens.integration.reviewer.test.ts` (1 test) — `--color-agent-guild` dangling reference in achievements components; unrelated to WO-06-005, predates this work.

## REVIEWER REOPEN (FRD gate, 2026-06-18, Opus) — REJECTED, reopened to PLANNED

**Reopened together with WO-06-012** (the root cause is the upstream parser). `toFraguaSnapshot` keys
running WOs on `ev.workOrder`, the FRD on `ev.frd` and the mode on `ev.mode` — all of which are
`undefined` for real events because the emitter nests them under `data` (see WO-06-012 reopen note).
So against the real stream the snapshot returns `active:false` and `PartyTab` renders the empty state
during a live build. This WO's own fixture `src/tests/fixtures/events/dashboard-events-enriched.ndjson`
is **fabricated** in the flat top-level shape and its tests (`_party/_tests/fragua-snapshot.test.ts`)
validate that fiction — so the green here was self-confirming, not real.

**Required on rebuild (after WO-06-012 reads `data.*`):**
- Replace the fabricated flat fixture with REAL nested-`data` lines (copy the actual on-disk shape from
  `~/.claude/dashboard-events.ndjson`).
- Re-derive the snapshot tests against that real fixture and make the reviewer integration anchor
  `src/app/projects/[slug]/_party/_tests/frd-06-realdata.reviewer.test.ts` GREEN
  (active scene, running WOs registered from `data.wo`, mode read from `data.mode`).
- Confirm the gate-open derivation (REQ-06-004: gate opens WHEN ALL WOs are `IN_REVIEW`) is driven by
  the real `phase:'review'` / review events, not only a synthetic `gate` event that the emitter may never
  produce — verify against the real review-phase line on disk (`data.phase:"review"`).

## Resolution (baseline repair, 2026-06-18) — back to IN_REVIEW

**Root cause fixed upstream** (WO-06-012: `lib/events.ts` now reads enriched fields from the nested
`data` object). With the parser corrected, `toFraguaSnapshot` receives populated `frd`/`workOrder`/
`mode` against the REAL stream, so the snapshot is `active` during a live build (no more spurious
empty state). No change to `fragua-snapshot.ts` itself was needed — the bug was entirely in the
parser feeding it. **Evidence:** the reviewer end-to-end anchor
`src/app/projects/[slug]/_party/_tests/frd-06-realdata.reviewer.test.ts` (`readEvents → toFraguaSnapshot`
against the real nested-`data` line) is now GREEN: active scene, running WOs registered from
`data.wo`, mode read from `data.mode`. The existing snapshot tests stay GREEN. Full `verify.sh`
green (238 files / 5957 tests). The FRD-06 gate remains the authority for VERIFIED.
