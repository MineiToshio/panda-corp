# FDD-12 — Observability & data visualization — feature design

> **Visual source:** `docs/design/prototype/index.html` — the **dashboard** view (`dashboardView()`),
> the **digest** (`digestSection()`), the per-project **freshness chips** in the cartera cards, and the
> work-order **board** (`projWO()`). Frozen tokens: `docs/design/design-tokens.json` (Atelier —
> pixel-RPG / guild). No hardcoded visuals.
>
> **Scope note:** the prototype covers the KPI header, the Live/No-signal freshness indicator and a
> kanban-style work-order view. The **RPG ↔ timeline/tree toggle** and the **work-order DAG** (with
> dependency-chain highlight / "jump to first error" / follow-mode) named in the FRD are **NOT present
> in `index.html`** — they are unbuilt against this visual. See the functional-gap note at the bottom.

## Surfaces present in the prototype (the part this FDD freezes visually)

### 1. KPI header — "Pulso de la fábrica" (≤5 critical KPIs)
- **Render fn:** `dashboardView()` (~L676), the `dStat` grid.
- **Composition:** a `secthead` ("Pulso de la fábrica") over a responsive grid of **`dStat`** tiles —
  each a `secondary` card with an icon label (`text.t2`, 11px), a large **pixel** numeral (30px,
  `tabular-nums`), and a sub-line (`text.t3`). The four shown: **Ideas vivas · En construcción
  (con "{n} en vivo") · Lanzados · Esperan por ti** (the last accent-colored `danger`/`ok` by state).
  Below, a one-line **conversión idea→lanzada** metric — "la métrica que importa". Cap = ≤5 KPIs per
  the FRD; the detail lives in collapsible/secondary sections.

### 2. Live / No signal — data-freshness indicators
Two freshness surfaces in the prototype:
- **Digest freshness** (`digestSection`, ~L602): "Desde tu última visita" with an **al día** (`ok`)
  chip or "{n} nuevas" (`accent`) chip + "última revisión hace {ago}". This is the read-recency of the
  event feed.
- **Per-project live/no-signal** (`dashboardView` cartera cards, ~L646): each running project shows a
  chip **"en vivo"** (`ok`, play icon) when `signal` is "hace N min/seg", else **"sin señal"** (`warn`,
  alert icon) + the timestamp — the FRD's "Live / No signal + timestamp of last event" derived from the
  event tail. State is conveyed by **icon + text + color** together (a11y).

### 3. Event digest cards
- **Render fn:** `evCard()` (~L599) inside `digestSection`. A `secondary` card, icon in the event's
  semantic color, title + "{sub} · hace {ago}". New events get an `accent` border; older ones dim to
  `opacity:.5`. Sorted newest-first, scoped to the last 24h tail (matches the "read the tail, cap
  100–200" non-goal).

### 4. Work-order board (kanban over the event-derived state)
- **Render fn:** `projWO()` (~L818). Columns **todo · progress · review · fail · done** (`.col`),
  `.card` per work order with its FRD chip; **fail** cards use `danger`/`dangerBg`. Read-only — "lo
  escriben los agentes". This is the *current* per-project task view the timeline/tree toggle would
  augment.

## Components mapped to frozen primitives

| Element | Render fn | Token / primitive |
|---|---|---|
| KPI tile | `dStat` | `secondary` card + pixel 30px numeral + state accent (`danger`/`ok`) |
| Section header | `secthead` | `rpgSkin.secthead` |
| Event card | `evCard` | `secondary` card + semantic icon color + `accent` "new" border |
| Freshness chip | `digestSection` | `.chip` on `okBg`/`accentBg`/`warnBg` |
| Live/no-signal chip | cartera in `dashboardView` | `.chip` `okBg`+play / `warnBg`+alert |
| WO board column | `projWO` | `.col` + `.card` (+ `dangerBg` for fail) |
| WO card FRD tag | `frdChip` | `.chip` on `infoBg` |

## States (empty / loading / error)

- **Empty:** no projects → the cartera shows a friendly empty card with the `/pandacorp:spec` command
  (already in `dashboardView`). No 24h activity → digest shows "Sin actividad en las últimas 24 h."
  KPI tiles show `0` (pixel, `tabular-nums`) — never blank.
- **Loading:** server-delivered KPIs render directly (no skeleton per the Next.js rule).
- **No signal / stale feed (the core FRD case):** when the last event is old, the per-project chip flips
  to **"sin señal"** (`warn`) and the digest shows "al día / última revisión hace {ago}" — the operator
  always knows whether the data is live or frozen.
- **Error:** if `~/.claude/dashboard-events.ndjson` is unreadable, degrade to last-known KPIs + a
  "sin señal" state rather than erroring the page.

## Demo-only controls (DR-061) — MUST be marked on implementation

The dashboard digest carries **demo-only affordances** that do NOT exist in the real read-only app:
- `digestSection` (~L616): the **"demo · simular novedad · reiniciar novedades"** links (`data-act`
  `seen-sim` / `seen-reset`) and the simulated events ("Evento simulado (demo)") — these exist only to
  preview the "new events" state in the static prototype. The real feed comes from
  `~/.claude/dashboard-events.ndjson`; MC never injects events.
- The "marcar visto" control persists a real read-marker (localStorage in the prototype) — in the real
  app this is genuine read-recency state, so it stays as a real control, but the **simular/reiniciar**
  pair is preview-only.

On implementation these preview-only controls MUST be wrapped per DR-061: a dashed-border block + an
uppercase **`SOLO DEMO`** tag (warn color) + a one-line note ("No existen en la app real (solo
lectura): los eventos vienen de `~/.claude/dashboard-events.ndjson`. Aquí solo previsualizan el estado
'nuevas novedades'."). Any real value they preview (the freshness timestamp, the new-count) is already
surfaced as real read-only data in the digest header. (See also `PLUGIN_SYNC` mock at L572 — a
drift-preview toggle for FRD-15, not this FRD.)

## Accessibility notes
- Live/no-signal is **icon + text + color** (play/"en vivo" vs alert/"sin señal"), never color alone.
- KPI numerals are pixel-font with `tabular-nums` so the header never reflows as counts change.
- New-vs-old events distinguished by border + position **and** the "hace {ago}" text, not opacity alone.
- Top-5 cap on any grouping/ranking (FRD AC) keeps the surface scannable.

## index.html render-fn pointer
`dashboardView` (~L619), `dStat` (~L588), `digestSection` (~L602), `evCard` (~L599), `secthead`
(~L444/rpgSkin), cartera live/no-signal chips in `dashboardView` (~L646), `projWO` (~L818),
`frdChip` (~L816). CSS: `.col` (L66), `.chip`, `.card`, `.secthead` (rpgSkin).
