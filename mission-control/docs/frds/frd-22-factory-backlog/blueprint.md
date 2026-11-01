---
id: BP-22
type: blueprint
slug: factory-backlog
title: Factory backlog surface (Propuestas · Backlog tab)
status: ACTIVE
parent: FRD-22
implementation_status: VERIFIED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---

# Blueprint — FRD-22 Factory backlog surface (Propuestas · Backlog tab)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-feature** blueprint (DR-049): how the Backlog tab is built on top of the platform in
> [`docs/product/architecture.md`](../../product/architecture.md) (§6 `backlog/` module, §7 write set item 4,
> §11 mapping, route map rows `/proposals/:tab` and `/proposals/backlog/:item`). It does not restate the
> platform. This is the first blueprint of FRD-22: the reader and the discard write exist and are VERIFIED
> as code (built under FRD-17's v1 work orders, no FRD-22 work order existed); v2 re-verifies them under
> WO-22-001 and rebuilds the tab under WO-22-002.

## Purpose

Surface the factory's actionable work queue (`factory/backlog/BL-*.md`, DR-103) inside the Propuestas page so
defects and improvements of the factory's own tooling are never invisible: priority tiles and topic bars that
filter, a "Cómo avanzar" card with the copyable commands, En curso then Abiertos grouped by priority, one
collapsed history card, a coral read-error notice that names the broken files, and an item dialog with its own
command and the single bounded write (discard). The tab shell (Resumen · Memoria · Backlog, count badge,
panels kept mounted) belongs to FRD-17's `ProposalsTabs` (WO-17-008); this FRD owns the Backlog panel.

## Components & Interfaces

| ID | Kind | Responsibility | Location | REQ |
|---|---|---|---|---|
| `IF-22-backlog` | interface | `readBacklog(): BacklogReadResult` (`items`, `errors[]`): typed items, body exposed, severity-then-id order, first-wins duplicate ids, missing directory = legitimately empty. | `src/lib/backlog/backlog.ts` (exists, re-verified) | REQ-22-001, REQ-22-004, REQ-22-008 |
| `IF-22-areas` | interface | Pure area helpers: `backlogAreaKey(areaCode)` maps a raw `area` to a catalogue key leaf (`buildEngine`, `pluginSkill`, `templates`, `hooks` for both `hooks` and `plugin-hooks`, `standards`, `missionControl`, `pluginAgent`, `plugin`, `other`) and `countByArea(items)` counts merged areas together. Returns keys, never Spanish text (the UI resolves them with `t("propuestas.backlog.areas.<key>")`), so the W0 reader has no dependency on the copy accessor. | `src/lib/backlog/areas.ts` (new) | REQ-22-001, REQ-22-010 |
| `IF-22-discard` | interface | `discardBacklogItem(id, reason?)`: the bounded write. Rewrites `status: discarded`, records `status_before_discard`, records `discard_reason` when a non-blank reason is given, preserves body and every other field verbatim. | `src/lib/backlog/discard-backlog.ts` (exists; gains the optional `reason`) | REQ-22-007 |
| `IF-22-action` | interface | `discardBacklogAction(id, reason?)`: Server Action. Authorizes by shape (id pattern `BL-` + digits, reason length-bounded), calls `IF-22-discard`, revalidates `/proposals`, returns a typed result, never throws. | `src/app/proposals/_actions/discard-backlog.ts` (exists; gains `reason`) | REQ-22-007 |
| `CMP-22-panel` | component | `BacklogPanel({ result })`: client orchestrator. Holds the tab-local state (priority, area and type filters, history paging, opened-dialog view) and composes the parts below. | `src/app/proposals/_components/BacklogPanel/BacklogPanel.tsx` | REQ-22-001..003, REQ-22-010 |
| `CMP-22-tiles` | component | Three priority tiles (P0, P1, P2), combinable filters with `aria-pressed`, built on the core `StateTile`. | `BacklogPanel/PriorityTiles.tsx` | REQ-22-010 |
| `CMP-22-areabar` | component | `AreaBar({ area, count, pressed, max })`: one "Por tema" bar that filters. | `src/app/proposals/_components/AreaBar/AreaBar.tsx` | REQ-22-010 |
| `CMP-22-howto` | component | "Cómo avanzar" card: whole-queue command first, then the one-by-one command, where they run. Omits the commands when nothing is actionable. | `BacklogPanel/HowToCard.tsx` | REQ-22-003, REQ-22-009, REQ-22-010 |
| `CMP-22-list` | component | En curso and Abiertos cards; Abiertos in P0, P1, P2 and "Sin prioridad" sub-groups; `BacklogRow` (the `.lrow.bl-row` button); `MoreBar` paging. | `BacklogPanel/BacklogGroups.tsx`, `BacklogPanel/BacklogRow.tsx` | REQ-22-001, REQ-22-005, REQ-22-010 |
| `CMP-22-history` | component | The one collapsed card "Hechos y descartados N" (native disclosure) with the paged rows. Omitted when empty. | `BacklogPanel/HistoryCard.tsx` | REQ-22-006, REQ-22-007 |
| `CMP-22-errors` | component | Coral `Notice` (`role="alert"`) naming each broken file and its reason, above the tiles; parsed items still listed. | `BacklogPanel/ReadErrors.tsx` | REQ-22-004 |
| `CMP-22-dialog` | component | Item dialog (metadata chips, `SectionedMarkdown` body, targeted `CommandBox`, "Descartar") and the discard confirmation that replaces it inside the same dialog (`DialogConfirm`, optional "Motivo"). | `BacklogPanel/BacklogDialog.tsx` | REQ-22-005, REQ-22-007, REQ-22-009 |
| `CMP-22-statetile` | component | `StateTile`: generic count tile that doubles as a combinable filter (label with dot, display number, hint, `aria-pressed`, optional bar). Relocated from the components.md path `src/app/projects/[slug]/_components/StateTile.tsx` to the core, because the Backlog tab needs it at W3 and the Observabilidad tab at W6 (components.md allows a blueprint to relocate a module, never to fork it). | `src/components/core/StateTile/` (new) | REQ-22-010 |

Reuse (components.md, in order): `Tabs` (FRD-17), `Card`/`CardHeader`, `Chip` family and `FilterChip`, `CommandBox`,
`ListRow`, `MoreBar`, `Dialog`/`DialogConfirm`, `EmptyState`/`Notice`, `SectionedMarkdown` (carried over from v1,
`src/components/modules/SectionedMarkdown/`). Nothing else is created.

## Contracts

**Reader (`IF-22-backlog`).** Input: the files of `<factory>/factory/backlog/` named `BL-*.md` (README and
`_item-template.md` skipped). Success: `{ items, errors }`; `items` ordered by severity (P0, P1, P2, none last)
then id ascending, ids unique (first file wins). Errors: an unreadable or empty file, malformed YAML, a
missing `id`/`area`/`title`, an out-of-range `type`/`status`, and a repeated id each become one entry
`{ file, reason }` (`duplicate id <ID> (already defined in <first-file>)`); nothing is dropped silently and a
missing directory is `{ items: [], errors: [] }`. Invariants: the order is a property of the reader, not of a
view; the reader performs no write.

**Discard write (`IF-22-discard`, `IF-22-action`).** Input: `id` (the frontmatter id, not a filename) and an
optional free-text `reason` (trimmed; blank means absent; bounded to 500 characters). Success: `{ ok: true }`
after rewriting exactly `status`, `status_before_discard` and, when a reason was given, `discard_reason`.
Errors (typed, never thrown): `not-found` (no file matches, also any id that cannot match a filename),
`parse-error` (file left untouched), `not-discardable` (status is `done`, already `discarded` or unknown).
Invariants: only `open` or `doing` items; sibling files are never touched; body and other frontmatter fields
survive verbatim. The action revalidates `/proposals` only on success.

**Filters (tab-local, `CMP-22-panel`).** Priority tile, area bar and type chip combine. Tile counts are the
open items of that priority (status `open`, ignoring other filters); area counts and type counts cover open and
in-progress items. "N ítems" is the count of En curso plus Abiertos after filters. "Quitar filtros" appears
whenever any filter is active and clears all of them. The history card count follows the filters; an empty
Abiertos result reads "Nada abierto con este filtro.". Page sizes: P0 and P1 groups 20, P2 and "Sin prioridad"
groups 10, history 15; each activation of the `MoreBar` reveals the next `2 x pageSize` rows and its label reads
"Mostrar N más · quedan M" with N the rows it reveals and M the rows hidden before the press (the captured
"Mostrar 2 más · quedan 2" and the FRD-17 "Mostrar 14 más · quedan 14" follow from this rule). History rows are
ordered by `closed` date, newest first; rows without a `closed` date (items discarded from Mission Control)
follow in reader order.

**URL.** The opened item is the codec's `backlogItem` key (`/proposals/backlog/:item`, FRD-25, ADR-0010): a
shareable location that restores the dialog; an unknown id is a bounded not-found, never another item.
Filters, history paging and the confirmation view are component state (AC-22-002.4). No URL write runs the
discard.

**Status labels.** `open`, `doing`, `done`, `discarded` render as "Abierto", "En curso", "Hecho", "Descartado"
(`propuestas.backlog.status.*`); the type chip reads "Bug" or "Mejora" (never "Cambio"); priority chips read
"P0", "P1", "P2" and the tiles and group headings carry the written priority ("P0 · urgente"); colour never
carries the priority alone.

## Removals (v1 things the frozen design dropped; map §6.C item 20)

WO-22-002 deletes, in the same work order: the row evidence line (`source` + `links`) on the cards, the source,
links and dates block of the dialog, the "Ver hechos" / "Ver descartados" toggle buttons and their separate
lists, the standalone `BacklogCard` and the old `DiscardBacklogButton` (their roles move into `BacklogRow` and
the dialog), and every test that pins them. The prototype's slate notice in the confirmation carries
prototype-only wording ("Esta maqueta no modifica archivos…") that is not product copy and has no catalogue
key (`docs/design/freeze/open-points.md`): the confirmation is built without it and the gap is in the ledger.

## Traceability

| REQ | Satisfied by | Work order |
|---|---|---|
| REQ-22-001 Read and group the backlog | `IF-22-backlog`, `IF-22-areas`, `CMP-22-list`, `CMP-22-panel` | WO-22-001 (AC-22-001.1), WO-22-002 (AC-22-001.2, AC-22-001.3) |
| REQ-22-002 In-page tabs | FRD-17 `ProposalsTabs` (`CMP-17-tabs`); this FRD only exports `BacklogPanel` and the count of actionable items | WO-17-008 (AC-22-002.1 to AC-22-002.4) |
| REQ-22-003 Read-mostly note | `CMP-22-howto` | WO-22-002 (AC-22-003.1) |
| REQ-22-004 Fail-loud read boundary | `IF-22-backlog`, `CMP-22-errors` | WO-22-001 (AC-22-004.1, AC-22-004.3), WO-22-002 (AC-22-004.2) |
| REQ-22-005 Item detail | `CMP-22-list`, `CMP-22-dialog`, `SectionedMarkdown` | WO-22-002 (AC-22-005.1 to AC-22-005.3) |
| REQ-22-006 Default-hidden history | `CMP-22-history` | WO-22-002 (AC-22-006.1 to AC-22-006.3) |
| REQ-22-007 Discard | `IF-22-discard`, `IF-22-action`, `CMP-22-dialog` | WO-22-001 (AC-22-007.2), WO-22-002 (AC-22-007.1, AC-22-007.3) |
| REQ-22-008 Priority ordering | `IF-22-backlog` | WO-22-001 (AC-22-008.1) |
| REQ-22-009 Ready-to-copy commands | `CMP-22-howto`, `CMP-22-dialog` | WO-22-002 (AC-22-009.1, AC-22-009.2) |
| REQ-22-010 Tiles, topic bars, Cómo avanzar, priority groups | `CMP-22-tiles`, `CMP-22-areabar`, `CMP-22-statetile`, `CMP-22-howto`, `CMP-22-list`, `IF-22-areas` | WO-22-002 (AC-22-010.1 to AC-22-010.4) |

## Visual spec (WO-22-002; binding, DR-054)

FDD: [`fdd.md`](fdd.md). Mock: `mocks/factory-backlog.html` (shard drawn from the frozen prototype); screenshots in
`mocks/screenshots/`. Oracle states of this FRD's gate (`docs/design/prototype/reference/oracle-states.json`,
recipes in `oracle-recipes.md`): `backlog`, `backlog-priority-filter`, `backlog-area-filter`,
`backlog-item-dialog`, `backlog-discard-confirm`, `backlog-history-open`, `backlog-errors` (the last one is the
fixture overlay with a malformed card and a duplicate `BL-0013`), plus the scenario state `backlog-open-empty`
(«Nada abierto con este filtro.», build-side double in `oracle-recipes.json`). Assets: icons only, through
`Icon`; no image, no new font. The panel keeps `data-testid="backlog-panel"` (the persistent-navigation spec
asserts it).

**Reconciliation (2026-10-22, binding).** WO-22-002 depends on WO-25-001 (wave unchanged, W3) and updates the
backlog steps of the split `e2e/persistent-navigation/proposals.spec.ts` (WO-17-008 updates its tab steps in W4)
and `BacklogPanel/_tests/persistentNavigation.test.tsx`. The core `StateTile` lives in
`src/components/core/StateTile/` (created here, reused by WO-05-008). `MoreBar`'s paged rule (`step` =
`2 × pageSize`) is WO-13-011's.

## Dependencies & Risks

- Upstream: WO-13-012 (composite primitives: `Card`, `Dialog`/`DialogConfirm`, `Notice`, `ListRow`, `Tabs`) and,
  through it, WO-13-011 (`Chip`, `CommandBox`, `MoreBar`); `src/lib/config` for the factory root; `gray-matter`
  (already installed, always `matter(content, { excerpt: false })`).
- Consumer: WO-17-008 mounts `BacklogPanel` and reads the actionable count; WO-05-008 reuses `StateTile`
  (ledger request).
- Risk: a backlog item without a priority must be listed, never dropped (PRD) - covered by the "Sin prioridad"
  sub-group and a test. Risk: the real `factory/backlog/` grows (hundreds of items); the page sizes and the
  `MoreBar` keep the rendered list bounded.
- Risk: a second copy of the area map would drift (DR-115): `IF-22-areas` is the only place that knows the
  codes, and Propuestas' Resumen backlog counts (WO-17-008) import it.

Lessons applied: LESSON-0077 (area codes map to labels in one module, `IF-22-areas`, and the Resumen counts in
FRD-17 import it), LESSON-0185 (the behaviour e2e spec avoids `networkidle` and hydration races), LESSON-0484
(the two cards end at the same height; priority colours are status colours only).

## Build Plan

> The build engine reads this table; it does not infer dependencies. `Parallel with` carries the global wave
> (`W<n>`, computed from `dependsOn`) and the wave-mates inside this FRD.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-22-001 | — | `src/lib/backlog/**` | false | W0; none inside this FRD |
| WO-22-002 | WO-22-001, WO-13-012, WO-25-001 | `src/app/proposals/_components/{BacklogPanel,AreaBar}/**`, `src/app/proposals/_actions/**`, `src/components/core/StateTile/**`, `e2e/backlog.spec.ts`, `e2e/fixtures/factory-root/factory/backlog/BL-90*.md`, `e2e/persistent-navigation/proposals.spec.ts` | false | W3; none inside this FRD |

- **Order and integration.** WO-22-001 first (a W0 lane: the reader, the area helpers and the reason-aware
  write, no UI). WO-22-002 builds the tab on top; WO-17-008 (FRD-17, W4) then mounts `BacklogPanel` inside the
  Propuestas tabs. Cross-FRD: this FRD sits between FRD-13's composite primitives (W2) and FRD-17's page (W4);
  WO-05-008 (FRD-05, W6) reuses `StateTile`.
- **Disjointness.** `src/app/proposals/_components/{BacklogPanel,AreaBar}/**` and `_actions/**` belong to WO-22-002
  only; every other `src/app/proposals/**` path belongs to WO-17-008 (a later wave). `src/lib/backlog/**` is
  WO-22-001 only.
- **No backend contract file.** No route handler or HTTP API is added or changed (the discard is a Server
  Action over an existing write), so no `docs/api/<wo-id>.md` is planned (DR-060 not applicable).

## Work Orders

1. WO-22-001 `backlog-reader` (low, W0): reader re-verified, area helpers, reason-aware discard write.
2. WO-22-002 `backlog-tab-orbita` (medium, W3): the Backlog panel, dialog and confirmation.

## Superseded (v1 history)

FRD-22 had no work order of its own before v2 (its code was built under FRD-17's WO-17-004 and the queue
cards of 2026-06/07). Nothing to supersede here.

## Readiness check (DR-100)

Every explicit `REQ-22-001..010` maps to a component or interface above; every `AC-22-MMM.K` of the FRD is owned
by exactly one work order (the AC coverage table in `work-orders/README.md`; AC-22-002.1 to AC-22-002.4 by
WO-17-008); `dependsOn` is acyclic; WO-22-001 and WO-22-002 are in different waves; the foundation they need is
FRD-13's; no unresolved question survives in this feature's documents.

## Security implementation update (2026-10-31)

Use the platform allowlists and shared data-only frontmatter parser described in
[architecture §7](../../product/architecture.md#7-cross-cutting-concerns). Preserve typed mutation
failures and source errors. The lazy board document action resolves only portfolio roots; change
discard resolves its target from the slug in the server. Backlog discard retains its server-owned root.
