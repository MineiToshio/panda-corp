# Context pack · FRD-04 · Project workspace

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-04 copy, S2.1 builds, S2.2 amendments, S2.3-04 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-04-project-workspace/frd.md` (id FRD-04, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 14 under `states["frd-04-project-workspace"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 23 AC lines: 6 drawn · 12 partially drawn · 2 not drawn · 3 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-04#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-04-001 · partial · `project-summary`, `project-spec`, `wo-by-frd`

> - **REQ-04-001** — The workspace SHALL be **tabs-first**: a **compact header** (title · stage · version · a thin work-order progress bar) at the top, the **tab bar** directly below it (reachable without scrolling), and the selected tab's content beneath. The overview content lives INSIDE the Resumen tab (the default), not above the tabs.

**Prototype:** Header + tab bar + content; Resumen shows the full hero (phase chip, "v1", Construyendo / Sin construcción activa, ring "109/110 work orders verificados", counts, six-segment stepper) and every other tab a compact one-line header (initials, name, phase chip, "n/m WO · pct", compact stepper, "Cambiar proyecto"). Version is shown only in the Resumen hero; the thin progress bar is a ring/text.

### REQ-04-002 · partial · `project-summary`

> - **REQ-04-002** — The workspace SHALL offer tabs, in this order: **Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos · Cuentas**. Architecture sits immediately after Work orders; Accounts follows Commands (FRD-26).

**Prototype:** Tabs drawn, in this order: Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos (8). "Work orders" is renamed Observabilidad (the old tab=Work orders link lands there: observability-legacy-link), Party is merged into the Resumen (La Fragua), Cuentas sits after Arquitectura.

### REQ-04-003 · partial · `project-summary`, `wo-by-frd`

> - **REQ-04-003** — The compact header SHALL show title, stage, version and a thin progress bar (% of work orders completed), visible on all tabs; the detailed **"Mission Objectives"** bar (work orders done / total + %) lives inside the Summary tab.

**Prototype:** Compact header on non-Resumen tabs shows title, stage and "n/m WO · pct %"; the detailed "Mission Objectives" bar is the hero ring plus the Fragua forging bar in Resumen.

### REQ-04-004 · partial · `project-summary`, `project-summary-funko`, `project-summary-decisions`

> - **REQ-04-004** — The **Summary** tab SHALL show: summary, key points, the **Mission Objectives** progress, **decision points** (highlighted, with a count) and a high-level **activity log** (what was done and what decisions were made), read from `.pandacorp/inbox/decisions.md` and `.pandacorp/comms/progress.md`.

**Prototype:** Resumen: Estado general verdict (La Fragua headline + chip), key numbers, "Avance por FRD" (replaces Mission Objectives), "Decisiones" list with Resuelta/Pendiente, "Tu turno", "Últimos avances", collapsed "Bitácora técnica del motor". Summary/key points = hero subtitle (clamped, "Leer completo"). The activity log is replaced by "Últimos avances" built from structured sources; the raw log is collapsed. "Contexto completo del producto" was removed on purpose (iteration 19).

### FRD-04#U1 · partial · `project-summary-decisions`, `project-decision-dialog`

> - WHEN there are pending decisions, it SHALL highlight them, EACH labeled with its stable `id` (`<date>-<n>` / `legacy-<n>`, derived from its heading — never invented, never reused) so the owner can reference one specific decision, plus an "hace N días" age hint derived from the heading's date (omitted for a legacy/undated heading); the **per-card command SHALL be `/pandacorp:decide <id>`** — scoped to that decision, not the bare un-scoped form (which would walk every pending one). WHERE a pending decision carries an AI recommendation, the Summary SHALL render the recommendation TEXT as context only — no one-click "approve" affordance (removed, owner decision 2026-06-30: answering must go through the real `/pandacorp:decide <id>` conversation, which shows full context before recording an answer).

**Prototype:** Pending decisions appear in "Tu turno" with age ("hace 41 días"), the scoped command `/pandacorp:decide 2026-09-10-1` and Detalles. The decision card in "Decisiones" opens a dialog whose command is the BARE `/pandacorp:decide` and shows the agent recommendation as text (no approve button). Stable id label is shown in Tu turno only through the command.

### FRD-04#U2 · not drawn · `project-summary-decisions`

> - A decision marked **obsolete** (status `OBSOLETO`/`SUPERSEDIDO` in `decisions.md`, distinct from `RESUELTO`) SHALL render with a visible "Obsoleta" tag, never indistinguishable from one actually answered.

**Prototype:** The "Obsoleta" tag for OBSOLETO/SUPERSEDIDO decisions is NOT drawn (only Resuelta / Pendiente).

### REQ-04-005 · not drawn · `project-summary`

> - **REQ-04-005** — The **Summary** tab SHALL show the **snapshot panel** when a last-green build commit exists: the last commit that passed all gates (with its FRD label and short SHA) and a copyable **`git worktree add ../<slug>-review <sha>`** command, so the owner can test that safe commit in a separate worktree without stopping the running build.

**Prototype:** The snapshot panel (last green commit, `git worktree add ../<slug>-review <sha>`) is NOT drawn in Resumen.

### REQ-04-006 · drawn · `commands`, `commands-mode-powerful`, `commands-target-scoped`

> - **REQ-04-006** — The **Commands** tab SHALL show the commands relevant to the stage and the **build mode selector** ([FRD-11](../frd-11-build-modes/frd.md)). The **ModeSelector panel** (FRD-11) shows `/pandacorp:implement [mode]` (the full build command) always, and additionally shows `/pandacorp:implement <frd>` and `/pandacorp:implement change:<slug>` when the phase is `implementation` or `release`. The **CommandsBox** (below ModeSelector) shows stage-relevant non-build commands: in `implementation` — (1) `/pandacorp:release` — launch when all work orders are done, (2) `/pandacorp:iterate` — add or adjust; in `release` — (1) `/pandacorp:iterate` — add/adjust/fix, (2) `/pandacorp:new-version` — start a new major milestone.

**Prototype:** Comandos tab: "Siguiente paso" cards (release, iterate), the build-mode picker with `/pandacorp:implement [mode]`, "Construir un objetivo concreto" with `/pandacorp:implement <id>` and "Cambios y decisiones" (change, decide, new-version). Per-phase variants (implementation vs release) differ only by data.

### FRD-04#U3 · partial · `project-changes`, `project-change-dialog`

> - The **Changes** tab SHALL list every item in the project's change queue (`.pandacorp/inbox/changes/*.md`, plus archived `done/*.md`). BY DEFAULT it SHALL show only **Listos (ready)** and **Borradores (draft)** — the actionable items; **Hechos (done)** and **Descartados (discarded)** SHALL be hidden behind "Ver hechos (N)" / "Ver descartados (N)" toggle buttons (each omitted when its bucket is empty), so the queue's history doesn't clutter the actionable view as a project ages over months. WHEN the reader cannot interpret one or more files (invalid/missing `type` or `status`, or a body with no H1 title), it SHALL surface a fail-loud error banner naming them — never silently render an empty-looking queue (DR-078). Clicking a card SHALL open a detail modal showing its type, urgency (when `expedite`), status, date, affected FRD, dependencies, a warning when it `rebuilds_verified`, the body rendered as titled colour-coded sections, and a ready-to-copy **`/pandacorp:implement change:<id>`** command scoped to that specific item (the existing targeted-build mechanism from [FRD-11](../frd-11-build-modes/frd.md), pointed at a concrete id instead of the `<slug>` placeholder).

**Prototype:** Cambios lists "Listos para construir 0", "En construcción 3", "Cerrando 0", "Borradores 3" and a collapsed "Historial 11" (done + discarded together). The FRD's separate "Ver hechos (N)" / "Ver descartados (N)" toggles are NOT drawn; the always-visible En construcción / Cerrando groups ARE drawn. Fail-loud banner "1 archivo de cambios no se pudo interpretar. No se cuentan como cola vacía." IS drawn. Detail dialog shows kind, status chip, id, FRD, "Qué pasa", "Qué se espera" and `/pandacorp:implement change:<id>`; urgency, rebuilds_verified warning and dependencies are not in the capture.

### FRD-04#U4 · partial · `project-change-discard`

> - WHEN the item shown in the Changes detail modal is **Listo or Borrador**, the modal SHALL offer a **"Descartar"** action (never shown for a Hecho or already-Descartado item). Confirming it SHALL rewrite `status: discarded` in the item's frontmatter (preserving the body and every other field verbatim, and recording `status_before_discard` for a future restore) — one of Mission Control's small, bounded set of human-triggered writes (architecture §1/§7, the same pattern as the idea-card discard/restore write, [ADR-0002](../../adr/ADR-0002-restore-second-write.md)). The confirmation SHALL be an inline "¿Seguro? Sí / No" swap, never a second modal nested inside the detail modal already showing. On success the detail modal SHALL close and the discarded item SHALL disappear from the default Listos/Borradores view (it now only shows under "Ver descartados").

**Prototype:** "Descartar" exists for Borrador/Listo; confirmation is a confirm dialog "Descartar cambio" (Cancelar / Descartar, optional "Motivo") that replaces the detail dialog, NOT an inline "¿Seguro? Sí / No" swap. Success state (modal closes, item leaves the list) is not captured.

### REQ-04-010 · partial · `project-changes`

> - **REQ-04-010** — The change-queue `status` enum the reader accepts SHALL be `ready | draft | building | closing | done | discarded` (DR-069 §7): `building` and `closing` are ENGINE-managed transient states the owner never writes — the build stamps `building` while a change's FRDs are in flight (so the safe-point drain never re-drains it), and `/pandacorp:sync`'s close-out mode stamps `closing` (plugin 9.104.0) together with `implemented_sha`/`closing_at` while it batch-archives an already-implemented card. WHEN an item's status is `building` or `closing`, the Changes tab SHALL render it in its own always-visible group ("En construcción" / "Cerrando" — never behind a toggle, unlike Hechos/Descartados), and the detail modal SHALL show the status as a labelled chip (never color alone) plus, when present, the `implemented_sha`/`closing_at` evidence; it SHALL NOT offer the "Descartar" action (same as Hecho/Descartado) and SHALL NOT count toward any pending-items badge (that counts only `ready`/`draft`, DR-092/DR-115).

**Prototype:** "En construcción" (blue) and "Cerrando" groups are always visible, with labelled status chips; `implemented_sha` / `closing_at` evidence and the exclusion from the pending badge are not drawn.

### REQ-04-011 · partial · `project-changes`

> - **REQ-04-011** — Each Changes-tab card SHALL show its date as a Spanish relative label ("hoy", "ayer", "hace N días", "hace N meses") instead of the raw ISO date, keeping the raw date as a tooltip; an unparseable date SHALL be shown raw, never hidden (WO-04-008).

**Prototype:** Cards show "slug · 19 oct. 2026 · frd" (absolute date), not "hoy / ayer / hace N días"; unparseable-date raw display is not drawn. The Resumen "Últimos avances" and Tu turno use absolute dates too.

### FRD-04#U5 · drawn · `project-documents`, `project-documents-search`, `project-documents-index-open`

> - The **Documents** tab SHALL allow navigating and reading the project's documents, rendered at the **full width** of the reader pane. Every navigation link — both the doc tree AND links found inside a document — SHALL preserve the workspace context (stay on the Documents tab, same project), so selecting a document never bounces back to the Summary tab. A link inside a document to another document the reader surfaces SHALL open it in the **same reader**; an off-app URL SHALL open in a new tab; a relative link to a document the reader does not surface SHALL render as plain text (never a broken link).

**Prototype:** Documentos: type filter chips ("Todos 66", "Work order 35", "Decisión técnica 8" …), reader at full width (paper head with type chip, path and "Copiar el documento") with the index on the RIGHT, grouped by purpose, search field "Buscar documento…"; below 900 px the index folds behind the button "Elegir documento · 66". Link resolution (same reader / new tab / plain text) is behaviour, not a captured state.

### REQ-04-012 · partial · `project-summary`

> - **REQ-04-012 / AC-04-012.1** — WHEN a project workspace is opened from the portfolio or `/projects/<slug>`, THE shell SHALL offer exactly ten tabs in this order: **Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos · Cuentas**, defaulting to Resumen when no tab is specified.

**Prototype:** Ten tabs required; the prototype draws eight (see REQ-04-002). Default Resumen when no tab is given: D.

### AC-04-012.2 · drawn · `project-architecture`, `model-diagram`

> - **AC-04-012.2** — WHEN `tab=architecture` is selected, THE workspace SHALL render the complete shared `ArchitectureDigest` and the shared logical-model reader/viewer from FRD-02 REQ-02-013/015, including stack, **Integraciones y operación**, **Modelo de datos**, environment-variable names (in that order), ADRs, implementation plan and per-FRD cards; it SHALL NOT substitute a database-only view.

**Prototype:** Arquitectura tab renders the full digest and the model viewer, never a database-only view. Section order drawn: Stack, Integraciones y operación, Modelo de datos, Variables de entorno, Decisiones, Plan de implementación (the AC lists environment names before ADRs: same).

### AC-04-012.3 · drawn · `project-architecture`

> - **AC-04-012.3** — WHEN navigating with `/portfolio?project=<slug>&tab=architecture` or `/projects/<slug>?tab=architecture`, THE workspace SHALL preserve the selected project and Architecture tab, including implementation and released projects.

**Prototype:** `#portfolio?project=pandasaga&tab=Arquitectura` keeps project and tab.

### AC-04-012.4 · partial · `model-none`, `idea-architecture-missing`

> - **AC-04-012.4** — WHEN architecture narrative or model input is missing/invalid/explicitly none, THE workspace SHALL show the same distinct partial/error states as the board and SHALL keep the Architecture tab reachable without fabricated database data.

**Prototype:** Distinct states for explicit no-database and architecture-not-published are drawn (see FRD-02 AC-02-015.7); malformed/invalid input is not.

### AC-04-012.5 · behaviour only · `project-architecture`

> - **AC-04-012.5** — WHEN the owner changes selected project, THE Architecture view SHALL reset project-local diagram/search/selection state and render only the newly selected project's artifacts.

**Prototype:** Reset of project-local diagram state when the project changes is behaviour.

### REQ-04-013 · partial · `project-spec`

> - **REQ-04-013 / AC-04-013.1** — WHEN a project workspace is opened from Portfolio or a direct project page, THE shell SHALL offer **Spec** immediately after Resumen and before Work orders, with the ten-tab order specified by REQ-04-002 and Resumen still the default.

**Prototype:** Spec follows Resumen in the tab order; the FRD wants it before Work orders, which the prototype also does (Spec · Observabilidad).

### AC-04-013.2 · drawn · `project-spec`

> - **AC-04-013.2** — WHEN `tab=spec` is selected and a nonempty digest is available, THE workspace SHALL reuse the board's complete `SpecDigest` (FRD-02 REQ-02-011), `readSpecDigest`, and live `countFrdFolders(listProjectDocs())`; PRD, research, FRD cards and FRD modal content SHALL NOT be forked or replaced by placeholder prose. Closing the modal SHALL restore keyboard focus to its connected opener.

**Prototype:** The workspace reuses the same Spec digest component and FRD dialog (idea-frd-dialog).

### AC-04-013.3 · behaviour only · `project-spec`

> - **AC-04-013.3** — WHEN the owner selects Spec, follows its deep link or opens a known document link in the digest, THE system SHALL retain the selected project and route context; known document links SHALL open that project's Documents reader, external links in a new tab and unknown relative targets as plain text.

**Prototype:** Context retention is behaviour.

### AC-04-013.4 · drawn · `project-spec-empty`

> - **AC-04-013.4** — WHEN no nonempty spec digest is available, THE workspace SHALL retain the tab and state **Todavía no hay una especificación publicada.**, without borrowing another project's digest or inventing specification content.

**Prototype:** "El spec todavía no está publicado." plus "Su PRD y sus FRDs reales siguen disponibles." (with the FRD cards listed). Copy differs from "Todavía no hay una especificación publicada.".

### AC-04-013.5 · behaviour only · `project-spec`

> - **AC-04-013.5** — WHEN the selected project changes, THE Spec view SHALL reset project-local FRD/modal state and read only the new project's digest and real FRD count. Full-bleed digest bands SHALL remain contained in the embedded panel on desktop and mobile.

**Prototype:** Reset of FRD/modal state when the project changes is behaviour.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `project-summary` | `#portfolio?project=mission-control` | (none) | full page | `REQ-04-001` `REQ-04-002` `REQ-04-003` `REQ-04-004` `REQ-04-005` `REQ-04-012` |
| `project-summary-funko` | `#portfolio?project=funko-tracker` | (none) | full page | `REQ-04-004` |
| `project-summary-decisions` | `#portfolio?project=personal-page-v2` | (none) | full page | `REQ-04-004` `FRD-04#U1` `FRD-04#U2` |
| `project-decision-dialog` | `#portfolio?project=funko-tracker` | click `[data-decision]` → wait for `dialog[open]` | capture viewport | `FRD-04#U1` |
| `project-spec` | `#portfolio?project=pandasaga&tab=Spec` | (none) | full page | `REQ-04-001` `REQ-04-013` `AC-04-013.2` `AC-04-013.3` `AC-04-013.5` |
| `project-spec-empty` | `#portfolio?project=mission-control&tab=Spec` | (none) | full page | `AC-04-013.4` |
| `project-architecture` | `#portfolio?project=pandasaga&tab=Arquitectura` | (none) | full page | `AC-04-012.2` `AC-04-012.3` `AC-04-012.5` |
| `project-changes` | `#portfolio?project=personal-page-v2&tab=Cambios` | (none) | full page | `FRD-04#U3` `REQ-04-010` `REQ-04-011` |
| `project-change-dialog` | `#portfolio?project=personal-page-v2&tab=Cambios` | click `[data-change]` → wait for `dialog[open]` | capture viewport | `FRD-04#U3` |
| `project-change-discard` | `#portfolio?project=personal-page-v2&tab=Cambios` | click `.lrow[data-change]:has-text("Borrador")` → click `#dlg [data-action="discard-change"]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-04#U4` |
| `project-documents` | `#portfolio?project=pandasaga&tab=Documentos` | (none) | full page | `FRD-04#U5` |
| `project-documents-search` | `#portfolio?project=pandasaga&tab=Documentos` | fill `#doc-search` = "blueprint" | full page; widths 1280 | `FRD-04#U5` |
| `project-documents-index-open` | `#portfolio?project=pandasaga&tab=Documentos` | click `[data-action="doc-index"]` | full page; widths 375/768 | `FRD-04#U5` |
| `project-tab-not-found` | `#portfolio?project=mission-control&tab=Inexistente` | (none) | full page | — |

States cited above that belong to another FRD folder (captured there, reused here): `wo-by-frd`, `commands`, `commands-mode-powerful`, `commands-target-scoped`, `model-diagram`, `model-none`, `idea-architecture-missing`.

**Not drawn (2)**: `FRD-04#U2`, `REQ-04-005`.

**Partially drawn (12)**: `REQ-04-001`, `REQ-04-002`, `REQ-04-003`, `REQ-04-004`, `FRD-04#U1`, `FRD-04#U3`, `FRD-04#U4`, `REQ-04-010`, `REQ-04-011`, `REQ-04-012`, `AC-04-012.4`, `REQ-04-013`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): `project-summary-decisions`, `project-spec-empty`.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Ruta
- Cambiar proyecto
- Ver secciones anteriores
- Ver más secciones
- Spec
- 1. Investigación · completada
- Investigación: completada
- 2. Producto · completada
- Producto: completada
- 3. Diseño · completada
- Diseño: completada

### `project-summary`

- [span] MC
- [span] v1
- [span] Sin construcción activa
- [@aria-label] 99% completado
- [small] work orders verificados
- [small] FRDs
- [small] ADRs
- [small] cambios abiertos
- [b] hoy
- [small] último movimiento
- [@aria-label] Fase: Construcción
- [@aria-label] Secciones de Mission Control
- [button[tab]] Observabilidad 110
- [button[tab]] Cambios 3
- [button[tab]] Documentos 175
- [@aria-label] Actualización pendiente
- [b] Este proyecto usa una versión vieja del motor de Pandacorp
- [p] Va con la v8.100.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas.
- [code] /pandacorp: upgrade
- [@aria-label] Copiar /pandacorp:upgrade
- [span] Córrelo en la carpeta de Mission Control
- [b] Siguiente paso:
- [code] /pandacorp: release
- [@aria-label] Copiar /pandacorp:release
- [span] La Fragua · Mission Control
- [h2] Construcción al 99 %: 109 de 110 work orders verificadas. Las 1 restantes ya están construidas y esperan la revisión de su FRD. 3 cambios abiertos. 3 cosas esperan tu decisión.
- [p] El equipo descansa: no hay un build corriendo.
- [span] Espera tu decisión
- [span] Demo
- [@aria-label] Estado de la escena
- [button] Estado real
- [button] Apagada
- [button] Encendida
- [button] Simulación
- [span] En la app la escena muestra siempre el estado real del build.
- [@aria-label] 109 verificadas, 1 en revisión, 0 en el taller, 0 en cola
- [b] Cola
- [span] por empezar
- [p] Nada por empezar
- [p] Nadie construyendo ahora
- [span] esperan a su FRD
- [@aria-label] WO-02-014: Accessible empty-column marker (×9 of the same pattern)
- [span] Faltan 1
- [span] 3 cambios abiertos
- [span] Último movimiento hoy
- [span] Cada cuadradito es una work order real: púlsalo para abrirla.
- [h2] Avance por FRD 26
- [p] Primero lo que falta terminar.
- [strong] FRD-02Ideas board
- [@aria-label] 8 verificado, 1 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×6 of the same pattern)
- [strong] FRD-22Factory backlog
- [strong] FRD-25Persistent navigation
- [strong] FRD-26Services and accounts
- [strong] FRD-01Data reading
- [strong] FRD-03Portfolio
- [strong] FRD-04Project workspace
- [strong] FRD-05Work orders
- [span] 26 FRDs en total
- [button] Ver todos
- [p] Sin decisiones tuyas registradas.
- [h2] Tu turno 3
- [span] Cambio listo · pedido el 18 oct. 2026 (×3 of the same pattern)
- [code] /pandacorp: implement change: board-search-diacritics
- [@aria-label] Copiar /pandacorp:implement change:board-search-diacritics
- [@data-tip] Copiar comando
- [button] Detalles
- [@aria-label] Detalles: Buscar ideas sin importar las tildes (×3 of the same pattern)
- [code] /pandacorp: implement change: rail-sort-ties
- [@aria-label] Copiar /pandacorp:implement change:rail-sort-ties
- [code] /pandacorp: implement change: timeline-gap-label
- [@aria-label] Copiar /pandacorp:implement change:timeline-gap-label
- [h2] Últimos avances
- [span] Listo para construir
- [span] 18 oct. 2026 (×3 of the same pattern)
- [span] 2 work orders verificadas
- [span] 24 set. 2026 (×2 of the same pattern)
- [span] Terminado
- [h2] Bitácora técnica del motor 9
- [span] Notas en crudo del build

### `project-summary-funko`

- [span] FT
- [span] v1
- [span] Construyendo
- [@aria-label] 81% completado
- [small] work orders verificados
- [small] FRDs
- [small] ADRs
- [small] cambios abiertos
- [b] hoy
- [small] último movimiento
- [@aria-label] Fase: Construcción
- [@aria-label] Secciones de Funko Tracker
- [button[tab]] Observabilidad 48
- [button[tab]] Cuentas 10
- [button[tab]] Cambios 21
- [button[tab]] Documentos 82
- [b] Siguiente paso:
- [code] /pandacorp: release
- [@aria-label] Copiar /pandacorp:release
- [span] La Fragua · Funko Tracker
- [h2] Construcción al 81 %: 39 de 48 work orders verificadas. Las 9 restantes ya están construidas y esperan la revisión de su FRD. 21 cambios abiertos. 1 cosa espera tu decisión.
- [p] El equipo está trabajando: hay un build corriendo.
- [span] Espera tu decisión
- [span] Demo
- [@aria-label] Estado de la escena
- [button] Estado real
- [button] Apagada
- [button] Encendida
- [button] Simulación
- [span] En la app la escena muestra siempre el estado real del build.
- [@aria-label] 39 verificadas, 9 en revisión, 0 en el taller, 0 en cola
- [b] Cola
- [span] por empezar
- [p] Nada por empezar
- [p] Nadie construyendo ahora
- [span] esperan a su FRD
- [@aria-label] WO-01-001: Catalog read model and seed loader (×16 of the same pattern)
- [span] Faltan 9
- [span] 21 cambios abiertos
- [span] Último movimiento hoy
- [span] Cada cuadradito es una work order real: púlsalo para abrirla.
- [h2] Avance por FRD 8
- [p] Primero lo que falta terminar.
- [strong] FRD-01Recorrer el catálogo
- [@aria-label] 14 verificado, 2 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×7 of the same pattern)
- [strong] FRD-03Cuenta y colección privada
- [strong] FRD-05Lista para compartir
- [strong] FRD-08Ayuda, contacto y legal
- [strong] FRD-02Ficha de la figura
- [strong] FRD-04Metas y faltantes
- [strong] FRD-06Carga inicial del catálogo
- [strong] FRD-07Novedades del catálogo
- [small] 20 oct. 2026 · Resuelta
- [p] 1 entrada automática del motor oculta (no son preguntas para ti).
- [h2] Tu turno 1
- [span] Cambio listo · pedido el 20 oct. 2026
- [code] /pandacorp: implement change: collection-csv-import
- [@aria-label] Copiar /pandacorp:implement change:collection-csv-import
- [@data-tip] Copiar comando
- [button] Detalles
- [@aria-label] Detalles: Importar una colección desde una hoja de cálculo
- [h2] Últimos avances
- [span] 1 work order verificada
- [span] 20 oct. 2026
- [span] Listo para construir
- [span] Pedido (borrador)
- [h2] Bitácora técnica del motor 44
- [span] Notas en crudo del build

### `project-summary-decisions`

- [span] PV
- [span] v1
- [span] Sin construcción activa
- [@aria-label] 76% completado
- [small] work orders verificados
- [small] FRDs
- [small] ADRs
- [small] cambios abiertos
- [b] ayer
- [small] último movimiento
- [@aria-label] Fase: Lanzamiento
- [@aria-label] Secciones de PersonalPage v2
- [button[tab]] Observabilidad 25
- [button[tab]] Cuentas 3
- [button[tab]] Cambios 6
- [button[tab]] Documentos 53
- [@aria-label] Actualización pendiente
- [b] Este proyecto usa una versión vieja del motor de Pandacorp
- [p] Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas.
- [code] /pandacorp: upgrade
- [@aria-label] Copiar /pandacorp:upgrade
- [span] Córrelo en la carpeta de PersonalPage v2
- [b] Siguiente paso:
- [code] /pandacorp: iterate
- [@aria-label] Copiar /pandacorp:iterate
- [span] La Fragua · PersonalPage v2
- [h2] Lanzamiento al 76 %: 19 de 25 work orders verificadas. Faltan 6: 6 por empezar. 6 cambios abiertos. 2 cosas esperan tu decisión.
- [p] El equipo descansa: no hay un build corriendo.
- [span] Espera tu decisión
- [span] Demo
- [@aria-label] Estado de la escena
- [button] Estado real
- [button] Apagada
- [button] Encendida
- [button] Simulación
- [span] En la app la escena muestra siempre el estado real del build.
- [@aria-label] 19 verificadas, 0 en revisión, 0 en el taller, 6 en cola
- [b] Cola
- [span] por empezar
- [@aria-label] WO-03-002: Case study template (×14 of the same pattern)
- [p] Nadie construyendo ahora
- [span] esperan a su FRD
- [p] Nada esperando revisión
- [span] Faltan 6
- [span] 6 cambios abiertos
- [span] Último movimiento ayer
- [span] Cada cuadradito es una work order real: púlsalo para abrirla.
- [h2] Avance por FRD 8
- [p] Primero lo que falta terminar.
- [strong] FRD-03Proyectos y casos
- [@aria-label] 1 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 2 planificado (×5 of the same pattern)
- [strong] FRD-05Blog en MDX
- [strong] FRD-06SEO y datos estructurados
- [strong] FRD-08Skill para escribir el blog
- [strong] FRD-01Estructura, idiomas y temas
- [strong] FRD-02Inicio y posicionamiento
- [strong] FRD-04Sobre mí y ahora
- [strong] FRD-07Contacto
- [small] 10 set. 2026 · Pendiente
- [small] 1 jul. 2026 · Pendiente
- [h2] Tu turno 2
- [span] Decisión · hace 41 días
- [code] /pandacorp: decide 2026-09-10-1 (×2 of the same pattern)
- [@aria-label] Copiar /pandacorp:decide 2026-09-10-1 (×2 of the same pattern)
- [@data-tip] Copiar comando
- [button] Detalles
- [@aria-label] Detalles: Textos del inicio y de "sobre mí" — 2 de 4 ajustes listos, faltan 2 (×2 of the same pattern)
- [span] Decisión · hace 112 días · ya resuelta en el archivo
- [h2] Últimos avances
- [span] 19 oct. 2026 (×6 of the same pattern)
- [span] Pedido (borrador)
- [h2] Bitácora técnica del motor 73
- [span] Notas en crudo del build

### `project-decision-dialog`

- [dlg p] Decisión · Funko Tracker
- [dlg span] Resuelta
- [dlg p] La captura guarda el título, la fecha, el estado y la recomendación; el razonamiento y las opciones completas están en .pandacorp/inbox/decisions.md del proyecto.
- [dlg p] Las decisiones se responden en el proyecto con:
- [dlg code] /pandacorp: decide
- [dlg @aria-label] Copiar /pandacorp:decide
- [dlg a] Abrir Funko Tracker

### `project-spec`

- [span] PS
- [span] 0/35 WO · 0%
- [@aria-label] Fase: Arquitectura
- [@data-tip] 4. Arquitectura · fase actual
- [span] Arquitectura: fase actual
- [@data-tip] 5. Construcción · pendiente
- [span] Construcción: pendiente
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [@aria-label] Secciones de PandaSaga
- [button[tab]] Observabilidad 35
- [button[tab]] Cuentas 5
- [button[tab]] Documentos 66
- [span] Resumen del spec
- [span] fase · producto
- [span] ai
- [h2] PRD · qué y por qué
- [button] PRD completo
- [h2] Research · la evidencia
- [button] Research completo
- [h2] FRDs · las piezas del v1 (7)
- [span] UI
- [span] 13 work orders planificadas (×6 of the same pattern)
- [span] Infra
- [@title] Tomado del frd.md (ui:); el spec todavía no lista este FRD

### `project-spec-empty`

- [span] MC
- [span] 109/110 WO · 99%
- [@aria-label] Fase: Construcción
- [@data-tip] 4. Arquitectura · completada
- [span] Arquitectura: completada
- [@data-tip] 5. Construcción · fase actual
- [span] Construcción: fase actual
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [@aria-label] Secciones de Mission Control
- [button[tab]] Observabilidad 110
- [button[tab]] Cambios 3
- [button[tab]] Documentos 175
- [b] El spec todavía no está publicado.
- [p] Su PRD y sus FRDs reales siguen disponibles.
- [button] PRD completo
- [h2] FRDs · las piezas del v1 (26)
- [span] UI
- [@title] Tomado del frd.md (ui:); el spec todavía no lista este FRD
- [@aria-label] 10 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×10 of the same pattern)
- [button] Party

### `project-architecture`

- [span] 0/35 WO · 0%
- [@aria-label] Fase: Arquitectura
- [@data-tip] 4. Arquitectura · fase actual
- [span] Arquitectura: fase actual
- [@data-tip] 5. Construcción · pendiente
- [span] Construcción: pendiente
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [@aria-label] Secciones de PandaSaga
- [button[tab]] Observabilidad 35
- [button[tab]] Cuentas 5
- [button[tab]] Documentos 66
- [span] fase · Arquitectura
- [h2] Stack y tecnologías
- [p] Qué tecnologías se usarán para construir la aplicación y por qué se eligieron.
- [th] Capa
- [td] Datos
- [td] ORM
- [td] Caché
- [td] Mapa
- [h2] Integraciones y operación
- [p] Cómo se conectan y operan las piezas del sistema: flujos, responsabilidades y límites.
- [b] Web
- [span] Modelo diseñado, no verificado contra una base viva
- [span] 26 entidades · 36 relaciones · docs/product/data-model.json
- [@aria-label] Buscar entidad o atributo
- [@placeholder] Buscar entidad o atributo…
- [@aria-label] Vista del modelo
- [button] Diagrama
- [@aria-label] Controles del diagrama
- [@aria-label] Alejar
- [@aria-label] Acercar
- [@aria-label] Ajustar a la vista
- [@aria-label] Restablecer
- [@aria-label] Pantalla completa
- [@aria-label] Diagrama de entidades. Arrastra o usa las barras para desplazarte; el esquema textual tiene la misma información.
- [button] User 4
- [span] idPK
- [span] uuid
- [span] emailUQ
- [span] text?
- [button] Guest context 4
- [span] deviceKeyUQ
- [span] mergedIntoUserIdFK
- [span] uuid?
- [button] Work 4
- [span] slugUQ
- [span] title
- [button] Medium 3
- [span] codeUQ
- [button] Release 5
- [span] workIdFK
- [span] mediumIdFK
- [button] Chapter 4
- [span] releaseIdFK
- [button] Reading progress 6
- [span] userIdFK
- [span] guestIdFK
- [span] chapterIdFK
- [button] Character 4
- [span] firstChapterIdFK
- [button] Place 4
- [button] Faction 4
- [button] Encyclopedia entry 4
- [span] kind
- [button] Entry revision 4
- [span] entryIdFK
- [span] visibleFromChapterIdFK
- [span] body
- [button] Connection 6
- [span] fromEntryIdFK
- [span] toEntryIdFK
- [span] typeIdFK
- [span] revealedAtChapterIdFK
- [button] Connection type 2
- [span] labelUQ
- [button] Recap 4
- [span] upToChapterIdFK
- [button] Recap section 4
- [span] recapIdFK
- [button] Chapter summary 2
- [span] chapterIdPKFK
- [button] Catalog bundle 4
- [span] timestamp?
- [button] Publish run 4
- [span] bundleIdFK
- [button] Image asset 4
- [span] url
- [button] Ingestion source 3
- [span] nameUQ
- … 58 more patterns omitted (same kinds as above).

### `project-changes`

- [span] PV
- [span] 19/25 WO · 76%
- [@aria-label] Fase: Lanzamiento
- [@data-tip] 4. Arquitectura · completada
- [span] Arquitectura: completada
- [@data-tip] 5. Construcción · completada
- [span] Construcción: completada
- [@data-tip] 6. Lanzamiento · fase actual
- [span] Lanzamiento: fase actual
- [@aria-label] Secciones de PersonalPage v2
- [button[tab]] Observabilidad 25
- [button[tab]] Cuentas 3
- [button[tab]] Cambios 6
- [button[tab]] Documentos 53
- [p] 1 archivo de cambios no se pudo interpretar. No se cuentan como cola vacía.
- [span] Listos para construir
- [span] Cerrando
- [h2] En construcción 3
- [small] blog-writer-v2-series · 19 oct. 2026 · frd-08-blog-writer-skill
- [small] case-study-metrics-strip · 18 oct. 2026 · frd-03-case-studies
- [small] now-page-auto-date · 16 oct. 2026 · frd-04-about-now
- [h2] Borradores 3
- [small] reading-list · 2 oct. 2026 · frd-05-blog-mdx
- [small] research-mode-for-posts · 14 oct. 2026 · frd-08-blog-writer-skill
- [small] talks-page · 9 oct. 2026
- [h2] Historial 11
- [small] case-gallery-captions · 21 ago. 2026 · frd-03-case-studies
- [small] contact-success-focus · 10 jul. 2026 · frd-07-contact
- [span] Bug
- [small] dark-theme-code-blocks · 15 jul. 2026 · frd-01-site-shell-i18n
- [small] footer-language-switch · 18 jul. 2026 · frd-01-site-shell-i18n
- [small] home-proof-order · 10 set. 2026 · frd-02-home-positioning
- [small] home-tagline-copy · 10 set. 2026 · frd-02-home-positioning
- [small] og-image-long-titles · 8 jul. 2026 · frd-06-seo-structured-data
- [small] post-reading-time-locale · 2 ago. 2026 · frd-05-blog-mdx
- [small] projects-filter-chips · 25 jul. 2026 · frd-03-case-studies
- [small] rss-full-content · 20 jul. 2026 · frd-05-blog-mdx
- [small] skill-voice-guide · 14 ago. 2026 · frd-08-blog-writer-skill
- [h2] Pedir un cambio
- [p] La puerta única para features, ajustes y bugs. El cambio queda en la cola hasta el siguiente punto seguro del build.
- [code] /pandacorp: change
- [@aria-label] Copiar /pandacorp:change

### `project-change-dialog`

- [dlg p] Cambio · blog-writer-v2-series
- [dlg p] Construir solo este cambio:
- [dlg code] /pandacorp: implement change: blog-writer-v2-series
- [dlg @aria-label] Copiar /pandacorp:implement change:blog-writer-v2-series

### `project-change-discard`

- [dlg p] Confirmar
- [dlg h2] Descartar cambio
- [dlg p] El cambio saldrá de la cola y quedará en el historial como descartado.
- [dlg label] Motivo (opcional)
- [dlg @placeholder] Por qué…
- [dlg p] Esta maqueta no modifica archivos de la fábrica. En la app real esta acción escribe solo el campo acotado de su tarjeta.
- [dlg button] Cancelar

### `project-documents`

- [@aria-label] Fase: Arquitectura
- [@data-tip] 4. Arquitectura · fase actual
- [@data-tip] 5. Construcción · pendiente
- [@data-tip] 6. Lanzamiento · pendiente
- [@aria-label] Secciones de PandaSaga
- [button[tab]] Observabilidad 35
- [button[tab]] Cuentas 5
- [button[tab]] Documentos 66
- [@aria-label] Filtrar por tipo de documento
- [button] Todos 66
- [button] Work order 35
- [button] Decisión técnica 8
- [button] Arquitectura 8
- [button] Contrato funcional 7
- [button] Diseño 3
- [button] Referencia 2
- [button] Producto 1
- [button] Investigación 1
- [button] Revisión 1
- [@aria-label] Copiar el documento
- [h2] Users
- [h2] Scope
- [@aria-label] Documentos del proyecto
- [@aria-label] Buscar documento
- [@placeholder] Buscar documento…

### `project-documents-search`

- (no strings beyond the shared chrome and the first state of the same route)

### `project-documents-index-open`

- (no strings beyond the shared chrome and the first state of the same route)

### `project-tab-not-found`

- [span] MC
- [span] 109/110 WO · 99%
- [@aria-label] Fase: Construcción
- [@data-tip] 4. Arquitectura · completada
- [span] Arquitectura: completada
- [@data-tip] 5. Construcción · fase actual
- [span] Construcción: fase actual
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [strong] Esta sección no existe
- [span] «Inexistente» no es una sección del proyecto.
- [a] Ir al resumen

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- REQ-04-002 / REQ-04-012 tab labels "Work orders", "Party" | "Observabilidad" (work orders section) and no Party tab; "Mission Objectives" | "Avance por FRD".
- AC-04-013.4 "Todavía no hay una especificación publicada." | "El spec todavía no está publicado." (project-spec-empty).
- Changes toggles "Ver hechos (N)" / "Ver descartados (N)" | "Historial 11" (collapsed card).
- Changes groups "Listos (ready)", "Borradores (draft)", "En construcción", "Cerrando" | "Listos para construir", "Borradores", "En construcción", "Cerrando", "Historial".
- "Descartar" inline confirm "¿Seguro? Sí / No" | dialog "Descartar cambio" with Cancelar / Descartar.
- "Comandos" tab title in FRD "Commands tab" | "Comandos".

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Tab set and order: 10 tabs (FRD) vs 8 (prototype); Party and Work orders are not tabs any more. e2e specs expecting 9/10 tabs are a known pending fix (decision 2026-10-21: v2 includes fixing them).
- The snapshot panel (REQ-04-005), the Obsoleta tag, the separate hecho/descartado toggles and the inline discard confirmation are FRD-wants/prototype-lacks (Group B candidates); the prototype's merged "Historial" and the dialog confirmation are prototype-has/FRD-differs (Group A candidates).
- The bare `/pandacorp:decide` in the Resumen decision dialog vs the scoped `/pandacorp:decide <id>` the AC demands.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- 2026-10-21: targets desktop + tablet + phone (the tab strip scrolls with arrows; the document index folds behind "Abrir índice" below 900 px; cards replace tables below 1024 px).
- 2026-10-21 scope: deploy target and objectives count in the Resumen stay out of v2; the e2e specs expecting 9 tabs and the PersonalPage v2 RESOLVED decision counted as pending are fixed in v2 (the prototype already flags a resolved decision as "ya resuelta en el archivo").
- Iteration 19: Resumen rebuilt for a manager; Observabilidad = the work-order section (Por FRD / Tablero / Dependencias); Cuentas after Arquitectura; Party merged into the Resumen as La Fragua.
- Iteration 12: secondary indexes (documents) sit on the RIGHT of the reader.
- Iteration 28: shared card header, section heading, "Mostrar más" bar.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
