---
id: FDD-12
type: fdd
title: FDD-12 — Observability & data visualization (feature design)
parent: frds/frd-12-observability-dataviz/frd.md
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-12 — Observability & data visualization — feature design

> **Visual source:** `docs/design/prototype/index.html` — the **now-canonical** Group B surfaces.
> The Observabilidad project tab is `observabilidadBody(i)` (~L1214) with `bTimeline()` (~L1156) and
> `bDag()` (~L1169); the project tab bar that hosts it is `projectPane(i)` (~L895). The dashboard KPI
> header / freshness / digest / WO-board pieces remain in `dashboardView()` (~L690), `digestSection()`
> (~L673), `evCard()` (~L670) and `projWO()` (~L933). Frozen tokens: `docs/design/design-tokens.json`
> (Atelier — pixel-RPG / guild). **Fidelity, not novelty** — no hardcoded visuals.
>
> **Re-anchor note (2026-06-19):** the RPG↔timeline↔tree toggle and the work-order DAG that earlier
> editions of this FDD flagged as "not present in the prototype" **now exist and are canonical**. They
> were moved out of Party (Party = live agents only) into a **new project tab, "Observabilidad"**, the
> sibling of Party. This FDD is updated to freeze that surface.

## 1. The Observabilidad tab — Línea de tiempo ↔ DAG toggle (the new surface)

- **Render fn:** `observabilidadBody(i)` (~L1214). It is a project-workspace sub-tab, the **sibling of
  Party**: the project tab bar (`projectPane`, ~L897) is **Resumen · Work orders · Party · Observabilidad ·
  Documentos · Comandos**. Party (`missionBody`, ~L1206) is now **live agents only** (the La Fragua
  embed); the timeline and DAG were moved here.
- **Local header (the one canonical section header pattern):** a thin `panel` strip — an `eye-search`
  icon + the eyebrow "OBSERVABILIDAD · 2 vistas sobre los MISMOS work orders" on the left, and on the
  right the **2-view toggle** built from the **one `.stab` sub-tab pattern** (Tabs primitive): **Línea
  de tiempo** (`ti-timeline`) ↔ **DAG** (`ti-binary-tree`). A muted line below points to Party for the
  live agents ("¿Buscas a los agentes en vivo? Están en la pestaña Party."). Both views read the **same
  work orders** — the toggle never changes the data, only the lens.

### 1a. Línea de tiempo (`bTimeline`, ~L1156)
- A `panel` with a one-line legend, an optional **jump-to-first-error** note, a **time axis** (0 →
  `BWO_TOTAL/2` → `BWO_TOTAL` min) and one **row per work order**: a 150px label column (state icon in
  the WO's state color + title + `WO-id · FRD` in `mono`) and a horizontal **duration bar** positioned
  by `start`/`dur` against the total (`done`/`progress`/`fail`/`todo` colored). **Nested tasks** render
  as fainter (`opacity:.55`) sub-bars under each WO ("WO → tareas → acciones, por duración"). The first
  `fail` WO surfaces a danger line ("Primer error en … — la barra roja marca dónde se rompió la cadena").

### 1b. DAG — dependency graph (`bDag`, ~L1169)
- A `panel` with an SVG **dependency graph** of the work orders (static topological layout standing in
  for **Dagre** in the real app, noted as "~39KB"). Nodes are rounded `card` rects (title slice +
  `WO-id · FRD` mono + a state dot); edges are bezier arrows from each dep to its dependent.
- **Chain highlight:** hovering/clicking a node highlights its **full dependency chain** (`bDagChain`,
  upstream + downstream) with `accent` edges + thicker stroke and **dims everything else** to
  `opacity:.32`; a hint line shows "Resaltando la cadena de … (upstream + downstream) · limpiar".
- **Jump to first error:** a `danger`-bordered button selects the first `fail` WO and highlights its
  chain.
- **Follow the active step:** a toggle ("Seguir al paso activo: ON/OFF"); when on, the running
  (`progress`) WO gets an accent drop-shadow + a "▶ paso activo" caption.

## 2. Dashboard surfaces (unchanged, still part of this FRD)

### 2a. KPI header — "Pulso de la fábrica" (≤5 critical KPIs)
- **Render fn:** `dashboardView()` (~L690), the `dStat` grid. A `SectionHead` ("Pulso de la fábrica")
  over a responsive grid of **`dStat`** tiles — each a `secondary` card with an icon label (`text.t2`,
  11px), a large **pixel** numeral (30px, `tabular-nums`) and a sub-line (`text.t3`): **Ideas vivas · En
  construcción ("{n} en vivo") · Lanzados · Esperan por ti** (last accent-colored by state). Below, the
  one-line **conversión idea→lanzada** metric. Cap ≤5 KPIs.

### 2b. Live / No signal — data-freshness indicators
- **Digest freshness** (`digestSection`, ~L673): "Desde tu última visita" with an **al día** (`ok`) chip
  or "{n} nuevas" (`accent`) chip + "última revisión hace {ago}".
- **Per-project live/no-signal** (cartera cards in `dashboardView`, ~L717): each running project shows
  **"en vivo"** (`ok`, play icon) when `signal` is "hace N min/seg", else **"sin señal"** (`warn`, alert
  icon) + the timestamp — conveyed by **icon + text + color** together (a11y).

### 2c. Event digest cards (`evCard`, ~L670)
- A `secondary` card, icon in the event's semantic color, title + "{sub} · hace {ago}". New events get
  an `accent` border; older ones dim. Newest-first, scoped to the 24h tail (cap 100–200).

### 2d. Work-order board (`projWO`, ~L933)
- Columns **todo · progress · review · fail · done** (`.col`), `.card` per work order with its FRD chip;
  **fail** cards use `danger`/`dangerBg`. Read-only. The kanban is the *resting* per-project task view
  the Observabilidad timeline/DAG augment with duration and dependencies.

## 3. Components mapped to frozen primitives

| Element | Render fn | Token / primitive |
|---|---|---|
| Observabilidad tab shell + view toggle | `observabilidadBody` | `Panel` strip + `SectionHead` + `Tabs` (`.stab` toggle) |
| Timeline view | `bTimeline` | `TimelineView` (`Panel` + duration bars + nested task bars + time axis) |
| DAG view | `bDag` | `WoDag` (SVG graph, Dagre in app; chain-highlight, jump-to-error, follow-active) |
| Project tab bar | `projectPane` | `Tabs` (`.stab`) — Resumen·Work orders·Party·**Observabilidad**·Documentos·Comandos |
| KPI tile | `dStat` | `secondary` card + pixel 30px numeral + state accent |
| Section header | `secthead` | `SectionHead` (one canonical pattern) |
| Event card | `evCard` | `secondary` card + semantic icon color + `accent` "new" border |
| Freshness / live-no-signal chip | `digestSection` / cartera | `Chip` on `okBg`/`accentBg`/`warnBg` |
| WO board column / card | `projWO` | `.col` + `.card` (+ `dangerBg` for fail) |
| WO card FRD tag | `frdChip` | `Chip` on `infoBg` |

## 4. States (empty / loading / error)

- **Empty:** no work orders → Observabilidad shows the WO-board empty line ("Los work orders se generan
  en /pandacorp:architecture"); the timeline/DAG render their frame with no rows rather than blank. No
  projects → cartera shows the empty card with `/pandacorp:spec`. No 24h activity → digest shows "Sin
  actividad en las últimas 24 h." KPI tiles show `0` (pixel, `tabular-nums`), never blank.
- **Loading:** server-delivered KPIs/timeline/DAG render directly (no skeleton, Next.js rule).
- **No signal / stale feed:** the per-project chip flips to **"sin señal"** (`warn`) and the digest
  shows "última revisión hace {ago}" — the operator always knows whether the data is live or frozen.
- **Error:** if `~/.claude/dashboard-events.ndjson` is unreadable, degrade to last-known KPIs + a "sin
  señal" state; a malformed WO set degrades the timeline/DAG to their empty frame, never an error page.

## 5. Demo-only controls (DR-061) — MUST be marked on implementation

- **Dashboard digest** (`digestSection`): the **"simular novedad · reiniciar novedades"** links exist
  only to preview the "new events" state in the static prototype. The real feed comes from
  `~/.claude/dashboard-events.ndjson`; MC never injects events. The "marcar visto" control persists a
  genuine read-marker (real). On implementation the **simular/reiniciar** pair MUST be wrapped per
  DR-061: dashed border + uppercase **`SOLO DEMO`** tag (warn) + a one-line note. Any value they preview
  (freshness timestamp, new-count) is already surfaced as **real read-only data** in the digest header.
- **Observabilidad** itself has **no demo toggler**: the view toggle (Línea de tiempo ↔ DAG), the
  chain-highlight, jump-to-first-error and follow-active are **real interactions** over real WO data,
  not state-preview controls — they ship as-is.

## 6. Cohesion (DR-062)

This surface uses the app-wide framing, not bespoke chrome:
- **Page title** — the dashboard host uses the one **`PageTitle`** block (`pageHead`, ~L964): a light
  icon + H1 (= the nav label) + subtitle, **not** a heavy panel. The Observabilidad tab lives inside the
  project workspace under its light `compactProjectHeader` (FDD-04), never its own heavy title panel.
- **Section header** — every grouping (Pulso de la fábrica, the Observabilidad eyebrow strip) is the one
  **`SectionHead`** (`secthead`).
- **Tabs** — the project tab bar AND the Línea-de-tiempo↔DAG toggle are the **one `Tabs` pattern**
  (`.stab`); no ad-hoc switcher.
- **Chip / panel** — KPI tiles, freshness chips, WO cards and graph nodes all use the shared `Chip` /
  `Panel` shapes. No surface re-invents a pill, panel or header.

## 7. Accessibility notes
- Live/no-signal and WO/graph state are **icon + shape + text + color** (play/"en vivo" vs alert/"sin
  señal"; the DAG node carries a state dot + WO id, not color alone), never color alone.
- KPI numerals and durations are pixel/`tabular-nums` so headers and bars never reflow as counts change.
- The DAG chain-highlight has a focusable jump-to-error button and a text hint ("Resaltando la cadena de
  …"); follow-active is a labelled toggle. Motion is `transform`/`opacity` only and honors
  `prefers-reduced-motion`.

## 8. index.html render-fn pointers
`observabilidadBody` (~L1214) · `bTimeline` (~L1156) · `bDag` (~L1169) · `bDagChain` (~L1154) ·
`missionBody` (Party, live agents only, ~L1206) · `projectPane` (tab bar, ~L895) · `dashboardView`
(~L690) · `dStat` (~L659) · `digestSection` (~L673) · `evCard` (~L670) · `secthead` (~L453) ·
`projWO` (~L933) · `frdChip` (~L931) · `pageHead` (~L964) · `compactProjectHeader` (~L890).
