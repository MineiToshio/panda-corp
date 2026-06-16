# FRD-06 — Party (live RPG map) — feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** for FRD-06. It describes how the live RPG map is built
> **on top of** the platform architecture (`../../product/architecture.md`) — it does not
> restate the stack, the data model or the event contract. Read §5 (event contract, the
> `project` field), §6 (`lib/events`, `lib/tasks`) and §4.7 (`~/.claude/` sources) of the
> platform architecture, plus `../../../PARTY.md` (state model, indicator vocabulary, the
> decoupled animation queue) and `../../../prototype/index.html` (`MC*` engine — the approved
> functional reference, NOT the visual reference per `docs/design/brief.md`).

## 0. Requirement IDs (assigned here)

The FRD authored its acceptance criteria as EARS bullets without numeric IDs. This blueprint
assigns the canonical `REQ-06-MMM` ids (one per EARS clause) so every requirement traces to a
component/interface and a work order. The EARS text is copied verbatim into the work orders as
`AC-06-MMM.K`.

| ID | Requirement (EARS, abridged) |
|---|---|
| REQ-06-001 | Show 4 pixel-art zones (Research/Backend/Frontend/Testing), each with its label. |
| REQ-06-002 | Each workflow subagent appears as a sprite placed in its zone. |
| REQ-06-003 | While no transition: continuous "breathing" + wandering within the zone. |
| REQ-06-004 | On handoff: incoming sprite walks to the next zone, both end up together, with a speech bubble. |
| REQ-06-005 | The researcher is on-demand (consulted by backend/frontend, not a fixed first step). |
| REQ-06-006 | Show a log/feed of the workflow events (actions + handoffs). |
| REQ-06-007 | When a work order closes, fire an achievement ("Achievement unlocked!"). |
| REQ-06-008 | Feed off `dashboard-events.ndjson` + `SubagentStop` + `~/.claude/tasks/`, without calling Claude; prototype simulated with a button. |
| REQ-06-009 | Observation-only view (redirect/pause happens in the Claude Code app). |
| REQ-06-010 | If no active team → graceful empty state. |
| REQ-06-011 | Each agent has a fixed color reused across the whole UI (sprite, feed, cards); multi-project → project-color + agent-color borders. |
| REQ-06-012 | Events use a fixed bounded iconic vocabulary (~12 types); tool = extra icon. |
| REQ-06-013 | Failure is a first-class state (downed + danger color + error icon, distinct from completed); never hidden. |
| REQ-06-014 | Feed auto-scrolls to new with a "pin" button when scrolled up; cap 100–200 events in memory (drop oldest). |
| REQ-06-015 | Activity pulse (bars per minute, color per agent) showing alive vs stalled. |
| REQ-06-016 | RPG ↔ timeline/tree toggle over the same data + Live/No-signal indicator with last-event timestamp. |

> REQ-06-015 (activity pulse) and REQ-06-016 (toggle + Live/No-signal) overlap heavily with
> FRD-12 (observability). To avoid duplicate implementation: the **shared selectors** (events-per-minute,
> data freshness, the timeline/DAG view) are **owned by FRD-12** and consumed here. This blueprint
> renders the *Party half* of REQ-06-015/016 (the pulse bars styled per-agent, and the toggle control
> that swaps the Party for FRD-12's timeline/DAG). See "Cross-feature boundary" below.

## 1. Architecture fit

The Party is the only feature with a **client animation engine**. Everything else in MC is a
Server Component. The split:

- **Server Component** (`app/projects/[slug]` → Party tab, RSC): reads the capped event tail and
  task state through `lib/events` + `lib/tasks` (§6) on the server, derives the **initial agent
  states** and the **roster** (from `status.yaml` build mode, FRD-11), and passes a serializable
  snapshot to the client engine. No `fs` ever reaches the client.
- **Client Component** (`"use client"`, the RPG scene): owns the `requestAnimationFrame` loop, the
  decoupled animation queue (PARTY.md §4) and the DOM sprites. It receives event *diffs* (new
  events since the last render) via props on re-render and translates them into visual actions.

The engine is a **TypeScript/React re-implementation** of the prototype's `MC*` functions
(`mcBoot`/`mcLoop`/`mcSetState`/`mcStartHandoff`/`mcPositions`/`mcSeed`), keeping the same names
for the pure helpers so PARTY.md stays the spec. The prototype's *director* (synthetic events) is
replaced by the real event stream from `lib/events`.

## 2. Components (`CMP-06-*`) and interfaces (`IF-06-*`)

| ID | Kind | Name | Responsibility | Uses | Traces |
|---|---|---|---|---|---|
| CMP-06-party-tab | RSC | `PartyTab` | Server entry of the Party tab: reads events tail + tasks, builds the initial snapshot + roster, renders the scene + feed + empty state. | `lib/events`, `lib/tasks`, `lib/status` (mode), `lib/config` | REQ-06-008, REQ-06-010 |
| CMP-06-scene | client | `PartyScene` | The RPG map: zones, stations, sprites, the RAF loop, the animation queue. Wraps the engine. | `IF-06-engine`, `IF-06-positions`, agent-color tokens (FRD-13) | REQ-06-001..005 |
| CMP-06-feed | client | `EventFeed` | Renders the capped event log with the iconic vocabulary, agent colors, first-class failure rows, auto-scroll + pin. | `IF-06-event-vm`, `IF-06-icon-map` | REQ-06-006, REQ-06-012, REQ-06-013, REQ-06-014 |
| CMP-06-pulse | client | `ActivityPulse` | Per-minute bars colored per agent (the Party-styled view of FRD-12's events-per-minute selector). | FRD-12 `IF-12-rate` selector | REQ-06-015 |
| CMP-06-achievement | client | `AchievementToast` | Fires the "¡Logro desbloqueado!" celebration on a work-order-close event; reduced-motion variant. | `IF-06-event-vm`, motion tokens (FRD-13) | REQ-06-007 |
| CMP-06-view-toggle | client | `RpgViewToggle` | Control to switch Party ↔ FRD-12 timeline/DAG over the same data; hosts the Live/No-signal badge. | FRD-12 `CMP-12-toggle`, `CMP-12-freshness` | REQ-06-016 |
| CMP-06-empty | RSC | `PartyEmptyState` | Graceful "no active team / no events" state. | — | REQ-06-010 |
| IF-06-engine | interface | `createPartyEngine(snapshot, opts)` | Pure-ish engine: `setState(agentId,state)`, `startHandoff(agentId, target)`, `tick(now)`, `applyEvents(diff)`. Owns the visual queue; no DOM in the pure core (DOM binding is a thin adapter). | reads agent-state model (PARTY.md §1) | REQ-06-003, REQ-06-004 |
| IF-06-positions | interface | `mcPositions(roster, mode) → Pos[]` | Pure station layout per roster size/mode (ported from prototype). | — | REQ-06-001 |
| IF-06-event-vm | interface | `toEventVM(event) → EventVM` | Pure mapper: raw `DashboardEvent` (from `lib/events`) → view model `{ icon, agentColorKey, isFailure, label, at, workOrder }`. | `lib/events` types, `IF-06-icon-map` | REQ-06-012, REQ-06-013 |
| IF-06-icon-map | interface | `EVENT_ICON: Record<EventType, Icon>` | The fixed bounded vocabulary (~12) event→icon + tool→extra-icon. Centralized constant (no magic). | — | REQ-06-012 |
| IF-06-state-map | interface | `eventToVisual(event) → VisualAction` | Pure map from event (`start/handoff/end/blocked/review/achievement`, §5 + PARTY.md §4) → engine action. The decoupling boundary. | `lib/events` types | REQ-06-004, REQ-06-005, REQ-06-007, REQ-06-013 |
| IF-06-roster | interface | `rosterFor(mode) → Role[]` | Pure: build mode (`pro/balanced/powerful/deep`) → role list (`MCROSTER`, FRD-11). | `lib/status` | REQ-06-002, REQ-06-005 |
| IF-06-agent-color | interface | `agentColor(role) → tokenVar` | Pure: role → its fixed CSS color token (defined by FRD-13 design tokens). The single source the sprite, feed and cards all read. | FRD-13 tokens | REQ-06-011 |

### New `lib/` modules
None. This feature consumes `lib/events` and `lib/tasks` (FRD-01-owned, §6). The engine and the
pure mappers live under the **feature folder** (`app/projects/[slug]/_party/`), not in `lib/`,
because they are UI logic, not the data layer. They are still TDD'd as pure functions.

## 3. Contracts

### Server → client snapshot (props of `PartyScene`)
```ts
type PartySnapshot = {
  roster: Role[];                         // IF-06-roster, from status.yaml mode
  agents: { id: Role; state: AgentState; color: string }[];  // initial states
  events: EventVM[];                      // capped tail (≤200), already mapped
  active: boolean;                        // false → empty state
  lastEventAt: string | null;            // for Live/No-signal (FRD-12)
};
```
`AgentState = 'work' | 'walk' | 'idle' | 'blocked' | 'review'` (PARTY.md §1; CSS classes
`s-work/s-walk/s-idle/s-blocked/s-review`). The mapping `event → state` is **only** in
`IF-06-state-map` (PARTY.md §4 / architecture §5), tested in isolation.

### Event diffs on re-render
On a Server-Component re-read the new (uncapped-by-cap) events since `snapshot.lastEventAt` are
passed; `engine.applyEvents(diff)` enqueues visual actions. Temporal fidelity is secondary
(PARTY.md §4): the queue drains at the engine's pace.

### Failure (REQ-06-013)
An event with `status:'fail'` (or `event:'test_fail'`) → `IF-06-event-vm.isFailure=true` (danger
token + ❌ icon + Spanish label) in the feed, and `IF-06-state-map` may down the sprite. Never
filtered out.

### Multi-project (REQ-06-011)
`lib/events` exposes the optional `project` field (§5). When events from >1 project are present,
the feed row carries a **project-color left border + agent-color second border**. Events without
`project` are legacy/global (CLAUDE.md) and render with the agent color only.

## 4. App surface (§11)
`app/projects/[slug]` → **Party tab** (client engine inside an RSC tab shell). No new route; it is
a tab of the project workspace (FRD-04). Assets (sprites/zone backgrounds) are reused as-is from
`prototype/assets/**` per `docs/design/brief.md` (do not reinvent).

## 5. Cross-feature dependencies
- **FRD-01 (`lib/events`, `lib/tasks`)** — the data layer. Hard dependency; the Party cannot be
  built before these readers exist (their stubs/contracts must land first).
- **FRD-11 (build modes)** — `status.yaml` build mode drives the roster (`IF-06-roster`).
- **FRD-12 (observability)** — owns the shared selectors (events-per-minute → `ActivityPulse`,
  data freshness → Live/No-signal, the timeline/DAG view behind the toggle). This blueprint
  *consumes* them. Build order: FRD-12's `IF-12-rate` + `CMP-12-freshness` + `CMP-12-toggle`
  before CMP-06-pulse / CMP-06-view-toggle.
- **FRD-13 (visual system)** — the per-agent color tokens, the motion tokens (achievement
  celebration <300ms + reduced-motion), `prefers-reduced-motion` disables the RAF loop. Hard
  dependency for the visual layer; the engine logic can be TDD'd before tokens exist.

## 6. Traceability (REQ → CMP/IF)
Every REQ-06-MMM above maps to at least one CMP-06-* / IF-06-* in §2. REQ-06-009 (observation-only)
is a **negative requirement**: satisfied by the platform read-only invariant (architecture §7) —
no action/affordance to control agents is built. No requirement is unbuildable.
