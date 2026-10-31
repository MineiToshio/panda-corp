---
id: FDD-06
type: fdd
slug: la-fragua
title: La Fragua (main live build scene of the project Resumen)
status: ACTIVE
parent: FRD-06
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/frds/frd-06-party/mocks/party.html
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-06 La Fragua

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the Órbita design (round 5, iteration 28), frozen from the approved prototype. It describes only what the
> captured states of `mocks/party.html` draw (DR-130). La Fragua is not a tab: it is the main scene of the project
> **Resumen** (FRD-04). The 47 acceptance criteria the FRD retired (the sprite-per-work-order scene, rooms, tribunal,
> relay, flow strip, parchment, bitácora feed, toast) stay retired and are not specified here.

The scene keeps its own always-dark palette (`--scene-*`, `--map-*`) in both the light and the dark theme (AC-06-020.1). The surrounding Resumen content (the project header, «Siguiente paso» above the scene, the «Último commit en verde» panel, «Tu turno», «Últimos avances», «Avance por FRD», «Decisiones» and the «Bitácora técnica del motor») belongs to FRD-04 and FRD-14 and is not specified here.

## Screens

One screen: the scene, as the project Resumen draws it. Each row is a captured state; every state is the same scene in a different data situation.

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| La Fragua, project with a running build | Answer "how much is left and where" in the main scene of the Resumen: verdict, forging bar, four stations with tokens, foot chips | `fragua-real` | AC-06-001.6, AC-06-020.1, AC-06-020.2, AC-06-020.3, AC-06-020.4, AC-06-020.7, AC-06-020.8, AC-06-013.4 |
| La Fragua, running scene | The live cue: crews work and the courier walks between the first and last stations that hold work | `fragua-on` | AC-06-020.6, AC-06-013.3, AC-06-014.1, AC-06-018.5 |
| La Fragua, token card | Card that opens on a hovered or focused token: code, state, title, one sentence, FRD | `fragua-token-card` | AC-06-002.3, AC-06-020.4 |

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Build running, real state | Eyebrow «La Fragua · Funko Tracker». The sentence under the headline reads «El equipo está trabajando: hay un build corriendo.». The health chip reads «Espera tu decisión». Stations show Cola 0 («Nada por empezar»), Taller 1, Revisión 8, Bóveda 39 with 8 tokens then «+31». Foot chips «Faltan 9», «21 cambios abiertos» and «Último movimiento hoy». | `fragua-real` | AC-06-013.3, AC-06-020.2, AC-06-020.3, AC-06-020.4, AC-06-020.5, AC-06-020.7 |
| Build running, live cues | Same content as the real state. The crews animate and a gold courier route runs between the first and last stations holding work. | `fragua-on` | AC-06-020.6, AC-06-014.1, AC-06-018.5 |
| Factory off (build exists, not running) | Stations keep their tokens and counts. The sentence reads «El equipo descansa: no hay un build corriendo.». The crews are desaturated and idle and there is no courier. A stale event tail does not turn it on. | `fragua-off` | AC-06-013.1, AC-06-013.2, AC-06-013.4, AC-06-020.6 |
| Project without work orders yet (never built) | Eyebrow «La Fragua · PandaCast». The sentence reads «El equipo descansa: no hay un build corriendo.», the health chip «Avanzando». In place of the forging bar and the stations the scene says «Aún no hay work orders: la escena se llena cuando la arquitectura publique el plan.». Foot chips «Todo forjado», «0 cambios abiertos» and «Último movimiento ayer». | `fragua-empty` | AC-06-020.5, AC-06-020.7, AC-06-013.1 |
| Work order card on a focused token | A card floats above the focused token (WO-05-005): code, a «Bloqueado» state chip, the title «Share link with expiry», one sentence of the order's summary and «FRD-05 · Lista para compartir». | `fragua-token-card` | AC-06-002.3, AC-06-020.4 |
| Build with no signal | The headline gains «El build dice estar corriendo, pero no hay señal del supervisor desde hace 25 min.» The sentence reads «El equipo se detuvo: el build dice estar corriendo, pero el último evento llegó hace 25 min.». The health chip reads «Sin señal». The project header badge reads «Sin señal · último evento hace 25 min» in place of «Construyendo». | `build-no-signal` | AC-06-019.7 |

A station with no work always uses the pattern drawn for Cola in `fragua-real`: three dashed slots and one short message with an icon (AC-06-020.5). The captured states draw only Cola's message, so no other station message is specified here.

## Components used

From `docs/design/components.md`. Nothing new is introduced by this FRD.

| On screen | Component | Notes |
|---|---|---|
| The whole scene | `FraguaScene` | section `.fragua`: eyebrow, headline, sentence, health chip, forging bar, stations, foot. Its demo scene control is not part of it (DR-061). |
| Each of Cola, Taller, Revisión, Bóveda | `FraguaStation` | decorative crew, plate with name, count and sub-label, up to 8 tokens then «+N» |
| A station with no work | `FraguaStationEmpty` | three dashed ghost slots plus the short message |
| One work order | `FraguaToken` | 44 by 40 px tile, FRD number over order number, opens `#tok-tip` on hover or focus |
| Health chip, foot chips, count in the state chips | `Chip` family | tone carries status only, with an icon besides the colour |
| Project header badge in the no-signal state | `Chip` | text «Sin señal · último evento hace 25 min» (shared with FRD-03 and FRD-18) |

## Interaction & flow

- Entry: the user opens a project from the Portafolio (FRD-03); La Fragua is the main scene of the Resumen. There is no Party tab (`fragua-real`).
- The scene is read-only. It has no effort or mode picker and no power, reset, pause or agent control in the shipped view (AC-06-012.1). The prototype's scene-state control is demo-only (DR-061): it is not specified and does not ship. The run effort is not shown on any v2 surface (AC-06-012.3).
- Station placement follows the work order's frontmatter state, read from the same resolver as Observabilidad (AC-06-001.6); the event stream drives only liveness. A work order sent back by a gate returns to Cola; an event whose work-order field is an FRD id spawns no token and changes no count (AC-06-001.5, behaviour, no picture). In the captured real state the failing order WO-05-005 is drawn in Taller with its «Bloqueado» chip (see `fragua-token-card`).
- The stacked forging bar (verified, review, workshop, queue) carries a text alternative that lists the four counts (`fragua-real`, AC-06-020.2).
- Hover or keyboard focus on a token opens the card; leaving or scrolling closes it. The card is a tooltip and takes no pointer events (`fragua-token-card`).
- Liveness: while `running` is true the crews animate and the courier walks the gold route between the first and last stations that hold work; while it is false the scene is idle (`fragua-on`, `fragua-off`). The flag is the authoritative `running` in `status.yaml`, never the mere presence of events (AC-06-013.4). A build that becomes active again leaves the idle state by itself (AC-06-013.3).
- Freshness: a `running` flag with an old heartbeat reads «Sin señal» and never «Construyendo» (`build-no-signal`, AC-06-019.7). The badge is `data-volatile`, and the shell refreshes when the SSE frame's `stateVersion` moves (behaviour, no picture).
- Event reading (AC-06-011.1 to AC-06-011.3): liveness comes from `AgentWorking` events read from `~/.claude/dashboard-events.ndjson` through `lib/events.ts`, scoped to the project before the tail cap, tolerating events without the optional fields, without calling Claude (behaviour, no picture).

## Responsive & accessibility

- At 1280 the four stations sit in one row joined by the dashed route. Below 900 px the scene stacks one station per row: crew, then plate with name and count at the right, then its tokens (`fragua-real` at 375 and 768, AC-06-020.8). The dashed route and the courier are hidden when stacked.
- Tokens are 44 by 40 px with 12 px text. Each token is a `button` with an `aria-label` of the code and the title (`fragua-token-card`). Hover scaling happens only inside `@media (hover: hover)`.
- The forging bar is `role="img"` with an `aria-label` of the four counts. The decorative crews and the courier are `aria-hidden`.
- State is never by colour alone: each station and chip carries its text and an icon.
- With `prefers-reduced-motion` the crews and the courier stop and the scene stays readable and static (AC-06-014.1, AC-06-018.5). Only transforms animate; text never fades.

## Copy

All strings in this FDD are the Spanish ones drawn by the captured states; their keyed form lives in `docs/design/microcopy.es.json`. Work-order titles and summaries keep their source language (English). Artifact names stay English («work orders»).

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate): the component catalogue (`docs/design/prototype/components.html`), measured styles (`docs/design/prototype/reference/computed-styles.json`), the exported icons and logo (`docs/design/prototype/{icons,logo}/`), the copy file and the whole-app prototype for states and motion.

prototype_blessed_at: 409a0564

- **Mock:** `docs/frds/frd-06-party/mocks/party.html` (sections `fragua-real`, `fragua-on`, `fragua-off`, `fragua-empty`, `fragua-token-card`, `build-no-signal`).
- **Mock screenshots** in `mocks/screenshots/`: `<id>-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=funko-tracker` (and `#portfolio?project=pandacast` for the empty scene).
- **Oracle entries** (`docs/design/freeze/fidelity.config.json`, `states["frd-06-party"]`): `fragua-real`, `fragua-on`, `fragua-off`, `fragua-empty`, `fragua-token-card`, `build-no-signal`.
- **Reference files:** root `DESIGN.md` (scene tokens, responsive thresholds 899 and 759, demo-only rule), `docs/design/design-tokens.json`, `docs/design/freeze/m1-decisions.md`, `docs/design/freeze/reconciliation.md` (A-24 to A-31, B-40, C-08), `docs/design/prototype/prototype.css` (`.fragua`, `.fr-*`, `.token`, `.tok-tip`).
- **components.md rows:** `FraguaScene`, `FraguaStation` (with `FraguaStationEmpty`), `FraguaToken`, `Chip` family.
