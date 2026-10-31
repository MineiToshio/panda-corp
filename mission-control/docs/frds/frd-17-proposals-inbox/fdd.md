---
id: FDD-17
type: fdd
slug: proposals-inbox
title: Propuestas (to-do, memory and signals)
status: ACTIVE
parent: FRD-17
last_updated: '2026-10-22'
prototype_blessed_at: '0e6b7191'
---

# FDD — FRD-17 Propuestas

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Feature design on the frozen Órbita contract (`docs/design/design-tokens.json` + root `DESIGN.md`). It uses the global tokens and components; it defines none. Frozen FROM the approved prototype `docs/design/prototype/index.html` (Órbita, round 5, iteration 28), shard `mocks/proposals-inbox.html`.

"Propuestas" is a sidebar destination (FRD-19) and the owner's to-do for the factory itself: what needs a decision, in order, with the exact command and where to run it. The page has three tabs, Resumen (default), Memoria and Backlog; this FDD covers Resumen and Memoria and the lesson dialog. The Backlog tab is FRD-22's (its captured state is `backlog` in that FRD). The page title block is the shared `PageHead`: the eyebrow "Captura de la fábrica · 20 oct. 2026, 7:20 p. m." (prototype capture stamp, not product copy), the `h1` "Propuestas" (equal to the nav label) and the subtitle "Lo que la fábrica aprendió construyendo y lo que hay que arreglar en ella misma. Aquí ves qué te toca y qué comando correr." The tab strip is the shared `Tabs`: "Resumen", "Memoria" with the count pill 16 and "Backlog" with 11, each with its icon, the selected one with the underline.

Mission Control only shows. It never harvests, promotes, prunes or runs a skill; every action is a command to copy and run in Claude Code.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Propuestas · Resumen | The ordered to-do of what needs the owner, two summary cards and the automatic signals. Route `#propuestas`. | `proposals-summary` | AC-17-011.1, AC-17-011.2, AC-17-011.3, AC-17-001.2 |
| Propuestas · Memoria | How a lesson advances, the lessons that wait for the owner, and the candidates. Route `#propuestas?tab=Memoria`. | `proposals-memory` | AC-17-011.4, AC-17-001.1, AC-17-001.2, AC-17-001.3, AC-17-010.1, AC-17-010.2, AC-17-010.3, AC-17-010.4 |
| Lesson detail dialog | The formatted detail of one lesson with its promotion command. Opened from a lesson row in Memoria. | `proposals-lesson-dialog` | AC-17-006.7 and the lesson-detail rule |

**Resumen** (`proposals-summary`), top to bottom:

- **"Qué te toca, en orden"** card: header with the target icon tile, the title, the sentence "4 cosas necesitan tu decisión. Copia el comando, pégalo en Claude Code y vuelve." and the pill "4 para ti". It holds an ordered list of only the actions that need the owner. Each action is a tinted block with its number, a kind label with icon, a bold title, the reason in plain words, a `CommandBox` with copy, where to run it, and a link button at the right:
  1. **Urgente** (coral, alert icon): "2 problemas urgentes en la fábrica", the P0 reason, `/pandacorp:implement-backlog BL-0001`, "Córrelo en la carpeta de la fábrica", link "Ver el backlog".
  2. **Decidir** (green, rocket icon): "16 lecciones esperan tu sí o no", `/pandacorp:learn LESSON-0001`, the hint "Córrelo en la carpeta de la fábrica · cambia el número por la lección que elijas", link "Ver las lecciones".
  3. **Importante** (amber, list icon): "4 arreglos importantes en cola", `/pandacorp:implement-backlog BL-0004`, hint "Córrelo en la carpeta de la fábrica · el primero de la lista", link "Ver los P1".
  4. **Ideas** (blue, bulb icon): "5 ideas descubiertas esperan decisión", `/pandacorp:recommend`, link "Ver el tablero".
  - Below the list, a calm strip with a check icon: "La memoria se revisa sola." and "La rutina diaria cosechó y revisó por última vez el 20 oct. 2026. No necesitas hacer nada." Memory upkeep reads this way while the daily routine is current.
- Two cards side by side, ending at the same height: **"Memoria de la fábrica"** ("Lo que aprendió construyendo tus proyectos.", the figures "Reglas activas" 12, "Esperan tu decisión" 16, "Candidatas" 24 with "se corroboran solas", link "Ver cómo avanza una lección") and **"Backlog de la fábrica"** ("Fallos y mejoras de la propia fábrica (motor, plantillas, skills), no de tus proyectos.", the figures "Urgentes · P0" 2, "Importantes · P1" 4, "Cuando haya tiempo · P2" 3, "1 ítem ya está en curso.", link "Ver el backlog por tema").
- **"Señales automáticas"** card with the count pill 42 and the sentence "Avisos que la fábrica genera sola. Ya están incluidos arriba cuando piden algo de ti." Signals are grouped by kind into four expander rows, each with an icon, title and count pill, collapsed in the capture: "Columnas del tablero con muchas ideas" (2), "Lecciones vistas en 2 proyectos" (12), "Skills sin uso registrado" (27) and "Otras" (1). A row opens to its explanation and its items (for example the 12 lessons each with its own `/pandacorp:learn LESSON-NNNN` and copy). The unused-skills row, which flags 27 of 27 skills, opens with the marker "Señal poco fiable:" and says it only reads the last 200 usage entries and asks for no action (AC-17-011.3).
- The Propuestas sidebar item carries the count 4, the owner's actions, not the 42 + 16 + 24 items behind them (AC-17-011.2). Its accessible name is "4 cosas esperan tu decisión".

**Memoria** (`proposals-memory`), top to bottom:

- **"Cómo avanza una lección"** card: "Cada build deja notas; la fábrica las convierte en lecciones y, cuando una se confirma en varios proyectos, te pide decidir si se vuelve regla para todos." Four tiles joined by arrows say who moves each step: 65 "Notas sin refinar" ("de los proyectos") → "rutina diaria" → 24 "Candidatas" ("esperan confirmarse") → "2+ proyectos" → 16 "Esperan tu decisión" ("sí o no") → "tú decides" → 12 "Reglas activas" ("para todos los proyectos"). Under them: "Última revisión automática: 20 oct. 2026 · al día. Ninguna lección obsoleta." (AC-17-011.4). There is no prune list in v2; the prune group is out of v2 by owner decision.
- **"Esperan tu decisión"** card (pill 16, first of the lesson groups): "Abre una, lee qué propone y, si te convence, copia su comando. `/pandacorp:learn` la convierte en estándar, regla o skill; si no, la dejas como está." Lesson rows are buttons: tinted icon tile, the lesson's title (its `context`, in its source language, English), "LESSON-0001 · javascript · funko-tracker, pandasaga", and a type chip at the right ("Trampa" pink, "Patrón" blue, "Problema→solución" violet). A second block under the uppercase label "Recién detectadas en 2 proyectos" lists lessons with the green chip "Nueva" and each one's own command, for example `/pandacorp:learn LESSON-0001`, with a copy button. Per-item commands differ (the lesson id), so each row shows its own (AC-17-001.2).
- **"Candidatas"** card (pill 24): a collapsed expander with the right-hand text "No piden nada" and a chevron. Opened, it says "Se confirman solas cuando vuelven a aparecer en otro proyecto." and lists lesson rows (type chips include "Antipatrón") with no command, then the full-width dashed bar "Mostrar 14 más · quedan 14" (AC-17-010.1, AC-17-010.4). Candidates defer to the daily routine, so no row carries a command (AC-17-001.1: a command shared by a whole group would appear once under the group title; the candidates group has none).

**Lesson dialog** (`proposals-lesson-dialog`, a native `dialog`, captured at 375 and 1280): a tinted head with the uppercase kicker "Lección · Trampa", the title "LESSON-0001" and a close button "Cerrar". The body: chips "Trampa", "javascript", "Promoción: propuesta" and "Corroborada"; the lesson's context as a bold sentence; the retrieval trigger in a blue box with a target icon ("use this when returning a constant array of objects from a module"); the sectioned body with bold labels "Situation:", "Lesson:" and "Apply next time:" (source language); the line "Aplicada en: funko-tracker, pandasaga"; and "Promoverla a estándar, regla o skill:" with the `CommandBox` `/pandacorp:learn LESSON-0001` and copy.

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Resumen with the owner's four actions | As described: ordered blocks, calm "La memoria se revisa sola." strip, signals collapsed. | `proposals-summary` | AC-17-011.1, AC-17-011.2, AC-17-011.3 |
| Unreliable signal | The unused-skills row carries "Señal poco fiable:" because it flags 27 of 27 skills. | `proposals-summary` | AC-17-011.3 |
| Memoria at rest | Flow card, "Esperan tu decisión" open with its rows, "Candidatas" collapsed under "No piden nada". | `proposals-memory` | AC-17-011.4, AC-17-001.3 |
| Candidatas opened, long list | Rows plus the dashed bar "Mostrar 14 más · quedan 14"; activating it adds the next page in place. | `proposals-memory` | AC-17-010.1, AC-17-010.2, AC-17-010.4 |
| Lesson dialog open | Pink-tinted head for a Trampa, body and command as above, page dimmed and blurred behind. | `proposals-lesson-dialog` | AC-17-006.7 |

Behaviour with no separate picture:

- A short list shows no bar and every card renders (AC-17-010.3). The bar adds the next page in place, with no fetch and no way to collapse back (AC-17-010.2).
- The page order of the lesson groups is "Esperan tu decisión", then the collapsed "Candidatas" (AC-17-001.3, AC-17-011.4).
- Self-suggestions (the automatic signals) are computed locally from files and events already read, with no Claude call. They have no markdown body, so they are not clickable.
- High-risk proposals are only displayed; approval is the owner running the skill (DR-047).
- Out of v2 by owner decision 2026-10-21, nothing to build: the dismiss affordance and remembered dismissal, the per-stream explainers, the prune list, the harvest-orphans banner, the staleness nudge on the memory panel, the portfolio-rail chip, the "Crónica del gremio" alias, and lesson rejection.

## Components used

From `docs/design/components.md`: `PageHead`, `Tabs`, `Card` and `CardHeader` (tinted icon tile, one-size title, same-hue count pill), `CommandBox` (and the compact form in list rows), `Chip` family and `CountPill`, lesson type chips (Trampa pink, Memoria teal family), `MoreBar` ("Mostrar más", full-width dashed bar, the one shared component of memory, backlog, rules, trophies and transitions), `Dialog` (native `dialog`, tinted sticky head with the kicker, display title, close, body) with the sectioned markdown body, `Notice`, the sidebar `NavItem` count (FRD-19). The Resumen action blocks and the flow tiles are Propuestas-specific compositions of those primitives; register them in the inventory if they repeat elsewhere.

## Interaction & flow

1. The owner opens Propuestas and lands on Resumen. They read the four blocks top to bottom, copy the command of the first one, run it in the factory folder and come back.
2. "Ver las lecciones" and the other link buttons move to the matching tab or screen (Memoria, Backlog, Tablero); tab and filter state live in the URL (FRD-25).
3. In Memoria they open a lesson (a real `<button>`, accessible name naming the lesson), read the formatted detail, copy `/pandacorp:learn LESSON-NNNN` from the dialog or from the row, and run it in the factory folder. Escape or the close button returns focus to the row.
4. Opening "Candidatas" shows candidates that confirm themselves when they reappear in another project; nothing is asked of the owner.

## Responsive & accessibility

- Captured at 375, 768 and 1280, light and dark; the dialog at 375 and 1280, viewport capture. At 768 the two summary cards are already stacked, one per row; at 375 the four flow tiles stack vertically and the arrows point down with their captions ("rutina diaria", "2+ proyectos", "tú decides"); commands wrap only at ":" and spaces.
- Every action block states its kind by label and icon, not colour alone; counts are text. The lesson rows are buttons with an accessible name; the dialog moves focus in, traps Tab, closes on Escape and returns focus to its opener.
- Lesson titles and bodies keep their source language (English) inside the Spanish interface.

## Copy

Interface strings are the prototype's, Spanish; lesson ids, commands and file names stay literal. Keyed strings are in `docs/design/microcopy.es.json`. No streaks, no false urgency, no nagging (White-Hat, FRD-09).

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar). Component catalogue `docs/design/prototype/components.html`; measured styles `docs/design/prototype/reference/computed-styles.json`; icons `docs/design/prototype/icons/`; copy `docs/design/microcopy.es.json`; whole-app prototype `docs/design/prototype/index.html`.

prototype_blessed_at: 0e6b7191

`propuestas-desktop` re-blessed 2026-10-30 in the wave 1 batch as a consistency baseline after the Órbita shell (WO-19-002) and primitives, judged against `docs/design/prototype/index.html#propuestas` and the prior baseline. Fidelity to the prototype is judged at the close-out oracle pass, not by this bless.

`propuestas-desktop` re-blessed 2026-10-30 in the wave 2-3 batch after WO-17-008 added the Resumen tab and new header copy (the panels carry `data-volatile`, so this baseline covers the chrome only), viewed against its wave 1 predecessor and `docs/design/prototype/index.html#propuestas`. Reviewer sign-off: recognizably the Órbita surface, no console error, no structural gap. This is a consistency baseline; fidelity is judged at the close-out oracle pass.

- **Mocks:** `docs/frds/frd-17-proposals-inbox/mocks/proposals-inbox.html` (sections `proposals-summary`, `proposals-memory`, `proposals-lesson-dialog`); screenshots in `mocks/screenshots/` as `<id>-<width>-<theme>.jpg` at 375, 768 and 1280 (the dialog at 375 and 1280), light and dark.
- **Binding comparison URLs:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#propuestas`, `…#propuestas?tab=Memoria`, and the dialog after clicking the first `[data-lesson]` on Memoria.
- **Oracle entries (`fidelity.config.json`, `frd-17-proposals-inbox`):** `proposals-summary`, `proposals-memory`, `proposals-lesson-dialog`.
- **Reference files:** `docs/design/freeze/packs/frd-17.md`, `docs/design/freeze/reconciliation.md` (C-17), `docs/design/freeze/m1-decisions.md`, root `DESIGN.md`.
- **components.md rows:** `PageHead`, `Tabs`, `Card`/`CardHeader`, `CommandBox`, `Chip` family, `MoreBar`, `Dialog`, `NavItem`, `AppShell`.

`propuestas-desktop` re-blessed 2026-10-31 in the wave 6 batch after WO-19-003 filled the sidebar (counts, Proyectos, guild card, Colapsar, theme button), viewed against its wave 4-5 predecessor and `docs/design/prototype/index.html#propuestas`. Reviewer sign-off: only the sidebar moved, the header and tabs are unchanged; the panels stay `data-volatile`, no console error. The pending pill carries `data-volatile`, because it is live git data that streams in late, so the baseline omits it. It proves consistency only; the close-out oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

`propuestas-mobile` first blessed 2026-10-31 at the FRD-13 recheck, viewed at 390 against its desktop baseline and `docs/design/prototype/index.html#propuestas`. Reviewer sign-off: title, intro and tabs are present. The panel is empty in the shot because it carries `data-volatile`, as on desktop, so this baseline asserts chrome only. Consistency only; the next oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

## Baseline provenance (Visual QA, 2026-10-31)

Oracle: `docs/design/prototype/index.html` (route shards of `reference/oracle-states.json`), captured at 375 and 1280, light and dark, against `pnpm dev:oracle`. Layer-B sign-off: reviewer viewed the re-blessed baselines; they are consistency guards rendered from `e2e/fixtures/factory-root`, not pixel matches of the oracle (L3 still open, see `.pandacorp/comms/visual-punch-list.md`).
prototype_blessed_at: 0e6b7191
