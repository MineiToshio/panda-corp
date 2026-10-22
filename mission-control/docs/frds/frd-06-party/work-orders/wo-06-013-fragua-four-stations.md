---
id: WO-06-013
type: work-order
slug: fragua-four-stations
title: 'WO-06-013 La Fragua four-station scene'
status: DRAFT
parent: FRD-06
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/Fragua/**'
  - 'src/lib/fragua/**'
  - 'src/components/modules/FreshnessBadge/**'
source_requirements: [REQ-06-001, REQ-06-002, REQ-06-011, REQ-06-012, REQ-06-013, REQ-06-014, REQ-06-018, REQ-06-019, REQ-06-020]
dependsOn: [WO-13-012, WO-01-010, WO-25-001, WO-05-001, WO-06-012]
last_updated: 2026-10-22
---

# WO-06-013 La Fragua four-station scene

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED` without the FRD gate passing.

## Summary

Builds La Fragua v2: the always-dark `FraguaScene` that the Resumen mounts at its head, with the verdict sentence
and health chip, the stacked forging bar, the four stations Cola · Taller · Revisión · Bóveda holding one token per
work order placed by its frontmatter state, the token card on hover or focus, live crews and courier only while the
build is live, the idle, never-built and no-signal variants, and the foot chips. It also builds the single
build-signal resolver and restyles the shared `FreshnessBadge` chip that the header, Inicio and Portafolio reuse.

## In Scope

- **`src/lib/fragua/`** (pure where possible, deduped per request): `buildSignal` (single resolver of idle / live /
  no-signal with the age in minutes, freshest of `supervisor_heartbeat` and the project's latest event, graded by
  `freshnessBand` with the 10-minute TTL, "now" from `now()` of `src/lib/clock`), `deriveStations`,
  `deriveVerdict` and `loadFraguaScene(project)` (blueprint Contracts and IF table; it reads neither the change
  queue nor the FRD index: those facts arrive as props). Port into
  this folder the event-to-liveness reading the v1 `_party/` code did (project-scoped tail, FRD-level `wo` never a
  work order, empty or composite `frd` ignored); import nothing from `_party/**` or `components/modules/party/**`.
- **`src/app/projects/[slug]/_components/Fragua/`**: `FraguaScene` (RSC, contract
  `FraguaScene({ project, openChanges?, ownerPending?, lastActivityAt?, frds? })`: the four optional facts come
  from `countOpenChanges` (FRD-04), `ownerTurnItems({ project })` (FRD-18), the last-commit instant (FRD-03 via
  `WorkspaceProject.lastMove`) and the FRD index (FRD-12); when one is absent its part is omitted, never
  invented), `FraguaStation` (+ empty variant), `FraguaToken`
  with the token card (client island), `FraguaLive` (client island: one `useLiveSnapshot` subscription, refresh on
  a fresher event or a moved `stateVersion`, one scheduled refresh at the TTL crossing, the live class).
  - Head: eyebrow «La Fragua · <project name>», the verdict headline (`h2`), the status sentence (working,
    resting, or the no-signal sentence with its age), the health chip with its icon (Sin señal coral · Espera tu
    decisión amber · Construyendo ahora violet · En pausa slate · Listo para lanzar green · Avanzando green).
  - Forging bar `role="img"` with the four counts as its name; segments verified, review, workshop, failed, queue.
  - Stations: crews from the copied sprites (Cola product-manager; Taller frontend-dev and backend-dev; Revisión
    reviewer and test-writer; Bóveda devops), plate with name, count and sub-label; up to 8 tokens then «+N»; a
    station without work draws three dashed slots and its message with its icon; failed and blocked tokens in
    Taller with the coral tone.
  - Token: `button`, FRD number over order number, `aria-label` «<id>: <title>»; hover or keyboard focus opens the
    card (code, state chip, title, first sentence of the summary, «FRD-NN · title») positioned with the
    prototype's `tokenTip` arithmetic; leave, blur or scroll closes it; activation opens the order in
    Observabilidad (`…/observability?wo=<id>` through the FRD-25 codec), which is also the touch behaviour (tap
    navigates; the card is a pointer/keyboard affordance, LESSON-0310).
  - Courier and route: only while live, between the first and last stations holding work, CSS transforms with
    `--from`/`--to`/`--dur`; hidden below 900 px and under reduced motion.
  - Never-built: no forging bar and no stations, the never-built sentence instead; foot chips still drawn.
  - Foot: «Falta 1» / «Faltan N» (amber) or «Todo forjado» (green), «N cambios abiertos» (pink, from the
    `openChanges` prop), «Último movimiento …» (plain, clock icon, from `lastActivityAt`, «sin registro» when
    absent), and the note «Cada cuadradito es una work order real: púlsalo para abrirla.».
  - Below 900 px one station per row (crew, plate with count at the right, tokens).
- **`src/components/modules/FreshnessBadge/`** restyled in place as the build-signal chip
  (`FreshnessBadge({ signal, nowIso })`, v1 `lastSignalAt` still accepted for its `_party` callers until WO-04-010
  deletes them): «Construyendo» while live, «Sin señal · último evento hace N» when stale, nothing when idle,
  `data-volatile`, client re-grade from the server instant.
- Read-only: no effort or mode picker, no power / reset / pause / agent control, no scene-state control, no
  «Demo» marker in the shipped view.

## Out of Scope

- Mounting the scene on the Resumen and the Resumen's always-dark placement (AC-06-020.1): WO-04-011.
- The scene, Inicio card and Portafolio card all showing «Sin señal» (AC-06-019.7): WO-18-002 (it reuses this
  WO's `buildSignal` and `FreshnessBadge`).
- Deleting the v1 sprite scene and the Party tab: WO-04-010 (map §6.C item 5).
- Excluding superseded work orders from the reader: WO-05-009.

## Requirements & Acceptance Criteria

REQ-06-001, REQ-06-002, REQ-06-011, REQ-06-012, REQ-06-013, REQ-06-014, REQ-06-018, REQ-06-019 (signal side),
REQ-06-020. Owned criteria, copied from the current FRD:

- **AC-06-001.5:** WHERE an event's work-order field (`wo`) carries **the FRD id itself** (`frd-NN-<slug>`) instead of a real work-order id — emitted for **FRD-level activity** (an agent working the feature as a whole, before/between its work orders) — THE system SHALL NOT treat it as a work order: it spawns **no token**, is **not** added to any station and does **not** inflate any count. Only real work-order ids are work orders in the scene.
- **AC-06-001.6:** THE station of each work order SHALL agree with the **authoritative work-order state** the Observabilidad views show — the frontmatter `implementation_status` read by `listWorkOrders` (the SAME source, DR-092 single source for derived state), NOT a second derivation: `PLANNED` → **Cola**; `IN_PROGRESS`, `BLOCKED` and `fail` → **Taller** (a blocked or failed work order keeps its token in Taller, drawn with the coral danger token, as `fragua-real` shows for a Bloqueado order); `IN_REVIEW` → **Revisión**; `VERIFIED` → **Bóveda**. The event stream drives only **liveness**; the frontmatter decides the structure. WHEN a gate sends a work order back (`IN_REVIEW → PLANNED`, a `wo_reopen` event), THE scene SHALL move its token back to Cola; a moved `stateVersion` in the SSE frame (a backward transition emits no event) SHALL also refresh the scene.
- **AC-06-002.3:** WHEN a token is hovered or focused, THE system SHALL show a card with the work order's **code, state, title and FRD** (see AC-06-020.4).
- **AC-06-011.1:** THE system SHALL feed liveness off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` — plus the engine's `gate`/`achievement`/`wo_commit` lines — read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude** (read-only).
- **AC-06-011.2:** WHEN an event omits the optional enriched fields (`frd`, `phase`, `activity`, `mode`), THE system SHALL still render gracefully (backward compatibility), falling back to defaults rather than throwing. An event whose `frd` is an **empty string** (FRD-less activity, e.g. the visual-qa pass) or **composite** (several ids joined by comma, a run-level event) SHALL never become the scene's FRD.
- **AC-06-011.3:** THE event tail SHALL be **scoped to the project** (the emitter's `basename $PWD`) with the filter applied **BEFORE the tail cap** (`readEvents({project})`, same for the SSE `?project=`), so neither another project's build nor any session's hook noise (`SubagentStop`/`SupervisorTick` fire from EVERY Claude conversation) can leak into the scene or crowd this project's events out of the 200-event tail.
- **AC-06-012.1:** IN production Mission Control, THE system SHALL NOT expose any **effort/mode picker** nor any **power / reset / pause / agent-control** affordance — the build is launched by `/pandacorp:implement` and the effort is fixed there (DR-061); the view is read-only over the factory.
- **AC-06-012.2:** THE scene-state control (on / off) SHALL exist **only** in the prototype mockup, SHALL be visibly marked **"Demo"** with the note "En la app la escena muestra siempre el estado real del build.", SHALL be hidden when the prototype runs with `?demo=off`, and SHALL NOT ship in the Mission Control view.
- **AC-06-012.3:** **Out of v2 (owner decision 2026-10-21):** IN production Mission Control, THE system SHALL display the run **effort level as read-only data in the Misión bar** (next to the project WO progress), reading the mode from state. No v2 surface shows the effort level.
- **AC-06-013.1:** WHILE **no build is running** (derived from real state), THE system SHALL render the scene idle, with the line "El equipo descansa: no hay un build corriendo.", never a blank screen or a crash.
- **AC-06-013.2:** THE factory-off state SHALL be **derived from real state**, NOT toggled by any control. (The command that starts a build is carried by the Resumen's "Siguiente paso", FRD-04 AC-04-014.3, not by an overlay line in the scene.)
- **AC-06-013.3:** WHEN a build becomes active again (events resume), THE system SHALL leave the factory-off state and show "El equipo está trabajando: hay un build corriendo." automatically.
- **AC-06-013.4:** THE "is a build running" signal SHALL be the project's **authoritative `running` flag from `status.yaml`**, NOT mere presence of events. The event ndjson retains the LAST build's events indefinitely, so when `running` is `false` THE system SHALL render the idle state even though a stale event tail is present. A build that EXISTS but is off SHALL still render its stations with their tokens, NOT the never-built state (AC-06-020.5).
- **AC-06-014.1:** WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL La Fragua animation (crews, courier), while keeping the scene readable.
- **AC-06-018.5:** WHEN `prefers-reduced-motion` is set, THE liveness cues of AC-06-020.6 SHALL be disabled, each falling back to a sensible **static** state that still communicates "active" — liveness is softened, never reduced to a dead or blank scene.
- **AC-06-020.2** — THE scene SHALL state the project verdict as a sentence and a health chip (espera tu decisión, construyendo, en pausa, listo para lanzar or avanzando), and SHALL show a stacked forging bar of verified, review, workshop and queue counts with a text alternative.
- **AC-06-020.3** — THE scene SHALL show four stations, Cola · Taller · Revisión · Bóveda, each with its count and a sub-label and fixed decorative crews, and SHALL place every work order in the station of its authoritative frontmatter state (AC-06-001.6).
- **AC-06-020.4** — EACH station SHALL show at most 8 work-order tokens (the FRD number over the order number) followed by "+N", and WHEN a token is hovered or focused THE system SHALL show a card with its code, state, title and FRD.
- **AC-06-020.5** — WHEN a station holds no work, THE scene SHALL draw three dashed slots and its empty message ("Nada por empezar", "Nadie construyendo ahora", "Nada esperando revisión", "Aún nada verificado"); WHEN the project has no work orders at all, THE scene SHALL say "Aún no hay work orders: la escena se llena cuando la arquitectura publique el plan." (drawn in FRD-04's project-summary states and FRD-20's overlay-behind)
- **AC-06-020.6** — WHILE the project's `running` flag is true, THE scene SHALL animate the crews and a courier that walks a gold route between the first and last stations holding work; WHILE it is false the scene SHALL stay idle.
- **AC-06-020.7** — THE scene SHALL end with chips for what is left ("Faltan N", "Falta 1", or "Todo forjado"), the open changes ("N cambios abiertos") and the last movement ("Último movimiento hace …"). (drawn in FRD-04's project-summary)
- **AC-06-020.8** — WHERE the viewport is narrower than 900 px, THE scene SHALL stack one station per row.

Notes on the negative and out-of-v2 criteria: AC-06-012.2 and AC-06-012.3 are met by absence (no scene-state
control, no «Demo», no effort level anywhere in the shipped scene), proven by tests. AC-06-011.2's «the scene's
FRD» has no v2 counterpart (the scene is project-wide): the test proves such events neither throw nor change a
station or a count. AC-06-020.6's «running» reads as live (running AND fresh, DR-066, AC-06-019.7); a stale
running flag shows the no-signal variant, idle.

**Completeness and NFRs (DR-100/DR-102).** Error paths: unreadable `status.yaml` → idle (never a fabricated live
state); malformed event lines skipped by the parser without throwing; an absent or `null` cross-feature fact
omits its part (never an invented value); no work orders → the never-built variant. Security: read-only, no Claude call, no write. Accessibility: the scene
is a `section` with its `h2`; tokens are buttons with names; the card is `role="tooltip"` and takes no pointer
events; crews and courier `aria-hidden`; the forging bar has its text alternative; state by icon and word; 44×40
targets; focus ring token. Performance: one cached load per request; no per-frame React state; motion is CSS
transforms under 300 ms per step except the courier walk (3 s per station, transform-only, as recorded); hover
scaling only inside `@media (hover: hover)`. Reduced motion: crews, courier and route off; the scene stays
readable and still says live by its chip and sentence.

## Components built (blueprint)

CMP-06-fragua-scene, CMP-06-station, CMP-06-token, CMP-06-live, CMP-06-freshness-badge, IF-06-build-signal,
IF-06-stations, IF-06-verdict, IF-06-scene-data. Reuse `Chip` family, `Icon`, `StateDot` with the shared
work-order state map (WO-13-011), `t()` copy. Assets: the sprites and `courier.png` WO-13-010 copied to
`public/prototype/assets/` (original bytes, `image-rendering: pixelated`, plain `<img>`). Installs: none.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-06-party/mocks/party.html` sections `fragua-real`, `fragua-on`,
  `fragua-off`, `fragua-empty`, `fragua-token-card`, `build-no-signal` (screenshots at 375, 768, 1280, light and
  dark). The station-empty pattern for the other three stations is drawn in FRD-04's `project-summary` states
  and FRD-20's `overlay-behind`.
- **Prototype functions:** `fraguaScene`, `tokenTip`, `projectVerdict`, `buildSignal`
  (`docs/design/prototype/prototype.js`); `.fragua`, `.fr-*`, `.token`, `.tok-tip` in `prototype.css`. Keep the
  recorded hooks listed in the blueprint's visual spec (`section.fragua`, `.fr-station[data-station]`,
  `.token[data-wo]`, `#tok-tip`, …); never ship `.demo-inline` / `data-demo-only` markup.
- **Token slice:** `--scene-*` always dark in both themes, station hues slate / blue / amber / green with coral
  for failed tokens, the gold route, chips at 24 px, 12 px floor, `tabular-nums` on counts.
- **FDD pointer:** `docs/frds/frd-06-party/fdd.md`.
- **Fidelity criterion:** the scene matches the six sections (layout, structure, density, stacking below 900 px)
  on the frozen tokens; preview smoke once mounted and the close-out fidelity diff in oracle mode (crews and
  courier paused at capture).

## Tests

- **Component and resolver tests** (Vitest + RTL), against production-shaped fixtures (a work-order folder set with
  every state including `BLOCKED` and a legacy fail marker, `status.yaml` with `running` true / false and a stale
  heartbeat, nested-`data` event lines with foreign-project and hook noise, FRD-level `wo`, empty and composite
  `frd`) and a malformed status file that yields idle: stations from frontmatter only; FRD-level and foreign events
  change nothing; reopen moves a token back to Cola after a refresh; 8 tokens then «+N» (the FRD worked example:
  Bóveda 39 → 8 and «+31», «Falta 1», the one-left review sentence); empty station slots and message; never-built;
  idle with a stale tail; live crews/courier only while live, between the busy stations; no-signal sentence and
  chip; reduced motion static; token card content, focus and close; no control, no «Demo», no effort level;
  `buildSignal` bands at the TTL boundary; `FreshnessBadge` wording, `data-volatile`, idle renders nothing.
- **Behaviour e2e:** none here: the scene has no route until WO-04-011 mounts it (W6); the Resumen's e2e covers
  it (ledger NEEDS on WO-04-011).
- **Derogated tests:** none removed here. The v1 `_party` tests and reviewer tests go with `_party/**` in
  WO-04-010. `src/components/modules/FreshnessBadge/_tests/FreshnessBadge.test.tsx` is updated to the v2 wording
  (its `lastSignalAt` cases keep passing). Baselines untouched.

## Definition of done

- `bash .pandacorp/verify.sh --since <base>` green (biome, tsc, knip: the new modules are covered by their tests,
  madge, structure guard).
- Every owned criterion met by a test that fails without the change; no import from `_party/**` or
  `components/modules/party/**`; strings through `t()`; tokens only; no `next/image` for the sprites.

## Dependencies

WO-13-012 (W2, primitives), WO-01-010 (W2, `now()`), WO-25-001 (W0, URL keys), WO-05-001 (reader, VERIFIED),
WO-06-012 (enriched event parse, VERIFIED). The last four edges are added to the map's list because this WO
imports them (DR-087); the wave stays W3.

## Status Note
