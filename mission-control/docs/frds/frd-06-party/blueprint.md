---
id: FRD-06-blueprint
type: blueprint
slug: la-fragua
title: FRD-06 La Fragua feature blueprint, v2 Órbita
status: ACTIVE
parent: FRD-06
implementation_status: IN_REVIEW
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---
# FRD-06 — La Fragua (live build view) · feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049). Built on the platform ([`../../product/architecture.md`](../../product/architecture.md):
> §5 build-event contract, §6 read interfaces, §7 cross-cutting) without restating it. Binding visual spec:
> [`fdd.md`](fdd.md) + [`mocks/party.html`](mocks/party.html) (frozen Órbita prototype, ADR-0012). Cross-FRD plan:
> `.pandacorp/run/architecture/wo-map.md` (§2 FRD-06, §6.C item 5).

## Purpose

La Fragua v2 is a four-station scene at the head of the project **Resumen** (FRD-04 mounts it; there is no Party
tab). It answers "how much is left and where": a verdict sentence and health chip, a stacked forging bar, the
stations **Cola · Taller · Revisión · Bóveda** holding one token per work order placed by its **frontmatter state**
(the same reader as Observabilidad), live crews and a courier only while the build is live, and foot chips. Events
drive only liveness; nothing in the scene is a control (DR-061, read-only).

The whole v1 sprite scene (`src/app/projects/[slug]/_party/**`, `src/components/modules/party/**`: rooms,
bridges, parchment, deep relay, flow strip, bitácora feed, camp, Misión bar effort, demo controls, per-WO toast,
event view-model) is removed by **WO-04-010** (map §6.C item 5), which also removes the Party tab. WO-06-013 never
imports from those folders; it ports into `src/lib/fragua/` only what it needs (the event-to-liveness reading).

## Components & Interfaces

| ID | Kind | Name · location | Responsibility | Traces |
|---|---|---|---|---|
| CMP-06-fragua-scene | RSC | `FraguaScene` · `src/app/projects/[slug]/_components/Fragua/FraguaScene.tsx` | `section.fragua` on the always-dark `--scene-*` tokens in both themes: eyebrow «La Fragua · <project>», verdict headline, status sentence, health chip, forging bar (`role="img"` with the four counts), the four stations, courier route, foot chips and the token note; never-built variant. No demo control, no effort, no power/reset/pause. | REQ-06-012, REQ-06-013, REQ-06-020 |
| CMP-06-station | RSC | `FraguaStation` (+ `FraguaStationEmpty`) · same folder | Decorative crew (`aria-hidden`), plate with name, count and sub-label, at most 8 tokens then «+N»; the empty variant draws three dashed ghost slots and the station's empty message with its icon. One station per row below 900 px. | REQ-06-020 |
| CMP-06-token | client island | `FraguaToken` + the token card (`#tok-tip`, `role="tooltip"`) · same folder | 44×40 `button` (FRD number over order number, tinted by state, coral when failed), `aria-label` «<id>: <title>»; hover or focus opens the card (code, state chip, title, first sentence of the summary, «FRD-NN · title») positioned in place with the prototype's own offset arithmetic (no portal, no positioning library); leave, blur or scroll closes it; activating the token (click, Enter, tap on touch) opens the order in Observabilidad (`…/observability?wo=<id>`). | REQ-06-002, REQ-06-020 |
| CMP-06-live | client island | `FraguaLive` · same folder | One `useLiveSnapshot` subscription for the Resumen: throttled `router.refresh()` on a fresher event or a moved `stateVersion` (`lib/status/state-version-moved.ts`), plus one scheduled refresh when the current signal would cross the no-signal TTL, so a silent build degrades to «Sin señal» without a reload. Toggles the live class that animates crews and courier. | REQ-06-001, REQ-06-013, REQ-06-019 |
| CMP-06-freshness-badge | client | `FreshnessBadge` · `src/components/modules/FreshnessBadge/` (restyled in place) | The shared build-signal chip: «Construyendo» (violet, loader) while live, «Sin señal · último evento hace N» (coral, alert) when `running` but stale, nothing when idle; `data-volatile`; re-grades from the server instant plus elapsed client time. Consumers: project header (FRD-04), Inicio card (FRD-18), Portafolio card (FRD-03). | REQ-06-019 |
| IF-06-build-signal | lib | `buildSignal(input)` · `src/lib/fragua/build-signal.ts` | THE single resolver of a project's build signal (DR-066/DR-115, LESSON-0077): `idle` when `running` is not true; otherwise the freshest of `supervisor_heartbeat` and the project's latest event graded by `freshnessBand` (`lib/status/liveness.ts`, TTL 10 min) into `live` or `no-signal` with its age in minutes. Inputs injected (`now()` of `src/lib/clock`). | REQ-06-013, REQ-06-019 |
| IF-06-stations | lib | `deriveStations(orders)` · `src/lib/fragua/stations.ts` | Pure: frontmatter state → station (`todo` → Cola; `in_progress` and `fail` → Taller, failed tokens coral; `review` → Revisión; `done` → Bóveda), counts, first 8 tokens in reader order, overflow, empty flags, the four forging-bar counts, the busy span for the courier. Events never create, move or count a token (an FRD-level `wo` is ignored by construction). | REQ-06-001, REQ-06-020 |
| IF-06-verdict | lib | `deriveVerdict(input)` · `src/lib/fragua/verdict.ts` | Pure: the health (precedence: Sin señal → Espera tu decisión → Construyendo ahora → En pausa (no movement for more than 7 days) → Listo para lanzar (all verified in Construcción) → Avanzando) and the verdict sentence parts (phase and %, what is left or «restantes … esperan la revisión», open changes, no-signal note, what waits for the owner), as catalogue keys + variables. | REQ-06-020 |
| IF-06-scene-data | lib | `loadFraguaScene(project)` · `src/lib/fragua/scene-data.ts` | The scene's one cached resolver (`React.cache()`): `listWorkOrders` (FRD-05), `readStatus` (phase, `running`, heartbeat), `readEvents({ project })` (project-scoped before the tail cap), `aggregateProgress`, `buildSignal`. It reads neither the change queue nor the FRD index (facts owned by other features' resolvers in the same wave; the mount passes them, see Contracts). | REQ-06-011, REQ-06-020 |

Reuse: `Chip` family (health and foot chips), `Icon`, `StateDot` with the shared work-order state map
(WO-13-011, ledger), `t()` copy (`workspace.resumen.forge.*`, `workspace.resumen.verdict.*`, `common.build.*`).
No new component beyond the components.md rows `FraguaScene`, `FraguaStation`, `FraguaToken` (FDD-06).

## Contracts

- **Seam (map §0.3):** `FraguaScene({ project, openChanges?, ownerPending?, lastActivityAt?, frds? })`.
  `project` is structural `{ slug, path, name }` (FRD-04's `WorkspaceProject` maps onto it: `slug`,
  `projectPath`, `name`). Four facts belong to other features' single resolvers that land in the same wave or
  later, so the mount supplies them and the scene never derives them itself (DR-115, LESSON-0077):
  `openChanges` = `countOpenChanges` (FRD-04, WO-04-013; «N cambios abiertos» chip and verdict part);
  `ownerPending` = this project's count from `ownerTurnItems({ project })` (FRD-18, WO-18-002; «Espera tu
  decisión» and «N cosas esperan tu decisión.»); `lastActivityAt` = the project's last-commit instant
  (FRD-03's resolver, carried by `WorkspaceProject.lastMove`; «En pausa» and «Último movimiento …»);
  `frds` = the FRD index rows (FRD-12, WO-12-007; «FRD-NN · title» in the token card). When one is absent the
  scene omits that part (no open-changes chip, no owner part, «Último movimiento sin registro», the card shows the
  FRD code alone); it never shows an invented value. WO-04-011 passes all four (ledger).
- **Read errors:** the work-order reader never throws; an unreadable `status.yaml` yields `idle` (never a
  fabricated live state); a `null` open-changes count (its reader failed, FRD-04 §4.5) omits the chip. The scene
  never renders blank and never crashes (AC-06-013.1).
- **Freshness chip:** `FreshnessBadge({ signal, nowIso })`; the v1 prop `lastSignalAt` stays accepted until its
  last caller (`_party/**`, removed by WO-04-010) is gone; its removal is requested from WO-13-013 (ledger).
- **Assets:** crews `public/prototype/assets/{product-manager,frontend-dev,backend-dev,reviewer,test-writer,devops}.png`,
  `courier.png` (copied as original bytes by WO-13-010), plain `<img>` with `image-rendering: pixelated`, no
  `next/image`.
- **Motion:** crews bob and the courier walks by CSS transforms only (`--from`, `--to`, `--dur` = 3 s per station
  between the first and last busy stations); only while live; hidden below 900 px and under
  `prefers-reduced-motion`, where the scene stays static and still reads live by its chip and sentence.

## Visual spec (DR-054)

| WO | Reproduce | Oracle states | Recorded hooks |
|---|---|---|---|
| WO-06-013 | [`fdd.md`](fdd.md), [`mocks/party.html`](mocks/party.html) | `fragua-real`, `fragua-on`, `fragua-off`, `fragua-empty`, `fragua-token-card`, `build-no-signal` | `section.fragua` (`.is-live` / `.is-idle`), `.fr-head`, `.eyebrow`, `.fr-side`, `.fr-quest`, `.fr-scene`, `.fr-path`, `.fr-route`, `.fr-courier`, `.fr-walker`, `.fr-station[data-station]`, `.fr-cast`, `.fr-plate`, `.fr-count`, `.tokens` (`.is-empty`), `.token[data-wo]`, `.tk-a`, `.tk-b`, `.token-more`, `.tk-ghost`, `.fr-empty-msg`, `.fr-foot`, `.fr-note`, `#tok-tip` |

Prototype reference: `fraguaScene`, `tokenTip`, `projectVerdict`, `buildSignal` in
`docs/design/prototype/prototype.js`; `.fragua`, `.fr-*`, `.token`, `.tok-tip` in `prototype.css`. Token slice:
`--scene-*` (always dark), the state hues through `data-tone`, the gold courier route, 12 px floor,
`tabular-nums` on counts. The scene is mounted on the Resumen by WO-04-011 (W6), so its gate-time picture is
FRD-04's `project-summary*` states as well.

## Dependencies & Risks

- **Upstream:** WO-13-012 (primitives), WO-01-010 (`now()`), WO-25-001 (the `wo` key and observability path),
  WO-05-001 (reader, VERIFIED), WO-06-012 (enriched event parse, VERIFIED).
- **Consumers:** WO-04-011 (mount, AC-06-020.1, passes the four cross-feature facts), WO-18-002 (AC-06-019.7
  across scene, Inicio and Portafolio, reusing `buildSignal` and `FreshnessBadge`), WO-03-007 and WO-04-010 (the
  same chip; `WorkspaceProject.build` is `buildSignal`'s value, one resolver).
- **Why props and not reads:** `countOpenChanges` (WO-04-013) and the FRD index (WO-12-007) build in this same
  wave, `ownerTurnItems` (W5) and the last-commit resolver (W4) later; reading or re-deriving them here would
  either break same-wave disjointness or create a second derivation. Moving the scene to a later wave would
  delay `buildSignal` / `FreshnessBadge`, which the W4/W5 cards consume.
- **Risk: no route before W6.** The scene has no page until WO-04-011 mounts it, so its behaviour e2e belongs to
  the mount (ledger); WO-06-013 proves its criteria with component and resolver tests against production-shaped
  fixtures (work-order folders, `status.yaml`, nested-`data` event lines with foreign-project noise).
- **Risk: superseded work orders** count in the stations until WO-05-009 (W6) excludes them from the reader.

## Traceability

| REQ | Components / interfaces | Live ACs → owner |
|---|---|---|
| REQ-06-001 | IF-06-stations, CMP-06-live | AC-06-001.5, AC-06-001.6 → WO-06-013 |
| REQ-06-002 | CMP-06-token | AC-06-002.3 → WO-06-013 |
| REQ-06-011 | IF-06-scene-data, IF-06-build-signal | AC-06-011.1, AC-06-011.2, AC-06-011.3 → WO-06-013 |
| REQ-06-012 | CMP-06-fragua-scene (no control, no effort) | AC-06-012.1, AC-06-012.2, AC-06-012.3 → WO-06-013 |
| REQ-06-013 | IF-06-build-signal, CMP-06-live, CMP-06-fragua-scene | AC-06-013.1, AC-06-013.2, AC-06-013.3, AC-06-013.4 → WO-06-013 |
| REQ-06-014 | CMP-06-fragua-scene, CMP-06-live (reduced motion) | AC-06-014.1 → WO-06-013 |
| REQ-06-018 | CMP-06-fragua-scene (static live cues) | AC-06-018.5 → WO-06-013 |
| REQ-06-019 | IF-06-build-signal, CMP-06-freshness-badge, CMP-06-live | AC-06-019.7 → WO-18-002 (first wave where scene, Inicio card and Portafolio card all exist) |
| REQ-06-020 | CMP-06-fragua-scene, CMP-06-station, CMP-06-token, IF-06-stations, IF-06-verdict | AC-06-020.1 → WO-04-011 (Resumen mount) · AC-06-020.2 to AC-06-020.8 → WO-06-013 |

Retired criteria (FRD table «Retired by the Órbita redesign») are owned by nobody and built by nobody.

## Build Plan

> The build engine reads this table; it matches each work order's frontmatter exactly.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-06-012 | WO-01-007 | `src/lib/events/events.ts`, `src/lib/events/event-types.ts`, `src/lib/events/_tests/events.wo06012.test.ts`, `src/tests/fixtures/events/dashboard-events-enriched.ndjson` | false | W2 (legacy, VERIFIED, never rebuilt) |
| WO-06-013 | WO-13-012, WO-01-010, WO-25-001, WO-05-001, WO-06-012 | `src/app/projects/[slug]/_components/Fragua/**`, `src/lib/fragua/**`, `src/components/modules/FreshnessBadge/**` | false | W3 · with WO-12-007, WO-14-005 and the other W3 surface WOs |

- **Order:** WO-06-012 is VERIFIED history (the parser WO-06-013 reads). WO-06-013 builds in W3 once the composite
  primitives (WO-13-012, W2) and the clock (WO-01-010, W2) exist; its other edges are VERIFIED or W0.
- **Disjoint by design:** WO-06-013 writes only `_components/Fragua/**`, `src/lib/fragua/**` and the
  `FreshnessBadge` module; no other W3 work order touches them (map §3.2).
- **Integration:** WO-04-010 (W5) deletes the v1 scene; WO-04-011 (W6) mounts `FraguaScene` at the head of the
  Resumen; WO-18-002 (W5) reuses `buildSignal` / `FreshnessBadge` for AC-06-019.7.
- **Reconciliation (2026-10-22, binding).** WO-06-013 stays W3 (author C's request to move it to W4 behind
  WO-04-013 is declined: WO-03-007 (W4) and WO-18-002 (W5) consume `buildSignal()` / `FreshnessBadge`, and the move
  would push WO-03-007 to W5 and WO-04-010 to W6). The scene derives no cross-feature count: the mount
  (WO-04-011) passes `openChanges` (`countOpenChanges`), `ownerPending` (`ownerTurnItems({ project }).count`),
  `lastActivityAt` (`getLastCommit()`) and `frds` (`listProjectFrds()`). `buildSignal()` is the one freshness
  resolver read by the scene, the Portafolio and Inicio cards (WO-03-007, WO-18-002) and the workspace hero
  (`WorkspaceProject.build`, WO-04-010). WO-04-011 owns the behaviour e2e of the scene inside Resumen
  (`e2e/resumen.spec.ts`). `FreshnessBadge`'s v1 `lastSignalAt` prop is dropped by WO-13-013 (W7). The
  per-station empty lines are drawn in FRD-04's `project-summary*` and FRD-20's `overlay-behind`.

## Superseded (v1 history)

All superseded by WO-06-013 (the v1 code they built is deleted by WO-04-010):

- WO-06-001 Iconic event vocabulary + event view-model mapper.
- WO-06-002 La Fragua layout (rooms + forge/tribunal/vault slots).
- WO-06-003 Event → visual-action map.
- WO-06-004 La Fragua engine (RAF loop, wave cap, rooms, parchment, gate).
- WO-06-005 La Fragua tab + `FraguaSnapshot`.
- WO-06-007 La Fragua scene re-paint (FraguaScene + PartyScene/PartyTab shell).

## Readiness check (DR-100)

Every REQ-06-MMM with a live criterion maps to a component or interface; each live criterion is owned by exactly one
work order (README AC table; two of them cross-FRD by the map); `dependsOn` names only live work orders; the W3
artifacts are disjoint; the primitives come from FRD-13's foundation work orders; no open clarification marker
survives. No API contract is planned (no route handler changes, map §0.3).
