---
id: FDD-21
type: fdd
slug: pending-merge
title: FDD-21 — Pending-merge visibility (feature design)
status: ACTIVE
parent: FRD-21
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-21 Pending-merge visibility

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Two surfaces on the frozen Órbita system (`DESIGN.md`, `docs/design/design-tokens.json`): the sidebar pill that is visible from every screen, and the Inicio card "Árboles de trabajo" with its per-repository dialog. Both are read-only: nothing merges, deletes or runs from here. The captured states are the binding visual spec (DR-054).

## Screens

| Screen | Purpose | Captured state | ACs |
|---|---|---|---|
| Inicio card "Árboles de trabajo" | One table of every repository with work outside `main` or leftover worktrees, the state of each by the legend rule, and the cleanup command | `worktrees-card` | AC-21-007.1, AC-21-007.3, REQ-21-005 |
| Branch dialog of one repository | The branches of one repository (Funko Tracker): last commit, origin, age, commits outside `main`, uncommitted changes, branch name, plus the cleanup command for that folder | `worktrees-branch-dialog` | AC-21-007.2, AC-21-007.3, REQ-21-005 |
| Sidebar pending pill on another screen | The global indicator, beside the plugin pill, visible while the owner is on any screen (captured on Tablero) | `shell-pending-chip` | AC-21-008.1, AC-21-008.2, REQ-21-001, REQ-21-002 |
| Pill activated | The pill opens Inicio with the card scrolled to the top of the page | `shell-pending-chip-open` | AC-21-008.1, REQ-21-003 |
| Card with a repository that could not be read | The unreadable repository is named, distinct from "Limpio", and the pill says so | `worktrees-unreadable` | REQ-21-006, AC-21-008.2 |

### The card (`worktrees-card`)

Route `#inicio`. The card is the last card of the right column of Inicio's two-column grid (FRD-18 owns the grid; this FRD owns the card).

- Card header: tinted icon tile and the title "Árboles de trabajo" (no count pill).
- Intro, small muted: "Trabajo en paralelo que no está en `main`, y worktrees que sobraron."
- Skill line: the small text "Para depurar un proyecto, corre en su carpeta" followed by the compact command `/pandacorp:worktrees` with its copy icon button "Copiar /pandacorp:worktrees". It is a normal command, with no "proposed" label (AC-21-007.3).
- The table, inside a horizontally scrollable region named "Tabla desplazable", columns **Proyecto**, **Sin integrar** (tooltip "Ramas con trabajo que no está en main"), **Sobrantes** (tooltip "Worktrees abiertos sin nada pendiente") and **Estado**. The first cell of each row is a link-style button with the repository name (it opens the dialog); the numbers are tabular. Rows as captured: Funko Tracker 12 · 1, Fábrica 4 · 1 and PersonalPage v2 1 · 1, each with the coral state "Depurar ya" (a coral dot plus the words); PandaSaga and PandaCast show a dash in both number columns, the green state "Limpio", and a disabled name button (nothing to open).
- Under the table, the hint "Desliza la tabla para ver todas las columnas".
- A closed disclosure "¿Cómo se decide el estado?" holding the legend of the rule (AC-21-007.1): "Depurar ya" is 3 or more leftovers or unmerged branches, or any branch untouched for more than 7 days; "Revisar pronto" is any branch older than a day or any leftover; "Al día" is only recent work; "Limpio" is nothing pending or left over; it ends with the capture time.

### The dialog (`worktrees-branch-dialog`)

Route `#inicio` with the dialog open, captured at the viewport at 375 and 1280. A native dialog with the teal head: kicker "Árboles de trabajo", title "Árboles de trabajo · Funko Tracker", close button "Cerrar". Body:

- a summary line "12 ramas sin integrar y 1 worktree sobrante.";
- one row per branch (the `.ask-row` pattern): the last-commit subject in bold (two lines at most), a meta line with origin, age and commits outside `main` ("Rama manual · hace 8 h · 12 commits fuera de main", "1 commit fuera de main" in the singular, and "2 sin guardar" appended when the branch has uncommitted changes), and the branch name in mono small faint text underneath;
- at the end, the line "Corre en la carpeta de Funko Tracker para depurarlo:" with the command box `/pandacorp:worktrees` and its copy button "Copiar /pandacorp:worktrees".

### The pill (`shell-pending-chip`, `shell-pending-chip-open`)

- In the sidebar, directly under the coral plugin pill (FRD-15's plugin pill, FRD-19's shell) and above the nav, a second pill of the same family: coral tone, alert triangle icon, the label "17 pendientes · depurar ya" (count of branches with work outside `main` across every repository, then the alert words). Its title reads "17 ramas sin integrar en main. Abre «Árboles de trabajo» en Inicio." and the same sentence is repeated for screen readers after the label.
- Captured at 768 and 1280 on Tablero. At 375 the sidebar is the drawer, drawn by FRD-19's `shell-drawer-open`.
- Activating it goes to Inicio and puts the card "Árboles de trabajo" at the top of the viewport (`shell-pending-chip-open`, captured at 768 and 1280).

## States

| State | What the owner sees | Captured state | ACs |
|---|---|---|---|
| Work pending, repositories at "Depurar ya" and "Limpio" | The table rows above, the pill in its alert variant | `worktrees-card` | AC-21-007.1, AC-21-008.2 |
| Nothing to open | A repository with a dash in both counts keeps a disabled name button and the state "Limpio" | `worktrees-card` | AC-21-007.1 |
| Branch list open | The dialog above, one row per branch | `worktrees-branch-dialog` | AC-21-007.2 |
| Pill in alert variant | Alert icon, count and "· depurar ya", coral, text plus icon | `shell-pending-chip` | AC-21-008.1, AC-21-008.2, REQ-21-002 |
| Pill activated | Inicio with the card at the top of the page, the pill still visible in the sidebar | `shell-pending-chip-open` | REQ-21-003 |
| A repository could not be read | In the table, PandaSaga shows dashes, a coral chip "No se pudo leer" in Estado (not "Limpio"), and its name button is disabled; under the table a coral notice with `role="alert"` reads "PandaSaga:" followed by the reason ("no se pudo leer su estado de git (git worktree list terminó con error). No cuenta como «Al día» ni como «Limpio»."); the other rows are unchanged | `worktrees-unreadable` | REQ-21-006 |
| Pill with an unreadable repository | The same coral pill reads "17 pendientes · sin leer"; its title adds "1 repositorio no se pudo leer" | `worktrees-unreadable` | AC-21-008.2, REQ-21-006 |

Behaviour with no picture of its own (rules about what is NOT drawn, or about data): when nothing is pending and every repository was read, the pill is not rendered (AC-21-008.1, REQ-21-001), so a build asserts its absence rather than a look; the count is capped at `9+` per the FRD's edge case; a stale snapshot shows the FRD-12 freshness note instead of a confident "al día" (data rule in the FRD, not a drawn element); the derivation of states and of the pill count is the FRD's rule (AC-21-007.1), computed once and read by both surfaces (DR-115).

## Components used

From `docs/design/components.md`:

| Component | Use in this feature |
|---|---|
| `PendingPill` | The sidebar pill: alert variant (coral, alert icon, count and "· depurar ya" or "· sin leer"); mirrors `PluginPill` and shares its family styling; hidden at zero |
| `WorktreesTable` | The card's table and its rule for the state of each row |
| `Card` / `CardHeader` | The card surface and its header (icon tile plus title) |
| `Table` | Base table styling (uppercase small heads, hairline rows) inside a scrollable region |
| `StateDot` | "Depurar ya" and "Limpio": a dot plus the word, never colour alone |
| `Chip` family | The coral "No se pudo leer" chip |
| `EmptyState` / `Notice` | The coral unreadable-repository notice (`role="alert"`) |
| `CommandBox` / `CommandCompact` | `/pandacorp:worktrees` in the card (compact, in the skill line) and in the dialog |
| `Dialog` | The branch dialog (teal head, kicker, display title, close) |
| `AskRow` pattern | The branch rows of the dialog (title, meta line, mono branch name) |
| `AppShell` / `Sidebar` | Where the pill mounts (FRD-19); no new shell element |

No new component. `PendingPill` and `WorktreesTable` are already registered; the legend disclosure is the card's native `details`, not a component.

## Interaction & flow

1. From any screen the owner sees the pill. Pressing it goes to Inicio, closes the phone drawer if it was open, and scrolls the card to the top.
2. In the card, pressing a repository name (only for rows that have something to show) opens the branch dialog; Escape or "Cerrar" closes it and focus returns to that name button.
3. The owner copies `/pandacorp:worktrees` (from the card or the dialog) and runs it in that project's folder, outside Mission Control. The surface never merges, deletes or runs anything (REQ-21-005).
4. "¿Cómo se decide el estado?" opens and closes the rule text in place.

## Responsive & accessibility

- Widths: the card is captured at 375, 768 and 1280, the dialog at 375 and 1280, the pill at 768 and 1280 (the phone drawer is FRD-19's).
- The table lives in a scrollable region named "Tabla desplazable"; when its columns do not fit (the narrow right column on desktop), the hint line says so. The disabled name buttons are announced as disabled.
- State is conveyed by words plus a dot or an icon, never colour alone; the pill carries an alert icon and its words, with the full sentence for screen readers.
- Dialog: native `dialog`, focus moves in and returns to the trigger, Escape closes, branch subjects are clamped to two lines.

## Copy

Keyed Spanish strings: `docs/design/microcopy.es.json`; reconciliation notes in `docs/design/freeze/copy/frd-21.md`. Artifact and branch names keep their source language (commit subjects, branch names); everything Mission Control writes is Spanish.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar, its *How to verify* the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-21-pending-merge/mocks/pending-merge.html` (states `worktrees-card`, `worktrees-branch-dialog`, `shell-pending-chip`, `shell-pending-chip-open`, `worktrees-unreadable`).
- **Mock screenshots:** `docs/frds/frd-21-pending-merge/mocks/screenshots/<id>-<width>-<theme>.jpg` (24 files).
- **Binding comparison URLs:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#inicio` for the card and dialog, `...#tablero` for the pill. The unreadable state applies the fixture scenario `worktrees-unreadable`.
- **Oracle table:** `docs/design/prototype/reference/oracle-states.json`, the five entries of `frd-21-pending-merge`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/components.html`, root `DESIGN.md`, `docs/design/design-tokens.json`. Styles to match: `.wt-table`, `.skill-line`, `.state-dot`, `.legend`, `p.tbl-hint`, `.plugin-pill`, `.pending-pill` in `docs/design/prototype/prototype.css`.
- **components.md rows:** `PendingPill`, `PluginPill`, `WorktreesTable`, `Card`, `Table`, `StateDot`, `Chip`, `EmptyState` / `Notice`, `CommandBox`, `Dialog`, `AskRow`, `Sidebar`.

## Visual close-out (2026-10-31)

The worktree table keeps sentence-case headers with normal tracking, including on narrow screens. Its state column never wraps or clips state words; horizontal scrolling remains explicitly labelled and keyboard reachable.

## Independent review corrections (2026-10-31)

The worktree cell padding selector includes the table element so it wins against the shared Table headers and cells, keeping the prototype 9 px by 6 px spacing. Small horizontal overflow is local to the labelled scroll region, never page overflow.
