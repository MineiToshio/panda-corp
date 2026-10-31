---
id: FDD-18
type: fdd
slug: dashboard
title: Inicio (the command center)
status: ACTIVE
parent: FRD-18
last_updated: '2026-10-22'
prototype_blessed_at: ''
---

# FDD — FRD-18 Inicio (the command center)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Feature design on the frozen Órbita contract (`docs/design/design-tokens.json` + root `DESIGN.md`). It uses the global tokens and components; it defines none. Frozen FROM the approved prototype `docs/design/prototype/index.html` (Órbita, round 5, iteration 28), shard `mocks/dashboard.html`.

Inicio is the default landing screen of Mission Control: what needs the owner now, what the factory is already doing, and the state of every project. It is read-only: every actionable item shows the exact `/pandacorp:*` command with a copy button, and a project card navigates to the project. It renders inside the persistent shell (FRD-19). The page title block is the shared `PageHead`: the eyebrow "Captura de proyectos · 20 oct. 2026, 7:20 p. m." (prototype capture stamp, not product copy), the `h1` "Inicio" (equal to the nav label) and the subtitle "Tu centro de mando: primero lo que necesita tu acción; después lo que avanza y el estado de tus proyectos."

Below the title block, in order: the plugin banner when the plugin is behind (FRD-15, `AlertBanner`, `role="alert"`, first content element), then a two-column composition. Left column: Tu turno, Tu cartera, En marcha. Right column: Pulso, Gremio, Embudo de ideas, Árboles de trabajo. Below 1024 px it is one column with Tu turno first (AC-18-022.1).

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Inicio | The command center: the owner's queue, the project portfolio, in-flight work, the pulse, the guild and the worktrees table. Route `#inicio`. | `home` | REQ-18-001, REQ-18-002, REQ-18-010, REQ-18-011, REQ-18-012, REQ-18-013, REQ-18-016, REQ-18-021, AC-18-022.1, AC-18-022.2, AC-18-022.3, AC-18-022.4 |
| Tu turno detail dialog | The explanation of one queue item, opened from its "Detalles" button. | `home-turn-dialog` | AC-18-022.2 |

Blocks of `home`, in reading order:

- **Tu turno** (count pill 5, same hue as its icon tile). One line per item, decisions first, then changes ready to build (REQ-18-010, REQ-18-012): a flag icon for a decision or a branch icon for a change, the title, the line "project · kind · age" ("PersonalPage v2 · Decisión · hace 41 días"; "Mission Control · Cambio listo · pedido el 18 oct. 2026"), the scoped command in a compact `CommandBox` with copy (`/pandacorp:decide 2026-09-10-1`, `/pandacorp:implement change:board-search-diacritics`), and a "Detalles" button at the right (accessible name "Detalles: <title>"). A decision already answered in its own file is not listed and not counted. Routine progress (a running build, an auto-retried work order) is not here (REQ-18-011); it lives in En marcha.
- **Tu cartera**: a section heading outside any card (folder icon, "Tu cartera", a hairline) with the link "Ver portafolio" at the right, then one project card per project (REQ-18-016). A card is a link to the project and carries: the initials avatar in the phase hue, the name, the phase chip ("Construcción", "Arquitectura", "Lanzamiento"), the progress ring with its percentage (accessible name "39 de 48 work orders verificadas"), the six-segment phase stepper (accessible name "Fase: Construcción", each step "Investigación: completada" / "Construcción: fase actual" / "Lanzamiento: pendiente"), the line "Etapa 5 de 6 del pipeline · último cambio hace 1 h", the counts "39/48 WO verificadas", "8 FRDs", "82 docs", the status chip when it applies, and the closing line "Siguiente · /pandacorp:implement" (the next command comes from the phase: implement for a building project, review-launch for the launched one, REQ-18-021). A project with no work orders yet shows the neutral chip "Sin WOs".
- **En marcha** (count pill 29): "Trabajo que ya está en manos de la fábrica. No espera una decisión tuya; avanza cuando corre el build." Three collapsible groups, each with its title, a one-line explanation and a count pill: "Construyéndose ahora" (18), "Esperan la revisión de su FRD" (9) and "Borradores en la cola" (2) (AC-18-022.3). Closed at rest.
- **Pulso** (right column): three tiles with display numbers, 5 "Proyectos", 53 "FRDs" and 167 "de 218 WO verificadas" (AC-18-022.4, at most five signals).
- **Gremio**: the rank crest and name "Portador de Luz III", "Nivel 22 · 2410 XP", the gold bar, "25 XP para el nivel 23 · 18 trofeos", a link row "Último logro · 6 oct. 2026" with its title "El primer ladrillo" and the link "Ver logros". Derived from real outcomes (FRD-09); no streaks, no urgency.
- **Embudo de ideas**: one row per phase (Investigación, Producto, Diseño, Arquitectura, Construcción, Lanzamiento) with a bar and its count, then "12 descartadas" counted apart and the link "Abrir tablero" (AC-18-022.4). The Lanzamiento count comes from the one launched-ideas resolver, the same one the Logros funnel uses (REQ-18-014).
- **Árboles de trabajo** (FRD-21's content, hosted here): "Trabajo en paralelo que no está en main, y worktrees que sobraron." and "Para depurar un proyecto, corre en su carpeta" with `/pandacorp:worktrees` and copy. A horizontally scrollable table region ("Tabla desplazable") with the columns "Proyecto", "Sin integrar", "Sobrantes" and "Estado"; the project names are buttons; the state reads "Depurar ya" (coral dot) or "Limpio" (green dot), and the hint "Desliza la tabla para ver todas las columnas" appears under it. The expander "¿Cómo se decide el estado?" explains the four states.

The **dialog** (`home-turn-dialog`, a native `dialog`, tinted head): the uppercase kicker "Decisión · PersonalPage v2", the item's title, a close button "Cerrar"; the body opens with "Decisión pendiente en PersonalPage v2: un agente encontró algo que no debe decidir solo (alcance, dinero o algo irreversible) y ese punto espera tu respuesta.", then two chips ("hace 41 días" and the decision id), the labelled sections "Lo que se necesita de ti" and "Recomendación del agente", the collapsed expander "Contexto", the sentence saying what the command does ("Corre en la carpeta de PersonalPage v2. Te muestra la pregunta, las opciones y la recomendación, primero te pregunta si sigue vigente, y guarda tu respuesta.") and the `CommandBox` with `/pandacorp:decide 2026-09-10-1` and copy.

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Busy factory (default) | All blocks as above: plugin banner, six Tu turno items, five project cards, En marcha closed. | `home` | REQ-18-001, REQ-18-010, REQ-18-016, AC-18-022.1 |
| Decision story dialog open | Page dimmed and blurred; dialog as above. | `home-turn-dialog` | AC-18-022.2 |
| En marcha group opened | The first group, "Construyéndose ahora", open: each change is a block with an icon tile, the kicker "En construcción", its title, "Funko Tracker · cambio en curso" and the button "Ver cambio". The other groups use "Work order en revisión" blocks with the link "Abrir work order" and "Borradores" blocks ("5 cambios en borrador", link "Revisar"). | `home-in-flight-open` | AC-18-022.3 |
| Nothing waits on the owner | Tu turno shows the green "Al día" badge (check icon) beside its title and, inside, a dashed box with a check icon and "Nada espera tu acción ahora mismo." The rest of the page is unchanged; En marcha holds the ready changes that are now building. Calm, no manufactured urgency. | `home-calm` | REQ-18-003, REQ-18-012 |
| Empty factory (no projects, no ideas) | Tu turno as in the calm state; Tu cartera holds the first-action card instead of project cards: the icon tile, "Tu fábrica todavía no tiene proyectos", "Un proyecto nace de una idea. Captura una o pide a la fábrica que busque oportunidades; cuando una idea te convenza, su spec crea el proyecto.", then "Captura tu primera idea, en la carpeta de la fábrica:" with `/pandacorp:new-idea` and "Cuando la idea esté lista, conviértela en proyecto:" with `/pandacorp:spec <idea>`, each with copy. Pulso shows 0, 0 and "de 0 WO verificadas"; Embudo de ideas shows zeros and "0 descartadas"; the sidebar's Proyectos group counts 0. Never a blank. | `factory-empty` | Tu cartera first-action rule |
| Build claims to run but has no signal | The project card's status chip reads "Sin señal · último evento hace 25 min" instead of "Construyendo": the absence of signal is itself the alarm, and a live build keeps the "Construyendo" chip (the same voice as FRD-06 and the Resumen of FRD-14). The rest of Inicio is unchanged. | `build-no-signal` | REQ-18-015, REQ-18-017 |

Behaviour with no separate picture:

- The dashboard updates live from the events stream and the project `status.yaml` files, with no reload; the surfaces affected are the queue, the pulse and the project cards (REQ-18-004). Nothing is faked when there is no event stream yet.
- Many waiting items: the queue stays decisions-first and never truncates silently.
- Out of v2 by owner decision 2026-10-21, nothing to build: the "Desde tu última visita" digest and its seen marker (REQ-18-005 to REQ-18-009), the version and the age-in-stage on the card, the stalled flag, the bugs chip, the inline blocker reason, and the "estable · en operación" presentation of a launched project.

## Components used

From `docs/design/components.md`: `PageHead`, `AlertBanner` (FRD-15), `Card` and `CardHeader` (tinted icon tile, one-size title, same-hue count pill), `AskRow` (a Tu turno line) with the compact `CommandBox`, `Dialog`, `ProjectCard` (with `PhaseStepper` compact and the progress ring), `Chip` family (status chip, "Al día" badge, count pills), `EmptyState`/`Notice` (the "Nada espera tu acción ahora mismo." box and the first-action card), the collapsible in-flight groups (`.flight-group`, native `details`), `KpiTiles` (Pulso), `FunnelRow` (Embudo), `WorktreesTable`, the Gremio card (FRD-09 data), and `AppShell` (FRD-19). Nothing new beyond rows the inventory already lists.

## Interaction & flow

1. The owner opens the app and lands on Inicio. If the plugin is behind, the banner is the first thing they read (FRD-15).
2. In Tu turno they copy the command of an item or press "Detalles" to read what it is, what is needed, the agent's recommendation and the context, then run the command in the folder the dialog names. Escape or "Cerrar" closes the dialog and returns focus to its button.
3. Tu cartera cards open the project; "Ver portafolio", "Ver logros" and "Abrir tablero" go to their screens; "Ver cambio", "Abrir work order" and "Revisar" open the change, the work order or the drafts list.
4. The owner opens a En marcha group to see work already in the factory's hands; none of it asks for a decision.

## Responsive & accessibility

- Captured at 375, 768 and 1280, light and dark (the dialog as a viewport capture). At 1280 the two columns sit side by side; at 768 and 375 it is one column, Tu turno first, then Tu cartera, En marcha, Pulso, Gremio, Embudo de ideas and Árboles de trabajo; at 768 the project cards go two per row (see `mocks/screenshots/home-375-light.jpg` for the phone).
- The `h1` is "Inicio" and each block heading is an `h2`. Status is carried by icon and text (flag and branch icons, "Al día" with a check, state labels with a dot and a word), not colour alone. The worktrees table sits in a labelled scroll region ("Tabla desplazable") with the hint under it.
- The dialog moves focus in, traps Tab, closes on Escape and restores focus to "Detalles".

## Copy

Interface strings are the prototype's, Spanish; commands, ids and work-order titles stay literal, and work-order and FRD titles keep their source language (English). Keyed strings are in `docs/design/microcopy.es.json`.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar). Component catalogue `docs/design/prototype/components.html`; measured styles `docs/design/prototype/reference/computed-styles.json`; icons and logo `docs/design/prototype/{icons,logo}/`; copy `docs/design/microcopy.es.json`; whole-app prototype `docs/design/prototype/index.html`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-18-dashboard/mocks/dashboard.html` (sections `home`, `home-turn-dialog`, `home-in-flight-open`, `home-calm`, `factory-empty`, `build-no-signal`); screenshots in `mocks/screenshots/` as `<id>-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#inicio`; the scenarios `home-calm`, `factory-empty` and `build-no-signal` after `applyScenario('<name>')`; the dialog after clicking `[data-turn="0"]`; the open group after clicking `.flight-group > summary`.
- **Oracle entries (`fidelity.config.json`, `frd-18-dashboard`):** `home`, `home-turn-dialog`, `home-in-flight-open`, `home-calm`, `factory-empty`, `build-no-signal`.
- **Reference files:** `docs/design/freeze/packs/frd-18.md`, `docs/design/freeze/reconciliation.md` (C-18), `docs/design/freeze/m1-decisions.md`, root `DESIGN.md`.
- **components.md rows:** `PageHead`, `AlertBanner`, `Card`/`CardHeader`, `AskRow`, `CommandBox`, `Dialog`, `ProjectCard`, `PhaseStepper`, `Chip` family, `EmptyState`/`Notice`, `KpiTiles`, `FunnelRow`, `WorktreesTable`, `AppShell`.

## Visual close-out (2026-10-31)

Owner-turn metadata joins only present fields with middle dots, so an absent date has no dangling separator. Header icons follow the approved prototype: target (Tu turno), gauge (Pulso), trophy (Gremio), kanban (Embudo). The guild rank name uses body-size bold display text, not a section-heading size. CamelCase project names use capital initials (PandaSaga = PS).
