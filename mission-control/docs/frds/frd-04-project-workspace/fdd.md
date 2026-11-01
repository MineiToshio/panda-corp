---
id: FDD-04
type: fdd
slug: project-workspace
title: FDD-04 — Project workspace (feature design)
status: ACTIVE
parent: FRD-04
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-10-22'
prototype_blessed_at: '0e6b7191'
---

# FDD — FRD-04 Project workspace

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Frozen FROM the approved Órbita prototype (round 5, iteration 28). This FDD specifies only what the captured states of this FRD draw (DR-130). It uses the global design system and redefines none of it.

The workspace is what opens from the Portafolio (FRD-03) for one project. Every state below shares one frame: breadcrumb, a project header, the tab bar and the selected tab's content. The header is the full hero on Resumen only and a one-line compact header on every other tab. There are eight tabs, in this order: "Resumen", "Spec", "Observabilidad", "Arquitectura", "Cuentas", "Cambios", "Documentos", "Comandos". There is no Party tab and no work-orders tab.

Owned by other FRDs and only referred to here: La Fragua scene as the main scene of Resumen (FRD-06), the Observabilidad views (FRD-05 and FRD-12), the Cuentas tab (FRD-26), the Comandos tab and its build-mode picker (FRD-11, captured in FRD-11's `commands` states), the Spec and Arquitectura digests and the data-model viewer (FRD-02).

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Resumen of a project with no build running | Hero, upgrade notice, "Siguiente paso", La Fragua, then "Avance por FRD" and "Decisiones" and "Tu turno" and "Últimos avances", and a collapsed "Bitácora técnica del motor". | `project-summary` | REQ-04-001, REQ-04-002, REQ-04-003, REQ-04-004, AC-04-012.1, AC-04-014.1, AC-04-014.2, AC-04-014.3, AC-04-014.4, AC-04-014.7 |
| Resumen of a project with a running build | The hero chip "Construyendo", and all the cards; decisions are all "Resuelta". | `project-summary-funko` | REQ-04-004, AC-04-014.4, AC-04-014.5, AC-04-014.7 |
| Resumen with pending decisions | "Decisiones" lists "Pendiente" entries; "Tu turno" carries the scoped decision commands. | `project-summary-decisions` | REQ-04-004, FRD-04#U1, AC-04-014.5, AC-04-014.6 |
| Decision dialog | Kicker "Decisión · Funko Tracker", the decision title, status chip, date, a sentence on what the capture holds, and the command to review it. | `project-decision-dialog` | FRD-04#U1, AC-04-014.5 |
| Spec tab | Compact header, then the project's Spec digest (FRD-02's components): PRD band, research band, FRD cards. | `project-spec` | REQ-04-013, AC-04-013.1, AC-04-013.2, AC-04-013.3, AC-04-013.5 |
| Arquitectura tab | Compact header, then the architecture digest in this order: "Stack y tecnologías", "Integraciones y operación", "Modelo de datos", "Variables de entorno", "Decisiones", "Plan de implementación". | `project-architecture` | AC-04-012.1, AC-04-012.2, AC-04-012.3, AC-04-012.5 |
| Cambios tab | The change queue in groups, each card a row: title, `slug · date · frd`, kind chip, status chip; a collapsed "Historial" with done and discarded together; the card "Pedir un cambio". | `project-changes` | FRD-04#U3, REQ-04-010, REQ-04-011 |
| Change detail dialog | Kicker "Cambio · `<slug>`", title, chips, the body as titled sections ("Qué pasa", "Qué se espera") and the scoped build command. | `project-change-dialog` | FRD-04#U3, REQ-04-010 |
| Discard confirmation | Replaces the detail dialog: kicker "Confirmar", title "Descartar cambio", the optional "Motivo", "Cancelar" and "Descartar". | `project-change-discard` | FRD-04#U4 |
| Documentos tab | Type filter chips with counts, the open document as typed paper at full reader width, the document index on the right with a search. | `project-documents` | FRD-04#U5, AC-04-014.8 |

## States

| State | What the user sees | Oracle state | ACs |
|---|---|---|---|
| Documentos filtered by search | The search holds "blueprint" and the index narrows (captured at 1280). | `project-documents-search` | AC-04-014.8 |
| Documentos index folded (phone and tablet) | Below 900px the index is folded behind the button "Elegir documento · 66" and opens above the reader (captured at 375 and 768). | `project-documents-index-open` | AC-04-014.8 |
| Spec not published | The Spec tab stays and says "El spec todavía no está publicado." then "Su PRD y sus FRDs reales siguen disponibles."; below, the button "PRD completo" and the project's real FRD cards, each tagged with a tooltip that the digest does not list it yet. | `project-spec-empty` | AC-04-013.4 |
| Unknown tab | Under the compact header: a card "Esta sección no existe" with "«Inexistente» no es una sección del proyecto." and the button "Ir al resumen". | `project-tab-not-found` | REQ-04-002 |
| Snapshot panel | While a build runs, a card "Último commit en verde" with the chip "Seguro para probar", the short SHA, "verificó WO-07-002 de FRD-07", the line "Construyendo ahora: el build sigue avanzando. Eso todavía no está en verde: no lo pruebes." and the copyable `git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2` command, between La Fragua and "Avance por FRD". | `project-snapshot` | REQ-04-005 |
| Change that rebuilds verified work | The dialog of an urgent change shows the chips "Listos para construir", "Cambio", "Urgente", the slug and the FRD, a warning "Rehace trabajo ya verificado" with the sentence "Construirlo reabre work orders verificadas de `frd-03-my-collection`: vuelven a pasar por la revisión de su FRD.", the line "Depende de: …", and the button "Descartar cambio". | `project-change-rebuilds` | REQ-04-010, FRD-04#U3, FRD-04#U4 |
| Unreadable data model | In Arquitectura, the "Modelo de datos" band shows the one explicit error "No se pudo leer el modelo de datos docs/product/data-model.json: …" and "No se dibuja ningún diagrama hasta que el archivo sea válido."; every other band is intact. | `model-invalid` | AC-04-012.4 |
| Change in construction (no discard) | The detail dialog of an "En construcción" change shows its status chip and the build command and offers no discard action. | `project-change-dialog` | REQ-04-010 |

Not specified by this FDD, because no captured state of this FRD draws it:

- The "Obsoleta" tag, the unreadable-change-files banner, the "Cerrando" group and the "Listos para construir" group on `project-changes` (that state holds none), the `implemented_sha` evidence: Out of v2 or without a picture. Their FRD wording stays the only definition.
- Success feedback after discarding, and the unparseable-date slot of a change card: behaviour (no picture).
- How links inside a document resolve (same reader, new tab, plain text): behaviour (no picture).
- The Comandos tab: see FRD-11.
- Loading: behaviour (no picture).

## Components used

| Screen or state | Components (`docs/design/components.md`) |
|---|---|
| All | `AppShell` (FRD-19), `Crumbs`, `Tabs` (with count badges), `ProjectSwitcher` ("Cambiar proyecto", the dialog is FRD-03's picker) |
| `project-summary`, `project-summary-funko`, `project-summary-decisions` | `ProjectHero` (ring, stat counts, full `PhaseStepper`), `Notice` (upgrade), `CommandBox`, `FraguaScene` (FRD-06), `Card` + `CardHeader` + `CountPill`, `FrdRow`-style progress rows with `StackBar` ("Avance por FRD"), `ListRow` (decisions), `AskRow` ("Tu turno"), `ProgressList` ("Últimos avances"), native `details` (Bitácora) |
| `project-snapshot` | `SnapshotPanel` (`Card`, `Chip`, `CommandBox`) |
| `project-decision-dialog`, `project-change-dialog`, `project-change-rebuilds`, `project-change-discard` | `Dialog` / `DialogConfirm`, `Chip`, `Notice` (warning tone), `CommandBox`, `Button` (`danger`, `ghost`) |
| `project-changes` | `Card` groups with `ListRow`, `Chip`, collapsed `details` "Historial", `CommandBox` |
| `project-spec`, `project-spec-empty`, `project-architecture`, `model-invalid` | `ProjectHeroCompact`, `DigestHero`, `ReportBand`, `FrdCard`, `EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic` (hidden before Construcción), `ModelDiagram` / `SchemaList`, `Notice` (error) |
| `project-documents`, `project-documents-search`, `project-documents-index-open` | `FilterChip`, `Paper`, `Markdown`, `DocIndex` / `DocItem`, `SearchField`, `Button` (index toggle) |
| `project-tab-not-found` | `Card`, `Button` |

No new component is introduced.

## Interaction & flow

- **Entry.** A project from the Portafolio, the sidebar or the picker lands on Resumen unless the URL names a tab (`tab=Spec` and so on); the tab and its filters live in the URL (FRD-25). An unknown tab shows the "Esta sección no existe" card.
- **Header.** Resumen shows the hero with the ring, the counts and the full stepper; every other tab shows the one-line header with "n/m WO · pct", the compact stepper and "Cambiar proyecto". The tab bar sits right below, scrolls sideways with arrow buttons and keeps the selected tab in view on phones.
- **Resumen.** Top to bottom: upgrade notice (only when the project's engine is old), "Siguiente paso" with its copyable command, La Fragua, the snapshot card (only while a build runs), then two columns that become one below 1024px with "Tu turno" first. "Avance por FRD" lists unfinished FRDs first. "Decisiones" rows open the decision dialog; the dialog only shows the recommendation as text and the command to review it; nothing is answered in the app.
- **Cambios.** Cards open the detail dialog; a change that can be discarded offers "Descartar cambio", which swaps the detail for the confirmation (never a second modal on top). The confirmation closes with "Cancelar" or Escape. Changes in construction offer no discard.
- **Documentos.** The reader is full width; the index is on the right from 900px and folded behind "Elegir documento · 66" below it; chips filter by type with counts, the search filters by name.
- **Copy-only commands.** Every command is text to copy; Mission Control never runs one.

## Responsive & accessibility

- **Widths.** 1280, 768 and 375 for every state except `project-change-discard` (375 and 1280), `project-documents-search` (1280 only) and `project-documents-index-open` (375 and 768). On phones the hero stacks and "Cambiar proyecto" takes the full width; the sidebar rail on tablet and the drawer on phone are FRD-19's.
- **Not colour alone.** Decision state is the word "Resuelta" or "Pendiente"; change state is a chip with its word; the warning "Rehace trabajo ya verificado" has an alert icon; urgency is the chip "Urgente" with a bolt icon.
- **Keyboard.** The tab bar is a `tablist` with arrow-key movement; dialogs trap focus, close on Escape and return focus to the opener; the index toggle is a real button with `aria-expanded`; copy buttons are labelled "Copiar `<comando>`".
- **Language.** Artifact names stay English; change titles, document bodies and work-order titles keep their source language.

## Copy

Spanish, from `docs/design/microcopy.es.json`; no em dash in product copy.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-04-project-workspace/mocks/project-workspace.html` (one `mock-screen` section per captured state) and `docs/frds/frd-04-project-workspace/mocks/screenshots/<id>-<width>-<theme>.jpg`.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=<slug>&tab=<tab>` with the parameters of each state.
- **Oracle states of this FRD (`oracle-states.json`):** `project-summary`, `project-summary-funko`, `project-summary-decisions`, `project-decision-dialog`, `project-spec`, `project-spec-empty`, `project-architecture`, `project-changes`, `project-change-dialog`, `project-change-discard`, `project-documents`, `project-documents-search`, `project-documents-index-open`, `project-tab-not-found`, `project-snapshot`, `project-change-rebuilds`, `model-invalid`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/reference/css/` (06-card, 07-chip, 12-command, 13-list-row, 14-empty-notice, 19-page-header, 20-tabs, 21-phase-stepper, 22-inicio, 25-spec, 27-architecture, 28-documents, 29-markdown), `docs/design/prototype/components.html`.
- **`docs/design/components.md` rows:** `Tabs`, `ProjectHero`, `ProjectHeroCompact`, `ProjectSwitcher`, `FraguaScene`, `SnapshotPanel`, `AskRow`, `ProgressList`, `Dialog`, `Notice`, `CommandBox`, `ListRow`, `Chip` family, `StackBar`, `DigestHero`, `ReportBand`, `FrdCard`, `EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic`, `ModelDiagram` / `SchemaList`, `DocIndex` / `DocItem`, `Paper`, `Markdown`, `SearchField`.

## Baseline provenance

`workspace-desktop` first blessed 2026-10-31 in the wave 4-5 batch, once WO-04-010 and WO-04-011 mounted the frame and Resumen, judged against `docs/design/prototype/index.html#portfolio?project=mission-control&tab=summary` at 1280. It had no predecessor. Layer-B: hero, Fragua, next step, Avance por FRD, Decisiones, Tu turno and Últimos avances are present and recognizably match; cosmetic gaps go to the close-out oracle. It proves consistency only.

prototype_blessed_at: 0e6b7191

`workspace-desktop` re-blessed 2026-10-31 in the wave 6 batch after WO-19-003 filled the sidebar (counts, Proyectos, guild card, Colapsar, theme button), viewed against its wave 4-5 predecessor and `docs/design/prototype/index.html#portfolio?project=mission-control&tab=summary`. Reviewer sign-off: only the sidebar moved, the hero, Fragua and Resumen cards are unchanged, no console error. The pending pill carries `data-volatile`, because it is live git data that streams in late, so the baseline omits it. It proves consistency only; the close-out oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

`workspace-desktop` re-blessed and `workspace-mobile` first blessed 2026-10-31 at the FRD-13 recheck, viewed against the wave 6 predecessor and `docs/design/prototype/index.html#portfolio?project=mission-control&tab=summary`. Reviewer sign-off: the structure is unchanged at 1280; the "Último movimiento" chip no longer renders as a pale pill over La Fragua, and the command rows and hyphen widths moved with tabular figures. At 390 hero, tabs, Fragua and the Resumen cards are present; the bottom bar mid-image is a full-page capture effect. Consistency only; the next oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191

## Baseline provenance (Visual QA, 2026-10-31)

Oracle: `docs/design/prototype/index.html` (route shards of `reference/oracle-states.json`), captured at 375 and 1280, light and dark, against `pnpm dev:oracle`. Layer-B sign-off: reviewer viewed the re-blessed baselines; they are consistency guards rendered from `e2e/fixtures/factory-root`, not pixel matches of the oracle (L3 still open, see `.pandacorp/comms/visual-punch-list.md`).
prototype_blessed_at: 0e6b7191

## Structural fidelity correction (2026-10-31)

Avance por FRD shows its total and Ver todos footer only when there are more than eight rows, matching `prototype.js:833`. The approved order is upgrade notice, right-aligned Siguiente paso, La Fragua and snapshot; this supersedes the earlier forge-first implementation note. Spec uses the shared band headers and source-document actions described by FRD-02.

Component tests and static checks are recorded in the decision log. Browser fidelity, themes and overflow still require the attended Claude reviewer; no visual baseline was edited.

## Re-bless (2026-10-31, independent review)

`workspace-mobile` re-blessed after the structural fidelity corrections, viewed against `docs/design/prototype/index.html` at 375 and 1280 in both themes. Reviewer Layer-B sign-off: only the corrected surfaces moved. The route baselines are consistency guards from `e2e/fixtures/factory-root`.
prototype_blessed_at: 0e6b7191

## Partial-source state (2026-10-31)

FileReadErrors reuses the coral Notice with each relative path and localized reason, wrapping long
paths on phones. Valid lists remain below the notice. Incomplete project totals show "N archivos sin
leer" instead of a progress fraction/ring. Lista's source-error links are visibly underlined.

### Lane H visual reconciliation (2026-10-31)

Workspace Spec hides the visible digest eyebrow, including unpublished state, and exposes PRD completo as a button-styled document link. Desktop FRD cards form four columns (two on tablet, one on phone), with violet ID, kind on the right, de-prefixed title, and state bar plus done/total count. Bars order done, review, in_progress, fail, todo. Summary uses a terminal badge and trailing raw-log hint in its collapsed log header, uppercase forge eyebrow, green Ver todos with arrow, and mobile hero phase segments without clipped visual labels.

### Independent-review corrections (2026-10-31)

Spec notice and bands are separated by s6. The unpublished notice uses layers and exposes flag PRD completo plus search Research when their documents exist. FRD codes use mono fcode treatment, and progress counts use text-2. The Summary engine log uses a Space Grotesk h2 and slate small BadgeIcon; its hint reuses hide-sm. Ver todos has its own green, base-size, weight-600 class so decision links retain their original treatment. Empty FRD rows keep a zero-state track. Siguiente paso always pairs a command with its when sentence, including pre-build phases and complete construction with queued changes.

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

## Decision and ADR dialog closure, 2026-10-31

Decision details use the existing native Modal with amber context, metadata chips, optional blue recommendation Notice, source note, command and project button in body order. ADR details use the ADR id as kicker, the document title without a repeated id, and amber heading/Markdown treatment. Both retain the shared focus trap, Escape dismissal and connected-trigger focus return. Work-order details remain routed inline in Observabilidad rather than becoming a modal; the prototype follows the same navigation model.

ADR document bodies omit their leading Markdown title because the modal header already supplies it. Metadata and subsequent document sections remain intact (2026-10-31 independent review).


## Visual close-out clarification (2026-10-31, lane O)

Document filters span the workspace before the two-column reader. The selected paper and index icon use one document-type hue mapping. The right index uses colored group headings and chevrons; at phone widths its existing disclosure appears above the paper. Existing project content is preserved rather than replaced with the frozen sample.


## Independent review corrections (2026-10-31, lane O)

On phones, type filters stay on one horizontally scrollable row, with category dots and muted counts. The index toggle includes the file icon. Index headings and links have a 40px minimum target height. Invalid YAML retains the typed Paper and index, displaying an alert with the parse reason followed by an escaped source-code block. Missing content keeps path copying rather than copying an empty string.
