---
id: FDD-11
type: fdd
slug: build-modes
title: Per-project build modes (Modo de construcción)
status: ACTIVE
parent: FRD-11
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-11 Per-project build modes (Modo de construcción)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This FDD describes the build-mode picker and the scoped command of the approved Órbita prototype (`docs/design/prototype/index.html`, route `#portfolio?project=mission-control&tab=Comandos`), frozen FROM that prototype on 2026-10-22. It uses the global design system (`DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md`) and defines no token or component of its own. Every screen and state below is a captured state of `docs/frds/frd-11-build-modes/mocks/build-modes.html`; the screenshots in `mocks/screenshots/` are the binding picture.

## Screens

One screen: the **Comandos** tab of a project (the tab belongs to FRD-04's project workspace; FRD-11 owns the mode picker and the scoped command box). The project header, breadcrumb and tab bar above it are FRD-04's.

| Screen | Purpose | Captured state | Acceptance criteria |
|---|---|---|---|
| Comandos: mode picker and command | The owner picks how much power the build uses, sees the exact command to copy, and can scope the build to one target. Equilibrado is preselected and the box shows the command with no mode argument. | `commands` | REQ-11-001, REQ-11-002, REQ-11-004, AC-11-005.1 |

### Layout of `commands`

- **1280px**: two columns of cards. Left: "Siguiente paso", then "Modo de construcción". Right: "Construir un objetivo concreto", then "Cambios y decisiones". Cards are `Card` with the shared `CardHeader` (tinted icon tile, display title, one size).
- **768px**: one column; the four mode cards sit three in a row, the fourth wraps to a second row.
- **375px**: one column; the four mode cards are stacked full width, each with its icon, name, tag, meter and hint.
- The neighbouring cards ("Siguiente paso" with the three commands `/pandacorp:implement`, `/pandacorp:release`, `/pandacorp:iterate`; "Cambios y decisiones" with `/pandacorp:change`, `/pandacorp:decide`, `/pandacorp:new-version`) are FRD-04's Comandos content; this FDD only fixes how the mode card relates to them.

### "Modo de construcción" card (`commands`)

- Header: tinted icon tile, title "Modo de construcción", then the line "Con cuánta potencia se construye. Se recuerda por proyecto." (REQ-11-003).
- **Four selectable mode cards** (`BuildModeCard`), in this order: Equilibrado, Pro, Potente, Profundo (AC-11-005.1, REQ-11-001). Each card shows:
  - a 15px mode icon in a tinted tile (the selected card's tile is filled);
  - the mode name in bold followed by its **tag**, the literal command argument in small mono: "por defecto" for Equilibrado, "pro", "powerful", "deep";
  - a **power meter** of four segments, filled 1 to 4 (Pro 1, Equilibrado 2, Potente 3, Profundo 4), with the accessible name "Potencia 2 de 4" and so on (state by count of segments plus the text name, never colour alone);
  - the hint:
    - Equilibrado: "Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x."
    - Pro: "1 agente a la vez, modelos económicos (sonnet/haiku). Más lento, mínimo consumo. Para el plan Pro."
    - Potente: "Hasta 5 agentes en paralelo → avanza más rápido. Para Max 20x."
    - Profundo: "Mejores modelos en todos + revisión adversarial extra. Para un proyecto especial."
- The grid is 2 x 2 at 1280, three in a row at 768 (the fourth wraps), one column at 375. The selected card has the hue border, the tinted surface and `aria-pressed="true"`; the others are plain with a hairline.
- **Command box** under the cards (`CommandBox`, tinted by its container): the mono prompt and `/pandacorp:implement`, and the copy icon button "Copiar /pandacorp:implement". With Equilibrado it carries no mode argument (REQ-11-004).

### "Construir un objetivo concreto" card (`commands`)

- Title "Construir un objetivo concreto"; the line "Elige un FRD, una work order pendiente o un cambio de la cola para acotar el build."
- A select (`SelectField`, 40px, chevron) named "Objetivo del build" with the placeholder option "Elige un FRD o work order…", then one option per FRD ("FRD-01 · Data reading" and the rest), then the pending work orders, then the queued changes ("Cambio · Buscar ideas sin importar las tildes").
- Its command box shows `/pandacorp:implement <id>` until a target is chosen, with the copy button "Copiar /pandacorp:implement <id>" (AC-11-005.2).

## States

| State | What it shows | Captured state | Acceptance criteria |
|---|---|---|---|
| Default mode | Equilibrado selected (filled icon tile, hue border), the command box reads `/pandacorp:implement` with no argument, the scoped box shows the `<id>` placeholder. A project with no remembered mode opens here. | `commands` | REQ-11-001, REQ-11-003, REQ-11-004, AC-11-005.1 |
| Mode chosen (Potente) | The Potente card is selected (the previous selection returns to plain); its meter reads "Potencia 3 de 4"; the command box now reads `/pandacorp:implement powerful` and the copy button is named "Copiar /pandacorp:implement powerful". The choice is remembered for this project. | `commands-mode-powerful` | REQ-11-002, REQ-11-003, AC-11-005.1 |
| Scoped target chosen | A target is picked in the select (an FRD here): the scoped command box reads `/pandacorp:implement FRD-01` and its copy button is named "Copiar /pandacorp:implement FRD-01". The mode picker and its own command box are unchanged. | `commands-target-scoped` | AC-11-005.2 |

Rules that need no picture: choosing Equilibrado again drops the mode argument (no mode token is appended); a work order target produces the same box with the work order id; a queued change target produces the same box with `change:` and the change id (AC-11-005.2; the options of the select are drawn in `commands`). A mode read that fails falls back to Equilibrado, never a blank card. No loading state is designed: the mode and the targets arrive with the page.

## Components used

From `docs/design/components.md`; nothing new is introduced by this FRD.

| Part | Component |
|---|---|
| Card surfaces and titles | `Card`, `CardHeader`, `BadgeIcon` |
| The four mode cards | `BuildModeCard` (selectable card: icon, tag, 1 to 4 power meter, hint; `pressed`) |
| Command boxes | `CommandBox` (terminal icon, mono `code`, copy icon button "Copiar <comando>") |
| Target select | `SelectField` |
| Page frame above | `PageHead`/`Crumbs`, `ProjectHeroCompact`, `Tabs` (FRD-04) |

## Interaction & flow

- Entry: Portafolio → a project → Comandos (`/portfolio?project=<slug>&tab=Comandos`, FRD-25 URL contract).
- Pick a mode: the card becomes selected, the command box updates in place, the choice is stored per project in the browser and restored on the next visit.
- Copy: the copy button puts the command on the clipboard and shows the shared toast. **Mission Control never runs a command**: the card text says so ("Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta."), and there is no run or play control. The mode picker is real state the owner reads and copies, so it is not a demo control.
- Pick a target: the scoped box updates; clearing the select returns to the `<id>` placeholder.
- AC-11-005.3: the same mode picker is offered behind "Elegir modo de construcción" in the Construcción phase sheet of La Campaña; FRD-02 draws that sheet in its own captured states, so this FDD does not restate it.

## Responsive & accessibility

- Widths 375 / 768 / 1280, light and dark, as captured; the two-column layout collapses to one column below 1024px with the actionable cards first.
- The mode cards are a group of toggle buttons with `aria-pressed`; selection is shown by border, tint, filled icon AND the command box content, never colour alone; the meter has a text name ("Potencia N de 4").
- The command is real text in mono with tabular figures, wraps only at ":" and spaces; the copy buttons are 36px at 1280 and 44px target on touch layouts with an accessible name per command.
- Keyboard: Tab reaches each card and the select; Space or Enter selects; focus ring from the shared token; arrow keys are not required.
- Motion: the selection change moves no layout; no fading text.

## Copy

Interface strings are Spanish (`docs/design/microcopy.es.json`); command arguments (`pro`, `powerful`, `deep`) and artifact names stay as in the CLI. No em dash in product copy.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar): the component catalogue `docs/design/prototype/components.html`, measured styles `docs/design/prototype/reference/computed-styles.json`, icons `docs/design/prototype/icons/`, root `DESIGN.md`, `docs/design/components.md` (rows `BuildModeCard`, `CommandBox`, `Card`, `CardHeader`, `SelectField`, `Tabs`), `docs/design/freeze/m1-decisions.md` and `docs/design/freeze/reconciliation.md`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-11-build-modes/mocks/build-modes.html`; screenshots `docs/frds/frd-11-build-modes/mocks/screenshots/<id>-<width>-<theme>.jpg` (375, 768, 1280; light and dark).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=mission-control&tab=Comandos`.
- **Oracle states of this FRD** (`oracle-states.json`): `commands`, `commands-mode-powerful`, `commands-target-scoped`.
