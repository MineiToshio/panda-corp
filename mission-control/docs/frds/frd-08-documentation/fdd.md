---
id: FDD-08
type: fdd
slug: documentation
title: Documentación (home, search and reader)
status: ACTIVE
parent: FRD-08
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/frds/frd-08-documentation/mocks/documentation.html
last_updated: '2026-10-22'
prototype_blessed_at: '0e6b7191'
---

# FDD — FRD-08 Documentación

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the Órbita design (round 5, iteration 28), frozen from the approved prototype. It describes only what the captured states of `mocks/documentation.html` draw (DR-130). The surface is called «Documentación» everywhere: sidebar, page `h1`, search labels, index label and the not-found page. «Manual» and «Códice» are not the surface name. The curated per-skill explainer, the interactive flow graph and its cross-navigation (REQ-08-008 to REQ-08-010, REQ-08-012) are out of v2 and not drawn.

Page frame, shared by every state: the shared `PageHead` with an eyebrow, the `h1` «Documentación» (equal to the nav label) and a one-line subtitle. Below it the home, the results or the reader. The reader's hue follows the page's group; the catalogs of Referencia live in Configuración (FRD-07), not here.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Documentación home | Where to start: the tutorial path, the everyday guides, and the four page types plus Referencia | `docs-home` | AC-08-020.1, REQ-08-001, REQ-08-003, REQ-08-007 |
| Search results | Matching pages from every group, each with a snippet | `docs-search` | AC-08-020.2 |
| Reader, concept page | A page with breadcrumbs, a position counter, previous and next, and the page index at the right | `docs-page` | AC-08-020.3, REQ-08-002, REQ-08-003 |
| Reader, index opened on a narrow screen | The page index folded behind a control and opened | `docs-page-index-open` | AC-08-020.3, REQ-08-002 |
| Reader, unknown page | The not-found page | `docs-page-not-found` | REQ-08-001 |
| Reader, tutorial page | A tutorial page with its step progress bar | `docs-page-tutorial` | AC-08-020.3, REQ-08-003 |
| Reader, guide page | A task-oriented page | `docs-page-guide` | AC-08-020.3, REQ-08-003 |
| Reader, «El equipo» concept | One card per agent, grouped by phase | `docs-page-team` | REQ-08-019 |
| Reader, multi-runtime concept | Codex and Claude Code, both with full access | `docs-page-multi-runtime` | REQ-08-014, REQ-08-015, REQ-08-016 |

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Home at rest | Search «Buscar en toda la Documentación» with the placeholder «Buscar en 38 páginas…». Card «Empieza aquí»: «Si es tu primera vez, el tutorial te lleva de cero a tu primer proyecto en 2 pasos.», then the numbered path 1 «Qué es Pandacorp» and 2 «Cómo empezar», then «Después, entiende lo esencial» with the links «El pipeline», «El equipo», «Los gates humanos» and «Estado y archivos». Card «Guías para el día a día» with six guide links, the count «11 guías» and «Ver todas». Block «Explorar por tipo»: «Tutorial» («2 páginas»), «Guías» («11 páginas»), «Conceptos» («22 páginas»), «Workflows» («3 páginas») and «Referencia» («Comandos, agentes, reglas y estándares.», with «En Configuración» instead of a page count). | `docs-home` | AC-08-020.1, REQ-08-003, REQ-08-007 |
| Search with results | The term is typed in the search. A card «Resultados» with its count lists each matching page: its title, a snippet that opens and closes with an ellipsis around the match, and a chip with its group («Guías», «Conceptos» or «Workflows»). | `docs-search` | AC-08-020.2 |
| Reader at rest, concept page | Breadcrumbs «Documentación», «Conceptos», the page name, with the counter «2 de 22». The page title «El pipeline · de idea a producto» and its body. At the foot, the previous and next cards: «Anterior en Conceptos» («Qué es Pandacorp») and «Siguiente en Conceptos» («El equipo»). At the right, the index «Índice de la Documentación» with its own search «Buscar en la Documentación…» and the groups «Tutorial», «Guías», «Conceptos», «Workflows» and «Referencia», each with its count and its pages; the current page is highlighted. | `docs-page` | AC-08-020.3, REQ-08-002, REQ-08-003 |
| Index folded on a narrow screen | Below 900 px the index is not at the right. A control labelled «Índice · El pipeline» (the group's page name follows the dot) opens it above the page; it holds the same search and groups as the wide index. | `docs-page-index-open` | AC-08-020.3, REQ-08-002 |
| Unknown page | The title «Esta página no existe», the line «La Documentación no tiene una página «no-existe».» and a link «Ir al inicio de la Documentación». No index and no reader. | `docs-page-not-found` | REQ-08-001 |
| Tutorial page | Breadcrumbs «Documentación», «Tutorial», «Cómo empezar», with «Paso 2 de 2» and a two-segment progress bar. The page «Tu primera misión» shows its checklist and numbered step cards 1 to 5, each with a command in a monospace box, then a «Lo que acabas de ver:» note and «A continuación». Previous and next read «Anterior en Tutorial» and «Siguiente en Tutorial». | `docs-page-tutorial` | AC-08-020.3, REQ-08-003 |
| Guide page | Breadcrumbs «Documentación», «Guías», «Elegir modo de construcción», with the counter «4 de 11». The page is a numbered list of options, each with its command. Previous and next read «Anterior en Guías» and «Siguiente en Guías». | `docs-page-guide` | AC-08-020.3, REQ-08-003 |
| «El equipo» concept | Title «El equipo de agentes». A roster of avatars grouped by phase («Producto», «Diseño y contenido», «Arquitectura e infra», «Construcción y datos», «Calidad», «Memoria y motor»), each with the agent's name and role. Below, «Quién hace qué» with one bio card per agent in the same phase groups, including «drift-finder», then «Cómo se orquesta el equipo». | `docs-page-team` | REQ-08-019, AC-08-020.3 |
| Multi-runtime concept | Title «Operar desde cualquier agente». The diagram «Dos puertas, un núcleo» with «Puerta Claude Code» and «Puerta Codex» (each labelled with its access) over the shared core. The statement «Codex y Claude Code: acceso completo.» and the note «Permiso no significa automatización certificada.». The section «Cómo probar que funciona» with three numbered steps. | `docs-page-multi-runtime` | REQ-08-014, REQ-08-015, REQ-08-016 |

Behaviour with no picture (content and data rules, not layout): the pages cover what Pandacorp is, the flow, the stages, the commands, the build modes, the standards and handing off (REQ-08-004, REQ-08-005); the pages reflect the current v2 engine and the feature-centric document layout (REQ-08-013, REQ-08-017); a page with a bespoke renderer takes its content only from that renderer and its `.md` is an index stub (REQ-08-018, a test); the catalogs behind Referencia are read from the factory and never hand-copied (REQ-08-006); every agent shipped in `plugin/agents/` has a bio card (REQ-08-019, a test). The full `SKILL.md` as markdown behind «Definición completa» is FRD-07's dialog (REQ-08-011).

## Components used

From `docs/design/components.md`. Nothing new is introduced by this FRD.

| On screen | Component | Notes |
|---|---|---|
| Title block | `PageHead` | eyebrow, one `h1` equal to the nav label, subtitle |
| Home | `DocsGroupCard` / `DocsSteps` | «Empieza aquí» numbered path, «Guías para el día a día», «Explorar por tipo»; the two cards end at the same height |
| Search fields | `SearchField` | one width; the index search sits in the index |
| Search results | `Card` with `CardHeader`, `ListRow`, `Chip` | group chip per hit |
| Breadcrumbs | `Crumbs` | last item is the current page |
| Page index | `DocIndex` / `DocItem` | at the right from 900 px, folded behind the «Índice · …» control below |
| Reader body | `Markdown` | in the group's hue; steps, callouts and command boxes follow the shared `CommandBox` |
| Previous and next | `Button` link variant as two cards | label «Anterior en <grupo>» / «Siguiente en <grupo>» |
| Agent roster and bio cards | `Avatar` (sprite) and `Card` | one per agent, grouped by phase |
| Not-found | `EmptyState` | title, sentence and one link |

## Interaction & flow

- Entry: «Documentación» in the primary nav (short label «Docs» on the rail and the bottom navigation) opens the home (`docs-home`).
- Searching the home lists results across all groups (`docs-search`); choosing a hit opens that page in the reader.
- Choosing a link on the home or in the index opens the page in the reader (`docs-page`). The page, the opened index state and the search live in the URL (FRD-25), so reload and Back restore them.
- Inside the reader, previous and next move through the page order; the breadcrumb returns to the home or to the group (`docs-page`, `docs-page-guide`).
- On tutorial pages the progress bar and the label «Paso 2 de 2» show where the reader is in the tutorial (`docs-page-tutorial`).
- The Referencia entries («Comandos», «Agentes», «Reglas de decisión», «Estándares») lead to Configuración (FRD-07): one catalog, one set of cards (`docs-home`, `docs-page`).
- A page address that does not exist shows the not-found page, never a blank screen (`docs-page-not-found`).
- Read-only: every command is shown to copy, never run.

## Responsive & accessibility

- At 1280 the reader and the index sit side by side, the index at the right with its own search; the home is two cards of equal height over the «Explorar por tipo» block (four tiles in a row, then «Referencia»). Below 900 px the index folds behind the «Índice · …» control and opens above the page (`docs-page-index-open` at 375 and 768); the two home cards stack to one column below 1024 px.
- Wide tables and code in the reader scroll sideways inside their own box, never the page.
- The index control is a `button` with the page name in its label; the opened index is reachable by keyboard and closes back to its control. The current page in the index is marked with `aria-current="page"` and a highlight, not colour alone.
- The agent avatars carry the accessible name «Avatar de agente <nombre>». The progress bar carries the text «Paso 2 de 2 del tutorial».
- Only transforms animate; no motion is needed to read the page.

## Copy

Interface strings are the Spanish ones in the states above and in `docs/design/microcopy.es.json`. The page bodies are authored content in Spanish; artifact names stay English (FRD, work order, spec, ADR). The surface name is «Documentación»; the search labels and placeholders say «Documentación».

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate): the component catalogue (`docs/design/prototype/components.html`), measured styles (`docs/design/prototype/reference/computed-styles.json`), the exported icons and logo (`docs/design/prototype/{icons,logo}/`), the copy file and the whole-app prototype for states and motion.

prototype_blessed_at: 0e6b7191

`documentacion-desktop` re-blessed 2026-10-30 in the wave 1 batch as a consistency baseline after the Órbita shell (WO-19-002) and primitives, judged against `docs/design/prototype/index.html#documentacion` and the prior baseline. Fidelity to the prototype is judged at the close-out oracle pass, not by this bless.

`documentacion-desktop` re-blessed 2026-10-30 in the wave 2-3 batch after WO-08-003 replaced the reader home with the search, cards and "Explorar por tipo", viewed against its wave 1 predecessor and `docs/design/prototype/index.html#documentacion`. Reviewer sign-off: recognizably the Órbita surface, no console error, no structural gap. This is a consistency baseline; fidelity is judged at the close-out oracle pass.

- **Mock:** `docs/frds/frd-08-documentation/mocks/documentation.html` (sections `docs-home`, `docs-search`, `docs-page`, `docs-page-index-open`, `docs-page-not-found`, `docs-page-tutorial`, `docs-page-guide`, `docs-page-team`, `docs-page-multi-runtime`).
- **Mock screenshots** in `mocks/screenshots/`: `<id>-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark (the index-open state at 375 and 768).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#documentacion` (pages by `?page=<slug>`).
- **Oracle entries** (`docs/design/freeze/fidelity.config.json`, `states["frd-08-documentation"]`): the nine ids above.
- **Reference files:** root `DESIGN.md` (responsive thresholds, shared component rules), `docs/design/design-tokens.json`, `docs/design/freeze/m1-decisions.md`, `docs/design/freeze/reconciliation.md`, `docs/design/prototype/prototype.css`.
- **components.md rows:** `PageHead`, `Crumbs`, `DocsGroupCard` / `DocsSteps`, `DocIndex` / `DocItem`, `SearchField` / `SelectField`, `Markdown`, `CommandBox`, `Avatar`, `EmptyState` / `Notice`.

`documentacion-desktop` re-blessed 2026-10-31 in the wave 6 batch after WO-19-003 filled the sidebar (counts, Proyectos, guild card, Colapsar, theme button), viewed against its wave 4-5 predecessor and `docs/design/prototype/index.html#documentacion`. Reviewer sign-off: only the sidebar moved, the home cards are unchanged, no console error. The pending pill carries `data-volatile`, because it is live git data that streams in late, so the baseline omits it. It proves consistency only; the close-out oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

`documentacion-mobile` first blessed 2026-10-31 at the FRD-13 recheck, viewed at 390 against `docs/design/prototype/index.html#documentacion`. Reviewer sign-off: search, Empieza aquí, Guías and Explorar por tipo are present, no console error; the bottom bar mid-image is a full-page capture effect. Consistency only; the next oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

## Baseline provenance (Visual QA, 2026-10-31)

Oracle: `docs/design/prototype/index.html` (route shards of `reference/oracle-states.json`), captured at 375 and 1280, light and dark, against `pnpm dev:oracle`. Layer-B sign-off: reviewer viewed the re-blessed baselines; they are consistency guards rendered from `e2e/fixtures/factory-root`, not pixel matches of the oracle (L3 still open, see `.pandacorp/comms/visual-punch-list.md`).
prototype_blessed_at: 0e6b7191


## Visual close-out clarification (2026-10-31, lane O)

Explore cards include the tinted icon tile, small description and bold small count. The guides footer uses the teal arrow action. Reader groups use chevrons and colored item icons, with the same shared DocIndex as project documents.

Authored Manual headings use plain typography without the legacy violet accent bar. The first
heading uses the reader-title scale; pipeline phases stack label, prose and command on phones
so the copyable command keeps the available paper width.


## Independent review corrections (2026-10-31, lane O)

Phone reader breadcrumbs show the linked group and position counter on one line, with the full trail retained on desktop. The guides footer uses muted small live counts and a semibold teal action. All shared index headings and links have a 40px minimum target height.
