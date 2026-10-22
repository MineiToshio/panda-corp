---
id: FDD-22
type: fdd
slug: factory-backlog
title: FDD-22 — Factory backlog (feature design)
status: ACTIVE
parent: FRD-22
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-22 Factory backlog

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the design of the **Backlog** tab of Propuestas on the frozen Órbita system (`DESIGN.md`, `docs/design/design-tokens.json`): priority tiles, topic bars, the "Cómo avanzar" card, the status groups, the item dialog and the discard confirmation. It reuses shared components only. The captured states are the binding visual spec (DR-054); the page header and the other tabs belong to FRD-17 and FRD-13.

## Screens

| Screen | Purpose | Captured state | ACs |
|---|---|---|---|
| Backlog tab, default | See the factory's queue by priority and topic, learn how to advance it, open any item | `backlog` | AC-22-001.2, AC-22-001.3, AC-22-002.1, AC-22-002.3, AC-22-003.1, AC-22-008.1, AC-22-009.1, AC-22-010.3, AC-22-010.4 |
| Backlog filtered by priority | Only one priority: P0 | `backlog-priority-filter` | AC-22-010.1 |
| Backlog filtered by topic | Only one topic: Motor de construcción | `backlog-area-filter` | AC-22-010.2 |
| Item dialog | Read one item with its metadata, its body and its own command, and reach the discard action | `backlog-item-dialog` | AC-22-005.1, AC-22-005.2, AC-22-005.3, AC-22-009.2, AC-22-007.1 |
| Discard confirmation | Confirm the discard with an optional reason; replaces the item dialog | `backlog-discard-confirm` | AC-22-007.1, AC-22-007.2 |
| History open | The done and discarded items, paged | `backlog-history-open` | AC-22-006.1, AC-22-006.2, AC-22-007.3, AC-22-010.4 |
| Read errors | The files that could not be read, named, with the rest of the backlog still listed | `backlog-errors` | AC-22-004.2, AC-22-004.3 |

### The tab in order (`backlog`)

Route `#propuestas?tab=Backlog`. Page header (FRD-17's slot): the capture stamp, the single `h1` "Propuestas" and its subtitle. Then the shared tab bar named "Propuestas" with the tabs "Resumen" and "Memoria" (FRD-17; "Memoria" carries a count badge, 16 in the capture) and "Backlog" (selected, count badge 11 = open plus in progress). The Backlog panel, a vertical stack:

1. **Priority tiles** (a group named "Filtrar por prioridad"): three tile buttons that act as filters, each with a dot, the label, the count and a short hint: "P0 · urgente" 2 "arréglalo primero" (coral), "P1 · importante" 4 "pronto, de a uno" (amber), "P2 · cuando haya tiempo" 3 "mejoras y detalles" (slate). Text always carries the priority; colour only reinforces it.
2. **Two cards side by side** that end at the same height:
   - "Por tema" (blue card header, intro "Dónde se concentran los arreglos. Clic para filtrar."): a group named "Filtrar por tema" of bars, one per topic in plain names with its count: Motor de construcción 3, Controles automáticos 2, Skills 1, Plantillas de proyecto 1, Mission Control 1, Estándares 1, Agentes 1, Plugin 1.
   - "Cómo avanzar" (violet card header): "Todo de una vez." with the sentence "Lanza un agente por ítem (11 ítems): consume mucho y conviene solo con la cola corta." and the command box `/pandacorp:implement-backlog`; then "Uno por uno." with "Abre un ítem y copia su comando; empieza por los P0 y P1." and the command box `/pandacorp:implement-backlog BL-0001`; then the small faint line "Se corren en la carpeta de la fábrica."
3. **Toolbar**: a group named "Tipo" of filter chips "Todo tipo" (selected), "Bugs" 5 and "Mejoras" 6, and on the right the count "11 ítems".
4. **Card "En curso"** (violet, count pill 1): one row.
5. **Card "Abiertos"** (blue, count pill 10): rows grouped under the sub-headings "P0 · urgente" 2, "P1 · importante" 4 and "P2 · cuando haya tiempo" 3, each in id order.
6. **A collapsed card "Hechos y descartados"** (green icon tile, count pill 17), one native disclosure, closed.

**Item row** (`.lrow.bl-row`, a button): the mono faint id ("BL-0003"), the title in bold, clamped to two lines, a small line with the topic in plain words and the opening date ("Motor de construcción · 17 oct. 2026"), an outline chip "Bug" (coral) or "Mejora" (blue), and the priority chip "P0", "P1" or "P2". Titles keep their source language (English today).

### The item dialog (`backlog-item-dialog`)

Captured at the viewport at 375 and 1280. Head: kicker "Backlog · P1", title "BL-0003 · Cross-FRD dependencies declared in prose are ignored", close button "Cerrar". Body, top to bottom:

- a row of chips: priority "P1", outline "Bug", the status "En curso" (violet), the topic "Motor de construcción" (plain);
- the item's markdown body in the compact reader, each `##` heading a heading of the body in its source language ("Problem", "Fix plan" with a numbered list, "Proof" with a bullet list);
- the targeted command box `/pandacorp:implement-backlog BL-0003` with its copy button "Copiar /pandacorp:implement-backlog BL-0003";
- a danger button "Descartar" at the end.

### The discard confirmation (`backlog-discard-confirm`)

It replaces the item dialog in the same native dialog (no nested modal). Kicker "Confirmar", title "Descartar del backlog", close button "Cerrar". Body: the muted sentence "El ítem pasará a descartados con el motivo indicado.", the label "Motivo (opcional)" over a textarea with the placeholder "Por qué…", a slate notice with an alert icon that says what the write is bounded to, and the buttons "Cancelar" (ghost) and "Descartar" (danger).

### The read-error notice (`backlog-errors`)

First element of the panel, above the priority tiles: a coral `Notice` with `role="alert"`, the bold title "2 archivos del backlog no se pudieron leer", a list in which each line is the file name in `code` followed by the reason ("el frontmatter no es YAML válido"; "id duplicado BL-0013, ya definido en" the first file's name), and the small muted line "Los demás ítems sí se leyeron y aparecen abajo; los que fallan no se cuentan." The rest of the panel is unchanged below it.

## States

| State | What the owner sees | Captured state | ACs |
|---|---|---|---|
| Populated, default | The six blocks above; En curso first, then Abiertos by priority; history collapsed | `backlog` | AC-22-001.2, AC-22-008.1, AC-22-010.4 |
| Priority filter active | The pressed tile, "Quitar filtros" appears beside the count ("2 ítems"), En curso disappears when it has no match, Abiertos lists only P0, and the history card count follows the filter | `backlog-priority-filter` | AC-22-010.1 |
| Topic filter active | The pressed bar, "Quitar filtros", "3 ítems", the matching rows of En curso and Abiertos, the history count follows the filter | `backlog-area-filter` | AC-22-010.2 |
| Item open | The dialog above with its own command and "Descartar" | `backlog-item-dialog` | AC-22-005.1, AC-22-009.2 |
| Discard confirming | The confirmation dialog with the optional reason | `backlog-discard-confirm` | AC-22-007.1 |
| History open | The "Hechos y descartados" card open: the same row list, then a full-width dashed bar "Mostrar 2 más · quedan 2" | `backlog-history-open` | AC-22-006.2, AC-22-007.3 |
| Read errors | The coral notice naming each failed file; parsed items still listed and counted | `backlog-errors` | AC-22-004.2, AC-22-004.3 |

Behaviour with no picture of its own (rules about data or structure, not about a drawn element): the reader's fail-loud contract and first-wins duplicate rule (AC-22-004.1, AC-22-004.3); both panels stay mounted and carry `data-volatile` (AC-22-002.4); the discard write, its bounded fields and the move of the item into the history (AC-22-007.2, AC-22-007.3); the per-priority order inside a group by id (AC-22-008.1); a missing `factory/backlog/` directory as a legitimately empty backlog (AC-22-004.1). Mission Control creates and edits no backlog item (AC-22-003.1).

## Components used

From `docs/design/components.md`:

| Component | Use in this feature |
|---|---|
| `PageHead` | The Propuestas page title block (FRD-17's slot) |
| `Tabs` | The Resumen / Memoria / Backlog tab bar with count badges; no bespoke switcher |
| `StateTile` | The three priority tiles, combinable filters with `aria-pressed` |
| `AreaBar` | The "Por tema" bars, `aria-pressed` filters |
| `Card` / `CardHeader` | "Por tema", "Cómo avanzar", "En curso", "Abiertos" and the collapsed history card; count pill in the card's hue |
| `CommandBox` | The three commands (whole queue, one item in the card, the item's own in the dialog) |
| `Chip` family / `FilterChip` | The type filter chips, the outline "Bug" / "Mejora" chips, the priority and status chips |
| `ListRow` | The item row (`.lrow.bl-row`): id, title and small line, chips |
| `MoreBar` | "Mostrar N más · quedan M" at the end of the paged history |
| `Dialog` / `DialogConfirm` | The item dialog and the confirmation with the optional reason |
| `EmptyState` / `Notice` | The coral read-error notice (`role="alert"`) and the slate bounded-write notice in the confirmation |

No new component.

## Interaction & flow

1. The owner opens Propuestas and selects the Backlog tab (the selection lives in the URL, FRD-25). Resumen is the default tab when no tab is in the URL (AC-22-002.2).
2. Priority tiles, topic bars and type chips combine; each press updates the rows, the counts and the history card at once. "Quitar filtros" clears all of them.
3. Pressing a row opens its dialog; the body is read-only. The owner copies the item's command and runs it in the factory folder (the "Uno por uno" path), or copies the whole-queue command from "Cómo avanzar".
4. "Descartar" turns the dialog into the confirmation; the owner types an optional reason and confirms, or presses "Cancelar" to go back. On success the dialog closes and the item moves into "Hechos y descartados".
5. "Hechos y descartados" opens in place; "Mostrar 2 más · quedan 2" appends the next page of rows.

## Responsive & accessibility

- Captured at 375, 768 and 1280 in light and dark; the two dialogs also at the viewport at 375 and 1280.
- The two cards side by side stack to one column on narrow widths (below 1024 px, the actionable side first, per `components.md` card pairs).
- Filters are real buttons with `aria-pressed` inside named groups; the selected state is neutral, never a hue; the priority is always written ("P0 · urgente"), so colour is never the only carrier. The coral error notice is `role="alert"`.
- Dialogs are native: focus moves in, Escape closes, focus returns to the row that opened it.
- Item titles clamp to two lines; ids are mono and the numbers are tabular.

## Copy

Keyed Spanish strings: `docs/design/microcopy.es.json`; reconciliation notes in `docs/design/freeze/copy/frd-22.md`. Item ids, titles, body headings and the source language of the item file stay as written (English today); everything Mission Control writes is Spanish.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar, its *How to verify* the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-22-factory-backlog/mocks/factory-backlog.html` (states `backlog`, `backlog-priority-filter`, `backlog-area-filter`, `backlog-item-dialog`, `backlog-discard-confirm`, `backlog-history-open`, `backlog-errors`).
- **Mock screenshots:** `docs/frds/frd-22-factory-backlog/mocks/screenshots/<id>-<width>-<theme>.jpg` (40 files).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#propuestas?tab=Backlog`; the error state applies the fixture scenario `backlog-errors`.
- **Oracle table:** `docs/design/prototype/reference/oracle-states.json`, the seven entries of `frd-22-factory-backlog`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/components.html`, root `DESIGN.md`, `docs/design/design-tokens.json`. Styles to match: `.state-strip`, `.state-tile`, `.area-bars`, `.area-bar`, `.bl-row`, `.band-sub`, `.morebtn` in `docs/design/prototype/prototype.css`.
- **components.md rows:** `PageHead`, `Tabs`, `StateTile`, `AreaBar`, `Card`, `CardHeader`, `CommandBox`, `Chip`, `ListRow`, `MoreBar`, `Dialog`, `EmptyState` / `Notice`.
