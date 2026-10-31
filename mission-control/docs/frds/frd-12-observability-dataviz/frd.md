---
id: FRD-12
type: frd
title: FRD-12 — Observability and data visualization
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-10-22'
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-12-observability-dataviz/mocks/observability-dataviz.html
floor: false
---
# FRD-12 — Observability and data visualization

Pandacorp's "honest" layer: read the factory's state at a glance and understand *where something got stuck*, complementing La Fragua's scene (FRD-06). Derived from the 2026 research (see [docs/proposals/06](../../../../docs/proposals/06-improvement-plan-2026.md)). Read-only, no calling Claude.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle (contradiction C-15 of `docs/design/freeze/reconciliation.md`). The timeline is gone (owner decision, iteration 22), Observabilidad is the work-order section with three views, and the dependency map adopts the prototype's deterministic layout (M1 decision 2026-10-22). Items the owner left out of v2 stay in place, prefixed **Out of v2**. Prototype-drawn behaviours are REQ-12-006 (AC-12-006.1 to AC-12-006.4).

## Tab placement (canonical)

The analytical views live in the project-level **"Observabilidad" tab**, the work-order section of the workspace: it offers the views **Por FRD (default) · Tablero · Dependencias** (FRD-05 AC-05-008.1, kept in the URL). There is no Party tab (La Fragua heads the Resumen, [FRD-06](../frd-06-party/frd.md)) and no Línea de tiempo view. All three views read the same work-order data.

## Acceptance criteria (EARS)

### REQ-12-001 — Header KPIs and freshness
- ~~**AC-12-001.1** — The header SHALL show **≤5 critical KPIs** (e.g. active projects, agents working, XP of the day, builds queued, **failed work orders**), top-left; the detail goes in collapsible sections.~~ **Struck (amended 2026-10-22, v2 plan; retired id, never reused).** **SUPERSEDED (reconciled from code 2026-07-05):** the standalone observability KPI header (`KpiHeader`/`deriveKpis`) was never mounted in production and was **removed** (DR-092/DR-115 — its "failed work orders" metric derived state through a mechanism divergent from `WorkOrder.state`). The operative factory pulse is the Inicio **`Pulso`** section (FRD-18), which is the single source for those cross-cutting signals. This AC no longer describes shipped behaviour.
- **AC-12-001.2** — The build state SHALL declare its freshness from the **timestamp of the last event** read from `~/.claude/dashboard-events.ndjson` and the supervisor heartbeat (DR-066), so the operator knows whether they're seeing something current or frozen: WHILE `running` is true and the signal is stale, the surfaces read **"Sin señal · último evento hace N"** instead of "Construyendo" (FRD-06 AC-06-019.7, state `build-no-signal`).
- **AC-12-001.3** — THE Inicio **Pulso** section (FRD-18 REQ-18-013) SHALL present at most **5 signals**, so as not to overwhelm the operator (amended 2026-10-22, v2 plan: restated from the generic "any grouping or ranking limited to top-5" rule, since no other v2 surface ranks agents, events or metrics).
- ~~**AC-12-001.4** — The honest metrics (tasks done vs failed, time per work order, events per minute) SHALL be derived from the same event file, with no extra instrumentation.~~ **Struck (amended 2026-10-22, v2 plan; retired id, never reused):** no v2 surface shows event metrics (the events-per-minute chart and top-N helpers are removed).

### REQ-12-002 — Observabilidad tab placement
- **AC-12-002.1** — WHERE a project is open, Mission Control SHALL expose an **"Observabilidad" project tab**, third in the tab order after Spec (FRD-04 REQ-04-002).
- **AC-12-002.2** — La Fragua SHALL NOT live in Observabilidad: it heads the project Resumen (FRD-06), and there is no Party tab.
- **AC-12-002.3** — The Observabilidad tab SHALL provide the views **Por FRD · Tablero · Dependencias** over the **same work-order data** (no timeline view, no RPG view).

### REQ-12-003 — Por FRD view: drift badge
- ~~**AC-12-003.1** — The Línea de tiempo view (FRD ▸ work order bars, the `.pandacorp/track.jsonl` timeline with its git-estimated and structural fallbacks, and "saltar al primer error").~~ **Struck (amended 2026-10-22, v2 plan; retired id, never reused).** **AC-12-003.1, AC-12-003.1a, AC-12-003.2 — retired (owner decision, iteration 22).** The Línea de tiempo view (FRD ▸ work order bars, the `.pandacorp/track.jsonl` timeline with its git-estimated and structural fallbacks, and "saltar al primer error") no longer exists. The FRD-by-FRD reading is the Por FRD view (FRD-05 AC-05-008.2).
- **AC-12-003.3 (pre-existing drift badge, DR-122)** — WHEN a FRD's rolled-up state is verified AND its
  `docs/frds/<frd>/frd.md` frontmatter carries a non-empty `drift: [REQ-…, AC-…]` list (written only by the
  build engine's certifying landing), THE **Por FRD row** of that FRD SHALL show **"Verificado · N derivas"** (N = the
  list length, icon + text, never color alone) as a link to the project's **Cambios** tab, where the
  `origin: gate-drift` cards live (state `wo-frd-drift`, M1 2026-10-22). The badge SHALL derive from that one field through ONE shared reader
  (`lib/frds/frd-drift.ts`, DR-115; no stored copy) and SHALL NOT appear when the list is empty/absent or the
  FRD is not verified. The reader SHALL fail loud (DR-078): a `drift` value that is not a list of
  `REQ-NN-MMM` / `AC-NN-MMM(.K)` ids, invalid frontmatter or an unreadable `frd.md` SHALL render a
  **"Deriva ilegible"** error chip on that FRD (any state), never a silent empty list; a FRD folder with no
  `frd.md` shows nothing.

### REQ-12-004 — Dependencias view and interactions
- **AC-12-004.1** — WHEN the **Dependencias** view is selected THE system SHALL render the card "Grafo de dependencias" (with a count chip, e.g. "23 FRDs") as a **work-order dependency graph** at two levels (AC-12-006.1): the FRDs as boxes placed **two per row** by a deterministic layout, and the work orders in **depth columns** (left to right: what goes first → what it unblocks). Hand-rolled deterministic layout — no Dagre/ELK runtime dependency. (Replaces the earlier force-layout clusters; adopted at M1 2026-10-22.)
- **AC-12-004.7** — (real dependencies, no fabrication, DR-087; renamed from "AC-12-004.1a", amended 2026-10-22, v2 plan) Edges SHALL come from each work order's **`dependsOn` frontmatter** (read by `lib/work-orders`), the machine-readable source of truth. A work order with no declared dependencies is an **independent node** (no edge); cross-FRD and fan-in/fan-out edges render as-is. The system SHALL NOT fabricate edges — in particular it SHALL NOT invent a "depends on the previous work order in its FRD" sequential chain when a WO has no real dependency (that drew a linear chain that misrepresented the real graph).
- **AC-12-004.8** — (deterministic layout; renamed from "AC-12-004.1b", amended 2026-10-22, v2 plan) The layout SHALL be computed from **STRUCTURE ONLY** (WO ids + deps + frd) and be **byte-deterministic**, so it is stable across server reads + live updates: a WO **state** change only recolors its card — boxes never jump. Edges are **two levels**: **intra-FRD** WO→WO lines and **cross-FRD** lines **aggregated to one FRD→FRD line per directed pair**, whose tooltip reads "FRD-01 → FRD-02: 1 dependencia" / "N dependencias".
- **AC-12-004.2 (chain highlight)** — WHEN the operator hovers or **clicks to pin** a card THE system SHALL highlight its **full upstream and downstream chain** in ONE highlight colour (the work orders it depends on and the ones it unblocks), outline the chain's cards, and **dim** the rest. At rest every edge is uniform accent. Click the card again / the background / Escape clears the pin.
- **AC-12-004.3** — **Out of v2 (owner decision 2026-10-21):** The DAG SHALL offer **"saltar al primer error"** that selects/highlights the first failed work order and its chain.
- **AC-12-004.4** — **Out of v2 (owner decision 2026-10-21):** The DAG SHALL offer a **"seguir al paso activo" follow-mode** toggle that, when ON, marks/centers the work order currently in execution.
- **AC-12-004.5** — The graph SHALL render at a **legible natural size** (never auto-shrunk to fit the column) and **pan inside its own bounded, scrollable container** — a wide graph never forces the whole page to scroll horizontally. **Out of v2 (owner decision 2026-10-21):** the floating **zoom / fit / fullscreen toolbar** (zoom out · % readout · zoom in · fit-to-view), the mouse-wheel zoom-to-cursor, grab-dragging the canvas and the browser fullscreen toggle on the dependency map (the data-model viewer of FRD-02 keeps its own toolbar).
- **AC-12-004.6** — Each node SHALL keep its text **inside the card**: the title is clamped to ≤2 lines with the full title in a tooltip (never spilling past the card edge), and the redundant `WO-NN-MMM —` id prefix is stripped from the title (the id is shown once).

### REQ-12-005 — Real-time updates
- **AC-12-005.1** — WHILE the build is running THE views SHALL update **live / event-driven**: the structure comes from the work-order frontmatter and refreshes when the SSE `stateVersion` moves or a newer event arrives in `~/.claude/dashboard-events.ndjson` — not a one-shot snapshot.
- **AC-12-005.2** — IF no new event has arrived THEN the views SHALL stay consistent with the freshness indicator of AC-12-001.2 (no fabricated progress).

### REQ-12-006 — Dependencias levels, focus card, narrow list and legacy link (added 2026-10-22, design freeze)
- **AC-12-006.1** — THE Dependencias view SHALL switch between an FRD-level map ("Por FRD", FRD boxes) and a work-order graph ("Por work order"), and WHEN an FRD title is activated THE system SHALL open that FRD in the work-order graph.
- **AC-12-006.2** — WHEN a work order is focused, THE system SHALL show the card "Work order en foco" with "Depende de · N", "Desbloquea · N" and a link "Abrir work order", and SHALL keep the focus in the URL.
- **AC-12-006.3** — WHERE the viewport is narrower than 900 px, THE dependency map SHALL render as an ordered build list ("Paso N · M work orders") whose FRDs unfold to their work orders.
- **AC-12-006.4** — WHEN a legacy link with `tab=Work orders` opens, THE workspace SHALL show the Observabilidad tab (FRD-05 views).

**Worked example (AC-12-006.3).** At 375 px the map is a list: "Paso 1 · 1 work order", "Paso 2 · 3 work orders", and so on; unfolding a step shows its FRDs and their work orders. The intro line says "Pulsa una work order para ver de qué depende y qué desbloquea."

## Edge cases
- A work order with no `dependsOn` → an independent node with no edge (AC-12-004.7).
- A `drift` value that is not a list of ids, or an unreadable `frd.md` → the "Deriva ilegible" chip (AC-12-003.3).
- A legacy `tab=Work orders` link → Observabilidad (AC-12-006.4).
- `running` true with a stale signal → "Sin señal · último evento hace N" (AC-12-001.2).

## Event schema (vendor-neutral)

The producer (factory hooks → `dashboard-events.ndjson`) and the consumer (Mission Control) share a **portable** schema (OpenTelemetry style: standardize the *shape* of the telemetry so as not to tie yourself to one viewer). Minimum per event: `event`, `at` (ISO timestamp), `agent`/`session`, `tool`, `status` (ok | fail), `work_order`/`task` id. This allows rendering it as a scene, as a list or exporting it without rewriting the emitter.

## Non-goals (v1)
- It is not a full APM nor does it keep a long history: it reads the **tail** of the event file (cap 100–200), not the whole history.
- It does not compute cost/tokens in v1 (left as a future metric if instrumented).
- The Observabilidad tab does NOT host La Fragua (that heads the Resumen, [FRD-06](../frd-06-party/frd.md)) and has no timeline.

## Future
Cost/tokens per agent and per project; trace export; comparison of idea→launch speed between projects.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.

## Malformed source clarification (2026-10-31)

A syntactically invalid work-order file SHALL produce a visible per-file notice naming its relative path and reason. The other valid work orders SHALL remain available in Observability, Summary FRD progress and recent progress. The invalid document SHALL NOT become a fabricated todo order. Unreadable discovery directories fail the entire source; deliberate absence remains empty. Global progress SHALL show the number of unread files instead of an exact total or percentage when any work order failed to parse.
