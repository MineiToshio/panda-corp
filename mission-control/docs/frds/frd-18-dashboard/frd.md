---
id: FRD-18
type: frd
title: 'FRD-18 — Dashboard ("Inicio", the command center)'
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-18-dashboard/mocks/dashboard.html
last_updated: '2026-10-22'
floor: false
---
# FRD-18 — Dashboard ("Inicio", the command center)

The landing screen of Mission Control: a read-only **command center** that answers, at a glance, *"what needs me now and what's the next command"* across the whole factory. It is the **default view**; the Tablero / Portafolio / Propuestas / Logros / Documentación / Configuración destinations stay reachable from the sidebar (FRD-19). Its navigation label and its page heading (H1) are both "Inicio"; "Centro de mando" lives in the subtitle, "Tu centro de mando: primero lo que necesita tu acción; después lo que avanza y el estado de tus proyectos." (H1 = nav label, as the Shell-Presence Gate checks).

It composes existing layers — honest gamification ([FRD-09](../frd-09-gamification/frd.md)), observability and data-viz ([FRD-12](../frd-12-observability-dataviz/frd.md)), the visual/accessibility system ([FRD-13](../frd-13-visual-system-accessibility/frd.md)) — and surfaces existing signals: plugin drift ([FRD-15](../frd-15-plugin-out-of-sync-warning/frd.md)) and pending merges ([FRD-21](../frd-21-pending-merge/frd.md)). Designed from the dashboard-design research (action-oriented, exception-first, anti-vanity; see the decision log entry of 2026-06-16).

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle. The layout is the two-column composition of AC-18-022.1; the "Desde tu última visita" digest is out of v2 (owner decision 2026-10-21, prefixed **Out of v2**, original text kept); Tu turno holds decisions and changes ready, and the idea→shipped conversion lives in Logros → Estadísticas (contradiction C-18 of `docs/design/freeze/reconciliation.md`). Prototype-drawn behaviours are REQ-18-022 (AC-18-022.1 to AC-18-022.4).

## Layout (top to bottom, left column then right column)
1. **Health banner** (conditional, only when triggered): plugin drift (FRD-15).
2. Left column: **Tu turno** (the hero block) → **Tu cartera** → **En marcha**.
3. Right column: **Pulso** → **Gremio** → **Embudo de ideas** → **Árboles de trabajo** (FRD-21).
4. Below 1024 px: one column, with Tu turno first (AC-18-022.1).
5. **Out of v2 (owner decision 2026-10-21):** **Desde tu última visita**, the digest of events since the operator last acknowledged.

## Acceptance criteria (EARS)
- **REQ-18-001** — The dashboard SHALL be the default landing view; the other six sidebar destinations (Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración) SHALL remain reachable from the sidebar.
- **REQ-18-002** — The dashboard SHALL be read-only and SHALL NOT call Claude; every actionable item SHALL surface the exact `/pandacorp:*` command with a copy button, and clicking an item SHALL navigate to the relevant project, idea or board.
- **REQ-18-003** — **Exception-first / quiet when healthy**: WHEN nothing needs the operator, the screen SHALL read calm — "Tu turno" shows the message "Nada espera tu acción ahora mismo." and an *al día* badge — rather than manufacture urgency (state `home-calm`, M1 2026-10-22). No vanity or cumulative counters with no decision attached.
- **REQ-18-004** — **Real-time / event-driven**: the dashboard SHALL update LIVE — it watches the events NDJSON stream and the project `status.yaml` files and pushes deltas into the affected sections (queue, pulse, project cards), NOT a static render produced only on navigation. WHEN a new event arrives or a status file changes, the relevant section SHALL reflect it without the operator reloading the page.

### Desde tu última visita (the digest) — Out of v2 (owner decision 2026-10-21)
- **REQ-18-005** — **Out of v2 (owner decision 2026-10-21):** The section SHALL show factory **events** (work orders closed/failed, phase transitions, decisions queued, lessons captured) as change-framed items with a relative timestamp, read from the event stream + state diffs (FRD-01) — NOT as cumulative totals.
- **REQ-18-006** — **Out of v2 (owner decision 2026-10-21):** The "seen" marker (`visto_hasta`) SHALL be locally persisted and SHALL survive a page refresh and a tab close; a refresh or a mere visit SHALL NOT advance it.
- **REQ-18-007** — **Out of v2 (owner decision 2026-10-21):** The marker SHALL advance ONLY when the operator acknowledges (a "marcar visto" action) or acts on an item. Events newer than the marker are "new" (highlighted and counted); a refresh therefore never loses unseen events.
- **REQ-18-008** — **Out of v2 (owner decision 2026-10-21):** WHEN there are no new events, the section SHALL NOT be empty: it SHALL show an *al día* state plus the **last-24h activity** (dimmed) as a rolling-window fallback.
- **REQ-18-009** — **Out of v2 (owner decision 2026-10-21):** (Always-open use) The section SHOULD update live as new events arrive, incrementing the "new" count without a refresh.

### Tu turno (the human-gate queue)
- **REQ-18-010** — The queue SHALL contain ONLY items that genuinely require the owner (a human gate): pending decisions (`.pandacorp/inbox/decisions.md` — spend money, deploy to prod, design/stack choice, delete data) and changes ready to build. The other owner actions (shipped projects awaiting `/pandacorp:review-launch`, the memory backlog nudge, ideas in "Descubierta" awaiting prioritization) live in Propuestas (FRD-17), not here.
- **REQ-18-011** — Routine progress SHALL NOT appear here: a running build, an auto-retried failed work order, and `advance_pending` (DR-032) are NOT owner gates — `advance_pending` is visible on the Board, not in this queue.
- **REQ-18-012** — Items SHALL be ordered decisions first, then changes; the section header SHALL show the count of items waiting ("Tu turno N"), or an *al día* badge when none.

### Pulso (the pulse) and Embudo de ideas
- **REQ-18-013** — The pulse SHALL present the factory's pulse (Proyectos, FRDs, work orders verificadas) and the funnel "Embudo de ideas" (AC-18-022.4), keeping to ≤5 signals. The **idea→shipped conversion** (the one metric that matters) lives in Logros → Estadísticas (FRD-10), not on Inicio.
- **REQ-18-014** — **"Shipped" means launched, internal or external (DR-085).** A launch is either a legacy idea card hand-marked `status: "shipped"` with no linked project, or a portfolio project whose `.pandacorp/status.yaml` reports `phase: "release"` — an `in-pipeline` card's project reaching `release` counts as a launch even though the card itself stays `in-pipeline` (it freezes as a pointer, DR-085). The count SHALL come from THE single bridge resolver (`countLaunched`, `lib/ideas/ideas.ts`, DR-115) — the same one the Logros Estadísticas funnel uses — never a local re-filter of ideas by `status: "shipped"` alone, or the two surfaces silently disagree on the same fact.
- **REQ-18-015** — The "in construction" signal SHALL distinguish live builds from stale ones: WHILE `running` is true and the signal is stale, it SHALL read "Sin señal · último evento hace N" instead of "Construyendo" (FRD-06 AC-06-019.7, state `build-no-signal`, M1 2026-10-22).

### Tu cartera (build & portfolio)
- **REQ-18-016** — Per active project (architecture / building) and per shipped project, a card SHALL show phase, work-order progress and the next command. **Out of v2 (owner decision 2026-10-21):** the version and the age-in-stage on the card.
- **REQ-18-017** — WHEN a running build's last event is older than a freshness threshold, the card SHALL flag it "Sin señal · último evento hace N" (no-signal is itself the alarm); a fresh build SHALL show the "Construyendo" chip.
- **REQ-18-018** — **Out of v2 (owner decision 2026-10-21):** WHEN a project has sat in its current phase beyond a staleness threshold, the card SHALL flag it *estancado* (stalled) with the age.
- **REQ-18-019** — **Out of v2 (owner decision 2026-10-21):** WHEN a project has open bugs awaiting processing (count > 0), the card SHALL show a **"N bugs" count chip** so the operator sees pending defects at a glance.
- **REQ-18-020** — **Out of v2 (owner decision 2026-10-21):** WHEN a work order is failing/blocked, the card SHALL surface the blocker reason inline (no need to open logs).
- **REQ-18-021** — The **next command** shown per card SHALL be derived from the project phase, never from a fixture: a `building` project with work orders still open SHALL map to `/pandacorp:implement`; a `shipped` project SHALL map to `/pandacorp:review-launch`; otherwise the phase's natural next step.
- **Out of v2 (owner decision 2026-10-21):** A shipped project SHALL be presented as *estable · en operación* with `/pandacorp:review-launch` as its next action (the next command stays, per REQ-18-021).
- WHEN there are no projects, the Inicio SHALL show a **first-action card** with the command to start one — never a blank (state `factory-empty`, M1 2026-10-22; the Portafolio shows its own empty state, FRD-03).

### Gremio (gamification)
- The Gremio card SHALL show the guild level/XP, the most recent achievement (with a "Nuevo" chip when fresh) and the next milestone, all derived from **real outcomes** (shipped, phases completed, lessons graduated) per FRD-09. No streaks, no false urgency.

### REQ-18-022 — Layout, Tu turno detail, En marcha and Pulso/Embudo (added 2026-10-22, design freeze)
- **AC-18-022.1** — THE Inicio SHALL arrange its cards in two columns (left: Tu turno, Tu cartera, En marcha; right: Pulso, Gremio, Embudo de ideas, Árboles de trabajo) below the plugin warning, and SHALL put Tu turno first when the layout is one column (below 1024 px).
- **AC-18-022.2** — (amended 2026-10-22, gate fix) EACH Tu turno item SHALL be one line (title, "project · kind · age", its scoped command with copy), and WHEN "Detalles" is activated THE system SHALL open a dialog explaining what it is, what is needed, the recommendation, the context and the command; WHEN the decision is 7 days old or more, the dialog SHALL also carry the drawn sentence on what the command does (`dialogs.turnDecision.runStale`). A younger decision's dialog SHALL show the command without a run sentence (the fresh variant is drawn in no captured state).
- **AC-18-022.3** — THE Inicio SHALL list in-flight work in the "En marcha" card, apart from Tu turno, in collapsible groups: "Construyéndose ahora", "Esperan la revisión de su FRD" and "Borradores en la cola".
- **AC-18-022.4** — THE Inicio SHALL show the factory pulse (Proyectos, FRDs, work orders verificadas) and the "Embudo de ideas" per phase, with the discarded ideas counted apart.

**Worked example (AC-18-022.2).** A pending decision "2026-10-15-1" of Funko Tracker appears as one line: its title, "Funko Tracker · decisión · hace 6 días", and `/pandacorp:decide 2026-10-15-1` with a copy button. "Detalles" opens the dialog with what is needed, the recommendation (as text), the context and the command, with no run sentence (the decision is younger than 7 days; amended 2026-10-22, gate fix).

## Edge cases
- The `visto_hasta` marker is out of v2 together with the digest.
- No event stream yet (a fresh factory) → Inicio shows the first-action card (`factory-empty`); nothing is faked.
- Nothing waiting for the owner → "Nada espera tu acción ahora mismo." and the *al día* badge (REQ-18-003).
- Many waiting items → the queue stays decisions-first and does not truncate silently.
- A running build with a stale signal → "Sin señal · último evento hace N" (REQ-18-017).

## Notes
- Implemented in the navigable prototype (`docs/design/prototype/index.html`, view `home`); events, age-in-stage and live/no-signal are mocked with fixed timestamps. The Next.js app will read the real event stream and state.
- Approved as a **first version** (owner: "not 100% convinced, but good to ship and iterate"). The "Tu turno" composition and the pulse framing are expected to evolve.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.

## Visual close-out acceptance (2026-10-31)

WHEN an owner-turn item has no date, the system SHALL omit both the date and its separator from the metadata line.
