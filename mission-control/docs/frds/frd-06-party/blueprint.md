---
id: FRD-06-blueprint
type: blueprint
parent: FRD-06
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-18'
---
# FRD-06 — Party · La Fragua (live build view) — feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** for FRD-06. It describes how **La Fragua** is built **on top of**
> the platform architecture (`../../product/architecture.md`) — it does not restate the stack, the data
> model or the event contract. Read §5 (event contract — incl. the new optional `frd/phase/activity/mode`
> fields), §6 (`lib/events`, `lib/tasks`) and §4.7 (`~/.claude/` sources) of the platform architecture.
> **Visual contract:** `../../../prototype/party-proposal.html` (La Fragua) — the approved functional &
> visual reference for rooms, wave, the deep relay, the parchment, the Bóveda compaction and the FRD tracker.
> Faithful engine model: `../../../prototype/party-redesign-spec.md` §2–3.

## 0. Requirement IDs

The FRD authors its own EARS criteria with stable ids (DR-049): `REQ-06-001..012`, each with
`AC-06-MMM.K`. This blueprint maps each REQ to components/interfaces and work orders; the EARS text is
copied verbatim into the work orders.

| ID | Requirement (abridged) |
|---|---|
| REQ-06-001 | One sprite per running `implementer` WO; wave = mode; the rest = "+N en cola". |
| REQ-06-002 | Per-FRD scene with the FRD title + a global project WO counter; hover tooltip = WO id+title. |
| REQ-06-003 | Linear rooms Forja → Tribunal → Bóveda (not a kanban); moves animate inside/between rooms. |
| REQ-06-004 | ONE `reviewer` per FRD; opens when all WOs `IN_REVIEW`; 3 lenses; ≥12 slots (4×3). |
| REQ-06-005 | Bóveda places `VERIFIED` WOs as trophies; compacts to "+N archivados" beyond 9. |
| REQ-06-006 | The parchment = the real `Status Note` hand-off between dependent WOs (artifact, not chat). |
| REQ-06-007 | Deep mode = a sequential `test-writer → backend-dev →📄contract→ frontend-dev` relay (Opus); single implementer if no frontend. |
| REQ-06-008 | Feeds off enriched `AgentWorking{role,wo,frd,phase,activity,mode}` + `SubagentStop`; read-only; no Claude; tolerant of missing optional fields. |
| REQ-06-009 | Read-only in production: mode read from state, no selector, no pause/reset (controls demo-only). |
| REQ-06-010 | Empty state, reduced-motion (disable all animation), multi-project project+role borders. |
| REQ-06-011 | Bitácora del gremio: real build events, iconic vocabulary, failure-first, auto-scroll+pin, cap ≤200. |
| REQ-06-012 | Achievement toast on WO close (`VERIFIED`), <300ms motion, reduced-motion variant. |

## 1. Architecture fit

The Party is the only feature with a **client animation engine**; everything else in MC is a Server
Component. The split is unchanged in nature, but the model is now **the engine's**:

- **Server Component** (`app/projects/[slug]` → Party tab, RSC): reads the capped event tail via
  `lib/events` (§6), derives the **current FRD in build**, the **mode** (read from the event stream's
  `mode` field / state), the **running WOs vs queued count**, the **review-gate** state and the
  **Bóveda trophies**, and passes a serializable `FraguaSnapshot` to the client engine. No `fs` ever
  reaches the client. **No mode selector, no pause/reset** — production is read-only (REQ-06-009).
- **Client Component** (`"use client"`, the scene): owns the `requestAnimationFrame` loop and the DOM
  rooms/sprites/parchments/relay. It receives event diffs via props and translates them into visual
  actions through the decoupling map.

The engine is a TypeScript/React re-implementation of the prototype's La Fragua functions (the
forge/tribunal/vault placement, the wave cap, the deep relay sub-sequence, the parchment routing). The
prototype's *director* (synthetic events + the demo mode selector) is replaced by the **real enriched
event stream** from `lib/events`.

## 2. Components (`CMP-06-*`) and interfaces (`IF-06-*`)

| ID | Kind | Name | Responsibility | Uses | Traces |
|---|---|---|---|---|---|
| CMP-06-party-tab | RSC | `PartyTab` | Server entry: reads the event tail, derives the `FraguaSnapshot` (current FRD, mode, running WOs, queued N, gate, trophies, global counter), renders scene + feed + empty state. **Read-only** (no selector/controls). | `lib/events`, `IF-06-fragua-snapshot`, `lib/config` | REQ-06-002, REQ-06-008, REQ-06-009, REQ-06-010 |
| CMP-06-scene | client | `FraguaScene` | The living map: rooms (Forja/Tribunal/Bóveda), running sprites (≤ wave), the "+N en cola" badge, the reviewer gate, the trophy shelf + "+N archivados", the parchment, the deep relay, the FRD tracker + global counter, hover tooltips. Wraps the engine + RAF loop. | `IF-06-engine`, `IF-06-fragua-layout`, role-color tokens (FRD-13) | REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004, REQ-06-005, REQ-06-006, REQ-06-007 |
| CMP-06-relay | client | `DeepRelay` | The per-WO sequential `test-writer → backend-dev →📄→ frontend-dev` relay sub-render (3-segment progress, active sub-step, contract hand-off, "Opus" label). Used by the scene for deep-mode WOs with a frontend. | `IF-06-fragua-layout`, role-color tokens | REQ-06-007 |
| CMP-06-feed | client | `EventFeed` | The bitácora: capped event log, iconic vocabulary, role colors, first-class failure rows, auto-scroll + pin; hand-off / contract / gate lines. | `IF-06-event-vm`, `IF-06-icon-map` | REQ-06-011, REQ-06-010 |
| CMP-06-achievement | client | `AchievementToast` | Fires "¡Logro desbloqueado!" on a WO-close (`VERIFIED`) event; reduced-motion variant; <300ms motion. | `IF-06-event-vm`, motion tokens (FRD-13) | REQ-06-012 |
| CMP-06-empty | RSC | `PartyEmptyState` | Graceful "no FRD in build / no events" state. | — | REQ-06-010 |
| IF-06-engine | interface | `createFraguaEngine(snapshot, opts)` | Pure-ish engine: `setWo(wo, state)`, `enqueue(wo)`, `startHandoff(fromWo, toWo)`, `advanceRelay(wo, step)`, `openGate()`, `tick(now)`, `applyEvents(diff)`. Owns the visual queue; no DOM in the core. | reads the WO-state model | REQ-06-001, REQ-06-003, REQ-06-006, REQ-06-007 |
| IF-06-fragua-layout | interface | `forgeSlots(mode)`, `deepSlots()`, `reviewSlots()`, `vaultSlots()`, room rects | Pure station/room layout: forge slots per mode (8 normal / 6 deep wider), 12 tribunal slots (4×3), 9 vault slots + "+N", the room rectangles and the connecting paths (forge→tribunal→vault). | — | REQ-06-001, REQ-06-003, REQ-06-004, REQ-06-005, REQ-06-007 |
| IF-06-fragua-snapshot | interface | `toFraguaSnapshot(events, opts) → FraguaSnapshot` | Pure: enriched event tail → the server snapshot: current `frd` (+title), `mode`, running WOs (≤ wave), `queuedCount`, gate state, trophies (+ archivedCount), `{done,total}` global counter. Tolerant of missing optional fields (REQ-06-008). | `lib/events` types, `IF-06-state-map` | REQ-06-001, REQ-06-002, REQ-06-004, REQ-06-005, REQ-06-008 |
| IF-06-event-vm | interface | `toEventVM(event) → EventVM` | Pure mapper: raw `Event` → `{ icon, toolIcon?, roleColorKey, projectColorKey?, isFailure, label(es), at, wo?, frd?, project? }`. | `lib/events` types, `IF-06-icon-map` | REQ-06-011, REQ-06-010 |
| IF-06-icon-map | interface | `EVENT_ICON: Record<EventType, Icon>` | The fixed bounded vocabulary (~12) event→icon + tool→extra-icon, plus the new `handoff`/`contract`/`gate` lines. Centralized constant. | — | REQ-06-011 |
| IF-06-state-map | interface | `eventToVisual(event) → VisualAction` | Pure map: enriched event → engine action (`setWo`, `enqueue`, `startHandoff`, `advanceRelay`, `openGate`, `fireAchievement`, `downSprite`, `noop`). The decoupling boundary. | `lib/events` types | REQ-06-001, REQ-06-003, REQ-06-006, REQ-06-007, REQ-06-012 |
| IF-06-role-color | interface | `roleColor(role) → tokenVar` | Pure: build role (`implementer`/`reviewer`/`test-writer`/`backend-dev`/`frontend-dev`) → its fixed CSS color token (FRD-13). The single source the sprite, relay, feed and trophies all read. | FRD-13 tokens | REQ-06-010, REQ-06-011 |

### `lib/events.ts` — enriched-field parsing (cross-feature, FRD-01)
`lib/events.ts` (FRD-01) gains the **optional** event fields `frd`, `phase` (`build | review`),
`activity` (`test | backend | frontend | selftest | implement`) and `mode` (the run's mode), plus the
new event kinds `HandoffWritten {wo, frd}` and `ContractPublished {wo, frd}` — all **backward-compatible**
(new optional fields; current consumers ignore them; missing fields tolerated). The actual emission of
these fields is the **plugin's** prerequisite change (`pandacorp-build.js` + `emit-event.sh`), documented
there; this view consumes them. This is delivered as **WO-06-012** (the `lib/events.ts` parse extension).

### New `lib/` modules
Only the `lib/events.ts` field extension (WO-06-012). The engine and the pure mappers/snapshot live
under the **feature folder** (`app/projects/[slug]/_party/`), TDD'd as pure functions.

## 3. Contracts

### Server → client snapshot (props of `FraguaScene`)
```ts
type FraguaSnapshot = {
  frd: { id: string; title: string } | null;     // the FRD currently in build (per-FRD scene)
  mode: BuildMode;                                // read from state (REQ-06-009); default 'powerful'
  wave: number;                                   // mode → wave size (cap on running sprites)
  running: { wo: string; title: string; state: WoState; relay?: RelayState }[]; // ≤ wave
  queuedCount: number;                            // "+N en cola"
  gate: { open: boolean };                        // reviewer gate (one per FRD)
  trophies: { wo: string }[];                     // VERIFIED WOs of this FRD (≤9 shown)
  archivedCount: number;                          // "+N archivados" beyond the shelf
  project: { done: number; total: number };       // global counter (e.g. 52/109)
  events: EventVM[];                              // capped tail, already mapped (≤200)
  active: boolean;                                // false → empty state
  lastEventAt: string | null;
};
type WoState = 'building' | 'in_review' | 'verified' | 'blocked';
type RelayState = { step: 'test' | 'backend' | 'frontend'; contractPublished: boolean }; // deep only
type BuildMode = 'pro' | 'balanced' | 'powerful' | 'deep';
```
The mapping `event → action` is **only** in `IF-06-state-map`, tested in isolation. The wave cap
(`running.length ≤ wave`) is enforced in `IF-06-fragua-snapshot` so the scene can never over-render.

### The wave / mode table (faithful to the engine)
| mode | wave | split | worker | judge |
|---|---|---|---|---|
| pro | 2 | no | Sonnet | Sonnet |
| balanced | 4 | no | Sonnet | Opus |
| powerful (default) | 8 | no | Sonnet | Opus |
| deep | 6 | **yes** (relay if the WO has a frontend) | **Opus** | Opus |

### The parchment hand-off (REQ-06-006)
A `HandoffWritten {wo, frd}` event → `startHandoff(fromWo, toWo)` where `toWo` is the dependent WO per
the Build Plan. The parchment is the **`Status Note`** document, animated as an artifact between
stations — never a chat. If the dependent WO is not in the scene, the parchment animates to the
forge/queue edge without a target sprite (edge case).

### The deep relay (REQ-06-007)
In `deep` mode, a WO **with a frontend** is a 3-step sequential relay; `advanceRelay(wo, step)` walks
`test → backend → frontend`, sequentially (one completed before the next). `ContractPublished {wo,frd}`
flips `contractPublished=true` and renders the 📄 between backend and frontend + a feed line. A deep WO
**without** a frontend renders as a single `implementer` (AC-06-007.4).

### Failure & multi-project (REQ-06-010/011)
Failure (`status:'fail'` / `test_fail`) → first-class feed row (danger token + ❌) and may down the
WO sprite; never filtered. Multi-project rows carry a project-color left border + role-color second
border; events with no `project` render role-color only (legacy/global, CLAUDE.md).

## 4. App surface
`app/projects/[slug]` → **Party tab** (client engine inside an RSC tab shell). No new route; a tab of
the project workspace (FRD-04). The embed contract matches the prototype `party-proposal.html`
(`?embed=1&mode=<mode>` for the mockup only; production reads the mode from state). Assets reused from
`prototype/assets/**`: rooms `assets/zones/backend.png` (forge), `tribunal.png`, `boveda.png` (new art);
sprites `assets/agents/*.png` (the `implementer` reuses `backend-dev.png`).

## 5. Cross-feature dependencies
- **FRD-01 (`lib/events`)** — the data layer. WO-06-012 extends it with the enriched optional fields;
  hard dependency. The **plugin** must emit those fields for *real* (non-demo) data — a documented
  prerequisite, not part of this FRD's code.
- **FRD-11 (build modes)** — the `BuildMode` enum + the wave table; the mode is read from state.
- **FRD-12 (observability)** — owns the shared events-per-minute / timeline-DAG selectors if a future
  toggle is wired; **not required** by La Fragua's faithful scene (the old activity-pulse / view-toggle
  requirements are dropped from FRD-06's must-haves — see §6).
- **FRD-13 (visual system)** — the per-role color tokens, motion tokens (achievement <300ms +
  reduced-motion), `prefers-reduced-motion` disables the RAF loop.

## 6. Traceability & deltas from the previous model
Every `REQ-06-001..012` maps to ≥1 `CMP-06-*`/`IF-06-*` above. REQ-06-009 (read-only) is a **negative
requirement** satisfied by the platform read-only invariant — no selector/control affordance is built.

**Dropped from the previous (fictitious) blueprint:** the 4 fixed zones, the wandering cast, the live
handoffs, the researcher-on-demand, and the standalone **activity-pulse** (`CMP-06-pulse`) and
**RPG↔timeline view-toggle** (`CMP-06-view-toggle`) as FRD-06 must-haves. The pure infra
(`event-vm`, `state-map`, `icon-map`, the engine shell, the feed, the achievement toast) is **kept but
re-pointed** at the faithful model (rooms/wave/relay/parchment), and the layout/roster/snapshot/scene
work is re-planned (see `work-orders/README.md`).

## Build Plan (Phase 2)

Phase 2 re-paints the **Party · La Fragua** canvas to `mocks/la-fragua.html`. The entire **pure / logic
layer is VERIFIED** — `lib/events` enriched parse (WO-06-012), `event-vm` (WO-06-001), `layout`
(WO-06-002), `state-map` (WO-06-003), `engine` (WO-06-004) and `toFraguaSnapshot` (WO-06-005) — and is
**not** re-planned; the two coarse UI WOs consume it. The existing **real** `EventFeed`,
`AchievementToast` and `DeepRelay` are **reused**, never recreated.

> **Party canvas primitives moved to the GLOBAL foundation (FRD-13 WO-13-009).** They are a **shared**
> set reused by La Campaña (FRD-02) AND La Fragua (FRD-06); scoping them route-locally here was the root
> cause of La Campaña rendering a flat list. They now live in `src/components/modules/party/`, built +
> VERIFIED in FRD-13 **before** any surface. FRD-06 keeps **one** coarse UI WO (the scene) that consumes
> them.

**Coarse DAG:**

```
WO-06-001/002/003/004/005/012 (pure/logic, VERIFIED) ─┐
FRD-13 foundation (incl. WO-13-009 Party canvas) ─────┼─▶ WO-06-007  (La Fragua scene re-paint:
WO-01-009 useLiveSnapshot (VERIFIED) ─────────────────┘              FraguaScene + PartyScene/PartyTab)
```

- **WO-06-007 — La Fragua scene re-paint** — composes the shared FRD-13 Party-canvas primitives
  (`Room`/`StoneBridge`/`FlowStrip`/`AgentSprite`/`JudgeSprite`/`SpeechBubble`/`Tooltip`/`Parchment`/
  `MissionBar`/`DemoControls`/`PowerOffOverlay`, from `src/components/modules/party/`) into `FraguaScene`
  + the `PartyScene`/`PartyTab` shell, faithful to the mock, **live off `useLiveSnapshot`** (WO-01-009,
  event-driven, not polling); the always-visible flow strip lights the active beat. Reuses the **real**
  `EventFeed`/`AchievementToast`/`DeepRelay`. The geometry (`_party/layout`), engine and `fragua-snapshot`
  feed the (stateless) primitives here.

**Parallelism.** Across FRDs the scene is **disjoint** from FRD-05 (`_components/{wo-board,wo-detail,…}/**`)
and FRD-12 (`_observability/**`): its artifacts live only under `src/app/projects/[slug]/_party/**`, so
the three workspace tabs re-paint in parallel with no collision. The shared primitives it imports are
already built (FRD-13, `src/components/modules/party/**`).

**Disjoint artifacts:**
- WO-06-007: `src/app/projects/[slug]/_party/{FraguaScene,PartyScene,PartyTab}/**`.

**Cross-FRD deps:** `frd-13` (foundation **incl. the Party canvas WO-13-009 — VERIFIED first**),
`frd-04` (the workspace Tabbar the scene mounts into), `frd-01` (live — `useLiveSnapshot`, WO-01-009).

## 7. As-built — the v2 GLOBAL scene pipeline (2026-07-02)

> The definitive map of what feeds every pixel of La Fragua. Written so any agent (or human)
> can extend the scene without re-discovering the data flow. Requirement side: REQ-06-019
> (AC-06-019.1–.7) in `frd.md`.

### 7.1 The one honesty rule

**Decoration never fakes measurement.** Every element is either (a) anchored to a REAL signal
(named below), or (b) pure ambient decoration that encodes NOTHING (chimney smoke, the strolling
panda mascot). There is no third category: an element that LOOKS like data must BE data
(DR-087 "read real or empty-honest"; DR-061 read-only).

### 7.2 Data sources — who feeds what

| Source | Read by | Drives | Never drives |
|---|---|---|---|
| **WO frontmatter** (`docs/frds/*/work-orders/*.md`, `implementation_status`, `dependsOn`) | `listWorkOrders` → `structureFromWorkOrders` | THE STRUCTURE: forge sprites (`IN_PROGRESS` ≤ wave cap), tribunal occupants (`IN_REVIEW`), gate queue (FRDs fully in review), enfermería beds (`fail`/BLOCKED), trophies (`VERIFIED`, grouped: a fully-verified FRD collapses into ONE champion entry — scaled sprite + 🏆 + `FRD-NN` tag — loose WOs keep their statuette; the shelf GROWS a row per 9 entries, `+N más` only past 45), the Campaña strip per-FRD states, the done/total counter | liveness (a stale file still renders; the badge says how fresh) |
| **Event stream** (`~/.claude/dashboard-events.ndjson`, project-filtered BEFORE the tail cap; env override `PANDACORP_EVENTS_FILE`) | `readEvents` → `toFraguaSnapshot` opts + `EventFeed` | LIVENESS + FOCUS: which FRD is highlighted, the bitácora feed, gate open/judging emphasis, achievement toasts | structure (an event can NEVER conjure a sprite the frontmatter doesn't back — DR-092) |
| **`track.jsonl`** (durable per-project timeline, DR-086) | `readBuildTimeline` → `woStarts` map | REAL elapsed time in speech bubbles ("N min al fuego / ante el juez") | anything fabricated — a WO without a `wo_start` line simply shows no time |
| **`status.yaml`** (`running`, `supervisor_heartbeat`) | `readStatus` → `isLive`/`freshnessBand` (`lib/status/liveness`, the single DR-092 derivation) | powered-off vs active scene (AC-06-013), the freshness badge bands | "running" alone is NEVER proof of life (DR-066: live ⇔ running AND fresh) |
| **`wo_commit` engine event** (v9.44+) | `useSceneLife` (lastCommitAt diff) | the courier flight forge → tribunal — a decorative CUE anchored to a real per-WO green commit; stale-tail replays never launch it | any state |
| **`readPending`** (FRD-21 — real git worktrees/branches not merged) | RSC `renderPartyTab` → `tents` pass-through | THE CAMPAMENTO: one ⛺ per pending-merge branch (occupied-only corner patch, `zones/camp.png`) | anything build-related (it is repo state, not build state) |
| **SSE `stateVersion`** (max mtime of status.yaml + WO files, stamped by `/api/live?project=`) | `PartyLiveShell` | a throttled `router.refresh()` when the machine state moves WITHOUT an event (cold start, long gate) — the scene can't look dead while the state file advances (DR-066 fix 3) | rendering directly (it only triggers the RSC re-read) |

### 7.3 The render loop (server → client)

1. **RSC pass** (`ProjectWorkspace` → `renderPartyTab`): reads work orders + timeline + status,
   derives `woStarts`, passes `project` (the emitters' `basename $PWD`), `running`,
   `supervisorHeartbeat` and the authoritative `workOrders` into `PartyTab`, which reads the
   event tail and derives the initial `FraguaSnapshot` via `toFraguaSnapshot` (pure).
2. **Client live shell** (`PartyLiveShell`): subscribes to `GET /api/live?project=` (SSE). Each
   frame re-derives the snapshot from the live events — but ALWAYS carrying the RSC's
   `workOrders` structure (events only modulate liveness/focus). Two refresh triggers share one
   throttled path (5 s): a genuinely fresher event, or a moved `stateVersion`.
3. **Scene** (`FraguaScene`): one persistent sprite engine for the whole build
   (`frdId: "fragua-global"` — a focus change must NOT reset in-flight walks; the diff effect
   retires departed WOs). `useSceneLife` is the single low-frequency clock (6 s tick) driving
   bubble rotation, the elapsed-time clock and the courier cue. Ambient motion is pure CSS
   (smoke, panda, courier keyframes in `globals.css`), all under `prefers-reduced-motion`.

### 7.4 Performance budget (measured)

No per-frame React state: the 6 s `useSceneLife` tick is the only interval; sprite positions are
written imperatively by the RAF engine (`useFraguaSprites`), never through setState; ambient
loops are CSS-only. SSE frames are throttled server-side (200 ms) and the RSC refresh
client-side (5 s). Sprites are positioned via `transform: translate(...)` (Fase 3), never per-frame
`left/top`, so the RAF write never triggers layout. Measured (CDP, 6 s idle scene, 2026-07-02):
**0.163 ms/frame** total main-thread (script+layout+recalc), layout **0.0 ms** — an order of
magnitude under the 2 ms budget.

### 7.5 Freshness is declared, never implied (DR-066)

The `FreshnessBadge` (shared module, `data-volatile`) grades the freshest of
{supervisor heartbeat, latest event} into "en vivo" (< 3·T), "datos de hace N min" (< 10-min
TTL) and "sin señal" (≥ TTL). The producer side of this contract (who advances the heartbeat
and when) lives in `factory/standards/observability.md`; the consumer derivation is
`lib/status/liveness.ts` and is the ONLY place the bands are computed.
