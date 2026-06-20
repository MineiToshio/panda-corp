---
id: FRD-18
type: frd
title: 'FRD-18 — Dashboard ("Inicio", the command center)'
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-18 — Dashboard ("Inicio", the command center)

The landing screen of Mission Control: a read-only **command center** that answers, at a glance, *"what needs me now, what changed while I was away, and what's the next command"* across the whole factory. It is the **default view**; the Board / Portfolio / Achievements / Configuration / Documentation tabs stay reachable from the top nav.

It composes existing layers — honest gamification ([FRD-09](../frd-09-gamification/frd.md)), observability and data-viz ([FRD-12](../frd-12-observability-dataviz/frd.md)), the visual/accessibility system ([FRD-13](../frd-13-visual-system-accessibility/frd.md)) — and surfaces existing signals: the onboarding gate ([FRD-01](../frd-01-data-reading/frd.md)), plugin drift ([FRD-15](../frd-15-plugin-out-of-sync-warning/frd.md)), orphan projects ([FRD-16](../frd-16-orphan-project-detection/frd.md)) and the proposals / memory-health stream ([FRD-17](../frd-17-proposals-inbox/frd.md)). Designed from the dashboard-design research (action-oriented, exception-first, anti-vanity; see the decision log entry of 2026-06-16).

## Layout (top to bottom)
1. **Health banners** (conditional, only when triggered): onboarding gate (FRD-01), plugin drift (FRD-15), orphan projects (FRD-16).
2. **Desde tu última visita** — the digest of events since the operator last acknowledged.
3. **Tu turno** — the human-gate decision queue (the hero block).
4. **Pulso de la fábrica** — the funnel + the one metric that matters.
5. **Construcción y cartera** — one card per active/shipped project.
6. **Tu progreso** — the honest gamification strip.

## Acceptance criteria (EARS)
- The dashboard SHALL be the default landing view; the Board / Portfolio / Achievements / Configuration / Documentation tabs SHALL remain reachable from the top nav.
- The dashboard SHALL be read-only and SHALL NOT call Claude; every actionable item SHALL surface the exact `/pandacorp:*` command with a copy button, and clicking an item SHALL navigate to the relevant project, idea or board.
- **Exception-first / quiet when healthy**: WHEN nothing needs the operator, the screen SHALL read calm (e.g. "Tu turno" shows an *al día* badge) rather than manufacture urgency. No vanity or cumulative counters with no decision attached.
- **Real-time / event-driven**: the dashboard SHALL update LIVE — it watches the events NDJSON stream and the project `status.yaml` files and pushes deltas into the affected sections (digest count, queue, pulse, project cards), NOT a static render produced only on navigation. WHEN a new event arrives or a status file changes, the relevant section SHALL reflect it without the operator reloading the page.

### Desde tu última visita (the digest)
- The section SHALL show factory **events** (work orders closed/failed, phase transitions, decisions queued, lessons captured) as change-framed items with a relative timestamp, read from the event stream + state diffs (FRD-01) — NOT as cumulative totals.
- The "seen" marker (`visto_hasta`) SHALL be locally persisted and SHALL survive a page refresh and a tab close; a refresh or a mere visit SHALL NOT advance it.
- The marker SHALL advance ONLY when the operator acknowledges (a "marcar visto" action) or acts on an item. Events newer than the marker are "new" (highlighted and counted); a refresh therefore never loses unseen events.
- WHEN there are no new events, the section SHALL NOT be empty: it SHALL show an *al día* state plus the **last-24h activity** (dimmed) as a rolling-window fallback.
- (Always-open use) The section SHOULD update live as new events arrive, incrementing the "new" count without a refresh.

### Tu turno (the human-gate queue)
- The queue SHALL contain ONLY items that genuinely require the owner (a human gate): pending decisions (`.pandacorp/inbox/decisions.md` — spend money, deploy to prod, design/stack choice, delete data), shipped projects awaiting `/pandacorp:review-launch` (DR-043), the memory backlog nudge (FRD-17), and ideas in "Descubierta" awaiting prioritization.
- Routine progress SHALL NOT appear here: a running build, an auto-retried failed work order, and `advance_pending` (DR-032) are NOT owner gates — `advance_pending` is visible on the Board, not in this queue.
- Items SHALL be ordered by urgency; the section header SHALL show the count of items waiting, or an *al día* badge when none.

### Pulso de la fábrica (the pulse)
- The pulse SHALL present a small funnel (ideas alive → in construction → shipped) plus the count of items awaiting the owner, and SHALL surface the **one metric that matters**: the idea→shipped conversion. It composes FRD-12 and SHALL keep to ≤5 signals.
- The "in construction" signal SHALL distinguish live builds from stale ones via the honest live / no-signal indicator (FRD-12).

### Construcción y cartera (build & portfolio)
- Per active project (architecture / building) and per shipped project, a card SHALL show phase + version, work-order progress, age-in-stage, and the next command.
- WHEN a running build's last event is older than a freshness threshold, the card SHALL flag it *sin señal* (no-signal) with the last-event time; a fresh build SHALL show *en vivo* (live). (No-signal is itself the alarm.)
- WHEN a project has sat in its current phase beyond a staleness threshold, the card SHALL flag it *estancado* (stalled) with the age.
- WHEN a project has open bugs awaiting processing (count > 0), the card SHALL show a **"N bugs" count chip** so the operator sees pending defects at a glance.
- WHEN a work order is failing/blocked, the card SHALL surface the blocker reason inline (no need to open logs).
- The **next command** shown per card SHALL be derived from the project phase: a `building` project with work orders still open SHALL map to `/pandacorp:implement`; a `shipped` project SHALL map to `/pandacorp:review-launch`; otherwise the phase's natural next step.
- A shipped project SHALL be presented as *estable · en operación* with `/pandacorp:review-launch` as its next action.
- WHEN there are no active projects, the section SHALL show a **first-action card** with the command to start one — never a blank.

### Tu progreso (gamification)
- The strip SHALL show the guild level/XP, the most recent achievement and the next milestone, all derived from **real outcomes** (shipped, phases completed, lessons graduated) per FRD-09. No streaks, no false urgency.

## Edge cases
- The `visto_hasta` marker is **client-local UI state** (a preference), not a write to the factory or to a project — consistent with FRD-01's read-only constraint.
- No event stream yet (a fresh factory) → the digest shows an *al día* state and the empty-but-guided portfolio shows first-action cards; nothing is faked.
- Many waiting items → the queue stays urgency-ordered and does not truncate silently.

## Notes
- Implemented in the navigable prototype (`mission-control/prototype/index.html`, view `dashboard`): the digest's persisted marker uses `localStorage` (survives refresh/close); events, age-in-stage and live/no-signal are mocked with fixed timestamps. The Next.js app will read the real event stream and state.
- Approved as a **first version** (owner: "not 100% convinced, but good to ship and iterate"). The "Tu turno" composition, the digest ack model, and the pulse framing are expected to evolve.
