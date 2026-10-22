# Context pack · FRD-22 · Factory backlog surface (Propuestas · Backlog tab)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-22 copy, S2.1 builds, S2.2 amendments, S2.3-22 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-22-factory-backlog/frd.md` (id FRD-22, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 6 under `states["frd-22-factory-backlog"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 23 AC lines: 5 drawn · 10 partially drawn · 4 not drawn · 4 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-22#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-22-001.1 · behaviour only · `backlog`

> - **AC-22-001.1** — Mission Control SHALL read every `factory/backlog/BL-*.md` item (skipping `README.md` and `_item-template.md`) into a typed model (`id`, `type` bug|change, `area`, `title`, `status` open|doing|done|discarded, `severity`, `source`, `closes`, `links`, `opened`, `closed`).

**Prototype:** Reader into a typed model: data. The item rows expose id, type (Bug / Mejora), area (plain names such as "Motor de construcción"), title, priority and date.

### AC-22-001.2 · partial · `backlog`

> - **AC-22-001.2** — The Backlog panel SHALL group items by `status`; **Abiertos** (open) and **En curso** (doing) render by default, in that order, each a section with its count, its items ordered by priority then id (see REQ-22-008). **Hechos** (done) and **Descartados** (discarded) do NOT render by default — see REQ-22-006, REQ-22-007. An empty backlog SHALL show an explicit empty state.

**Prototype:** Groups "En curso 1" then "Abiertos 10" (P0 URGENTE / P1 IMPORTANTE / P2 CUANDO HAYA TIEMPO sub-groups) then a collapsed "Hechos y descartados 17"; the AC lists Abiertos before En curso and keeps done/discarded hidden by default (done: collapsed). Empty state: "Nada abierto con este filtro." (filtered case).

### AC-22-001.3 · partial · `backlog`

> - **AC-22-001.3** — Each item SHALL render as a card visually consistent with the memory ProposalCard (DR-062): mono `id`, a `type · area` chip, a severity chip (text + tone, never colour alone), the title, and an evidence line (`source` + `links`).

**Prototype:** Row: mono id, title, "area · date", outline chip Bug/Mejora, priority chip P0/P1/P2. No `source` + `links` evidence line.

### AC-22-002.1 · partial · `backlog`, `proposals-summary`

> - **AC-22-002.1** — The Propuestas page SHALL present two sub-tabs, **Memoria** and **Backlog**, using the shared `Tabs`/`SubTabs` primitive (DR-062) — no bespoke switcher.

**Prototype:** Tabs on Propuestas are Resumen · Memoria (16) · Backlog (11): three, not two.

### AC-22-002.2 · not drawn · `backlog`

> - **AC-22-002.2** — **Memoria** SHALL be active by default and SHALL contain the existing self-learning surface (memory-health panel + the four proposal streams + the promotions queue, FRD-17), unchanged.

**Prototype:** The default tab is Resumen ("Qué te toca, en orden"), not Memoria.

### AC-22-002.3 · drawn · `backlog`

> - **AC-22-002.3** — The **Backlog** tab SHALL show a count badge of `open` items when greater than zero.

**Prototype:** Backlog tab carries the open count badge (11).

### AC-22-002.4 · behaviour only · `backlog`

> - **AC-22-002.4** — Both panels SHALL stay mounted (toggled with `hidden`) so the memory streams' local dismiss state survives a tab switch, and SHALL carry `data-volatile` (DR-088) so the visual baseline masks their live, length-varying data.

**Prototype:** Mounted-panel behaviour; not a state.

### AC-22-003.1 · partial · `backlog`

> - **AC-22-003.1** — The Backlog panel SHALL show a short note explaining these are actionable items worked by asking an agent (e.g. «implementa BL-0007»), and that Mission Control only displays and (per REQ-22-007) lets the owner discard them — it never creates, closes or edits the content of a `factory/backlog/` item (consistent with the FRD-17 read-only boundary, minus the one bounded discard write).

**Prototype:** "Cómo avanzar" card (Todo de una vez / Uno por uno, "Se corren en la carpeta de la fábrica.") replaces the how-to-work note; the sentence about asking an agent «implementa BL-0007» and the read-only/discard-only statement are NOT drawn.

### AC-22-004.1 · behaviour only · `backlog`

> - **AC-22-004.1** — The backlog reader SHALL distinguish "the backlog is empty" from "an item could not be interpreted": a malformed `BL-*.md` (unparseable YAML, missing a required field, or an out-of-range enum) SHALL be surfaced in an `errors` collection, never silently dropped. A missing `factory/backlog/` directory is a legitimately-empty backlog, not an error.

**Prototype:** Fail-loud reader: data.

### AC-22-004.2 · not drawn · `backlog`

> - **AC-22-004.2** — WHEN the reader reports one or more errors, the Backlog panel SHALL render an error banner (`role="alert"`) naming the offending file(s) and reason(s), while still rendering the items it could parse.

**Prototype:** The coral error notice listing offending files exists in code (`b.errors`) but the fixture has no errors, so no state draws it.

### AC-22-004.3 · not drawn · `backlog`

> - **AC-22-004.3** — **Duplicate ids are a data-integrity defect, surfaced fail-loud (BL-0013).** WHEN two different `BL-*.md` files declare the same `id`, the reader SHALL keep only the first occurrence in `items` (so the panel never renders duplicate React keys or a misleading second copy) and surface each subsequent collision in `errors[]` (`duplicate id <ID> (already defined in <first-file>)`). The invariant "the rendered backlog has unique ids" is enforced at the read boundary, not assumed. Added 2026-07-01 after a real collision (two files reusing BL-0010/BL-0011) intermittently red-locked the /proposals smoke gate with a duplicate-key console error.

**Prototype:** Duplicate-id collision: same (code path only).

### AC-22-005.1 · drawn · `backlog-item-dialog`

> - **AC-22-005.1** — Each backlog card SHALL be an accessible control (a `<button>`, keyboard-operable, with an `aria-label` naming the item) that opens a **detail modal** for that item. The detail opens in the shared `Modal` primitive (focus-trapped, Escape-closes, backdrop-click-closes) — never an inline expand (the app's modal-for-detail rule).

**Prototype:** Each row is a button that opens a dialog (kicker "Backlog · P1", title "BL-0003 · …"); Escape and close are native.

### AC-22-005.2 · partial · `backlog-item-dialog`

> - **AC-22-005.2** — The backlog reader SHALL expose each item's markdown **body** (everything after the frontmatter), and the detail SHALL render it as **titled, colour-coded sections** via the shared `SectionedMarkdown` primitive — each `## Heading` (Problem / Root cause / Fix plan / Tests / Done when / Out of scope) becomes a real section header (icon + coloured label) with its content rendered as markdown (lists, code, tables), NOT one wall of text or a raw string. This is the same `SectionedMarkdown` primitive the memory-lesson detail uses (it auto-detects `## Heading` vs `**Label:**` sections), so both detail modals share one look (DR-062).

**Prototype:** The body renders as markdown sections (e.g. "Proof"); colour-coded section headers with icons are not confirmed in the capture.

### AC-22-005.3 · drawn · `backlog-item-dialog`

> - **AC-22-005.3** — The detail SHALL show the item's metadata (id as the title, a `type` badge, and `type·area` / severity / status chips + source / links / dates) above the rendered body. Read-only: the detail has no write/close-item affordance (working an item is done by an agent, AC per Non-goals).

**Prototype:** Metadata chips (status "doing", priority) above the body; no write affordance except Descartar.

### AC-22-006.1 · partial · `backlog`, `backlog-history-open`

> - **AC-22-006.1** — GIVEN the backlog has any `done` items, a "Ver hechos (N)" toggle button SHALL render below the always-visible groups, naming the hidden count; the toggle SHALL be omitted entirely when there are zero `done` items.

**Prototype:** The history is one collapsed card "Hechos y descartados 17" opened with its header, not a "Ver hechos (N)" button.

### AC-22-006.2 · partial · `backlog-history-open`

> - **AC-22-006.2** — Clicking the toggle SHALL reveal the **Hechos** section (same card list as the other groups); the button label SHALL flip to "Ocultar hechos (N)". Clicking it again SHALL hide the section and flip the label back.

**Prototype:** Opening shows the list (15 at a time + "Mostrar 2 más · quedan 2"); the "Ocultar hechos (N)" label flip is not used.

### AC-22-006.3 · partial · `backlog-history-open`, `project-changes`

> - **AC-22-006.3** — This mirrors the same default-hide pattern used by the project-level Cambios tab (Mission Control FRD-04, REQ-04-009) — so the closed-item history of neither queue clutters its actionable view as it accumulates over months.

**Prototype:** Statement of parity with the Cambios tab: both end in a collapsed history card ("Hechos y descartados 17" here, "Historial 11" in Cambios); neither uses the "Ver hechos (N)" toggle wording.

### AC-22-007.1 · partial · `backlog-item-dialog`, `backlog-discard-confirm`

> - **AC-22-007.1** — WHEN a backlog item is `open` or `doing`, its detail modal SHALL offer a **"Descartar"** action (inline confirm, no nested modal) that rewrites `status: discarded` (ADR-0002 pattern) and closes the modal on success; never offered for `done` or already-`discarded` items.

**Prototype:** "Descartar" leads to a confirm dialog "Descartar del backlog" with "Motivo (opcional)" (placeholder "Por qué…") and Cancelar / Descartar that REPLACES the item dialog; the AC wants an inline confirm without a nested modal.

### AC-22-007.2 · behaviour only · `backlog-discard-confirm`

> - **AC-22-007.2** — Confirming SHALL call the `discardBacklogItem` write, which rewrites `status: discarded` and records `status_before_discard` (the prior value), preserving the body and every other frontmatter field verbatim (the same bounded-write pattern as `discardIdea`/`discardChange`) — never touching any sibling file.

**Prototype:** Bounded write is simulated ("Simulado: la maqueta no modifica el backlog").

### AC-22-007.3 · not drawn · `backlog`

> - **AC-22-007.3** — A discarded item moves out of the default Abiertos/En curso view into a new **Descartados** group, hidden by default behind its own "Ver descartados (N)" toggle — the same default-hide mechanism as REQ-22-006, mirroring the project-level Cambios tab (FRD-04, REQ-04-008/009).

**Prototype:** Discarded items fall into the same "Hechos y descartados" history; there is no separate Descartados group or toggle.

### AC-22-008.1 · drawn · `backlog`

> - **AC-22-008.1** — WITHIN each status group, items SHALL be ordered by `severity` first (P0 before P1 before P2), then by `id` ascending; an item with no `severity` SHALL sort after all severities. This is an invariant of the reader (`readBacklog`), not a per-view sort — every consumer of the read result sees the same order.

**Prototype:** P0 before P1 before P2, ids ascending inside each group.

### AC-22-009.1 · partial · `backlog`

> - **AC-22-009.1** — WHEN the backlog has at least one `open`/`doing` item, the Backlog panel SHALL render a `CmdRow` below the list with the generic command `/pandacorp:implement-backlog` (no id) — the same copy-to-clipboard affordance used elsewhere in Mission Control (never executed by the app itself, FRD-01's golden rule). Omitted entirely when there are zero actionable items.

**Prototype:** `/pandacorp:implement-backlog` (all at once) is drawn in the "Cómo avanzar" card ABOVE the list, together with the first-item command; not "below the list".

### AC-22-009.2 · drawn · `backlog-item-dialog`

> - **AC-22-009.2** — An `open`/`doing` item's detail modal SHALL render a `CmdRow` with the item's own targeted command, `/pandacorp:implement-backlog <id>`; a `done` or `discarded` item never shows it (the same actionable set REQ-22-007 uses for the discard action).

**Prototype:** The item dialog repeats the targeted command `/pandacorp:implement-backlog BL-0003` with copy.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `backlog` | `#propuestas?tab=Backlog` | (none) | full page | `AC-22-001.1` `AC-22-001.2` `AC-22-001.3` `AC-22-002.1` `AC-22-002.2` `AC-22-002.3` `AC-22-002.4` `AC-22-003.1` `AC-22-004.1` `AC-22-004.2` `AC-22-004.3` `AC-22-006.1` `AC-22-007.3` `AC-22-008.1` `AC-22-009.1` |
| `backlog-priority-filter` | `#propuestas?tab=Backlog` | click `[data-bfilter="pri"][data-val="p0"]` | full page | — |
| `backlog-area-filter` | `#propuestas?tab=Backlog` | click `.area-bar` | full page | — |
| `backlog-item-dialog` | `#propuestas?tab=Backlog` | click `[data-backlog]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `AC-22-005.1` `AC-22-005.2` `AC-22-005.3` `AC-22-007.1` `AC-22-009.2` |
| `backlog-discard-confirm` | `#propuestas?tab=Backlog` | click `[data-backlog]` → click `#dlg [data-action="discard-backlog"]` → wait for `dialog[open]` | capture viewport | `AC-22-007.1` `AC-22-007.2` |
| `backlog-history-open` | `#propuestas?tab=Backlog` | click `[role="tabpanel"] details.card > summary` | full page | `AC-22-006.1` `AC-22-006.2` `AC-22-006.3` |

States cited above that belong to another FRD folder (captured there, reused here): `proposals-summary`, `project-changes`.

**Not drawn (4)**: `AC-22-002.2`, `AC-22-004.2`, `AC-22-004.3`, `AC-22-007.3`.

**Partially drawn (10)**: `AC-22-001.2`, `AC-22-001.3`, `AC-22-002.1`, `AC-22-003.1`, `AC-22-005.2`, `AC-22-006.1`, `AC-22-006.2`, `AC-22-006.3`, `AC-22-007.1`, `AC-22-009.1`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `backlog`

- [span] Captura de la fábrica · 20 oct. 2026, 7:20 p. m.
- [p] Lo que la fábrica aprendió construyendo y lo que hay que arreglar en ella misma. Aquí ves qué te toca y qué comando correr.
- [@aria-label] Ver secciones anteriores
- [@aria-label] Ver más secciones
- [button[tab]] Memoria 16
- [button[tab]] Backlog 11
- [@aria-label] Filtrar por prioridad
- [small] arréglalo primero
- [small] pronto, de a uno
- [small] mejoras y detalles
- [h2] Por tema
- [p] Dónde se concentran los arreglos. Clic para filtrar.
- [@aria-label] Filtrar por tema
- [span] Motor de construcción
- [span] Controles automáticos
- [span] Plantillas de proyecto
- [h2] Cómo avanzar
- [b] Todo de una vez.
- [span] Lanza un agente por ítem (11 ítems): consume mucho y conviene solo con la cola corta.
- [@aria-label] Copiar /pandacorp:implement-backlog
- [b] Uno por uno.
- [span] Abre un ítem y copia su comando; empieza por los P0 y P1.
- [code] /pandacorp:implement-backlog BL-0001
- [@aria-label] Copiar /pandacorp:implement-backlog BL-0001
- [p] Se corren en la carpeta de la fábrica.
- [@aria-label] Tipo
- [button] Todo tipo
- [button] Bugs 5
- [button] Mejoras 6
- [span] 11 ítems
- [h2] En curso 1
- [small] Motor de construcción · 17 oct. 2026 (×2 of the same pattern)
- [h2] Abiertos 10
- [p] P0 · URGENTE 2
- [small] Controles automáticos · 10 oct. 2026 (×2 of the same pattern)
- [p] P1 · IMPORTANTE 4
- [small] Skills · 12 oct. 2026
- [small] Plantillas de proyecto · 11 oct. 2026
- [small] Mission Control · 9 oct. 2026
- [p] P2 · CUANDO HAYA TIEMPO 3
- [small] Estándares · 6 oct. 2026
- [small] Agentes · 5 oct. 2026
- [small] Plugin · 3 oct. 2026
- [h2] Hechos y descartados 17
- [small] Motor de construcción · 20 set. 2026 (×2 of the same pattern)
- [small] Plantillas de proyecto · 18 set. 2026
- [small] Skills · 16 set. 2026
- [small] Mission Control · 9 set. 2026
- [small] Estándares · 7 set. 2026
- [small] Controles automáticos · 5 set. 2026 (×2 of the same pattern)
- [small] Agentes · 3 set. 2026
- [small] Motor de construcción · 30 ago. 2026 (×2 of the same pattern)
- [small] Plantillas de proyecto · 26 ago. 2026
- [small] Skills · 22 ago. 2026
- [small] Controles automáticos · 19 ago. 2026
- [small] Estándares · 15 ago. 2026
- [button] Mostrar 2 más · quedan 2

### `backlog-priority-filter`

- [span] P1 · importante
- [span] P2 · cuando haya tiempo
- [button] Quitar filtros
- [span] 2 ítems
- [h2] Abiertos 2
- [h2] Hechos y descartados 2

### `backlog-area-filter`

- [span] P1 · importante
- [span] P2 · cuando haya tiempo
- [button] Quitar filtros
- [span] 3 ítems
- [span] P1 (×2 of the same pattern)
- [h2] Abiertos 2
- [p] P0 · URGENTE 1
- [h2] Hechos y descartados 4

### `backlog-item-dialog`

- [dlg p] Backlog · P1
- [dlg h2] BL-0003 · Cross-FRD dependencies declared in prose are ignored
- [dlg span] doing
- [dlg h2] Proof
- [dlg code] /pandacorp:implement-backlog BL-0003
- [dlg @aria-label] Copiar /pandacorp:implement-backlog BL-0003

### `backlog-discard-confirm`

- [dlg p] Confirmar
- [dlg h2] Descartar del backlog
- [dlg p] El ítem pasará a descartados con el motivo indicado.
- [dlg label] Motivo (opcional)
- [dlg @placeholder] Por qué…
- [dlg p] Esta maqueta no modifica archivos de la fábrica. En la app real esta acción escribe solo el campo acotado de su tarjeta.
- [dlg button] Cancelar

### `backlog-history-open`

- (no strings beyond the shared chrome and the first state of the same route)

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Abiertos / En curso / Hechos / Descartados" | "Abiertos 10 / En curso 1 / Hechos y descartados 17".
- "Ver hechos (N)" / "Ocultar hechos (N)" / "Ver descartados (N)" | none; collapsed card header.
- "type·area" chip | separate chips "Bug" / "Mejora" and the area as plain text; priority "P0 · URGENTE", "P1 · IMPORTANTE", "P2 · CUANDO HAYA TIEMPO".
- Area codes (build-engine, plugin-skill, templates, hooks…) | plain names "Motor de construcción", "Skills", "Plantillas de proyecto", "Controles automáticos", "Estándares", "Agentes", "Plugin".
- Item dialog fields shown in English ("Proof") come from the item file (content).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- FRD-22 describes two sub-tabs and a plain list; the approved page is a three-tab Propuestas with priority tiles, "Por tema" bars and "Cómo avanzar" (iteration 15-16), all of which are Group A for the FRD (prototype has, FRD lacks).
- Inline confirm vs dialog confirm; separate Hechos/Descartados toggles vs merged history; evidence line (`source` + `links`) missing.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 15 (owner): Backlog with P0/P1/P2 tiles that filter, a by-topic bar list in plain names that also filters (areas sharing a name merged), a "Cómo avanzar" card (one at a time, recommended, or the whole queue with its cost warning), open items grouped by priority, history collapsed.
- Iteration 16: "Cómo avanzar" lists the whole-queue command first.
- Iteration 26: backlog lists page 20/10 at a time; filter chips become one swipeable strip on phones.
- 2026-10-21 language: item titles/bodies keep their source language (English).

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
