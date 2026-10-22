---
id: FRD-05
type: frd
title: FRD-05 — Work orders (live view)
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-05-work-orders/mocks/work-orders.html
last_updated: '2026-10-22'
---
# FRD-05 — Work orders (live view)

Read-only views of the work orders' state (Por FRD, Tablero), with their FRD and reading the full document. The views live inside the project's Observabilidad tab (FRD-04, FRD-12); there is no separate Work orders tab.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle (contradiction C-07 of `docs/design/freeze/reconciliation.md`). Prototype-drawn behaviours are REQ-05-008 (AC-05-008.1 to AC-05-008.4); the failing-order state is drawn by the owner's M1 decision.

## Acceptance criteria (EARS)
- **REQ-05-001** — The Tablero view (inside Observabilidad, AC-05-008.1) SHALL show **four** columns, in this order: **Planificado · En curso · En revisión · Verificado**, plus a **Bloqueado** column placed after Verificado ONLY while a work order has failed; all columns the **same width** and **wide** (not tiny), with **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- **REQ-05-002** — WHEN a work order has failed, THE Tablero SHALL show it in the **Bloqueado** column, its card SHALL carry the **failed-card danger treatment** (coral background + border, an alert icon and danger-colored text on the title), the Bloqueado column header SHALL itself read in the danger color, and the work order's row in Por FRD SHALL carry the same treatment, so a failure is visually unmistakable (state `wo-failed`, M1 2026-10-22).
- **REQ-05-003** — EACH work order card SHALL indicate which **FRD** it belongs to; since work orders now live **per feature** under `docs/frds/frd-NN-<slug>/work-orders/` (DR-049), the kanban MAY group/filter the cards by their FRD (the FRD grouping is now the natural one).
- **REQ-05-004** — WHEN the owner clicks a work order, it SHALL show a **Resumen** and a **Documento completo** tab; the latter renders the entire work order (acceptance criteria, scope, definition of done, evidence), and the former reads as AC-05-008.4.
- **REQ-05-005** — It SHALL show the project's progress (work orders done / total and %), aggregated across every feature's `work-orders/`.
- **REQ-05-006** — The kanban SHALL reflect the live state (written by the agents in each feature's `docs/frds/frd-NN-<slug>/work-orders/`); the owner does NOT edit it.
- **REQ-05-007** — The work-order views SHALL offer a secondary filter by work-order state, as the four state tiles with their counts (AC-05-008.2), as `aria-pressed` controls in the same pattern as the FRD filter, combinable with it by logical AND (WO-05-007).
- **Real-time / event-driven**: the work-order board SHALL update LIVE as the agents change work-order state — when a work order moves column (e.g. into Review, Fail or Done) the board SHALL reflect it without the owner reloading the page. **(reconciled from code 2026-07-07)** — the board (`WoLiveRefresh`) refreshes on TWO triggers, not just fresher events: a genuinely newer event, OR a moved SSE `stateVersion` (the max mtime of `status.yaml` + WO frontmatter, via the shared `lib/status/state-version-moved.ts`). The `stateVersion` trigger is what makes a **backward** transition visible — a gate reopen (`IN_REVIEW → PLANNED`) rewrites only the frontmatter and emits no event, so an event-only board would leave the reopened WO stranded in the wrong column. The open **WO detail pane** mounts the same `WoLiveRefresh` (`ProjectWorkspace.renderWorkOrdersTab`), so an open work order's status badge updates live too — same SSE transport, no second subscription.

### REQ-05-008 — Three views, Por FRD, Tablero cap and reading summary (added 2026-10-22, design freeze)

- **AC-05-008.1** — THE Observabilidad tab SHALL offer the views Por FRD (the default), Tablero and Dependencias (FRD-12), and SHALL keep the selected view in the URL.
- **AC-05-008.2** — THE Por FRD view SHALL start with every FRD collapsed (each group showing its stacked state bar and "n/m %"), SHALL offer one "Expandir todo" / "Colapsar todo" toggle and a "Filtrar por FRD" select, and SHALL show the four state tiles with counts as filters that combine with each other and with the select.
- **AC-05-008.3** — THE Tablero SHALL show at most 8 cards per column (4 on phones) followed by "Mostrar N más", and SHALL collapse an empty column to one line.
- **AC-05-008.4** — (amended 2026-10-22, v2 reconciliation) THE work-order Resumen SHALL read in this order: a flow header with an "Ahora:" sentence; "De qué trata"; "Qué cambia" (with "Fuera de alcance" apart); "Cómo se comprueba" (one card per acceptance criterion, EARS keywords marked); "Qué se construyó" (a long note folded). It SHALL show a fact sheet (Estado, Dificultad, Reaperturas, Actualizada, Requisitos, Archivos que toca, Dependencias up and down, "Construir esta work order" with its scoped build command) and a line saying the content comes from the order's own document.

**Worked example (AC-05-008.3).** A Verificado column holds 21 work orders. On desktop it shows the first 8 followed by "Mostrar 13 más"; on a phone it shows 4 followed by "Mostrar 17 más". A column with no work orders is a single line.

## Edge cases
- Project with no work orders yet → "Este proyecto todavía no tiene work orders publicadas. Sus documentos de producto y diseño siguen disponibles." plus the `/pandacorp:architecture` command, which generates them.
- No work order has failed → the Tablero has no Bloqueado column (REQ-05-001).
- A work order link that does not resolve → the not-found state "Esta work order no está publicada" with "WO-99-999 no aparece entre las work orders de Mission Control." (`workspace.observabilidad.notFound`) and the link "Ver work orders" (FRD-25 owns the not-found contract).

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
