---
id: FRD-06
type: frd
title: FRD-06 — La Fragua (live build view; formerly the Party tab)
parent: product/prd.md
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-06-party/mocks/party.html
last_updated: '2026-10-22'
---
# FRD-06 — La Fragua (live build view; formerly the Party tab)

A faithful view of the **build** as the v2 engine runs it, shown as the **head of the project's Resumen** (FRD-04). There is no Party tab. The scene has **four stations** (Cola · Taller · Revisión · Bóveda) that hold one **token** per work order, placed by the work order's authoritative frontmatter state; the build agent is a generalist `implementer` orchestrated FRD by FRD by a deterministic script (Dynamic Workflows, DR-013), not a team of specialists chatting live. All communication is by document (the `## Status Note`), never live peer chat. The scene is read-only over the factory.

> **Design freeze amendment (2026-10-22, S2.2).** The sprite-per-work-order scene (rooms Forja → Tribunal → Bóveda, parchment, relay, flow strip, bitácora, campamento) was replaced by the approved four-station La Fragua (Órbita iterations 19, 21, 24, 26; contradiction C-08 of `docs/design/freeze/reconciliation.md`). Retired criteria keep their ids in the table below so traceability is preserved; the new behaviour is REQ-06-020. The role/colour set is owned by FRD-13; the pipeline view (La Campaña) by FRD-02.

## Requirements & acceptance criteria (EARS)

Stable IDs (DR-049): `REQ-06-MMM` → `AC-06-MMM.K`. The blueprint maps each REQ to a component/interface.

### Retired by the Órbita redesign (ids kept for traceability)

| Retired criteria | What they specified | Replaced by |
|---|---|---|
| AC-06-001.1 to .4 | One sprite per running work order; wave-size cap; "+N en cola"; foundation tag | Tokens per station, AC-06-020.3 and .4 |
| AC-06-002.1, .2 | Single-FRD scene; "52 / 109 WO" counter | Verdict sentence and stacked bar, AC-06-020.2; counts in the Resumen tiles (FRD-04 AC-04-014.3) |
| AC-06-003.1, .2 | Rooms Forja → Tribunal → Bóveda, stone bridges, walking sprites | Four stations, AC-06-020.3 and .6 |
| AC-06-004.1 to .4 | One reviewer per FRD, four lenses, visual judge, 12 tribunal slots | The Revisión station, AC-06-020.3 |
| AC-06-005.1, .2 | Bóveda trophies and compaction | The Bóveda station, AC-06-020.3 and .4 |
| AC-06-006.1 to .3 | Parchment hand-off of the Status Note | Not drawn in v2 |
| AC-06-007.1 to .3 | Disjoint waves, Option-B commit, Gran Integración | Not drawn in v2 |
| AC-06-008.1 | Per-work-order fidelity loop shown in the scene | Not drawn in v2 |
| AC-06-009.1 to .4 | Deep-mode sequential relay | Not drawn in v2 |
| AC-06-010.1 to .3 | Always-visible flow strip | Not drawn in v2 |
| AC-06-014.2 | Project-colour borders on events | Not drawn in v2 |
| AC-06-015.1, .2 | Bitácora del gremio feed with its icon vocabulary | The raw engine log, collapsed as "Bitácora técnica del motor" (FRD-04 AC-04-014.7) |
| AC-06-016.1 | Achievement toast on each work-order close | The guild achievement notice (FRD-09 AC-09-008.2) |
| AC-06-017.1 | Presentational layer (judge movement, speech bubbles, bridges) | Fixed decorative crews, AC-06-020.3 |
| AC-06-018.1 to .4 | Ambient bob, forge hammer, heartbeat chip, pulsing flow strip | Live only while `running`, AC-06-020.6 |
| AC-06-019.1 to .6, .8 to .11 | v2 global scene: wave, tribunal queue, Campaña chips, vault grouping, enfermería, campamento, toast fit | The four stations, AC-06-020.1 to .8 |

### REQ-06-001 — Stations follow the authoritative state
- **AC-06-001.5:** WHERE an event's work-order field (`wo`) carries **the FRD id itself** (`frd-NN-<slug>`) instead of a real work-order id — emitted for **FRD-level activity** (an agent working the feature as a whole, before/between its work orders) — THE system SHALL NOT treat it as a work order: it spawns **no token**, is **not** added to any station and does **not** inflate any count. Only real work-order ids are work orders in the scene.
- **AC-06-001.6:** THE station of each work order SHALL agree with the **authoritative work-order state** the Observabilidad views show — the frontmatter `implementation_status` read by `listWorkOrders` (the SAME source, DR-092 single source for derived state), NOT a second derivation: `PLANNED` → **Cola**; `IN_PROGRESS`, `BLOCKED` and `fail` → **Taller** (a blocked or failed work order keeps its token in Taller, drawn with the coral danger token, as `fragua-real` shows for a Bloqueado order); `IN_REVIEW` → **Revisión**; `VERIFIED` → **Bóveda**. The event stream drives only **liveness**; the frontmatter decides the structure. WHEN a gate sends a work order back (`IN_REVIEW → PLANNED`, a `wo_reopen` event), THE scene SHALL move its token back to Cola; a moved `stateVersion` in the SSE frame (a backward transition emits no event) SHALL also refresh the scene.

### REQ-06-002 — Token card
- **AC-06-002.3:** WHEN a token is hovered or focused, THE system SHALL show a card with the work order's **code, state, title and FRD** (see AC-06-020.4).

### REQ-06-011 — Feeds off real events, read-only, no Claude
- **AC-06-011.1:** THE system SHALL feed liveness off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` — plus the engine's `gate`/`achievement`/`wo_commit` lines — read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude** (read-only).
- **AC-06-011.2:** (amended 2026-10-22, v2 reconciliation) WHEN an event omits the optional enriched fields (`frd`, `phase`, `activity`, `mode`), THE system SHALL still render gracefully (backward compatibility), falling back to defaults rather than throwing. An event whose `frd` is an **empty string** (FRD-less activity, e.g. the visual-qa pass) or **composite** (several ids joined by comma, a run-level event) SHALL never become the project's current FRD or work order as La Fragua (in the project Resumen) draws it.
- **AC-06-011.3:** THE event tail SHALL be **scoped to the project** (the emitter's `basename $PWD`) with the filter applied **BEFORE the tail cap** (`readEvents({project})`, same for the SSE `?project=`), so neither another project's build nor any session's hook noise (`SubagentStop`/`SupervisorTick` fire from EVERY Claude conversation) can leak into the scene or crowd this project's events out of the 200-event tail.

### REQ-06-012 — Read-only in production; controls are demo-only (DR-061)
- **AC-06-012.1:** IN production Mission Control, THE system SHALL NOT expose any **effort/mode picker** nor any **power / reset / pause / agent-control** affordance — the build is launched by `/pandacorp:implement` and the effort is fixed there (DR-061); the view is read-only over the factory.
- **AC-06-012.2:** THE scene-state control (on / off) SHALL exist **only** in the prototype mockup, SHALL be visibly marked **"Demo"** with the note "En la app la escena muestra siempre el estado real del build.", SHALL be hidden when the prototype runs with `?demo=off`, and SHALL NOT ship in the Mission Control view.
- **AC-06-012.3:** **Out of v2 (owner decision 2026-10-21):** IN production Mission Control, THE system SHALL display the run **effort level as read-only data in the Misión bar** (next to the project WO progress), reading the mode from state. No v2 surface shows the effort level.

### REQ-06-013 — Factory-off state, derived from real state
- **AC-06-013.1:** WHILE **no build is running** (derived from real state), THE system SHALL render the scene idle, with the line "El equipo descansa: no hay un build corriendo.", never a blank screen or a crash.
- **AC-06-013.2:** THE factory-off state SHALL be **derived from real state**, NOT toggled by any control. (The command that starts a build is carried by the Resumen's "Siguiente paso", FRD-04 AC-04-014.3, not by an overlay line in the scene.)
- **AC-06-013.3:** WHEN a build becomes active again (events resume), THE system SHALL leave the factory-off state and show "El equipo está trabajando: hay un build corriendo." automatically.
- **AC-06-013.4:** THE "is a build running" signal SHALL be the project's **authoritative `running` flag from `status.yaml`**, NOT mere presence of events. The event ndjson retains the LAST build's events indefinitely, so when `running` is `false` THE system SHALL render the idle state even though a stale event tail is present. A build that EXISTS but is off SHALL still render its stations with their tokens, NOT the never-built state (AC-06-020.5).

### REQ-06-014 — Reduced motion
- **AC-06-014.1:** WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL La Fragua animation (crews, courier), while keeping the scene readable.

### REQ-06-018 — Liveness softened, never dead
- **AC-06-018.5:** WHEN `prefers-reduced-motion` is set, THE liveness cues of AC-06-020.6 SHALL be disabled, each falling back to a sensible **static** state that still communicates "active" — liveness is softened, never reduced to a dead or blank scene.

### REQ-06-019 — Freshness (DR-066)
- **AC-06-019.7:** THE project's build state SHALL declare its own freshness, never trusting the `running` flag alone (DR-066): WHILE `running` is true and the freshest of the supervisor heartbeat (`status.yaml`) and the latest event is older than the freshness TTL, THE scene, the Inicio card (FRD-18) and the Portafolio card (FRD-03) SHALL replace "Construyendo" with **"Sin señal · último evento hace N"** (state `build-no-signal`, M1 2026-10-22); WHILE the signal is fresh they read as live. The live shell SHALL refresh its RSC-derived structure when the SSE frame's `stateVersion` moves (a build advancing state without emitting an event must not read as dead). The badge is `data-volatile` (DR-088).

### REQ-06-020 — La Fragua at the head of the Resumen (added 2026-10-22, design freeze)
- **AC-06-020.1** — THE project Resumen SHALL open with the La Fragua scene (there is no Party tab), drawn with the always-dark scene tokens in both light and dark themes.
- **AC-06-020.2** — THE scene SHALL state the project verdict as a sentence and a health chip (espera tu decisión, construyendo, en pausa, listo para lanzar or avanzando), and SHALL show a stacked forging bar of verified, review, workshop and queue counts with a text alternative.
- **AC-06-020.3** — THE scene SHALL show four stations, Cola · Taller · Revisión · Bóveda, each with its count and a sub-label and fixed decorative crews, and SHALL place every work order in the station of its authoritative frontmatter state (AC-06-001.6).
- **AC-06-020.4** — EACH station SHALL show at most 8 work-order tokens (the FRD number over the order number) followed by "+N", and WHEN a token is hovered or focused THE system SHALL show a card with its code, state, title and FRD.
- **AC-06-020.5** — WHEN a station holds no work, THE scene SHALL draw three dashed slots and its empty message ("Nada por empezar", "Nadie construyendo ahora", "Nada esperando revisión", "Aún nada verificado"); WHEN the project has no work orders at all, THE scene SHALL say "Aún no hay work orders: la escena se llena cuando la arquitectura publique el plan."
- **AC-06-020.6** — (amended 2026-10-22, v2 reconciliation) WHILE the project's build is live, meaning its `running` flag is true AND its signal is fresh (DR-066, AC-06-019.7), THE scene SHALL animate the crews and a courier that walks a gold route between the first and last stations holding work; WHILE the build is not running, or is running without a fresh signal ("Sin señal"), the scene SHALL stay idle.
- **AC-06-020.7** — THE scene SHALL end with chips for what is left ("Faltan N", "Falta 1", or "Todo forjado"), the open changes ("N cambios abiertos") and the last movement ("Último movimiento hace …").
- **AC-06-020.8** — WHERE the viewport is narrower than 900 px, THE scene SHALL stack one station per row.

**Worked example (AC-06-020.2, AC-06-020.4, AC-06-020.7).** A project has 48 work orders: 39 VERIFIED, 8 IN_REVIEW, 1 PLANNED. Bóveda holds 39 (8 tokens and "+31"), Revisión 8, Cola 1, Taller 0 ("Nadie construyendo ahora"). The headline reads "39 de 48 work orders verificadas", the chip reads "Falta 1", and the stacked bar's text alternative lists the four counts. With 1 order left the headline says "La 1 restante ya está construida y espera la revisión de su FRD."

## Edge cases
- A FRD-level event (`wo` = the FRD id): no token, no count change (AC-06-001.5).
- A work order `BLOCKED` or failed mid-build sits in Taller with the coral danger token, never in Cola (AC-06-001.6); its failure also shows in Observabilidad as "Bloqueado" (FRD-05 REQ-05-002).
- More than 8 work orders in a station: 8 tokens and "+N" (AC-06-020.4); the full list is in Observabilidad.
- `running` true but the signal stale: "Sin señal · último evento hace N" instead of "Construyendo" (AC-06-019.7).
- `running` false with a stale event tail: idle scene, no live cue (AC-06-013.4).
- Project with a plan that has no work orders yet: the never-built message, all stations empty (AC-06-020.5).
- Events out of order or an empty latest bucket: the scene degrades to the idle state (AC-06-013.4), never mis-renders.

## Out of scope (this FRD does NOT include)
- **La Campaña** (the 6-phase pipeline with the full specialist team) — that is FRD-02 (the board card detail).
- Any sprite-per-work-order scene, rooms, flow strip, parchment, relay or bitácora feed (retired above).
- Any **effort/mode picker** or **power/reset/pause** control in the shipped view — these are **demo-only** in the prototype (DR-061) and never ship; MC is read-only and the effort is fixed by `/pandacorp:implement`.
- Defining the **role colour tokens** themselves (owned by FRD-13) and the shared selectors owned by FRD-12.
- The **engine event enrichment** itself (the plugin change that emits `frd`/`phase`/`activity`/`mode`) — a documented prerequisite owned by the plugin; this FRD only **consumes** those fields.
- Any **write / control** of the build: redirecting, pausing or commanding agents happens in the Claude Code app, never here (read-only invariant).
