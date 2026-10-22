---
id: FDD-05
type: fdd
slug: work-orders-live-view
title: FDD-05 — Work orders (live view, feature design)
status: ACTIVE
parent: FRD-05
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-05 Work orders (live view)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Frozen FROM the approved Órbita prototype (round 5, iteration 28). This FDD specifies only what the captured states of this FRD draw (DR-130). It uses the global design system and redefines none of it.

The work-order views live inside the project's Observabilidad tab (FRD-04 owns the workspace header, the tab bar and the Observabilidad tab itself; FRD-12 owns "Dependencias" and the drift badge). There is no separate work-orders tab. The view switch has Por FRD (default) and Tablero here; Dependencias is FRD-12's view. A work order opens as a drill-in inside the same tab.

The page frame of every state below is the workspace: breadcrumb, compact project header with "Cambiar proyecto", the tab bar with Observabilidad selected. Those belong to FRD-04's states; this FDD describes what appears under the tab bar.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Por FRD, collapsed (default) | The view switch, the "Filtrar por FRD" select, a count ("110 órdenes"), the four state tiles, one "Expandir todo" button and one collapsed row per FRD: FRD code, name, stacked state bar, "n/m" and percentage. | `wo-by-frd` | REQ-05-003, REQ-05-005, AC-05-008.1, AC-05-008.2 |
| Por FRD, every group open | The same view after "Expandir todo": the button reads "Colapsar todo" and each FRD lists its work-order rows. | `wo-by-frd-expanded` | AC-05-008.2 |
| Tablero | Columns by state: Planificado, En curso, En revisión, Verificado, each with its count; an empty column collapses to one line "Sin work orders"; a long column ends in the dashed bar "Mostrar N más". Cards show the id, the title and "FRD-NN · N dependencia(s)". | `wo-kanban` | REQ-05-001, REQ-05-003, AC-05-008.1, AC-05-008.3 |
| Tablero, column open | After "Mostrar N más" the column lists every card and the bar reads "Mostrar menos". | `wo-kanban-expanded` | REQ-05-001, AC-05-008.3 |
| Work order, Resumen | Drill-in: breadcrumb to the order, hero with the id chip, FRD chip, title and "Volver"; the four-step flow header with the "Ahora:" sentence; the Resumen / Documento completo tabs; then the cards "De qué trata", "Qué cambia", "Cómo se comprueba" (one card per acceptance criterion, EARS keywords marked), "Qué se construyó"; the line "El contenido viene del documento de la work order, escrito en inglés; los títulos son de Mission Control." and the link "Leer el documento completo". Beside them: "Ficha", "Dependencias" and "Construir esta work order". | `wo-detail` | REQ-05-004, REQ-05-005, AC-05-008.4 |
| Work order, Documento completo | The same hero and flow header, the "Documento completo" tab selected: the document path with its "Copiar documento" button, the folded "Metadatos del documento" and the rendered document sections. | `wo-detail-full` | REQ-05-004 |

## States

| State | What the user sees | Oracle state | ACs |
|---|---|---|---|
| State tile filter active | `state=review` in the URL: the "En revisión" tile is pressed, the count reads "1 orden", and only the FRD that has an order in that state is listed, with its row open. | `wo-state-filter` | REQ-05-007, AC-05-008.2 |
| Failed work order, Tablero | A fifth tile "Bloqueado" and a fifth column "Bloqueado", placed after Verificado in this capture, its header in the danger colour with an alert icon; the failed card has a coral fill and border, an alert icon, the id and title in danger colour, "FRD-05 · 1 dependencia" and the blocked reason in quotes. | `wo-failed` | REQ-05-001, REQ-05-002 |
| Failed work order, Por FRD | With "FRD-05 · Lista para compartir" selected, the FRD row is open and the failed order's row carries the same coral fill and border, an alert icon on its id and the "Bloqueado" state chip. | `wo-failed-row` | REQ-05-002 |
| Unknown work order | Under the tab bar: a card "Esta work order no está publicada" with "WO-99-999 no aparece entre las work orders capturadas de Mission Control." and the button "Ver work orders". No hero, no flow header. | `wo-detail-not-found` | AC-05-008.4 (the link must resolve or say so) |
| Project without work orders | A dashed empty box "Este proyecto todavía no tiene work orders publicadas. Sus documentos de producto y diseño siguen disponibles." and the command box `/pandacorp:architecture` with its copy button; the Observabilidad tab shows no count. | `wo-empty` | REQ-05-005 |
| Live refresh | Behaviour (no picture): the views update when work-order state changes without a reload; nothing visual is drawn for it. | `wo-by-frd` | FRD-05#U1, REQ-05-006 |

The drift badge "Verificado · N derivas" on a Por FRD row (visible in `wo-by-frd` on the FRD-03 row) belongs to FRD-12 (AC-12-003.3). Not specified here: editing a work order (the views are read-only) and the real-time transport.

## Components used

| Screen or state | Components (`docs/design/components.md`) |
|---|---|
| All | `Tabs` (FRD-04's bar), `Segmented` (Por FRD / Tablero), `SelectField`, `Crumbs` |
| `wo-by-frd`, `wo-by-frd-expanded`, `wo-state-filter`, `wo-failed-row` | `StateTile` (combinable `aria-pressed` filters), `FrdRow` (native `details`, `StackBar`), `WorkOrderRow` (fixed-width dependency column), `Button` sm ("Expandir todo" / "Colapsar todo") |
| `wo-kanban`, `wo-kanban-expanded`, `wo-failed` | `StateTile`, `WorkOrderColumn`, `WorkOrderCard` (`fail` variant is the same card), `MoreBar` ("Mostrar N más"), `StateDot` |
| `wo-detail`, `wo-detail-full` | `Card` + `CardHeader`, `WoSteps`, `Tabs`, `CriterionList`, `KeyValue` ("Ficha"), `DependencyButton`, `CommandBox`, `Chip`, `Markdown` / `Paper`-style reader for the document, `Button` ("Volver") |
| `wo-detail-not-found`, `wo-empty` | `Card`, `Button`, `EmptyState`, `CommandBox` |

No new component is introduced.

## Interaction & flow

- **Entry.** Observabilidad in the workspace tab bar opens Por FRD; the view and filters live in the URL (`view=tablero`, `state=review`, `frd=…`, `wo=…`, `woview=…`), so reload and Back restore them (FRD-25).
- **Filters.** The state tiles are `aria-pressed` toggles that combine with each other and with the FRD select by logical AND. The selected tile is neutral-bordered, not a hue.
- **Por FRD.** Every group starts closed; one toggle opens or closes all; a row opens a group and a work-order row opens that order.
- **Tablero.** At most 8 cards per column (4 on phones, see `wo-kanban` at 375), then "Mostrar N más". A column with no orders is one line. A card opens the order.
- **Order detail.** "Volver" returns to the list with its filters. The Resumen reads top to bottom in the fixed order of AC-05-008.4; "Leer el documento completo" switches to the other tab. The build command is copy-only; Mission Control runs nothing.
- **Failure.** A failed order is visible without opening anything: the Bloqueado tile and column appear only while one exists, and its card and row use the danger treatment with an icon and the word, never colour alone.

## Responsive & accessibility

- **Widths.** All states are captured at 1280, 768 and 375. Tablero columns share the width at 1280, flow as a masonry on tablet and stack on phones, where state tiles are two per row and empty columns collapse to one line (see `wo-kanban` at 375).
- **Not colour alone.** State chips carry an icon and a word; the failed card, row and column add an alert icon; stacked bars have a text alternative such as "10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado".
- **Keyboard.** Tiles and rows are buttons or `summary` elements; Tab order follows reading order; "Volver" and the breadcrumb are real links; the copy buttons are labelled "Copiar `<comando>`".
- **Language.** Artifact names stay English ("work orders", "FRD"); the interface around them is Spanish; titles, scope and criteria keep their source language, English, as the line under "Qué se construyó" says.

## Copy

Spanish, from `docs/design/microcopy.es.json`; no em dash in product copy.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-05-work-orders/mocks/work-orders.html` (one `mock-screen` section per captured state) and `docs/frds/frd-05-work-orders/mocks/screenshots/<id>-<width>-<theme>.jpg`.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=<slug>&tab=Observabilidad` plus the view parameters of each state (`view=tablero`, `state=review`, `wo=WO-02-014`).
- **Oracle states of this FRD (`oracle-states.json`):** `wo-by-frd`, `wo-by-frd-expanded`, `wo-state-filter`, `wo-kanban`, `wo-kanban-expanded`, `wo-detail`, `wo-detail-full`, `wo-detail-not-found`, `wo-empty`, `wo-failed`, `wo-failed-row`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/reference/css/` (11-progress, 12-command, 13-list-row, 14-empty-notice, 15-key-value, 20-tabs, 26-work-orders), `docs/design/prototype/components.html`.
- **`docs/design/components.md` rows:** `StateTile`, `FrdRow`, `WorkOrderRow`, `WorkOrderColumn` / `WorkOrderCard`, `WoSteps`, `CriterionList`, `DependencyButton`, `MoreBar`, `Segmented`, `Tabs`, `ProgressBar` / `StackBar`, `StateDot`, `EmptyState` / `Notice`, `CommandBox`, `KeyValue`, `Markdown`, `Paper`.
