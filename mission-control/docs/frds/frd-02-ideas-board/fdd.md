---
id: FDD-02
type: fdd
slug: ideas-board
title: FDD-02 — Ideas board (feature design)
status: ACTIVE
parent: FRD-02
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-10-22'
prototype_blessed_at: '0e6b7191'
---

# FDD — FRD-02 Ideas board

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Frozen FROM the approved Órbita prototype (round 5, iteration 28). This FDD specifies only what the captured states of this FRD draw (DR-130). It uses the global design system (`DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md`) and redefines none of it.

Three surfaces make up this feature: the **Tablero** (the board of ideas by phase), the **idea page** (header, tabs Propuesta, Spec, Arquitectura, Documentos, Campaña) and the **data-model viewer** inside the Arquitectura tab. The board's H1 is "Tablero" (equal to the nav label); the idea page is a drill-in with the idea's own title as H1 and a "Volver al tablero" link. The Spec and Arquitectura digests are the same components the project workspace reuses (FRD-04 `project-spec`, `project-architecture`). La Fragua, which "Entrar a La Fragua" leads to, is FRD-06.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Tablero | Header with "Descartadas · 12" and the primary "Capturar ideas", the search "Buscar por nombre o contenido…", category chips ("Todas 10", "ai 2", "automation 1", "claude-code 1", "web 6"), the switch "Ocultar columnas vacías", one phase chip per phase with its count, and the columns "1 Investigación" to "6 Lanzamiento" of equal width. Cards show title, favourite star, category chip, return chip, "Score 74" with a bar, and for projects "0/35 WO" plus "Construyendo" or "Proyecto creado". An empty column reads "Sin ideas en esta fase". | `board` | FRD-02#U1, REQ-02-002, REQ-02-005, REQ-02-006, REQ-02-014, AC-02-012.3, AC-02-016.2 |
| Capturar ideas (dialog) | Kicker "Ideas", title "Capturar ideas", the sentence "Copia el comando según lo que quieras hacer y pégalo en Claude Code." and four rows, each with its copy button: "Explorar una idea difusa conversando" `/pandacorp:explore`, "Capturar una idea que ya tienes clara" `/pandacorp:new-idea`, "Que la fábrica busque oportunidades" `/pandacorp:discover`, "Pedir una recomendación de cartera" `/pandacorp:recommend`. | `board-capture-dialog` | REQ-02-003 |
| Descartadas (dialog) | Title "Ideas descartadas · 12": one row per idea with title, category, the words "leer propuesta y restaurar" and, when recorded, "Motivo: …". | `board-discarded-dialog` | FRD-02#U4 |
| Idea, Propuesta tab | The idea header (title, category, return, "Score 72/100", "Etapa: Arquitectura"; "Volver al tablero", the favourite star, "Abrir en Portafolio", "Descartar idea"), the tab bar, then the memo-pitch: "De un vistazo · el sueño", "Profundizar · el criterio", "El tablero de decisión" with the "Scorecard founder-fit" and "Esfuerzo vs. valor" cards. | `idea-pitch` | FRD-02#U2, AC-02-009.1, AC-02-009.2, AC-02-009.5, AC-02-012.3, AC-02-016.5 |
| Idea, Spec tab | The Spec digest: hero, bands "PRD · qué y por qué", "Research · la evidencia" and "FRDs · las piezas del v1 (7)" with one card per FRD (code, kind tag, title, summary, planned work orders). | `idea-spec` | AC-02-009.2, AC-02-011.1, AC-02-011.2, AC-02-011.3, AC-02-015.14, AC-02-016.7 |
| Idea, Arquitectura tab | The architecture digest: "Stack y tecnologías", "Integraciones y operación", "Modelo de datos", "Variables de entorno", "Decisiones", "Plan de implementación". | `idea-architecture` | AC-02-009.2, AC-02-013.1, AC-02-013.2, AC-02-013.3, AC-02-013.4, AC-02-013.5, AC-02-015.14, AC-02-016.7, AC-02-016.8 |
| Idea, Documentos tab | The tab shows its count ("Documentos 82"). A document reader holds "Tarjeta de la idea" (the card's pitch) and, on the right, the rail "Documentos": "Resumen", "PRD", "Investigación", then per FRD "Contrato (frd.md)" and "Implementación (blueprint.md)". | `idea-documents` | FRD-02#U2, AC-02-009.2, AC-02-009.3 |
| Idea, Campaña tab | "El viaje de esta idea por las 6 fases", the strip "3/6 entregadas", six rooms on a dark map (done, current and locked, with the hand-off artifact on the corridor: "research.md", "PRD + FRDs", "sistema + mocks", "blueprint + Build Plan", "el código"), and below the sheet of the current phase. | `idea-campaign` | FRD-02#U2, AC-02-010.1, AC-02-010.2, AC-02-010.3, AC-02-010.4, AC-02-010.6, AC-02-016.6 |
| Campaña, Arquitectura sheet | Kicker "Fase 4 de 6", the title with the chip "en curso", previous and next arrows, then "Descripción", "Entra y sale" ("Lee" to "Escribe"), "Equipo · 1 especialista", "Qué puedes correr" with "Siguiente paso · avanza a Construcción" and "Otras opciones de esta fase". | `idea-campaign-phase` | AC-02-010.4, AC-02-010.8, AC-02-010.9, AC-02-016.6 |
| Campaña, research sheet | The research sheet of an idea still under investigation: `/pandacorp:spec market-stall-ledger`, the disclosure "Cuántas preguntas te hago antes de generar la documentación" with the three modes `--ask`, `--auto`, `--infer`, and under "Otras opciones de esta fase" the command `/pandacorp:explore market-stall-ledger`. | `idea-campaign-research` | AC-02-010.2, AC-02-010.4, AC-02-010.9, AC-02-010.10 |
| Campaña, Diseño sheet | The sheet of a delivered phase: "Diseño entregado", a team of two ("Designer", "Copywriter"), next step `/pandacorp:architecture`, other option `/pandacorp:design`. | `idea-campaign-design` | AC-02-010.4, AC-02-010.7, AC-02-010.8 |
| Campaña, Construcción sheet | "Construcción en curso" with the four-specialist team, the next step `/pandacorp:release`, the link "Entrar a La Fragua", the disclosure "Elegir modo de construcción" with the four mode cards (FRD-11 owns their behaviour), and the other options `/pandacorp:implement`, `/pandacorp:bug`, `/pandacorp:change`. | `idea-campaign-build` | AC-02-010.2, AC-02-010.4, AC-02-010.5, AC-02-010.8, AC-02-010.9 |
| Campaña, locked Lanzamiento sheet | "Lanzamiento en espera": full description, "Lee" and "Escribe", the DevOps team member and the commands `/pandacorp:iterate`, `/pandacorp:review-launch`, `/pandacorp:new-version`, `/pandacorp:sync`; no "Entrar a La Fragua". | `idea-campaign-release` | AC-02-010.4, AC-02-010.7 |
| Data model, Diagrama | In Arquitectura, "Modelo de datos": the line "Modelo diseñado, no verificado contra una base viva", "26 entidades · 36 relaciones · docs/product/data-model.json", a search "Buscar entidad o atributo…", the view switch Diagrama / Esquema, the toolbar (Alejar, "100%", Acercar, Ajustar a la vista, Restablecer, Pantalla completa), entity cards with PK/FK/UQ badges, the hint "Selecciona una entidad para resaltar sus relaciones; vuelve a pulsarla para limpiar la selección." and the folded "Relaciones 36". | `model-diagram` | AC-02-015.1, AC-02-015.3, AC-02-015.6, AC-02-015.8, AC-02-015.9, AC-02-015.14 |
| Data model, Esquema | The same band with Esquema selected: one collapsed accordion per entity ("User 4 atributos") holding Prisma-like text. | `model-schema` | AC-02-015.1, AC-02-015.4 |

## States

| State | What the user sees | Oracle state | ACs |
|---|---|---|---|
| Board, empty columns hidden | The switch "Ocultar columnas vacías" is on; the columns Producto and Diseño and their phase chips are gone; the rest keep their width. | `board-hide-empty` | AC-02-016.3 |
| Board, search | The search holds "panda"; the cards narrow to matches in every phase, the line "5 ideas coinciden" and the button "Limpiar" appear, and a column without matches reads "Sin coincidencias". | `board-search` | AC-02-016.1, AC-02-016.4 |
| Board, category filter | The chip "web" is selected (neutral, not a hue); "6 ideas coinciden" and "Limpiar" show. | `board-category-filter` | REQ-02-005, AC-02-016.4 |
| Board, favourite | The star of the first card is pressed: a filled gold star, with its label "Quitar de favoritas: …"; the card keeps its column. | `board-favorite` | AC-02-012.1, AC-02-012.2, AC-02-012.3 |
| Board, phase jump | Activating the chip "Arquitectura" scrolls that column into view. | `board-phase-jump` | AC-02-016.2, REQ-02-002 |
| Spec FRD card dialog | Kicker "FRD-01 · Spec", the FRD title, sections "Visión", "Historias de usuario", "Reglas de negocio", "Fuera de alcance", "Preguntas abiertas", "Work orders" with its progress, and the buttons "Contrato", "Blueprint", "Ver work orders". | `idea-frd-dialog` | AC-02-011.3 |
| ADR dialog | Kicker "ADR-0001", the ADR title, a folded "Metadatos del documento" and the ADR text. | `idea-adr-dialog` | AC-02-013.4 |
| Architecture FRD plan dialog | Kicker "FRD-01 · Plan de implementación": the same sections plus "Implementación", ending in the same three buttons. | `idea-architecture-frd-dialog` | AC-02-013.5 |
| Architecture not published | The tab stays and says "La arquitectura todavía no está publicada." | `idea-architecture-missing` | AC-02-013.1, AC-02-015.7 |
| Discard confirmation | Over the idea page: kicker "Confirmar", title "Descartar idea", the sentence naming the idea and "Podrás restaurarla después.", the optional "Motivo (opcional)" with the placeholder "Por qué…", "Cancelar" and "Descartar". | `idea-discard-dialog` | REQ-02-008, FRD-02#U3 |
| Shipped idea | A launched idea's header offers the star and "Abrir en Portafolio" and no "Descartar idea". | `idea-shipped` | FRD-02#U3 |
| Unknown idea | A card "Esta idea no existe" with "No hay ninguna idea con el identificador «does-not-exist»." and the button "Volver al tablero". | `idea-not-found` | FRD-02#U2 |
| Discarded idea | The header carries the word "Descartada" and the button "Restaurar"; a banner "Idea descartada" says "Se descartó sin motivo registrado. «Restaurar» la devuelve a su columna del tablero."; the idea without a project shows only the tabs Propuesta and Campaña. | `idea-discarded` | FRD-02#U5 |
| Discarded idea with a reason | The banner reads "Motivo: Mercado lleno de alternativas maduras y sin una cuña clara." in place of the "sin motivo" sentence. | `idea-discarded-reason` | FRD-02#U5 |
| Restore confirmation | Kicker "Confirmar", title "Restaurar idea", the sentence naming the idea and saying it returns to its column, with no reason field; "Cancelar" and "Restaurar". | `idea-restore-dialog` | FRD-02#U5 |
| Data model, entity selected | One entity card is outlined and the cards it relates to light up with their connectors; the others dim. | `model-entity-selected` | AC-02-015.2, AC-02-015.5 |
| Data model, zoomed out | After "Alejar" the toolbar reads "85%" and the canvas shows more entities. | `model-zoomed-out` | AC-02-015.3 |
| Declared no database | In "Modelo de datos": "Sin base de datos: el contenido es código y vive en el repositorio." and "Este proyecto declara explícitamente que no usa base de datos."; the other bands are intact. | `model-none` | AC-02-013.2, AC-02-015.7 |
| Unreadable data model | The band shows one explicit error naming the file and the broken relation, and "No se dibuja ningún diagrama hasta que el archivo sea válido."; the rest of Arquitectura is intact. | `model-invalid` | AC-02-015.7 |

Not specified by this FDD, because no captured state of this FRD draws it:

- AC-02-012.4 (gold card highlight) and the "recomendada" badge are Out of v2; AC-02-013.6 (a per-FRD dependency graph in the FRD modal) is Out of v2. The FRD dialogs end in links only.
- Native fullscreen behaviour, wheel and drag zoom steps, the layout engine and its pending, failing and stale-project states (AC-02-015.6, .10, .11, .12, .13): behaviour (no picture). The data model keeps the app's current layout engine (owner decision at M1) and its canvas is compared by computed styles, not pixels.
- The tab chosen by stage, tab persistence and document-link resolution (AC-02-009.1, .3, .4): behaviour (no picture).
- Optimistic star flip and its revert, the writes of discard, restore and favourite, and the empty Documentos rail: behaviour (no picture).
- Loading: behaviour (no picture).

## Components used

| Screen or state | Components (`docs/design/components.md`) |
|---|---|
| `board`, `board-*` | `PageHead`, `Button` (primary "Capturar ideas", default "Descartadas"), `SearchField`, `FilterChip` (selected neutral), `Switch`, `PhaseNav`, `BoardColumn` (narrow when empty, shows its 0), `IdeaCard` / `IdeaCardProject`, `Chip` |
| `board-capture-dialog`, `idea-discard-dialog`, `idea-restore-dialog` | `Dialog` / `DialogConfirm`, `CommandBox` (four rows), `Button` (`danger`, `ghost`) |
| `board-discarded-dialog` | `Dialog`, `ListRow` |
| `idea-*` header | Idea header (`PageHead` pattern with a "Volver al tablero" link), `Chip`, favourite star (`IconButton`), `Button` sm, `Tabs` |
| `idea-pitch` | `DigestHero`, `ReportBand` hosting the Propuesta blocks (features, risks, quote, checks, score bar, decision box, gauge cards) |
| `idea-spec`, `idea-frd-dialog` | `DigestHero`, `ReportBand`, `FrdCard`, `Dialog` / `DialogSheet`, `Button` toned |
| `idea-architecture`, `idea-adr-dialog`, `idea-architecture-frd-dialog`, `idea-architecture-missing` | `DigestHero`, `ReportBand`, `EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic`, `FrdCard`, `Dialog`, `EmptyState` |
| `idea-documents` | `IdeaDocsRail` / `IdeaDocsItem`, `Markdown`, `Paper` |
| `idea-campaign*` | `CampaignRoom`, `PhaseSheet`, `TeamMember`, `CommandBox`, `BuildModeCard`, `Chip` |
| `idea-shipped`, `idea-not-found`, `idea-discarded`, `idea-discarded-reason` | `Card`, `Notice` (the discard banner), `Button` |
| `model-*` | `ModelDiagram` / `SchemaList`, `GraphControls` toolbar, `Segmented` (Diagrama / Esquema), `SearchField`, `Notice` (error and none), `Chip` |

No new component is introduced.

## Interaction & flow

- **Board.** Ideas are placed by the two-axis derivation (FRD-02#U1); nothing can be dragged (REQ-02-002). A card opens the idea page; the star only flips the favourite flag. Phase chips scroll the columns; the search narrows by title across phases; the category chip and the search each show "N ideas coinciden" with "Limpiar".
- **Descartadas and Capturar ideas** open dialogs over the board, which stays visible behind them; a row of "Descartadas" opens that idea's detail.
- **Idea page.** The default tab follows the stage; every tab has its icon; "Abrir en Portafolio" goes to the project (FRD-04). In Campaña a room selects its sheet, the arrows move between phases, the current phase's sheet is open by default; "Entrar a La Fragua" is only on the Construcción sheet.
- **Discard and restore** are confirmation dialogs that replace nothing underneath and write one bounded field of the card; a shipped idea has no discard.
- **Copy-only commands.** Every command in a dialog or sheet is text to copy; Mission Control never runs one.

## Responsive & accessibility

- **Widths.** 1280, 768 and 375 for every state except `board-discarded-dialog`, `idea-adr-dialog`, `idea-architecture-frd-dialog` (375 and 1280). At 1280 the columns share the width and the board scrolls sideways; at 375 the chips wrap, the phase chips scroll sideways and the first column is shown with the next one peeking (see `board` at 375). The model viewer opens on Esquema on phones.
- **Not colour alone.** The empty-column marker is the sentence "Sin ideas en esta fase" with the count 0; return is a chip with its word; a favourite is a filled star whose label changes to "Quitar de favoritas: …"; locked, done and current rooms each carry the words "en espera", "entregado" and "en curso".
- **Keyboard.** Cards are links; the star is a labelled toggle with `aria-pressed`; dialogs trap focus, close on Escape and return focus to their opener; the tab bar uses arrow keys; the diagram has labelled directional controls and a textual Esquema with the same information.
- **Motion.** Roaming sprites in Campaña move by transform only and are static under `prefers-reduced-motion`.
- **Language.** Idea titles, ADR texts, FRD texts and document bodies keep their source language; the interface around them is Spanish.

## Copy

Spanish, from `docs/design/microcopy.es.json`; no em dash in product copy.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate).

prototype_blessed_at: 0e6b7191

`tablero-desktop` re-blessed 2026-10-30 in the wave 1 batch as a consistency baseline after the Órbita shell (WO-19-002) and primitives, judged against `docs/design/prototype/index.html#tablero` and the prior baseline. Fidelity to the prototype is judged at the close-out oracle pass, not by this bless.

`tablero-desktop` re-blessed 2026-10-30 in the wave 2-3 batch after WO-02-015 rebuilt the board (filters, phase jump, six columns), viewed against its wave 1 predecessor and `docs/design/prototype/index.html#tablero`. Reviewer sign-off: recognizably the Órbita surface, no console error, no structural gap. This is a consistency baseline; fidelity is judged at the close-out oracle pass.

- **Mocks:** `docs/frds/frd-02-ideas-board/mocks/ideas-board.html` (one `mock-screen` section per captured state) and `docs/frds/frd-02-ideas-board/mocks/screenshots/<id>-<width>-<theme>.jpg`.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#tablero` and `#idea?idea=<slug>&tab=<tab>`; the data-model states use `#portfolio?project=<slug>&tab=Arquitectura&model=<view>`.
- **Oracle states of this FRD (`oracle-states.json`):** `board`, `board-hide-empty`, `board-search`, `board-category-filter`, `board-favorite`, `board-phase-jump`, `board-capture-dialog`, `board-discarded-dialog`, `idea-pitch`, `idea-spec`, `idea-architecture`, `idea-documents`, `idea-campaign`, `idea-campaign-phase`, `idea-campaign-research`, `idea-campaign-design`, `idea-campaign-build`, `idea-campaign-release`, `idea-frd-dialog`, `idea-adr-dialog`, `idea-architecture-frd-dialog`, `idea-architecture-missing`, `idea-discard-dialog`, `idea-shipped`, `idea-not-found`, `idea-discarded`, `idea-restore-dialog`, `model-diagram`, `model-entity-selected`, `model-zoomed-out`, `model-schema`, `model-none`, `model-invalid`, `idea-discarded-reason`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/reference/css/` (06-card, 07-chip, 10-segmented, 12-command, 13-list-row, 20-tabs, 21-phase-stepper, 23-tablero, 24-idea-header, 25-spec, 27-architecture, 28-documents), `docs/design/prototype/components.html`, the Campaña assets under `docs/design/prototype/assets/`.
- **`docs/design/components.md` rows:** `PhaseNav`, `BoardColumn`, `IdeaCard`, `DigestHero`, `ReportBand`, `FrdCard`, `EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic`, `CampaignRoom`, `PhaseSheet`, `TeamMember`, `BuildModeCard`, `IdeaDocsRail` / `IdeaDocsItem`, `ModelDiagram` / `SchemaList`, `Tabs`, `Segmented`, `Chip` family, `CommandBox`, `Dialog`, `SearchField`, `Switch`, `EmptyState` / `Notice`.

`tablero-desktop` re-blessed 2026-10-31 in the wave 6 batch after WO-19-003 filled the sidebar (counts, Proyectos, guild card, Colapsar, theme button), viewed against its wave 4-5 predecessor and `docs/design/prototype/index.html#tablero`. Reviewer sign-off: only the sidebar moved, the filters, phase jump and columns are unchanged, no console error. The pending pill carries `data-volatile`, because it is live git data that streams in late, so the baseline omits it. It proves consistency only; the close-out oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

`tablero-mobile` first blessed 2026-10-31 at the FRD-13 recheck, once `target_platforms: responsive` made the mobile baselines real. Viewed at 390 against `docs/design/prototype/index.html#tablero`. Reviewer sign-off: header, filters, phase jump and columns present, no console error. The fixed bottom bar lands mid-image because the shot is full page; that is a capture effect. It proves consistency only; the next oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

## Baseline provenance (Visual QA, 2026-10-31)

Oracle: `docs/design/prototype/index.html` (route shards of `reference/oracle-states.json`), captured at 375 and 1280, light and dark, against `pnpm dev:oracle`. Layer-B sign-off: reviewer viewed the re-blessed baselines; they are consistency guards rendered from `e2e/fixtures/factory-root`, not pixel matches of the oracle (L3 still open, see `.pandacorp/comms/visual-punch-list.md`).
prototype_blessed_at: 0e6b7191

## Structural fidelity correction (2026-10-31)

Idea-header metadata occupies the second grid column below the title. Phone actions use the existing short translated labels and an icon-only discard action with its accessible name preserved. Spec bands use flag/search/book icons, blue PRD and teal Research hues, source-document actions through the embedding reader resolver, and an amber decision list with a mixed-opacity border. Oracle: `prototype.css:1521,1637-1638,778`; `prototype.js:703-705,885,936,973-975`. The possible `.pitch-ok` 8 px overflow is not confirmed and its implementation is unchanged pending browser measurement.

Component tests and static checks are recorded in the decision log. Browser fidelity, themes and overflow still require the attended Claude reviewer; no visual baseline was edited.

## Proposal and board fidelity close-out (2026-10-31)

The approved prototype wins for the proposal presentation. A structured memo has no second title
or repeated lead: its uppercase eyebrow precedes neutral app/platform chips with icons. The three
report bands are teal/flame, blue/layers and violet/gauge. Row labels use Inter, uppercase, bold,
and the band hue mixed with secondary text. Vision uses three equal columns at desktop width,
then one on phones. Risk and mitigation occupy two tinted cells on desktop and stack on phones;
the mitigation label is separate from its prose. The decision band has two equal panels, with
score rows laid out as label, bar and wrapping caption. On phones the caption occupies the next
row, and the two panels stack. Evidence is a violet text disclosure with working Markdown links.

Legacy cards without a memo skeleton show a title, metadata and a paper summary derived from
the solution paragraph, falling back to the first prose paragraph. Do not publish all legacy
headings in Propuesta or invent a pitch. Documentos preserves the complete card. The idea header
keeps metadata beneath the title. Long titles wrap; phone actions stay on one line. Phase count
chips use the pale `--tint` mixed with `--surface`, retaining their phase colour.

### Independent review corrections (2026-10-31)

- Proposal bands use level-2 headings; score panels are level 3. Other ReportBand callers retain
  their default level 3. The shared hero eyebrow has line-height 1.2; proposal metadata chips
  use the oracle 6px gap and inline-flex wrappers so they do not add baseline height. CardDetail adds no flex gap
  after the tab wrapper: its own bottom margin supplies the spacing before the hero. The header
  favourite is 40px and small navigation actions retain their 32px height on desktop, producing
  the oracle action-row height of 40px. On phones, accessibility's 44px touch target takes
  precedence. The 24px WCAG AA target-size floor is only a minimum.
- The decision chart matches the oracle: 80-high, radius-6 ideal zone at 14% green; ticks start at
  x=70/180/300. Ticks and captions use 600-weight 12px mono; ideal-zone and idea labels use body type.
  Score labels use secondary text. The Evidence disclosure uses the measured 14px body token.
- Legacy summary papers use padding `--s8 --s10`, radius `--r-xl`, and a `--s6` gap after the hero.
  At widths <=1179px padding becomes `--s6`; at <=759px it is `--s5 --s4`, radius `--r-lg`, with
  15px paragraph text. An empty summary is an explicit localized status, never an empty paper.
- Evidence inherits the reader resolver. Archived factory files that the reader cannot surface
  are neutral text with an unavailable-reader explanation; do not invent app routes for them.


## Architecture closure (2026-10-31)

Both entry points reuse ArchitectureDigest. Stack uses a three-column table; band headers use the
existing icon tile and CountPill. Environment groups are native accordions: the first starts open, the remainder closed.
ADR rows keep compact ID chips, a title and an ellipsized one-line summary; the existing modal
reveals the full authored ADR. No data is discarded to achieve the compact report.

ModelDiagram opens/reset/focus at 100%, not an automatic fit of its tallest entity. Fit and zoom
stop at 30%. At overview scales, inverse-scaled entity titles remain 12px on screen, fields and
cardinality labels are suppressed, and clicking an entity returns to full detail. Schema, search,
keyboard/pointer pan, click-pan and fullscreen remain available for the 56-entity model.

The architecture plan uses compact state tiles with full work-order labels in accessible names
and native tooltips. FRD summaries are clamped to three lines in a four-column desktop grid;
their full content remains in the existing FRD dialog. Integration prose uses a compact bullet list.


### Independent review corrections (2026-10-31)

The environment note remains visible above the groups. Each summary exposes its CountPill and a
missing-description warning; the first group opens by default, as in the approved prototype.
Plan rows show both the FRD id and its title, followed by the existing POR FRD card grid and a
short explanation. Compact ADR titles use the medium token; keyboard focus reveals their complete
text. The stack table declares column-header scope. Duplicate authored ADR ids use composite
React keys without rewriting the source project.

The model starts at the upper-left graph origin at 100%. An entity URL instead focuses that entity
at 100%. Focus entering an entity centers its header and cancels native scroll offsets so the camera
remains the only scroll authority; pointer and keyboard navigation share this behavior. ELK allows
6 nodes per layer with an aspect ratio of 1.3 to reduce excessive width. If a 30% fit still clips
the graph, the viewer visibly asks the user to use search or Schema; titles remain at least 12px.
The existing localized model query values, including `?model=Esquema`, are unchanged; migrating
those values to English is a separate CONV-18 change.

### Shared FRD card clarification (2026-10-31, lane H)

The shared FrdCard presents its ID in a violet chip, kind at the opposite edge, and title without a repeated FRD ID prefix. Once construction starts, its state stack reads done, review, in_progress, fail, todo, with a done/total count alongside. Workspace-specific four-column placement and digest-header visibility belong to FRD-04. Board Spec retains its existing digest eyebrow.

### Integration report corrections (2026-10-31)

Architecture plan introductions use small secondary text and the “Por FRD” label uses secondary text for contrast. FRD card summaries render inline Markdown (including code) instead of exposing source delimiters. Authored punctuation and narrative metadata remain source content. Header hosting/platform chips use the plain variant, hosting includes a cube icon, and the cost uses a green tint.

The real Funko Tracker digest already supplies de-prefixed mosaic titles; its relationship disclosure already has a border and spacing. Neither is normalized from fixture-only observations.

### Integrated responsive repair (2026-10-31)

On phones, header actions meet the 44px accessibility touch-target goal, overriding the approved
32px small-link and 40px favourite sizes. Both action groups use spacing-1 gaps so the complete
row fits the 288px content area at a 320px viewport. Accessible labels remain unchanged.

### Responsive architecture stack (2026-10-31, lane M)

Below 1024px, the shared architecture stack table presents each row vertically:
layer, bold technology choice, then rationale, with s1 gaps and s3/s4 row insets.
Column headers remain available to assistive technology. Desktop retains the
three-column table. Both entry points use the same ReportBand styles in either
theme, matching the approved prototype at 768px.

Accessibility refinement: stack layer labels use `--text-2`; the environment
completeness chip uses the existing outline variant. Stacking its tint over the
pink report surface produced 4.43:1 contrast in light mode, below AA. The outline
avoids compounded tints while retaining the semantic tone and readable label.

## Route and image security update (2026-10-31)

The existing missing-idea card is retained, with HTTP 404 set by the proxy before shell streaming.
Markdown image embeds retain their appearance while suppressing the document referrer.
