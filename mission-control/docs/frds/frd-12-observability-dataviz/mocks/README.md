# FRD-12 mocks — Observability & data visualization

**Visual source:** `docs/design/prototype/index.html` — render fns `dashboardView()` (the "Pulso de la
fábrica" KPI header + cartera live/no-signal chips), `digestSection()` / `evCard()` (the event digest +
freshness), and `projWO()` (the read-only work-order board). Frozen tokens:
`docs/design/design-tokens.json`.

To preview in the prototype: open `index.html` on the **Inicio** tab (KPI header, digest, cartera with
"en vivo / sin señal" chips); open a building project → **Work orders** for the board.

## Scope / what the prototype does NOT cover
The prototype covers the KPI header, the Live/No-signal freshness indicator and the kanban work-order
board. It does **NOT** contain the FRD's **RPG ↔ timeline/tree toggle** or the **work-order DAG**
(dependency-chain highlight, "jump to first error", follow-mode, Dagre layout). Those have no visual in
`index.html` — see the functional-gap note in the parent FDD; their UI must be designed before build.

## DR-061 — demo-only controls to mark
The digest's **"simular novedad / reiniciar novedades"** links + the "Evento simulado (demo)" entries
are preview-only (the real feed is `~/.claude/dashboard-events.ndjson`). On implementation, wrap them in
a dashed `SOLO DEMO` block per DR-061. The freshness timestamp + new-count are real read-only data and
stay outside the demo block.

## Baseline

The build's Preview Smoke / visual-fidelity gate (DR-055/056) renders the dashboard + a project's Work
orders route and compares them to the corresponding regions of `index.html`. Scoped self-contained
slices (`mocks/dashboard-kpis.html`, `mocks/wo-board.html`) + 375px and 1280px screenshots are to be
extracted at build time as the per-FRD fidelity baselines.

## Token slice this feature uses
`secondary`/`card` surfaces · `status` (ok/warn/danger/info + bg) · `accent.*` · `categories` (event
icon colors) · `typography.families.pixel` (KPI numerals) + `display` · `rpgSkin.secthead` · `.col`/`.chip`/`.card`.
