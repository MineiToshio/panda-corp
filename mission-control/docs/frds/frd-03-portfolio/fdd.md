---
id: FDD-03
type: fdd
slug: portfolio-and-project-navigation
title: FDD-03 — Portafolio and project navigation (feature design)
status: ACTIVE
parent: FRD-03
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-03 Portafolio and project navigation

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Frozen FROM the approved Órbita prototype (round 5, iteration 28). This FDD specifies only what the captured states of this FRD draw (DR-130); it uses the global design system (`DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md`) and redefines nothing in it.

The Portafolio is the overview of every project: one page with the page title block (H1 "Portafolio", equal to the nav label), a three-way view switch (Tarjetas, Lista, Cuentas) and the project overview below it. Picking a project opens its workspace (FRD-04) across the full content width; the sidebar's project list and the "Cambiar de proyecto" dialog reach the same place.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Tarjetas (default view) | One card per project, ordered by last commit: avatar, phase chip, six-segment stepper, progress ring, "Etapa N de 6 del pipeline · último cambio hace …", counts, "Siguiente · `<command>`". | `portfolio-cards` | REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-005, REQ-03-006, REQ-03-007, AC-03-008.1 |
| Lista (comparison table) | The same projects as one table, "Comparativa", for side-by-side counts. | `portfolio-list` | REQ-03-001, REQ-03-004, AC-03-008.2 |
| Cuentas (third view) | The factory accounts directory: intro, search, state filter chips, accounts table. Works without selecting a project. | `portfolio-accounts` | REQ-03-009 |
| Cambiar de proyecto (dialog) | Searchable list of projects over the workspace, in the same order as the overview. | `portfolio-project-picker` | AC-03-008.3, REQ-03-005 |

## States

| State | What the user sees | Oracle state | ACs |
|---|---|---|---|
| Picker filtered | The dialog's search holds "funko" and the list narrows to the matching project. | `portfolio-project-picker-search` | AC-03-008.3 |
| Unknown project | A card "Este proyecto no existe" with the sentence "No hay ningún proyecto «does-not-exist»." and the button "Ver todos los proyectos"; no page title block. | `portfolio-project-not-found` | REQ-03-005 |
| Project folder missing | The project's card turns coral-tinted and shows a notice "Ruta no encontrada" under its counts: the sentence "La carpeta ~/Proyectos/pandacast ya no está en el disco. Clónala de nuevo y vuelve a sincronizar el portafolio:", then two command boxes, `git clone <repo> <path>` and `/pandacorp:sync-portfolio`, each with its copy button. The other cards are unchanged. | `portfolio-path-missing` | FRD-03#U2 (the "Ruta no encontrada" rule), REQ-03-003 |
| Empty factory | One first-action card "Tu fábrica todavía no tiene proyectos": the sentence "Un proyecto nace de una idea.", then "Captura tu primera idea, en la carpeta de la fábrica:" with the command box `/pandacorp:new-idea`, then "Cuando la idea esté lista, conviértela en proyecto:" with the command box `/pandacorp:spec <idea>`. The view switch stays, so Cuentas is reachable. | `factory-empty` | FRD-03#U1 (the empty-portfolio rule), REQ-03-009 |
| Build without signal | The running project's card replaces the violet "Construyendo" chip with "Sin señal · último evento hace 25 min"; the rest of the card is unchanged. | `build-no-signal` | REQ-03-003 |

Not specified by this FDD, because no captured state draws it:

- The no-remote variant of the missing-folder rule (the warning when a project has no `repo:`) has no picture; the FRD's wording is its only definition. Flagged to S3.
- The "Detalles" dialog of an accounts row, and the accounts source-error state, belong to FRD-26.
- The unparseable-date chip, the "stopped" indicator and the decision and bug count badges are Out of v2 in FRD-03.
- Loading state: behaviour (no picture). The overview streams with the page; no skeleton is drawn.

## Components used

From `docs/design/components.md`; nothing new is created for this FRD.

| Screen or state | Components |
|---|---|
| `portfolio-cards`, `portfolio-path-missing`, `build-no-signal` | `PageHead`, `Segmented`, `ProjectCard` (new row, `Avatar`, `Chip`, `Ring`, `PhaseStepper` compact, `CommandBox` inside the missing-folder notice), `Notice` |
| `portfolio-list` | `Segmented`, `Card` with `CardHeader` ("Comparativa"), `Table` (one card per row below 1024px), `Chip`, `ProgressBar` |
| `portfolio-accounts` | `Segmented`, `SearchField`, `FilterChip` (selected = neutral), `AccountsTable`, `CopyText` |
| `portfolio-project-picker`, `portfolio-project-picker-search` | `Dialog` (kicker "Portafolio"), `SearchField`, `ListRow` with `Avatar` and `ProgressBar`, `Chip` for "Actual" |
| `portfolio-project-not-found` | `Card`, `Button` |
| `factory-empty` | `EmptyState` first-action card (`CardHeader`), `CommandBox` |

## Interaction & flow

- **Entry.** Portafolio in the sidebar, or a project in the sidebar list. With no project selected the overview shows (REQ-03-006); it does not pre-select a project.
- **Switch.** Tarjetas, Lista and Cuentas are one `Segmented` with neutral selected state; one view shows at a time and the choice lives in the URL (`view=lista`, `view=cuentas`) (AC-03-008.2, REQ-03-009).
- **Open a project.** A card, a Lista row, a sidebar entry or a picker row opens that project's workspace (FRD-04) across the full content width (REQ-03-005). The card is one link; the missing-folder notice keeps its own copy buttons.
- **Picker.** "Cambiar de proyecto" (the switcher in the project header, FRD-04's `project-summary`) opens the dialog with the search focused; typing narrows the rows; the open project carries the "Actual" chip; Escape closes and returns focus to the switcher.
- **Commands are copy-only.** The recovery and first-action commands are text to copy; Mission Control never clones, writes or runs anything (FRD-03 read-only rule).
- **Order.** Cards, list rows and picker rows share one order, last commit first, labelled "Ordenados por último cambio".

## Responsive & accessibility

- **Widths.** 1280, 768 and 375 are captured for every state except the two picker states, which are captured at 375 and 1280 (`fidelity.config.json`). Cards flow in three columns at 1280, fewer below; Lista becomes one card per row below 1024px (see `portfolio-list` at 768); the picker dialog keeps a 16px inset on phones and its rows wrap their detail line.
- **Not colour alone.** The phase is a chip with its word and a dot; the ring shows its percentage as a numeral; "Ruta no encontrada" and "Sin señal" carry an icon or text, not only the coral tint.
- **Stepper and ring.** Each of the six segments has a tooltip and a visually hidden state word ("Investigación: completada" … "Lanzamiento: pendiente"); the ring has a text alternative with the verified work-order count.
- **Keyboard.** The segmented switch uses `aria-pressed` buttons; each card is one focusable link; the copy buttons are labelled "Copiar `<comando>`"; the dialog traps focus and closes on Escape.
- **Phone.** The card grid becomes one column at 375; the touch-target floor is the global one in `DESIGN.md`.

## Copy

Spanish, from `docs/design/microcopy.es.json`. Artifact names stay English ("work orders", "FRDs", "Spec"). No em dash in product copy; the middle dot is the structural separator.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-03-portfolio/mocks/portfolio.html` (one `mock-screen` section per captured state) and `docs/frds/frd-03-portfolio/mocks/screenshots/<id>-<width>-<theme>.jpg`.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio` (and `#portfolio?view=lista`, `#portfolio?view=cuentas`); `demo=off` removes the demo-only elements.
- **Oracle states of this FRD (`oracle-states.json`):** `portfolio-cards`, `portfolio-list`, `portfolio-accounts`, `portfolio-project-picker`, `portfolio-project-picker-search`, `portfolio-project-not-found`, `portfolio-path-missing`, `factory-empty`, `build-no-signal`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/reference/css/` (06-card, 07-chip, 10-segmented, 11-progress, 12-command, 13-list-row, 14-empty-notice, 16-table, 21-phase-stepper), `docs/design/prototype/components.html`, icons in `docs/design/prototype/icons/`.
- **`docs/design/components.md` rows:** `PageHead`, `Segmented`, `Chip` family, `CommandBox`, `ListRow`, `EmptyState` / `Notice`, `Dialog`, `SearchField` / `SelectField`, `Card`, `Table`, `Avatar`, `Ring`, `ProgressBar` / `StackBar`, `PhaseStepper`, `CopyText`, `ProjectCard`, `ProjectSwitcher`, `AccountsTable`.

## Unknown change count (2026-10-31)

In Lista, an existing project's unknown open-change count is a plain text link "No se pudo leer" to its Cambios tab. Reuse the table and link primitives without new tokens or layout. Missing project folders retain their absent-source placeholder. This is a read-error state (AC-03-008.3), not a numeric total.

## Partial-source state (2026-10-31)

FileReadErrors reuses the coral Notice with each relative path and localized reason, wrapping long
paths on phones. Valid lists remain below the notice. Incomplete project totals show "N archivos sin
leer" instead of a progress fraction/ring. Lista's source-error links are visibly underlined.

## Visual close-out (2026-10-31)

The view selector uses grid, list and users icons for Tarjetas, Lista and Cuentas, with a standard large stack gap before the view content. Shared progress rings have no box shadow; the Tailwind ring utility must not draw an outer outline in cards or project heroes.

## Independent review corrections (2026-10-31)

The toolbar has a bottom margin of s6 (24 px) in addition to the s5 grid gap, yielding the prototype's 44 px toolbar-to-cards separation. The phone project picker keeps intrinsic width on Summary and fills the compact header on other tabs. Selected segmented icons use blue. The hero ring is 60 px on phones (76 px on desktop).
