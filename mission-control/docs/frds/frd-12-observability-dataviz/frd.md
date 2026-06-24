---
id: FRD-12
type: frd
title: FRD-12 — Observability and data visualization
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
ui: true
visual_source: docs/design/prototype/index.html
---
# FRD-12 — Observability and data visualization

Pandacorp's "honest" layer: read the factory's state at a glance and understand *where something got stuck*, complementing Party's RPG show. Derived from the 2026 research (see [docs/proposals/06](../../../../docs/proposals/06-improvement-plan-2026.md)). Read-only, no calling Claude.

## Tab placement (canonical)

The analytical views live in a project-level **"Observabilidad" tab** that is a **sibling of the Party tab, NOT a view inside Party**. Party stays the live-agents-only RPG panel ([FRD-06](../frd-06-party/frd.md)); Observabilidad owns the timeline/DAG. The two surfaces share the same work-order data but are reached from two distinct project sub-tabs (`…/mission` Party, `…/observabilidad` Observabilidad). The Observabilidad tab offers a **Línea de tiempo ↔ DAG** toggle (exactly two views; the RPG view is NOT duplicated here — it lives in Party).

## Acceptance criteria (EARS)

### REQ-12-001 — Header KPIs and freshness
- **AC-12-001.1** — The header SHALL show **≤5 critical KPIs** (e.g. active projects, agents working, XP of the day, builds queued, **failed work orders**), top-left; the detail goes in collapsible sections.
- **AC-12-001.2** — The view SHALL show a **Live / No signal** indicator with the **timestamp of the last event** read from `~/.claude/dashboard-events.ndjson` (data freshness), so the operator knows whether they're seeing something current or frozen.
- **AC-12-001.3** — ANY grouping or ranking (agents, events, metrics) SHALL be limited to the **top-5** so as not to overwhelm the operator.
- **AC-12-001.4** — The honest metrics (tasks done vs failed, time per work order, events per minute) SHALL be derived from the same event file, with no extra instrumentation.

### REQ-12-002 — Observabilidad tab placement (sibling of Party)
- **AC-12-002.1** — WHERE a project is open, Mission Control SHALL expose an **"Observabilidad" project tab** that is a **sibling of the Party tab**, NOT a view nested inside Party.
- **AC-12-002.2** — The **Party** tab SHALL remain the live-agents-only RPG panel and SHALL NOT contain the timeline or DAG views.
- **AC-12-002.3** — The Observabilidad tab SHALL provide a **Línea de tiempo ↔ DAG** toggle over the **same work-order data**, offering exactly those two views (no RPG view here).

### REQ-12-003 — Timeline view
- **AC-12-003.1** — WHEN the **Línea de tiempo** view is selected THE system SHALL render the build as **FRD ▸ work order (+ a per-FRD review segment)** — FRD rows at the top level, each work order nested under its FRD as a bar sized to its **real wall-clock duration**, plus the FRD's review/test phase as its own segment. Granularity is FRD▸WO+review (NOT task/action — too granular). A reopened work order shows its **last attempt** (the attempt count is surfaced as meta).
- **AC-12-003.1a (data source + honest fallbacks)** — The timeline reads the **durable per-project log `.pandacorp/track.jsonl`** (written by the build engine: `wo_start`/`wo_end`/`review_*`/`frd_end`, DR-086). WHERE a track exists → real durations. WHERE a project has **no track** (built before the log, or never built with it) → a **structural** view (FRD▸WO with states, NO durations) under an honest banner ("histórico — estructura sin duraciones"). WHERE there is no build data at all → an **honest empty state**. The system SHALL NEVER render fabricated/placeholder duration bars.
- **AC-12-003.2** — The timeline SHALL offer a **"saltar al primer error"** affordance that locates the first failed work order in the sequence.

### REQ-12-004 — DAG view and interactions
- **AC-12-004.1** — WHEN the **DAG** view is selected THE system SHALL render a **work-order dependency graph** (rendered via **Dagre**, ~39KB, in the real app — NOT ELK.js unless orthogonal routing is genuinely needed).
- **AC-12-004.2** — WHEN the operator hovers or selects a node THE system SHALL **highlight only that node's dependency chain** (upstream + downstream) and **dim** the rest.
- **AC-12-004.3** — The DAG SHALL offer **"saltar al primer error"** that selects/highlights the first failed work order and its chain.
- **AC-12-004.4** — The DAG SHALL offer a **"seguir al paso activo" follow-mode** toggle that, when ON, marks/centers the work order currently in execution.
- **AC-12-004.5** — The DAG SHALL render at a **legible natural size** (never auto-shrunk to fit the column) and SHALL be **zoom/pan-able**: a floating toolbar (zoom out · % readout that resets to 100% · zoom in · fit-to-view) AND the **mouse wheel** change the zoom (wheel zoom is zoom-to-cursor and does not scroll the page), while the graph **pans inside its own bounded, scrollable container** — a wide graph never forces the whole page to scroll horizontally. Panning works by the scrollbars AND by **grab-dragging the canvas** (press-and-drag to scroll, `grab`/`grabbing` cursor); a press that travels past a small threshold pans and **does not select a node** (a click still selects), so dragging and clicking never conflict. The DAG SHALL also offer a **fullscreen** toggle (browser Fullscreen API on the whole DAG panel — legend + controls + canvas) so a large graph can fill the screen; Escape or the toggle exits, and zoom/pan/fit keep working at the larger size.
- **AC-12-004.6** — Each node SHALL keep its text **inside the card**: the title wraps to ≤2 lines with ellipsis (never spilling past the card edge) and the redundant `WO-NN-MMM —` id prefix is stripped from the title (the id is shown once, in the node's mono `id · FRD` sub-line).

### REQ-12-005 — Real-time updates
- **AC-12-005.1** — WHILE the build is running THE views SHALL update **live / event-driven** as new events arrive in `~/.claude/dashboard-events.ndjson` — not a one-shot snapshot. The **timeline** does this by **re-reading its durable source `.pandacorp/track.jsonl` on each event** (the engine appends to it live, so a refresh shows the latest WOs/durations from the same durable record); the DAG/KPIs read the event stream directly.
- **AC-12-005.2** — IF no new event has arrived THEN the views SHALL stay consistent with the freshness indicator of AC-12-001.2 (no fabricated progress).

## Event schema (vendor-neutral)

The producer (factory hooks → `dashboard-events.ndjson`) and the consumer (Mission Control) share a **portable** schema (OpenTelemetry style: standardize the *shape* of the telemetry so as not to tie yourself to one viewer). Minimum per event: `event`, `at` (ISO timestamp), `agent`/`session`, `tool`, `status` (ok | fail), `work_order`/`task` id. This allows rendering it as RPG, as a timeline or exporting it without rewriting the emitter.

## Non-goals (v1)
- It is not a full APM nor does it keep a long history: it reads the **tail** of the event file (cap 100–200), not the whole history.
- It does not compute cost/tokens in v1 (left as a future metric if instrumented).
- The Observabilidad tab does NOT host the live RPG agent panel (that is Party, [FRD-06](../frd-06-party/frd.md)) — it only carries the timeline and DAG.

## Future
Cost/tokens per agent and per project; trace export; comparison of idea→launch speed between projects.
