---
id: FRD-22
type: frd
title: FRD-22 — Factory backlog surface (Propuestas · Backlog tab)
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-22-factory-backlog/mocks/factory-backlog.html
last_updated: '2026-10-22'
floor: false
---
# FRD-22 — Factory backlog surface (Propuestas · Backlog tab)

Surfaces the factory's **actionable work queue** — `factory/backlog/BL-*` (DR-103, the plane-3 counterpart of the plane-1 self-learning memory) — inside Mission Control, so closeable defects/changes to the factory's own tooling do not stay invisible and get forgotten. It shares the **Propuestas** page with the memory self-learning streams (FRD-17) because both are "proposals to change the factory": the page has three in-page tabs (**Resumen** | **Memoria** | **Backlog**) using the one shared `Tabs` primitive (DR-062). Read-only, no Claude — consistent with the platform golden rule (FRD-01).

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle (contradiction C-20 of `docs/design/freeze/reconciliation.md`): En curso comes before Abiertos, history is one collapsed card, and the commands live in the "Cómo avanzar" card. Items the owner left out of v2 are prefixed **Out of v2**. Prototype-drawn behaviours are REQ-22-010 (AC-22-010.1 to AC-22-010.4).

## Acceptance criteria (EARS)

### REQ-22-001 — Read and group the backlog
- **AC-22-001.1** — Mission Control SHALL read every `factory/backlog/BL-*.md` item (skipping `README.md` and `_item-template.md`) into a typed model (`id`, `type` bug|change, `area`, `title`, `status` open|doing|done|discarded, `severity`, `source`, `closes`, `links`, `opened`, `closed`).
- **AC-22-001.2** — The Backlog panel SHALL group items by `status`; **En curso** (doing) and **Abiertos** (open) render by default, in that order, each a section with its count, its items ordered by priority then id (see REQ-22-008). **Hechos** (done) and **Descartados** (discarded) do NOT render by default — they sit together in one collapsed card, "Hechos y descartados N" (REQ-22-006, REQ-22-007). An empty backlog SHALL show an explicit empty state.
- **AC-22-001.3** — Each item SHALL render as a card visually consistent with the memory ProposalCard (DR-062): mono `id`, a type chip ("Bug" or "Mejora", an outline chip), the area as plain text in plain names ("Motor de construcción", "Skills", "Plantillas de proyecto", "Controles automáticos", "Estándares", "Agentes", "Plugin"), a priority label ("P0 · URGENTE", "P1 · IMPORTANTE", "P2 · CUANDO HAYA TIEMPO"; text, never colour alone) and the title. **Out of v2 (owner decision 2026-10-21):** the evidence line (`source` + `links`) on the card; it shows in the item dialog metadata.

### REQ-22-002 — In-page tabs (Resumen | Memoria | Backlog)
- **AC-22-002.1** — The Propuestas page SHALL present three tabs, **Resumen**, **Memoria** and **Backlog**, using the shared `Tabs`/`SubTabs` primitive (DR-062) — no bespoke switcher.
- **AC-22-002.2** — (amended 2026-10-22, v2 reconciliation) **Resumen** SHALL be active by default (FRD-17 AC-17-011.1); **Memoria** SHALL contain the self-learning surface (the `LessonFlow` health line + the proposal streams + the promotions queue, FRD-17).
- **AC-22-002.3** — The **Backlog** tab SHALL show a count badge of its actionable items (open and in progress, for example "Backlog 11") when greater than zero.
- **AC-22-002.4** — Both panels SHALL stay mounted (toggled with `hidden`) so each panel's tab-local state (for example the Backlog filters, its opened card and the paging of its history) survives a tab switch; the memory streams have no dismiss state in v2 (FRD-17, per-card dismiss is out of v2). (Amended 2026-10-22, v2 plan.) Both panels SHALL carry `data-volatile` (DR-088) so the visual baseline masks their live, length-varying data.

### REQ-22-003 — Read-mostly, how-to-work note
- **AC-22-003.1** — The Backlog panel SHALL explain, in the "Cómo avanzar" card (AC-22-010.3, which replaced the how-to note), that these are actionable items worked by asking an agent (e.g. «implementa BL-0007»), and that Mission Control only displays and (per REQ-22-007) lets the owner discard them — it never creates, closes or edits the content of a `factory/backlog/` item (consistent with the FRD-17 read-only boundary, minus the one bounded discard write).

### REQ-22-004 — Fail-loud read boundary (DR-078)
- **AC-22-004.1** — The backlog reader SHALL distinguish "the backlog is empty" from "an item could not be interpreted": a malformed `BL-*.md` (unparseable YAML, missing a required field, or an out-of-range enum) SHALL be surfaced in an `errors` collection, never silently dropped. A missing `factory/backlog/` directory is a legitimately-empty backlog, not an error.
- **AC-22-004.2** — WHEN the reader reports one or more errors, the Backlog panel SHALL render a coral error notice (`role="alert"`) naming the offending file(s) and reason(s) (including a duplicate id), while still listing the items it could parse (state `backlog-errors`, M1 2026-10-22).
- **AC-22-004.3** — **Duplicate ids are a data-integrity defect, surfaced fail-loud (BL-0013).** WHEN two different `BL-*.md` files declare the same `id`, the reader SHALL keep only the first occurrence in `items` (so the panel never renders duplicate React keys or a misleading second copy) and surface each subsequent collision in `errors[]` (`duplicate id <ID> (already defined in <first-file>)`). The invariant "the rendered backlog has unique ids" is enforced at the read boundary, not assumed. Added 2026-07-01 after a real collision (two files reusing BL-0010/BL-0011) intermittently red-locked the /proposals smoke gate with a duplicate-key console error.

### REQ-22-005 — Item detail (click a card → formatted detail)
- **AC-22-005.1** — Each backlog card SHALL be an accessible control (a `<button>`, keyboard-operable, with an `aria-label` naming the item) that opens a **detail modal** for that item. The detail opens in the shared `Modal` primitive (focus-trapped, Escape-closes, backdrop-click-closes) — never an inline expand (the app's modal-for-detail rule).
- **AC-22-005.2** — The backlog reader SHALL expose each item's markdown **body** (everything after the frontmatter), and the detail SHALL render it as **titled, colour-coded sections** via the shared `SectionedMarkdown` primitive — each `## Heading` (Problem / Root cause / Fix plan / Tests / Done when / Out of scope) becomes a real section header (icon + coloured label) with its content rendered as markdown (lists, code, tables), NOT one wall of text or a raw string. This is the same `SectionedMarkdown` primitive the memory-lesson detail uses (it auto-detects `## Heading` vs `**Label:**` sections), so both detail modals share one look (DR-062).
- **AC-22-005.3** — The detail SHALL show the item's metadata (the title "<id> · <title>", a priority chip, a type badge "Bug" or "Mejora", and status and area chips — the status in Spanish: "En curso", "Abierto", "Hecho", "Descartado") above the rendered body. **Out of v2 (owner decision 2026-10-21):** source / links / dates in the detail. Section headings that come from the item file (for example "Proof") are shown content and keep their source language. Read-only: the detail has no write/close-item affordance (working an item is done by an agent, AC per Non-goals).

### REQ-22-006 — Default-hidden history (opt-in reveal)
- **AC-22-006.1** — GIVEN the backlog has any `done` or `discarded` items, ONE collapsed card "Hechos y descartados N" (N = their combined count) SHALL render below the always-visible groups; the card SHALL be omitted entirely when there are none. (Amended 2026-10-22: it replaced the "Ver hechos (N)" and "Ver descartados (N)" toggle buttons.)
- **AC-22-006.2** — Opening the card SHALL reveal the history list (the same card list as the other groups, paged with "Mostrar N más · quedan M"); collapsing it hides the list again.
- **AC-22-006.3** — This mirrors the same default-hide pattern used by the project-level Cambios tab (Mission Control FRD-04, REQ-04-009) — so the closed-item history of neither queue clutters its actionable view as it accumulates over months.

### REQ-22-007 — Discard a backlog item (bounded write)
- **AC-22-007.1** — WHEN a backlog item is `open` or `doing`, its detail dialog SHALL offer a **"Descartar del backlog"** action that opens a confirmation dialog replacing the detail (no nested modal) with an optional "Motivo (opcional)" field, and on confirm rewrites `status: discarded` (ADR-0002 pattern) and closes the dialog on success; never offered for `done` or already-`discarded` items.
- **AC-22-007.2** — Confirming SHALL call the `discardBacklogItem` write, which rewrites `status: discarded` and records `status_before_discard` (the prior value) and, when a Motivo was typed, `discard_reason` [ASSUMPTION: the same field the idea-card discard uses (FRD-02 REQ-02-008); the prototype dialog only draws the optional field — source: reconciliation C-20], preserving the body and every other frontmatter field verbatim (the same bounded-write pattern as `discardIdea`/`discardChange`) — never touching any sibling file.
- **AC-22-007.3** — A discarded item moves out of the default En curso/Abiertos view into the collapsed card "Hechos y descartados N" (REQ-22-006), mirroring the project-level Cambios tab (FRD-04 "Historial N").

### REQ-22-008 — Priority ordering (severity, then id)
- **AC-22-008.1** — (amended 2026-10-22, v2 reconciliation) WITHIN each actionable status group (En curso, Abiertos), items SHALL be ordered by `severity` first (P0 before P1 before P2), then by `id` ascending; an item with no `severity` SHALL sort after all severities. The history ("Hechos y descartados", done and discarded items) SHALL be ordered by `closed` date, newest first; items without a `closed` date (for example those discarded from Mission Control) SHALL follow in reader order. This is an invariant of the reader (`readBacklog`), not a per-view sort — every consumer of the read result sees the same order.

### REQ-22-009 — Ready-to-copy `implement-backlog` commands
- **AC-22-009.1** — WHEN the backlog has at least one `open`/`doing` item, the "Cómo avanzar" card (AC-22-010.3, above the list) SHALL render a `CmdRow` with the generic command `/pandacorp:implement-backlog` (no id) — the same copy-to-clipboard affordance used elsewhere in Mission Control (never executed by the app itself, FRD-01's golden rule). Omitted entirely when there are zero actionable items. (Amended 2026-10-22: the command moved from below the list into the card.)
- **AC-22-009.2** — An `open`/`doing` item's detail modal SHALL render a `CmdRow` with the item's own targeted command, `/pandacorp:implement-backlog <id>`; a `done` or `discarded` item never shows it (the same actionable set REQ-22-007 uses for the discard action).

### REQ-22-010 — Priority tiles, topic bars, "Cómo avanzar" and priority groups (added 2026-10-22, design freeze)
- **AC-22-010.1** — WHEN a priority tile (P0, P1 or P2, each with its count) is activated, THE backlog SHALL show only that priority.
- **AC-22-010.2** — WHEN a bar of "Por tema" (the plain-name areas, with merged areas counted together) is activated, THE backlog SHALL show only that topic; "Quitar filtros" SHALL clear the filters and an empty result SHALL read "Nada abierto con este filtro."
- **AC-22-010.3** — THE backlog SHALL show a "Cómo avanzar" card with the whole-queue command first ("Todo de una vez.", with its cost warning) and then the one-at-a-time command ("Uno por uno.", recommended), each with where it runs.
- **AC-22-010.4** — THE open items SHALL be grouped by priority sub-groups (P0 URGENTE, P1 IMPORTANTE, P2 CUANDO HAYA TIEMPO) and paged with "Mostrar N más · quedan M".

**Worked example (AC-22-010.1, AC-22-010.2).** The backlog has 1 item En curso and 10 Abiertos. Activating the tile "P0" lists only the P0 items; activating the bar "Skills" in "Por tema" as well lists only the P0 items about Skills (the filters combine); "Quitar filtros" restores all 11.

## Non-goals
- Beyond the one bounded discard write (REQ-22-007), Mission Control does NOT create, edit or close `factory/backlog/` items, and never executes a skill itself (FRD-01's golden rule) — REQ-22-009's commands are copy-to-clipboard text, run by the owner (or an agent they invoke) outside this UI.
- No Claude calls — the surface is derived purely from the on-disk `BL-*` files (FRD-01).
- The memory-tab cleanup (deduping the promotions surfaces, the dismiss-button redesign, the count/dismissal reconciliation, dead-code removal) is a **separate** follow-up (tracked; not part of this FRD).

## Relationship
Shares the Propuestas route with [FRD-17](../frd-17-proposals-inbox/frd.md) (the memory self-learning inbox) — the two are the Memoria and Backlog sub-tabs of one page. Uses the `Tabs` primitive from FRD-13 (DR-062). The backlog store and its routing rule are factory-level doctrine (DR-103); this FRD is only the read-only Mission Control surface over it.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
