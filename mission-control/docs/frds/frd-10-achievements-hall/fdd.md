---
id: FDD-10
type: fdd
slug: achievements-hall
title: Achievements Hall (Logros)
status: ACTIVE
parent: FRD-10
last_updated: '2026-10-22'
prototype_blessed_at: '0e6b7191'
---

# FDD — FRD-10 Achievements Hall (Logros)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This FDD describes the Logros surface of the approved Órbita prototype (`docs/design/prototype/index.html`, route `#logros`), frozen FROM that prototype on 2026-10-22. It uses the global design system (`DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md`) and defines no token or component of its own. Every screen and state below is a captured state of `docs/frds/frd-10-achievements-hall/mocks/achievements-hall.html`; the screenshots in `mocks/screenshots/` are the binding picture.
>
> **AC ids.** `AC-10-0NN.K` are the numbered criteria of the FRD. The FRD's unnumbered EARS lines are cited as `FRD-10#Uk`, k counted in file order (U1 rarity grade · U2 eight axes · U3 Sellos · U4 NUEVO badge · U5 sagas · U6 honesty · U7 five tabs · U8 Rangos ladder · U9 hero · U10 hero counts · U11 hero XP line · U12 chain card · U13 statistics panel · U14 metric level · U15 tiering chains · U16 per-tier date · U17 "Casi lo tienes" · U18 trophies by state · U19 secrets · U20 endowed progress · U21 fun names).

## Screens

One Logros page, five tabs. The page head, the guild hero and the tab bar are the same on every tab; only the body under the tabs changes. Title block: ONE `h1` "Logros" (equal to the nav label) with the subtitle "El progreso que ha construido tu gremio, con la evidencia detrás." above the hero (`PageHead`).

| Screen | Purpose | Captured state | Acceptance criteria |
|---|---|---|---|
| Resumen | The balanced overview: what is nearly reached, the next rank, the seals, the latest trophies, the shape of the guild. Two columns from 1024px, side-by-side cards end at the same height; one column on phones. | `achievements-summary` | `FRD-10#U3`, `FRD-10#U7`, `FRD-10#U9`, `FRD-10#U10`, `FRD-10#U11`, `FRD-10#U17`, AC-10-028.1 |
| Misiones | One card per cumulative chain, grouped by saga, with a spotlight on the chain closest to its next tier. | `achievements-missions` | `FRD-10#U5`, `FRD-10#U7`, `FRD-10#U12`, `FRD-10#U15`, `FRD-10#U17`, `FRD-10#U20`, `FRD-10#U21`, AC-10-028.2 |
| Trofeos | Conquered bar, Sellos, category filter chips, Conquistados, "Los más alcanzables", Por conquistar (paged), Secretos. | `achievements-trophies` | `FRD-10#U1`, `FRD-10#U2`, `FRD-10#U3`, `FRD-10#U7`, `FRD-10#U18`, `FRD-10#U19`, AC-10-028.3 |
| Estadísticas | The sober operator report: executive summary, character sheet (radar, six records, three ledgers), weekly charts, usage band, funnel and transitions, process health, next action. | `achievements-stats` | `FRD-10#U6`, `FRD-10#U7`, `FRD-10#U13`, `FRD-10#U14`, AC-10-020.1, AC-10-020.2, AC-10-020.3, AC-10-021.1, AC-10-021.2, AC-10-021.3, AC-10-022.1, AC-10-022.2, AC-10-023.1, AC-10-023.2, AC-10-023.3, AC-10-024.1, AC-10-024.2, AC-10-025.1, AC-10-026.1, AC-10-026.2, AC-10-027.1, AC-10-028.5 |
| Rangos | The 40-rank guild ladder in six eras, the current rank highlighted, far eras collapsed. The ladder data is FRD-09's rank table. | `achievements-ranks` | `FRD-10#U7`, `FRD-10#U8`, `FRD-10#U11`, AC-10-028.4 |

### Shared head, hero and tabs (visible in every state above)

- **Guild hero** (`GuildHero`, above all five tabs, AC-10-028.1 and `FRD-10#U9`): crest XL in a gold frame, the kicker "Gremio Pandacorp · nivel 22", the rank name "Portador de Luz III" as display title, the XP line "2410 XP · 25 para el nivel 23", a gold XP bar, and three counts at the right: "18/82" trofeos, "0/18" secretos, "11/78" niveles de misión (`FRD-10#U10`). On phones the counts drop under the title in one row.
- **Tab bar** (`Tabs`, `FRD-10#U7`): Resumen · Misiones · Trofeos · Estadísticas · Rangos, each with its 15px icon; ONLY Trofeos carries a count (the unlocked trophies, "18"); the selected tab has the text colour, a tinted icon and a bottom bar. On phones the bar scrolls sideways and the selected tab scrolls into view.

### Resumen (`achievements-summary`)

Left column, top to bottom:
- **"Casi lo tienes"** card (`CardHeader` + three rows): chain title and "176 / 200" at the right, a muted line "Work orders completados · La Construcción", a thin gold bar (the chains closest to their next tier, `FRD-10#U17`).
- **"Sellos del gremio"** card: nine rows (lock icon tile, seal name, "7/11", the axis, a bar): one per axis plus "Todos los sellos" (`FRD-10#U3`). Seals carry progress, never a bare lock.

Right column, top to bottom:
- **"Tu siguiente rango"** card: current emblem ("ahora · Nv 22") → next emblem ("desde Nv 25"), a gold bar named "XP hacia Guardián del Juramento I", then "Faltan 450 XP. Se gana XP construyendo: cada work order verificada, fase completada y lanzamiento suma." and the link "Ver el escalafón" (`FRD-10#U11`, AC-10-028.1).
- **"Trofeos recientes"** card: the last four trophies as a 2 x 2 grid of tiles (trophy icon tile, name, description, rarity chip, date chip with a check). One column on phones.
- **"Atributos del gremio"** card: the compact radar, one sentence naming the strongest attribute in bold ("ideación") and the attributes without data, and the link "Ver todas las estadísticas" (AC-10-028.1).

### Misiones (`achievements-missions`)

- Intro line: "Misiones acumulativas, agrupadas por saga: cada tier alcanzado deja huella verificable en el tiempo."
- **Spotlight** card (`MissionCard` spot variant): the chip "A un paso de subir", the tier name "Jefe de fábrica" as title, the rarity chip "Poco común", the chain name "Work orders completados" as subtitle, the percentage "84%" large at the right, the five-node ladder, the goal row ("El fordismo digital" · "176 / 200"), the bar, the footer "176 acumulado".
- **Sagas** (`SectionHeading`: icon, name, hairline, count): La Construcción "5 misiones", Las Ideas "4 misiones", El Oficio "4 misiones", El Gremio "3 misiones", El Tiempo "3 misiones" (`FRD-10#U5`). Cards are a 3-column grid at 1280, one column on phones; on phones the untouched missions are compact rows.
- **Every chain card has ONE layout** (`FRD-10#U12`): icon tile, tier name as title (chain name as subtitle), rarity chip or "Sin tier", node ladder, goal row (arrow, next tier name, value and threshold), the bar (hidden only for untouched phone cards, otherwise a `progressbar` named "Work orders completados: 84% hacia El fordismo digital"), and the uniform footer "N acumulado". A lower-is-better chain says so in its subtitle: "Récord idea→launch (días) · menos es mejor".
- **Order inside a saga** (AC-10-028.2): by closeness to the next tier; missions with zero progress ("Sin tier", 0 acumulado) come last and read muted. Worked example in the FRD: 80% then 30% then 0%.
- Endowed progress (`FRD-10#U20`): bars start at the real accumulated value ("84% hacia El fordismo digital"), never at zero; tier names scale in grandeur (`FRD-10#U21`: the title changes as the tier rises, from "El primer ladrillo" at Común to "Jefe de fábrica" at Poco común).

### Trofeos (`achievements-trophies`)

Top to bottom:
1. **Conquered bar**: trophy icon, "18 / 82 trofeos conquistados", "22%", a gold bar.
2. **Sellos** (`SectionHeading` with the count "0 de 9"): nine seal tiles in a 4-column grid (lock icon, name, "Descubrimiento · 7/11", a bar), ending with "Todos los sellos · 0/8" (`FRD-10#U3`, AC-10-028.3).
3. **Category filter chips** (`FilterChip`, group named "Categoría"): "Todos 82" and the eight axes with counts: Descubrimiento 11 · Velocidad 10 · Calidad 10 · Constancia 10 · Maestría 10 · Producción 14 · Gremio 9 · Resiliencia 8 (`FRD-10#U2`). Selected = neutral surface, never a hue; the chips carry no icon. They wrap to a second row at 1280.
4. **Conquistados** (count "18"): trophy tiles in a 3-column grid (gold tile, name, description, rarity chip, "6 oct. 2026 · PersonalPage v2"); a conquered trophy without a date line is drawn with no footer, never an invented date (`FRD-10#U18`).
5. **"Los más alcanzables"** (count "6 de 64"): the line "Los de rareza más baja, uno por categoría: los primeros que conviene perseguir.", then tinted tiles whose chip reads "Común · Descubrimiento" (rarity · category) (AC-10-028.3).
6. **Por conquistar** (count "58"): compact tiles (lock icon, name, condition, rarity chip), 4 per row at 1280, 12 shown first and up to 24 more per press; a full-width dashed `MoreBar` "Mostrar 24 más · quedan 46" ends the list (AC-10-028.3).
7. **Secretos** ("0 de 18"): silhouette tiles with "?" and the cryptic hint in italics ("Ves el vacío al otro lado.") (`FRD-10#U19`).

Rarity (`FRD-10#U1`): Común · Poco común · Raro · Épico · Leyenda, always a chip with a coloured dot AND the text; never colour alone. Category and rarity names are Spanish.

### Estadísticas (`achievements-stats`)

The tab is the sober operator report; section headings outside cards use `SectionHeading` (shared rule, DR-062): "Resumen ejecutivo" (with its note "El pulso de la fábrica"), then "En el tiempo, de verdad" ("¿Cómo voy semana a semana?"), "Cómo usas la fábrica" ("¿En qué me apoyo y a qué coste?"), "Embudo y flujo" ("¿Dónde se atascan las ideas y los proyectos?"), "Estado y salud del proceso" ("¿Qué proyectos hay y qué señales vigilar?"), "Qué mover ahora" ("La conclusión, con su comando"). Honest data only (DR-078, `FRD-10#U6`): a value without a wired source is never a zero.

1. **"El pulso de la fábrica"** card: a one-sentence verdict ("Fábrica en marcha: 1 lanzado(s) y 4 en construcción.") from a pure rule (AC-10-020.1), then four KPI tiles (AC-10-020.2, AC-10-020.3): "Work orders verificadas / semana" with "2 últ. sem" and "↗ 2 vs 2 la previa"; "Proyectos activos" "4 en curso"; "Conversión" "5 % idea→lanzado" with "1 lanzada de 22"; "Lead time" with the no-value marker "—", "idea→release" and "no cableado".
2. **Character sheet**: "Atributos del gremio" card (six-axis radar with labels Producción, Velocidad, Calidad, Constancia, Ideación, Alcance) beside a 2 x 3 grid of six record tiles (AC-10-027.1): "Productos lanzados" (chip "Nv 1", "tu marca del gremio"), "Racha récord", "Récord idea→launch", "Pico semanal" (76, "work orders en la mejor semana"), "Lecciones" (65, "capturadas en memoria"), "Subagentes"; a record without events reads "sin datos aún". Below, the explanatory line «Sin datos aún»: la fábrica todavía no registra ese tipo de evento (gates, reviews, días activos…). No es un cero medido.
3. **Three ledgers** (`LedgerCard`): Producción, Calidad, Ritmo y alcance, EIGHT rows each so the columns align (AC-10-026.1). A row is the label, an optional level chip "Nv N" with a band-coloured pip, and the value (`FRD-10#U13`, `FRD-10#U14`); the level keeps climbing, never capped at 5. Producción adds FRDs completados, Commits, Proyectos creados; Calidad adds Tests en verde and Decisiones (DR). The value is a real count, "sin datos aún" (an event never recorded) or "no cableado" (a scalar with no source); the two are never merged (AC-10-026.2, AC-10-028.5).
4. **"En el tiempo, de verdad"**: two cards of equal height: a column chart "Work orders verificadas por semana" (sem 25 … sem 39, values over the columns, the peak sentence "Pico de 76 en una semana; la última semana con datos cerró 2.", AC-10-021.1) and a line chart "Ideas capturadas por semana" (sem 24 … sem 42, "Las ideas llegan a ráfagas, no de forma continua.", AC-10-021.2). The chart has a text alternative naming every week. No raw-event view exists (AC-10-021.3).
5. **"Cómo usas la fábrica"**: two cards "Workflows y skills más usados" and "Esfuerzo de los agentes". Both are drawn in their honest empty form: "Sin eventos de uso en el registro todavía: este bloque se llena cuando las skills emiten su evento." and "Sin registro de esfuerzo por agente todavía." (AC-10-022.1 and AC-10-022.2 are Out of v2 for the populated lists, per the FRD marks).
6. **"Embudo y flujo"**: card "Embudo ideas → lanzado" (four horizontal bars: "22 capturadas", "10 vivas", "4 en pipeline", "1 lanzada", and the sentence "El cuello está en decidir y arrancar: pocas ideas entran al pipeline.", AC-10-023.1) and card "Transiciones de fase por proyecto" (a row per transition: date, project, "Construcción → Lanzamiento"; a backwards move reads "Lanzamiento ↺ Construcción" with the amber chip "Reapertura": text, icon and tone together, AC-10-023.2, AC-10-023.3). Ten at a time; the `MoreBar` reads "Mostrar 2 más · quedan 2" (AC-10-028.5). Two-line cards on phones.
7. **"Estado y salud del proceso"**: card "Proyectos por estado" (project name and a phase chip, AC-10-024.1) and card "Señales del proceso" (AC-10-024.2): "Lecciones destiladas 36 / 65", "Relanzamientos de build 0", "Descartes sin razón estructurada 7", "Telemetría de calidad" with "no cableado".
8. **"Qué mover ahora"**: one row with the action sentence ("Acompaña hasta el lanzamiento 4 construcción(es) en marcha") and the `CommandBox` `/pandacorp:release` with its copy button "Copiar /pandacorp:release" (AC-10-025.1). Mission Control never runs the command.

### Rangos (`achievements-ranks`)

- Intro: "El escalafón del gremio: tu nivel sube con XP y cada rango cubre un tramo de niveles. Cada nivel cuesta más que el anterior; la cima está lejos a propósito."
- **Era header** (`EraGroup`): name, hairline and level range: "El despertar" "Nv 1–12 · completa", "Los portadores" "Nv 13–24", "Los guardianes" "Nv 25–72"; with the caption below ("Los primeros pasos del gremio").
- **Rank row** (`RankRow`, emblem on the left, 56px): the grade badge I / II / III on the emblem, the Spanish name ("Buscador del Alba I"), the one-line flavour caption, the level band ("Nv 4–6"), and at the right the state marker with icon AND text plus the XP threshold ("60 XP"): "Conseguido" (check, green), "Estás aquí" (current), or a lock with "Nv 25" (ahead). Rows ahead use a secondary surface and grayscale sprites, with fully opaque text.
- **Current rank row** ("Portador de Luz III"): highlighted tint, the chip "Estás aquí", a gold progress bar and the line "Faltan 450 XP para Guardián del Juramento I" (`FRD-10#U11`).
- **Collapsed eras** (AC-10-028.4): every era more than one step beyond the current one is a single row with its name, "Nv 73–141 · 9 rangos" and a chevron; here Los campeones, Los ascendidos ("Nv 142–230 · 9 rangos") and La trascendencia ("Nv 231+ · 6 rangos"). A collapsed era opens in place and keeps the same rows.

## States

| State | What it shows | Captured state | Acceptance criteria |
|---|---|---|---|
| Category filter active | The "Velocidad" chip is selected (neutral). Conquistados reads "Ningún trofeo conquistado en esta categoría." in an empty box; "Los más alcanzables" shows "3 de 10" with the line "Los de rareza más baja: los primeros que conviene perseguir." and tiles "Común · Velocidad" / "Poco común · Velocidad"; Por conquistar lists only that axis ("7"). | `achievements-trophy-category` | `FRD-10#U2`, `FRD-10#U18`, AC-10-028.3 |
| Trophy detail dialog | A click on a locked or conquered trophy opens the shared native `Dialog` (width `min(680px, 100vw − 32px)`): kicker "Trofeo", title "El primer ladrillo", the close button "Cerrar", chips "Común", "Descubrimiento" and the green "Desbloqueado 6 oct. 2026", the description "Creaste tu primer proyecto." and the line "Proyecto: PersonalPage v2". Captured at 375 and 1280. | `achievements-trophy-dialog` | `FRD-10#U1`, `FRD-10#U18` |
| Unreadable usage stream | A coral `Notice` above the two usage cards: "No se pudo leer el registro de uso" with the path `~/.claude/dashboard-events.ndjson` and "la línea 214 no es JSON válido. Los dos bloques quedan sin datos hasta que se pueda leer; no es un cero medido."; both cards read "Sin datos: el registro no se pudo leer." The rest of the report is unchanged. Different from the calm empty text of the same cards. | `stats-stream-error` | AC-10-022.3, `FRD-10#U6` |
| Never-recorded counters | A record tile, ledger row or KPI whose event was never recorded reads "sin datos aún" (muted), with the explanatory line under the records; a scalar without a source reads "no cableado". | `achievements-stats` | AC-10-026.2, AC-10-028.5, AC-10-020.3, AC-10-027.1 |
| Empty usage bands | The two usage cards hold one sentence each and no list. | `achievements-stats` | AC-10-022.1, AC-10-022.2 |
| Paged lists | Por conquistar shows 12 and a `MoreBar`; phase transitions show 10 and a `MoreBar`. | `achievements-trophies` (Por conquistar), `achievements-stats` (transitions) | AC-10-028.3, AC-10-028.5 |
| Untouched missions | Zero-progress missions carry "Sin tier" and "0 acumulado", an empty bar, muted and last in their saga; compact rows on phones. | `achievements-missions` | AC-10-028.2, `FRD-10#U12` |
| Locked secrets | Silhouette tile "?" plus the cryptic hint; no condition shown (none unlocked in this capture). | `achievements-trophies` | `FRD-10#U19` |
| Current rank | The "Estás aquí" row with its bar and "Faltan 450 XP para Guardián del Juramento I". | `achievements-ranks` | `FRD-10#U11`, `FRD-10#U8` |
| Collapsed far eras | Three era rows closed, each with its range and rank count. | `achievements-ranks` | AC-10-028.4 |

No loading state is designed: the Logros read arrives with the page, so there is no skeleton (Next.js rule). An unrecognised shape of the events source fails loud as the `Notice` of the unreadable-stream state, never as an empty or zeroed band.

## Components used

All from `docs/design/components.md`; nothing new is introduced by this FRD.

| Screen or state | Components |
|---|---|
| Every tab | `PageHead`, `GuildHero`, `Tabs` (with a count on Trofeos only), `Icon`, `Card` and `CardHeader`, `SectionHeading` |
| `achievements-summary` | `Card` (two columns, equal height), `ProgressBar`, `NextRankCard`, `TrophyCard`, `SealTile`, `RadarChart` |
| `achievements-missions` | `MissionCard` (spot variant), `SectionHeading`, `ProgressBar`, rarity chip (`Chip`) |
| `achievements-trophies`, `achievements-trophy-category` | `SealTile`, `FilterChip`, `TrophyCard`, `SecretTile`, `MoreBar`, `EmptyState`, rarity chip |
| `achievements-trophy-dialog` | `Dialog`, `Chip` |
| `achievements-stats`, `stats-stream-error` | `StatKpi`, `RecordTile`, `LedgerCard`, `RadarChart`, `ColumnChart`, `LineChart`, `FunnelRow`, `TransitionRow`, `MoreBar`, `StateDot` or `Chip` for phases, `CommandBox`, `Notice` (error variant), `EmptyState` |
| `achievements-ranks` | `RankRow`, `EraGroup`, `ProgressBar`, `Chip` |

## Interaction & flow

- Entry: Logros in the sidebar (`#logros`, route `/achievements`). The selected tab, the category filter, the open trophy and the opened eras are in the URL (FRD-25), so reload and Back restore them.
- Resumen links onward: "Ver el escalafón" opens Rangos; "Ver todas las estadísticas" opens Estadísticas.
- Trofeos: choosing a category chip filters Conquistados, "Los más alcanzables" (three trophies when a category is active) and Por conquistar; a click on a trophy opens the dialog (native Escape and focus return); "Mostrar 24 más · quedan 46" appends the next batch of 12.
- Estadísticas: "Mostrar 2 más · quedan 2" reveals the next transitions; the command has a copy button only.
- Read-only: Logros writes nothing. Every figure derives from the factory's artifacts and the event stream.
- Out of v2 (FRD marks, owner decision 2026-10-21; not drawn, so not specified here): the NUEVO badge on a trophy, the estimated-rarity blurb, the date and project per unlocked chain tier, the chain-complete crown, the distinct revealed-secret treatment, the distinct summit treatment of the top rank, the TU PARTY roster and record badges in the hero, and the populated usage lists.

## Responsive & accessibility

- Widths 375 / 768 / 1280, light and dark, as captured. Hero counts wrap under the title on phones; Resumen, Misiones, Trofeos grids and the stats cards collapse to one column below 1024px; the ledgers stack; the tab bar scrolls with the selected tab brought into view.
- Meaning is never colour alone: rarity is a dot plus its name; rank state is icon plus "Conseguido" / "Estás aquí" / "Nv N"; a reopening is an icon plus "Reapertura"; locked tiles carry the lock icon and the text.
- One `h1` ("Logros"); the tab bar is a `tablist` with arrow keys; progress bars are `progressbar` with a name ("Work orders completados: 84% hacia El fordismo digital"); the radar has a text alternative (the sentence under it); the weekly chart names every week; all numbers use tabular figures.
- The command's copy button is named "Copiar /pandacorp:release"; targets are 44px on touch layouts; the dialog traps focus and closes on Escape.
- Motion: only transforms animate; the bar fills do not fade text; `prefers-reduced-motion` removes them.

## Copy

Interface strings are Spanish (the microcopy file is `docs/design/microcopy.es.json` once written); artifact names stay English (work orders, ADRs, PRDs). Trophy, mission and rank names come from the app data (`docs/achievements.md`). No em dash in product copy; the no-value marker in the KPI is the one "—" glyph the prototype draws, next to its "no cableado" label.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar): the component catalogue `docs/design/prototype/components.html`, measured styles `docs/design/prototype/reference/computed-styles.json`, icons and logo `docs/design/prototype/{icons,logo}/`, root `DESIGN.md`, `docs/design/components.md` (rows: `GuildHero`, `NextRankCard`, `MissionCard`, `TrophyCard` / `SecretTile` / `SealTile`, `RankRow` / `EraGroup`, `RadarChart` / `ColumnChart` / `LineChart`, `StatKpi` / `RecordTile` / `LedgerCard` / `TransitionRow`, plus the framing rows `PageHead`, `Tabs`, `SectionHeading`, `CardHeader`, `Chip`, `MoreBar`, `CommandBox`, `Dialog`, `Notice`), `docs/design/freeze/m1-decisions.md` and `docs/design/freeze/reconciliation.md`.

prototype_blessed_at: 0e6b7191

`logros-desktop` re-blessed 2026-10-30 in the wave 1 batch as a consistency baseline after the Órbita shell (WO-19-002) and primitives, judged against `docs/design/prototype/index.html#logros` and the prior baseline. Fidelity to the prototype is judged at the close-out oracle pass, not by this bless.

`logros-desktop` re-blessed 2026-10-31 in the wave 3-4 batch after WO-10-016 replaced the Resumen with the guild hero, the tabs below it and the two-column cards, viewed against its wave 1 predecessor and `docs/design/prototype/index.html#logros` at 1280: the same hero, tab row and six cards in the same order. Layer-B sign-off is the reviewer's for this batch; open cosmetic gaps are the seal tiles (the prototype uses flat rows) and the missing right-aligned counts in "Casi lo tienes". Fidelity is judged at the close-out oracle pass, not by this bless.

- **Mocks:** `docs/frds/frd-10-achievements-hall/mocks/achievements-hall.html`; screenshots `docs/frds/frd-10-achievements-hall/mocks/screenshots/<id>-<width>-<theme>.jpg` (375, 768, 1280; light and dark; the dialog at 375 and 1280).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#logros` (with `?tab=` as in the config).
- **Oracle states of this FRD** (`oracle-states.json`): `achievements-summary`, `achievements-missions`, `achievements-trophies`, `achievements-trophy-category`, `achievements-trophy-dialog`, `achievements-stats`, `stats-stream-error`, `achievements-ranks`.
- **Measured by styles, not pixels:** none in this FRD.

`logros-desktop` re-blessed 2026-10-31 in the wave 6 batch after WO-19-003 filled the sidebar (counts, Proyectos, guild card, Colapsar, theme button), viewed against its wave 4-5 predecessor and `docs/design/prototype/index.html#logros`. Reviewer sign-off: only the sidebar moved, the hero, tabs and Resumen cards are unchanged, no console error. The pending pill carries `data-volatile`, because it is live git data that streams in late, so the baseline omits it. It proves consistency only; the close-out oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

## Structural fidelity correction (2026-10-31)

The summary uses the gold-framed crest (96/80 px, 72/60 px on phones, with a 64 px emblem), right-aligned near-mission counters and flat seal rows. The trophy catalog retains seal tiles. Oracle: `prototype.css:400-401,524-525`; `prototype.js:1908-1909`.

Component tests and static checks are recorded in the decision log. Browser fidelity, themes and overflow still require the attended Claude reviewer; no visual baseline was edited.

## Re-bless (2026-10-31, independent review)

`logros-desktop, logros-mobile` re-blessed after the structural fidelity corrections, viewed against `docs/design/prototype/index.html` at 375 and 1280 in both themes. Reviewer Layer-B sign-off: only the corrected surfaces moved. The route baselines are consistency guards from `e2e/fixtures/factory-root`.
prototype_blessed_at: 0e6b7191

### Visual closure, 2026-10-31

The Trofeos catalogue follows the approved `#logros?tab=Trofeos` horizontal-card composition: three columns for conquered/nearest trophies, four for the paged locked catalogue, compact secret rows and an icon/percentage progress summary. The existing `TrophyCard` accepts `catalogue`, `near` and `recent` variants so the summary's recent trophy tiles preserve their vertical composition. Category filters, reveal batches, source counts and dialog behavior remain unchanged.

The summary's next-rank discs use the existing `--map-bg` token, 64px containers and 56px sprites. Radar geometry includes radial axes and six vertex markers in `--teal`; labels are capitalized and the statistics link includes an arrow. `GuildHero` keeps its existing public API and implementation for the shared Inicio consumer.

### Independent review corrections, 2026-10-31

`TrophyGrid` receives an explicit won/locked variant, so empty conquered sections retain their trophy icon. Nearest targets are capped at six (three inside a category); remaining locked trophies reuse the same rarity index for a stable ascending order. Locked buttons expose their title and localized locked state.

Catalogue text flexes to the available width. Evidence dates use inline icons and muted extra-small text. Earned slots are 42px; nearest/locked slots are 34px. Secret hints use a decorative violet question mark. Seal tiles show the axis before the count and use gold progress bars. The progress summary uses a 19px gold badge; rarity dots are 7px, derived from spacing tokens.

The summary radar occupies 230px on desktop, uses medium label text and a 4% visual floor while preserving zero in its accessible data. Rank discs shrink to 52px with 44px sprites on phones. Recent tiles use gold icons and omit the project line; the dialog keeps that evidence. Links use medium semibold text and radar prose uses the small muted style. Shared `GuildHero` remains unchanged.

Browser verification at 1280px and 375px confirmed no horizontal overflow, a 230px radar with approximately 9.82px effective labels, 64/52px rank discs, 56/44px sprites, and medium semibold rank links. At 375px the conquered-card text measures 255px, matching the prototype; slots measure 42/34px, rarity dots 7px and the summary badge 19px. Dialog dismissal, category changes and the empty conquered trophy icon were exercised. These checks do not re-bless the existing screenshot baselines.

### Integration accessibility and typography corrections (2026-10-31)

The summary radar stacks above its prose at every width and uses a 280px SVG (`calc(var(--s10) * 7)`), constrained by the available width. Its 14px SVG labels therefore render at approximately 12px instead of 9.82px. Accessibility takes precedence over the prototype's compact side-by-side radar. Summary columns use the prototype's flex stacks with a spacing-6 gap and a stretching final card on desktop; seal rows use spacing-2, matching the compact approximately 61px row rhythm. Below 1024px final cards return to intrinsic height. Seal counts and axes use small (13px), tertiary text.

Statistics prose uses proportional figures. Numeric table cells retain the shared `td` tabular-figure rule; the report container does not impose tabular figures on its prose. Shared guild-hero and dashboard progress prose also retain proportional figures.

### Integrated responsive repair (2026-10-31)

RadarChart declares its bounded SVG coordinate surface with the responsive helper exception.
End-anchored left labels have browser scrollWidth larger than their text-origin clientWidth,
but their painted bounds remain inside the SVG viewBox and viewport. No clipping, font-size
reduction or additional scrolling is introduced; the complete value-bearing accessible name remains.

## Visual closure, 2026-10-31

The item-35 pass restores the existing MissionCard spotlight, slot, connected nodes, gold bars and compact untouched phone layout. Only the spotlight shows a percentage. Rank era headings are flat dividers; medals use dark discs and neutral grade badges, with grayscale locked sprites and labelled achieved/current chips. Statistics restores themed heading icons, visible weekly counts/week labels, teal columns and violet area/point series. Historical fixture numbers remain illustrative; real source values and visible read errors are preserved. See the FRD's “Visual closure” section for the current presentation contract.

The independent review follow-up closes the shared funnel through an optional count-caption report variant of FunnelRow, removes the summary narrative from the Statistics radar card and moves record level chips to their headers. Weekly axis labels shorten the ISO week while aria-label retains the full year/week evidence. Production series length, transition counts and read-error totals still differ legitimately from the historical prototype.

The four legacy reviewer expectations are not the visual oracle: prototype.js lines 1967 and 1971 show a two-part goal row and generic value/threshold (also lower-is-better); prototype.css line 1016 uses gold fills; prototype.js line 2103 formats the first rank as 0 XP. The unused sentence-format mission goal/recordGoal and rank start catalogue entries are removed. Source-level FRD wording is reconciled in the same change.
