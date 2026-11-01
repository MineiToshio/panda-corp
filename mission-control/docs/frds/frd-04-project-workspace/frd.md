---
id: FRD-04
type: frd
title: FRD-04 — Project workspace
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-04-project-workspace/mocks/project-workspace.html
last_updated: '2026-10-22'
floor: false
---
# FRD-04 — Project workspace

On opening a project from the Portafolio, its workspace: a **tabs-first** surface. The full project hero and the overview live in the Resumen tab; every other tab opens under a one-line header. There are eight tabs and no Party tab.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle. The workspace has eight tabs, La Fragua is the main scene of the Resumen, and Work orders live inside Observabilidad (contradiction C-04, C-05 of `docs/design/freeze/reconciliation.md`). Items the owner left out of v2 stay in place, prefixed **Out of v2**. Prototype-drawn behaviours are REQ-04-014 (AC-04-014.1 to AC-04-014.8).

## Acceptance criteria (EARS)
- **REQ-04-001** — The workspace SHALL be **tabs-first**: a header at the top (the full hero on Resumen, a one-line compact header on every other tab, AC-04-014.1), the **tab bar** directly below it (reachable without scrolling), and the selected tab's content beneath. The overview content lives INSIDE the Resumen tab (the default), not above the tabs.
- **REQ-04-002** — The workspace SHALL offer **eight** tabs, in this order: **Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos**. There is no Party tab (La Fragua is the main scene of the Resumen, FRD-06) and no separate Work orders tab (work orders are the views of Observabilidad, FRD-05). Cuentas follows Arquitectura (FRD-26).
- **REQ-04-003** — The one-line compact header shown on every tab other than Resumen SHALL show initials, name, phase, "n/m WO · pct", a compact stepper and "Cambiar proyecto" (AC-04-014.1). The work-order progress ("Mission Objectives" in earlier versions) is the "Avance por FRD" list inside the Resumen (AC-04-014.4).
- **REQ-04-004** — The **Resumen** tab SHALL show, in this order: the upgrade notice when needed, the right-aligned "Siguiente paso" command (AC-04-014.3), the La Fragua scene (FRD-06), and the key tiles, "Avance por FRD" (AC-04-014.4), the project's **decision points** (highlighted, with a count; AC-04-014.5, AC-04-014.6) and "Últimos avances" (AC-04-014.7), read from `.pandacorp/inbox/decisions.md`, `.pandacorp/comms/progress.md` and the work-order and change frontmatter.
- WHEN there are pending decisions, it SHALL highlight them, EACH labeled with its stable `id` (`<date>-<n>` / `legacy-<n>`, derived from its heading — never invented, never reused) so the owner can reference one specific decision, plus an "hace N días" age hint derived from the heading's date (omitted for a legacy/undated heading); the **per-card command SHALL be `/pandacorp:decide <id>`** — scoped to that decision, not the bare un-scoped form (which would walk every pending one), including inside the decision dialog. WHERE a pending decision carries an AI recommendation, the Resumen SHALL render the recommendation TEXT as context only — no one-click "approve" affordance (removed, owner decision 2026-06-30: answering must go through the real `/pandacorp:decide <id>` conversation, which shows full context before recording an answer).
- A decision marked **obsolete** (status `OBSOLETO`/`SUPERSEDIDO` in `decisions.md`, distinct from `RESUELTO`) SHALL NEVER be counted as pending. **Out of v2 (owner decision 2026-10-21):** the visible "Obsoleta" tag on such a decision.
- **REQ-04-005** — The **Resumen** tab SHALL show the **snapshot panel**, below La Fragua, WHILE a build is running and a last-green build commit exists: the last commit that passed all gates (with its FRD label and short SHA) and a copyable **`git worktree add /Users/Shared/review-worktrees/<project> <sha>`** command, so the owner can test that safe commit in a separate worktree without stopping the running build (state `project-snapshot`, owner decision at M1 2026-10-22; FRD-14 owns the panel's detail).
- **REQ-04-006** — (amended 2026-10-22, gate fix; the drawn Órbita `commandsView` binds) The **Comandos** tab SHALL be four cards, in two columns from 1024 px (left «Siguiente paso» then «Modo de construcción»; right «Construir un objetivo concreto» then «Cambios y decisiones»), one column below. «Siguiente paso» SHALL show the project's next step followed by the phase's commands, deduped by command, each with its «when» line, or the sentence «No hay comandos de fase para este proyecto.» when there are none. «Modo de construcción» hosts the build mode picker ([FRD-11](../frd-11-build-modes/frd.md)). «Construir un objetivo concreto» SHALL be drawn in EVERY phase (it is not gated by phase): its select offers each FRD, each work order not yet verified and each queued change (status `ready`, `draft` or `building`), and scopes `/pandacorp:implement` to the pick (FRD-11 AC-11-005.2). «Cambios y decisiones» SHALL show `/pandacorp:change`, `/pandacorp:decide` and `/pandacorp:new-version` and the copy-only note, in every phase. The v1 phase-gated `implement <frd>` / `implement change:<slug>` rows and the v1 CommandsBox (release / iterate by phase) are removed.
- The **Cambios** tab SHALL list every item in the project's change queue (`.pandacorp/inbox/changes/*.md`, plus archived `done/*.md`). BY DEFAULT it SHALL show the actionable groups **Listos para construir** and **Borradores**, plus the always-visible **En construcción** and **Cerrando** groups (REQ-04-010); **Hechos (done)** and **Descartados (discarded)** SHALL sit together in ONE collapsed card, **"Historial N"** (N = their combined count), so the queue's history doesn't clutter the actionable view as a project ages over months. WHEN the reader cannot interpret one or more files (invalid/missing `type` or `status`, or a body with no H1 title), it SHALL surface a fail-loud error banner naming them — never silently render an empty-looking queue (DR-078). Clicking a card SHALL open a detail dialog showing its type, urgency (when `expedite`), status, date, affected FRD, dependencies, a warning when it `rebuilds_verified` (an expedite change with dependencies that reopens verified work; state `project-change-rebuilds`, M1 2026-10-22), the body rendered as titled colour-coded sections, and a ready-to-copy **`/pandacorp:implement change:<id>`** command scoped to that specific item (the existing targeted-build mechanism from [FRD-11](../frd-11-build-modes/frd.md), pointed at a concrete id instead of the `<slug>` placeholder).
- WHEN the item shown in the Cambios detail dialog is **Listo or Borrador**, the dialog SHALL offer a **"Descartar"** action (never shown for a Hecho or already-Descartado item). Activating it SHALL replace the detail with a confirmation dialog "Descartar cambio" that has an optional "Motivo" field and the buttons "Cancelar" / "Descartar" (never a second modal nested inside the detail dialog already showing, and no inline "¿Seguro? Sí / No" swap). Confirming it SHALL rewrite `status: discarded` in the item's frontmatter (preserving the body and every other field verbatim, and recording `status_before_discard` for a future restore) and, when a Motivo was typed, SHALL record it as `discard_reason` [ASSUMPTION: the same field the idea-card discard uses (FRD-02 REQ-02-008); the prototype dialog only draws the optional field — source: reconciliation C-05] — one of Mission Control's small, bounded set of human-triggered writes (architecture §1/§7, the same pattern as the idea-card discard/restore write, [ADR-0002](../../adr/ADR-0002-restore-second-write.md)). On success the dialog SHALL close and the discarded item SHALL disappear from the default view (it now only shows inside "Historial N").
- **REQ-04-010** — The change-queue `status` enum the reader accepts SHALL be `ready | draft | building | closing | done | discarded` (DR-069 §7): `building` and `closing` are ENGINE-managed transient states the owner never writes — the build stamps `building` while a change's FRDs are in flight (so the safe-point drain never re-drains it), and `/pandacorp:sync`'s close-out mode stamps `closing` (plugin 9.104.0) together with `implemented_sha`/`closing_at` while it batch-archives an already-implemented card. WHEN an item's status is `building` or `closing`, the Cambios tab SHALL render it in its own always-visible group ("En construcción" / "Cerrando" — never behind the Historial card, unlike Hechos/Descartados), and the detail dialog SHALL show the status as a labelled chip (never color alone); it SHALL NOT offer the "Descartar" action (same as Hecho/Descartado) and SHALL NOT count toward any pending-items badge (that counts only `ready`/`draft`, DR-092/DR-115). **Out of v2 (owner decision 2026-10-21):** showing the `implemented_sha`/`closing_at` evidence in the detail dialog.
- **REQ-04-011** — Each Cambios-tab card SHALL show its date as an absolute Spanish date (e.g. "19 oct. 2026") instead of the raw ISO date, keeping the raw date as a tooltip; an unparseable date SHALL be shown raw in the same slot, never hidden (WO-04-008).
- The **Documentos** tab SHALL allow navigating and reading the project's documents, rendered at the **full width** of the reader pane (AC-04-014.8). Every navigation link — both the document index AND links found inside a document — SHALL preserve the workspace context (stay on the Documentos tab, same project), so selecting a document never bounces back to the Resumen tab. A link inside a document to another document the reader surfaces SHALL open it in the **same reader**; an off-app URL SHALL open in a new tab; a relative link to a document the reader does not surface SHALL render as plain text (never a broken link).
- La Fragua is the main scene of the Resumen and is specified in [FRD-06](../frd-06-party/frd.md); work orders are the views of **Observabilidad** ([FRD-05](../frd-05-work-orders/frd.md)); the dependency views of Observabilidad are in [FRD-12](../frd-12-observability-dataviz/frd.md).

### REQ-04-014 — Workspace header, Resumen and Documentos (added 2026-10-22, design freeze)

- **AC-04-014.1** — THE workspace SHALL show the full project hero on Resumen only, and on every other tab a one-line header (initials, name, phase, "n/m WO · pct", a compact stepper, "Cambiar proyecto").
- **AC-04-014.2** — EACH workspace tab with countable content SHALL show its count as a badge on the tab.
- **AC-04-014.3** — THE Resumen SHALL show four key tiles (avance, falta, cambios abiertos, último movimiento) and the next step with its copyable command ("Siguiente paso").
- **AC-04-014.4** — THE Resumen SHALL list each FRD in "Avance por FRD" with a stacked work-order state bar and n/m, with unfinished FRDs first.
- **AC-04-014.5** — THE Resumen SHALL list the project's decisions with a "Resuelta" or "Pendiente" chip, SHALL open each one in a decision dialog (the recommendation as text), and SHALL flag a pending entry whose file already records a resolution as "ya resuelta en el archivo".
- **AC-04-014.6** — THE Resumen SHALL show the project's own "Tu turno" items, and SHALL place them first when the layout is a single column (below 1024 px).
- **AC-04-014.7** — THE Resumen SHALL build "Últimos avances" only from verified work orders and filed or started changes, each line with an icon, a status label and a date, and SHALL keep the raw engine log collapsed as "Bitácora técnica del motor".
- **AC-04-014.8** — THE Documentos tab SHALL order its index by purpose, filter it by document type (chips with counts) and by search, render the open document as typed paper (type chip, path, copy), and SHALL place the index to the RIGHT of the reader, folded behind the button "Elegir documento · N" (N = the number of documents) below 900 px.

**Worked example (AC-04-014.5).** `decisions.md` still lists "2026-10-15-1" under its pending heading, but the entry itself already records a resolution. The Resumen shows that decision as "Resuelta" with the note "ya resuelta en el archivo", and it is not counted among the pending decisions (the `readDecisions` fix of the 2026-10-21 scope decision).

## Shared Architecture (extension, 2026-10-16)

- **AC-04-012.1** — (REQ-04-012; amended 2026-10-22, v2 plan: split into a plain AC bullet) WHEN a project workspace is opened from the Portafolio or `/projects/<slug>`, THE shell SHALL offer exactly eight tabs in this order: **Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos**, defaulting to Resumen when no tab is specified.
- **AC-04-012.2** — WHEN the Arquitectura tab is selected, THE workspace SHALL render the complete shared `ArchitectureDigest` and the shared logical-model reader/viewer from FRD-02 REQ-02-013/015, including stack, **Integraciones y operación**, **Modelo de datos**, environment-variable names (in that order), ADRs, implementation plan and per-FRD cards; it SHALL NOT substitute a database-only view.
- **AC-04-012.3** — WHEN navigating with `/portfolio?project=<slug>&tab=architecture` or `/projects/<slug>?tab=architecture`, THE workspace SHALL preserve the selected project and Arquitectura tab, including implementation and released projects.
- **AC-04-012.4** — WHEN architecture narrative or model input is missing/invalid/explicitly none, THE workspace SHALL show the same distinct partial/error states as the board (including the single explicit error notice for a malformed, oversized, unsupported or unreadable model, FRD-02 AC-02-015.7) and SHALL keep the Arquitectura tab reachable without fabricated database data.
- **AC-04-012.5** — WHEN the owner changes selected project, THE Arquitectura view SHALL reset project-local diagram/search/selection state and render only the newly selected project's artifacts.

## Shared Spec (extension, 2026-10-16)

- **AC-04-013.1** — (REQ-04-013; amended 2026-10-22, v2 plan: split into a plain AC bullet) WHEN a project workspace is opened from the Portafolio or a direct project page, THE shell SHALL offer **Spec** immediately after Resumen and before Observabilidad, with the eight-tab order specified by REQ-04-002 and Resumen still the default.
- **AC-04-013.2** — WHEN `tab=spec` is selected and a nonempty digest is available, THE workspace SHALL reuse the board's complete `SpecDigest` (FRD-02 REQ-02-011), `readSpecDigest`, and live `countFrdFolders(listProjectDocs())`; PRD, research, FRD cards and FRD modal content SHALL NOT be forked or replaced by placeholder prose. Closing the modal SHALL restore keyboard focus to its connected opener.
- **AC-04-013.3** — WHEN the owner selects Spec, follows its deep link or opens a known document link in the digest, THE system SHALL retain the selected project and route context; known document links SHALL open that project's Documentos reader, external links in a new tab and unknown relative targets as plain text.
- **AC-04-013.4** — WHEN no nonempty spec digest is available, THE workspace SHALL retain the tab and state **"El spec todavía no está publicado."** with the second line **"Su PRD y sus FRDs reales siguen disponibles."**, without borrowing another project's digest or inventing specification content.
- **AC-04-013.5** — WHEN the selected project changes, THE Spec view SHALL reset project-local FRD/modal state and read only the new project's digest and real FRD count. Full-bleed digest bands SHALL remain contained in the embedded panel on desktop and mobile.

## Edge cases
- Pending decision already answered in its own file → flagged "ya resuelta en el archivo" and not counted as pending (AC-04-014.5).
- Obsolete decision → never counted as pending (U2 above).
- Change file the reader cannot interpret → fail-loud banner naming it (Cambios bullet); unparseable date → raw text in the date slot (REQ-04-011).
- Project without a spec digest → "El spec todavía no está publicado." (AC-04-013.4); without architecture input → the explicit missing/none/error states (AC-04-012.4).
- Narrow viewport → Tu turno first (AC-04-014.6); Documentos index folded behind "Elegir documento · N" below 900 px (AC-04-014.8).

## Does NOT include
- No Party tab and no separate Work orders tab: both were absorbed (La Fragua into the Resumen, work orders into Observabilidad).
- No one-click approval of a decision's recommendation; answering goes through `/pandacorp:decide <id>`.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.

## Per-file read failures (2026-10-31)

A broken work-order file SHALL be named with its reason while valid siblings remain visible.
The shared strict source SHALL never infer state for the broken file. Summary's FRD progress and
recent advances SHALL retain valid data with per-file notices, including malformed archived changes.
An unreadable discovery directory remains a whole-source failure. Global progress SHALL state the
number of unread files instead of claiming an exact project total or percentage.

### Visual close-out clarification (2026-10-31, lane H)

The approved prototype supersedes the earlier forge-first sequence: upgrade notice, right-aligned next step, La Fragua, snapshot, summary columns. On phones, the hero keeps the six phase segments and accessible full phase names but hides the visual phase labels. The engine log stays collapsed with its hint in the summary header; the forge eyebrow is uppercase. Avance por FRD keeps its conditional (more than eight) Ver todos footer with a green trailing-arrow link.

In workspace Spec, omit the visible digest eyebrow and render PRD completo as a button-styled document link even when the digest is unpublished. FRD cards use four columns on desktop, two on tablet and one on phone; violet identity chip, right-aligned kind tag, title without its repeated FRD prefix, and a live state stack with done/total count. State stacks read done, review, in_progress, fail, todo.

**Next-step explanation (2026-10-31).** WHEN a workspace shows a next command, THE Resumen SHALL show its non-empty explanatory sentence beside Siguiente paso. Construction with unfinished orders or queued changes SHALL recommend implement; completely verified construction without queued changes MAY recommend release with its readiness sentence. Early phases SHALL use the command-specific when sentence from the shared phase command map.

### Dialog presentation closure (2026-10-31, item 35)

Decision dialogs order metadata, optional blue recommendation, source note, response command and project action. ADR dialogs show the id in the kicker and the title once, with amber document styling. Both use the shared native modal keyboard lifecycle. Work orders retain the inline routed detail owned by FRD-05; they do not introduce a dialog.

ADR modal content SHALL omit the leading document title while preserving metadata and subsequent section headings; the modal heading is the single title (2026-10-31 independent review).
