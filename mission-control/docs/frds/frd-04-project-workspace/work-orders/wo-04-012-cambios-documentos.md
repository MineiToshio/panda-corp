---
id: WO-04-012
type: work-order
slug: cambios-documentos
title: 'WO-04-012 — Cambios and Documentos tabs'
status: DRAFT
parent: FRD-04
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_panels/{CambiosPanel,DocumentosPanel}.tsx'
  - 'src/app/projects/[slug]/_components/{tab-changes,tab-documents}/**'
  - 'src/app/projects/[slug]/_actions/**'
  - 'src/lib/changes/**'
  - 'src/lib/docs/tree.ts'
  - 'src/lib/docs/_tests/{tree,docs.wo04001}*.test.ts'
source_requirements: [REQ-04-010, REQ-04-011, REQ-04-014]
dependsOn: [WO-04-010, WO-08-003]
last_updated: 2026-10-22
---

# WO-04-012 — Cambios and Documentos tabs

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED`. Blueprint: [`../blueprint.md`](../blueprint.md) §3, §4.6.

## Summary

Rewrites the two workspace panels that read the project's own files: Cambios (the change queue in groups
with a state strip, the fail-loud banner, absolute dates, the change dialog with the «Rehace trabajo ya
verificado» warning and the scoped build command, and the «Descartar cambio» confirmation that replaces the
dialog) and Documentos (an index ordered by purpose with type chips and search, the open document as typed
paper at full width, the index on the right from 900 px and behind «Elegir documento · N» below).

## In Scope

- `CMP-04-changes` (`_panels/CambiosPanel.tsx`, `_components/tab-changes/`): coral `Notice` «N archivo(s) de
  cambios no se pudo/pudieron interpretar. No se cuentan como cola vacía.» naming the files when
  `readChangeQueue` reports errors (DR-078); the state strip (Listos para construir, En construcción, Cerrando,
  Borradores with counts); one `Card` per non-empty group in the drawn order (Listos para construir, En
  construcción, Cerrando, Borradores), En construcción and Cerrando never hidden behind the history; done and
  discarded together in one collapsed `details` «Historial N»; each item a `ListRow` (type icon tile, title,
  «slug · fecha · frd», kind chip «Cambio» / «Bug», status chip with its word); «Pedir un cambio» card with
  `/pandacorp:change`; the `workspace.cambios.empty` sentence when the queue is empty.
- Card date (REQ-04-011): absolute Spanish date («19 oct. 2026») with the raw ISO date as tooltip; an
  unparseable date shown raw in the same slot; through the shared date formatter of the copy layer (ledger
  request to WO-13-010). The relative `formatChangeDate` goes.
- `CMP-04-change-dialog`: `Dialog` with kicker «Cambio · <slug>», title, chips (status word, kind, «Urgente»
  with its bolt icon when `expedite`, slug, FRD), «Depende de: …» when it has dependencies, the warning
  `Notice` «Rehace trabajo ya verificado» with its sentence naming the FRD when `rebuilds_verified`, the body
  rendered as titled colour-coded sections (`Markdown` compact), the scoped `/pandacorp:implement change:<id>`
  `CommandBox`; «Descartar cambio» only for Listo / Borrador (never for En construcción, Cerrando, Hecho,
  Descartado). Activating it replaces the dialog content with `DialogConfirm` (kicker «Confirmar», title
  «Descartar cambio», optional «Motivo», «Cancelar» / «Descartar»); Cancel or Escape returns to the detail.
  The dialog opens from a card and closes with focus back on that card.
- Discard write (blueprint §4.6): the existing `discardChange` Server Action keeps its contract and gains an
  optional `reason`; input validated at the boundary before any logic (a typed guard like the existing
  actions; no validation library is installed and none is added): `status: discarded`,
  `status_before_discard`, `discard_reason` only when a Motivo was typed, every other byte preserved; on
  success the dialog closes and the item leaves the default view (`revalidatePath`), on an expected failure the
  confirm shows the domain message inline and stays open; the action authorizes nothing beyond the bounded
  write (local single-operator app) and never touches a sibling file.
- `CMP-04-documents` (`_panels/DocumentosPanel.tsx`, `_components/tab-documents/`): the shared `DocIndex` and
  `Paper` (WO-08-003): purpose groups (Producto, Arquitectura y decisiones, one group per FRD module «FRD-NN
  <title>», Diseño, Analítica, Revisiones, Work orders), type `FilterChip`s with counts («Todos» first), search
  by name («Buscar documento…»), the index to the RIGHT of the reader from 900 px and folded behind the
  `aria-expanded` button «Elegir documento · N» (N = number of documents) below; the open document as `Paper`
  (type chip, path, copy button), full reader width; the `workspace.documentos.empty` and
  `workspace.documentos.emptyDocument` sentences for no documents and an empty file. Every index link and in-document link keeps the
  project and the Documentos tab (`document-links.ts`): a surfaced document opens in the same reader, an off-app
  URL in a new tab, an unknown relative target as plain text. The selected document and the type filter live
  in the URL (codec keys of WO-25-001); search typing replaces history.
- `IF-04-docs` extension (`src/lib/docs/tree.ts`): `listProjectDocs` additively surfaces the purpose groups
  above (design docs, analytics, reviews, work orders next to the product, global and per-FRD docs) and
  classifies each node's purpose group and document type; `readDoc` keeps its traversal and symlink guards;
  the document count the workspace badge and hero read comes from this same list.

**Removal list (map §6.C item 21, FRD-04 «Out of v2»):** the `implemented_sha` / `closing_at` evidence in the
dialog; the «Ver hechos (N)» / «Ver descartados (N)» toggles; the inline «¿Seguro? Sí / No» discard swap;
`src/lib/changes/formatChangeDate.ts` (relative date) and its tests; the v1 two-pane doc nav rail; any
now-unused export of `tab-changes/` and `tab-documents/`.

## Out of Scope

- The frame, tab bar and badges (WO-04-010); `countOpenChanges` semantics (WO-04-013, read only here).
- `DocIndex` / `Paper` internals (WO-08-003); the change-queue file format (owned by the factory skills).
- An unknown document id keeps today's route not-found behaviour (no state of this FRD draws another).

## Requirements & Acceptance Criteria

REQ-04-010, REQ-04-011, REQ-04-014 (Documentos), FRD-04#U3 (Cambios list), FRD-04#U4 (discard), FRD-04#U5
(Documentos navigation); this work order owns:

- **AC-04-014.8** — THE Documentos tab SHALL order its index by purpose, filter it by document type (chips with counts) and by search, render the open document as typed paper (type chip, path, copy), and SHALL place the index to the RIGHT of the reader, folded behind the button "Elegir documento · N" (N = the number of documents) below 900 px.

The REQ-level bullets of the FRD for Cambios (groups, Historial N, fail-loud banner, dialog content, scoped
command, discard flow, `building`/`closing` handling, absolute date) and Documentos (context-preserving links)
are delivered here and verified by this work order's tests.

Fidelity criterion: Cambios and Documentos visually match the mock states below on the frozen tokens,
verified by the preview smoke gate (DR-055) and the close-out fidelity diff.

Completeness (DR-100): error path per failure (unreadable change files banner; discard `not-found`,
`parse-error`, `not-discardable` inline; unreadable document); boundary validation of the action input
(id shape, reason length and type); empty states drawn above; the confirm traps focus, closes on Escape, returns focus; the index toggle
is a real button with `aria-expanded`; state chips carry words; no horizontal overflow at 320 to 1280 px.

## Visual reference

- **Mock screens:** `docs/frds/frd-04-project-workspace/mocks/project-workspace.html` sections
  `#project-changes`, `#project-change-dialog`, `#project-change-discard`, `#project-change-rebuilds`,
  `#project-documents`, `#project-documents-search`, `#project-documents-index-open`. Oracle states with the
  same ids.
- **Token slice:** `--surface`, `--line`, `--surface-3` (selected `FilterChip`), hues `--pink` (Cambios,
  change kind), `--blue` (En construcción), `--amber` (Cerrando, warning), `--slate` (Borradores, Historial),
  `--green` (Hechos), `--coral` (Bug, error banner) with `--tint`/`--tint-strong`; `--r-lg` cards, `--r-xl`
  dialog, `--shadow-dialog`; `--font-mono` for slugs, paths and commands; `--fs-sm`/`--fs-xs` meta lines.
- **FDD pointer:** `docs/frds/frd-04-project-workspace/fdd.md` (Cambios, change dialog, discard, Documentos
  rows). Reference CSS: `docs/design/prototype/reference/css/{06-card,07-chip,12-command,13-list-row,14-empty-notice,28-documents,29-markdown}.css`.

## Components and reuse

Builds `CMP-04-changes`, `CMP-04-change-dialog`, `CMP-04-documents`, extends `IF-04-changes` and `IF-04-docs`.
Reuses `Card`/`CardHeader`, `StateTile`-style tiles as drawn (`.state-strip`), `ListRow`, `Chip`, `Notice`,
`CommandBox`, `Dialog`/`DialogConfirm`, `Markdown`, `FilterChip`, `SearchField`, `Button`, `EmptyState`,
`DocIndex`, `Paper`. Creates no new components.md row. Installs: none.

## Tests

- Unit: `readChangeQueue` grouping by every status; the absolute date and the raw fallback; `discardChange`
  with and without a reason, each expected failure, byte preservation, guards; `listProjectDocs` purpose and
  type classification against a production-shaped project tree AND a malformed/symlinked one.
- Component: Cambios groups, Historial, banner, dialog per status (discard offered only for Listo/Borrador),
  confirm replacing the detail; Documentos chips, search, index placement and toggle, link resolution.
- **Derogated tests (map §3.3):** implementer-authored, updated or deleted here:
  `tab-changes/_tests/{ChangesPanel,ChangeCard,DiscardChangeButton}.test.tsx`,
  `tab-documents/_tests/{tab-documents,tab-documents.wo04005}.test.tsx`, `_actions/_tests/discard-change.test.ts`,
  `src/lib/changes/_tests/{changes,discard-change}.test.ts`, `src/lib/docs/_tests/docs.wo04001.test.ts` (where it
  pins the v1 discovered set); `src/lib/changes/_tests/formatChangeDate.test.ts` and the reviewer-authored
  `formatChangeDate.reviewer.test.ts` are deleted with their module (`git rm`, whole-module removal).
  Reviewer-authored, NOT edited (the FRD-04 gate reviewer re-blesses or rewrites them):
  `tab-changes/_tests/ChangesPanel.relativeDate.reviewer.test.tsx`, `src/lib/docs/_tests/docs.wo04001.reviewer.test.ts`.
  Visual baselines: never touched.

## Dependencies

WO-04-010 (panel contract, adapters replaced here), WO-08-003 (`DocIndex`, `Paper`).

## Definition of done

AC-04-014.8 and the Cambios/Documentos REQ bullets met with tests that fail without the change; the removal
list gone; `.pandacorp/verify.sh` green; Status Note filled.

## Status Note
