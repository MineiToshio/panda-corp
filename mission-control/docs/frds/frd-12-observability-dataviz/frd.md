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
- **AC-12-001.1** — ~~The header SHALL show **≤5 critical KPIs** (e.g. active projects, agents working, XP of the day, builds queued, **failed work orders**), top-left~~; the detail goes in collapsible sections. **SUPERSEDED (reconciled from code 2026-07-05):** the standalone observability KPI header (`KpiHeader`/`deriveKpis`) was never mounted in production and was **removed** (DR-092/DR-115 — its "failed work orders" metric derived state through a mechanism divergent from `WorkOrder.state`). The operative factory pulse is the Inicio **`Pulso`** section (FRD-18), which is the single source for those cross-cutting signals. This AC no longer describes shipped behaviour.
- **AC-12-001.2** — The view SHALL show a **Live / No signal** indicator with the **timestamp of the last event** read from `~/.claude/dashboard-events.ndjson` (data freshness), so the operator knows whether they're seeing something current or frozen.
- **AC-12-001.3** — ANY grouping or ranking (agents, events, metrics) SHALL be limited to the **top-5** so as not to overwhelm the operator.
- **AC-12-001.4** — The honest metrics (tasks done vs failed, time per work order, events per minute) SHALL be derived from the same event file, with no extra instrumentation.

### REQ-12-002 — Observabilidad tab placement (sibling of Party)
- **AC-12-002.1** — WHERE a project is open, Mission Control SHALL expose an **"Observabilidad" project tab** that is a **sibling of the Party tab**, NOT a view nested inside Party.
- **AC-12-002.2** — The **Party** tab SHALL remain the live-agents-only RPG panel and SHALL NOT contain the timeline or DAG views.
- **AC-12-002.3** — The Observabilidad tab SHALL provide a **Línea de tiempo ↔ DAG** toggle over the **same work-order data**, offering exactly those two views (no RPG view here).

### REQ-12-003 — Timeline view
- **AC-12-003.1** — WHEN the **Línea de tiempo** view is selected THE system SHALL render the build as **FRD ▸ work order (+ a per-FRD review segment)**: the **FRD is the top level**, shown as a **collapsible** row (click to expand/collapse) carrying a **summary bar equal to the sum of its work-orders' durations**; each work order **nests** under its FRD as a smaller, lighter bar, with its **review/test phase as a tail segment**. Each bar's **width is proportional to its duration** (a per-FRD local scale, so an 8-min and a 23-min work order are visibly different — the bar must never be a fixed/floored width that hides the duration). Granularity is FRD▸WO+review (NOT task/action — too granular). A reopened work order shows its **last attempt** (the attempt count is surfaced as meta).
- **AC-12-003.1a (data source + honest fallbacks)** — The timeline reads the **durable per-project log `.pandacorp/track.jsonl`** (written by the build engine: `wo_start`/`wo_end`/`review_*`/`frd_end`, DR-086) and degrades through an honest precedence:
  1. **track present** → **real** durations (`source: "track"`).
  2. **no track, but git history records the build** (WO-tagged commits) → an **estimated** timeline reconstructed from git (`source: "git"`): the **order, the dates and the outcomes are real**; **durations are estimated** from the gap between commits (clamped to a sane max, laid out sequentially so multi-day pauses don't distort the axis). It SHALL be shown under an explicit **"≈ tiempos estimados"** banner and never presented as real.
  3. **no track, no git build** but work orders exist → a **structural** view (FRD▸WO with states, NO durations) under an honest banner ("histórico — estructura sin duraciones").
  4. **no build data at all** → an **honest empty state**.
  The system SHALL NEVER render fabricated/placeholder duration bars, and SHALL always flag estimated durations as estimates.
- **AC-12-003.2** — The timeline SHALL offer a **"saltar al primer error"** affordance that locates the first failed work order in the sequence.

### REQ-12-004 — DAG view and interactions
- **AC-12-004.1** — WHEN the **DAG** view is selected THE system SHALL render a **work-order dependency graph** as a **2D compound (cluster) layout**: each FRD is an opaque box placed in free 2D, with its work-order cards inside it. Hand-rolled deterministic layout — no Dagre/ELK runtime dependency.
- **AC-12-004.1a (real dependencies — no fabrication, DR-087)** — Edges SHALL come from each work order's **`dependsOn` frontmatter** (read by `lib/work-orders`), the machine-readable source of truth. A work order with no declared dependencies is an **independent node** (no edge); cross-FRD and fan-in/fan-out edges render as-is. The system SHALL NOT fabricate edges — in particular it SHALL NOT invent a "depends on the previous work order in its FRD" sequential chain when a WO has no real dependency (that drew a linear chain that misrepresented the real graph).
- **AC-12-004.1b (2D compound layout — clusters in free 2D)** — The DAG SHALL place each FRD as an opaque **cluster box** positioned by a **deterministic seeded force simulation** (fixed iteration counts, no randomness) followed by an **AABB no-overlap pass** so boxes never touch; related FRDs end up adjacent and hubs central. Work-order **cards** sit inside their box, laid out by intra-FRD dependency rank (each card 2 lines: id + title + a state-color bar). Edges are **two levels**: **intra-FRD** WO→WO lines (drawn ON TOP of the boxes, visible inside) and **cross-FRD** lines **aggregated to one FRD→FRD line per directed pair** (drawn BEHIND the opaque boxes, so they hide where they cross a box and emerge from the borders — no spiderweb over the boxes). The layout is computed from **STRUCTURE ONLY** (WO ids + deps + frd) and is **byte-deterministic**, so it is stable across server reads + live updates: a WO **state** change only recolors its card — boxes never jump. (Replaces the earlier 1D swimlane layout; the force-directed/Obsidian look the red-team flagged for non-determinism is made deterministic here by seeding + structural-only layout, and adopted after the owner validated the prototype `docs/design/prototype/dag-2d.html`.)
- **AC-12-004.2 (color-on-select highlight)** — WHEN the operator hovers or **clicks to pin** a card THE system SHALL highlight its **intra transitive chain within its FRD** + its FRD's **immediate FRD neighbors** (1 hop — full transitive across FRDs is rejected: the shared foundations connect the whole graph, so it lights everything), **recolor each highlighted line a distinct trace-palette color** (the `--color-trace-N` design tokens) so crossing lines stay traceable, outline the chain's cards + the neighbor FRD boxes, and **dim** the rest. At rest every edge is uniform accent. Click the card again / the background / Escape clears the pin.
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
