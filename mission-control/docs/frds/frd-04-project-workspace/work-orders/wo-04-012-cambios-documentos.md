---
id: WO-04-012
type: work-order
slug: cambios-documentos
title: 'WO-04-012 — Cambios and Documentos tabs'
status: ACTIVE
parent: FRD-04
foundation: false
implementation_status: VERIFIED
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
last_updated: 2026-10-31
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
  `/pandacorp:change`; the `workspace.cambios.empty` sentence when the queue is empty. Renders no `<main>`
  (the shell's `main#content` is the only one).
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
- `readChangeQueue()` keeps its item fields `id`, `title` and `status` (names and meaning) unchanged in this
  wave: WO-11-004 (same wave W6) builds the «Cambio · title» targets and `change:<id>` commands from them
  (AC-11-005.2); additions are optional fields only.
- `CMP-04-documents` (`_panels/DocumentosPanel.tsx`, `_components/tab-documents/`): the shared `DocIndex` /
  `DocItem` and `Paper` (WO-08-003, `src/components/modules/DocumentReader/`) consumed exactly as the FRD-08
  blueprint specifies them (`IF-08-doc-index`: `groups`, `query`, `onQuery`, optional `typeFilters`,
  `toggleLabel`; `IF-08-paper`: `type`, `path`, children); no fork: purpose groups (Producto, Arquitectura y decisiones, one group per FRD module «FRD-NN
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
  same ids, plus the scenario states `changes-empty` («No hay cambios abiertos en la cola.»),
  `documents-empty` («No hay documentos publicados para este proyecto.») and `document-empty-body` («Documento
  vacío.»), each reproduced from its `docs/design/prototype/reference/oracle-recipes.json` double in this work
  order's tests and at the close-out Visual QA.
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

- 2026-10-31 (S5C round 2): Patched review findings. Confirmation now requires a discardable selection, resets on URL selection changes, and clears its error on cancellation. Impossible date-only values fail the UTC round-trip and remain raw; non-ISO prose also remains raw. Duplicate command rows retain non-empty guidance without rendering empty paragraphs. Document filters/search hide empty groups and search both labels and paths. Added optional DocIndex search placeholder and DialogConfirm kicker/confirm-tone props; the discard reason is capped at 2000 characters. Singular change states and discard errors now use the copy catalogue. Updated stale action, tree and command comments. `implementation_status` remains `IN_REVIEW`; no blocked reason is present.


- 2026-10-31: Implemented the changes queue, replacement discard confirmation and shared document reader. Scoped Vitest excluding reviewer suites: 18 files / 335 tests passed. Reviewer suites remain untouched; full-gate caveats and final commands are recorded below after S5C verification.

### S5C implementation handoff — 2026-10-31

- Built before WO-11-004 on `orch/s5c`, port 3983. The queue preserves reader identity/status fields, shows the state strip and ordered active cards, combines history, names unreadable files, uses the shared absolute-date formatter and replaces detail with the shared discard confirmation. Discard writes accept an optional reason, validate boundary input and preserve unrelated bytes, including CRLF/comments/quotes. The document reader consumes shared DocIndex/Paper, adds purpose/type discovery and keeps filters/search in reader links.
- Test citations: `tab-changes/_tests/{changes.v2,ChangesPanel,ChangeCard}.test.tsx` cover REQ-04-007/008/009/010/011; `_actions/_tests/discard-change.test.ts` and `src/lib/changes/_tests/discard-change.test.ts` cover reason validation, expected failures and byte preservation. `tab-documents/_tests/tab-documents{,.wo04005}.test.tsx` and `src/lib/docs/_tests/tree.v2.test.ts` cite AC-04-014.8; document link cases cite AC-04-006.5.
- Reviewer reconciliation (untouched): remove `src/lib/changes/_tests/formatChangeDate.reviewer.test.ts` with its retired module; rewrite `tab-changes/_tests/ChangesPanel.relativeDate.reviewer.test.tsx`; reconcile `src/lib/docs/_tests/docs.wo04001.reviewer.test.ts` for the expanded discovered set (currently passes its fixture).
- Shared-contract limitation: DocIndex hardcodes the Documentation search label/placeholder and exposes no override for the project's “Buscar documento…” copy. Its module is outside S5C ownership, so it remains unchanged. DialogConfirm exposes no kicker prop; “Confirmar” is rendered in its content. Browser focus/900px layout and fidelity remain unverified because Playwright was explicitly excluded.

Verification executed from `mission-control/` with `PORT=3983 PANDACORP_E2E_PORT=3983`:

- `pnpm exec vitest run 'src/app/projects/[slug]/_components/tab-changes' 'src/app/projects/[slug]/_components/tab-documents' 'src/app/projects/[slug]/_components/tab-commands' 'src/app/projects/[slug]/_components/mode-selector' 'src/app/projects/[slug]/_actions' src/lib/changes src/lib/docs --maxWorkers=2`: 429 passed, 19 failed; 26 suites passed, five reviewer suites failed (two import/collection failures, three obsolete-contract suites). The reviewer files were not edited.
- The same scoped Vitest command with `--exclude '**/*.reviewer.*' --maxWorkers=2`: GREEN, 22 suites / 353 tests passed. This excludes reviewer-owned contracts awaiting reconciliation; it is not the full gate.
- `pnpm exec tsc --noEmit`: RED, 47 diagnostics, all in unchanged reviewer suites referring to retired Party/ModeSelector/formatChangeDate/objectives-bar or the former observabilidad tab ID. No diagnostics in S5C implementation or implementer tests.
- `pnpm exec knip`: RED, 26 unresolved imports in unchanged reviewer suites and three retained command-mode exports reserved for W7.
- `python3 /private/tmp/s5c-verify-biome.py`: GREEN, exact 27-file explicit-path Biome invocation, no fixes applied. `git diff --check`: GREEN.
- No Playwright, production build, full verify.sh, baseline blessing or browser fidelity check was run. No commits, staging, pushes, merges, merge queue, decision log or .pandacorp state writes were performed.

Explicit paths for this work order (including removed files):

- `docs/frds/frd-04-project-workspace/work-orders/wo-04-012-cambios-documentos.md`
- `src/app/projects/[slug]/_actions/_tests/discard-change.test.ts`
- `src/app/projects/[slug]/_actions/discard-change.ts`
- `src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx`
- `src/app/projects/[slug]/_components/tab-changes/ChangeDetail.tsx`
- `src/app/projects/[slug]/_components/tab-changes/ChangesPanel.tsx`
- `src/app/projects/[slug]/_components/tab-changes/DiscardChangeButton.tsx`
- `src/app/projects/[slug]/_components/tab-changes/_tests/ChangeCard.test.tsx`
- `src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.test.tsx`
- `src/app/projects/[slug]/_components/tab-changes/_tests/DiscardChangeButton.test.tsx`
- `src/app/projects/[slug]/_components/tab-changes/_tests/changes.v2.test.tsx`
- `src/app/projects/[slug]/_components/tab-changes/changePresentation.ts`
- `src/app/projects/[slug]/_components/tab-changes/changes.module.css`
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx`
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.wo04005.test.tsx`
- `src/app/projects/[slug]/_components/tab-documents/tab-documents.tsx`
- `src/lib/changes/_tests/discard-change.test.ts`
- `src/lib/changes/_tests/formatChangeDate.test.ts`
- `src/lib/changes/discard-change.ts`
- `src/lib/changes/formatChangeDate.ts`
- `src/lib/docs/_tests/docs.wo04001.test.ts`
- `src/lib/docs/_tests/tree.v2.test.ts`
- `src/lib/docs/tree.ts`

### S5C round 2 verification — 2026-10-31

Executed from `mission-control/`, with `export PORT=3983 PANDACORP_E2E_PORT=3983`:

```sh
pnpm exec vitest run 'src/app/projects/[slug]/_components/tab-changes' 'src/app/projects/[slug]/_components/tab-documents' 'src/app/projects/[slug]/_components/tab-commands' 'src/app/projects/[slug]/_actions' src/lib/changes src/lib/docs src/lib/copy src/components/modules/DocumentReader src/components/core/Modal --maxWorkers=2
```

GREEN: 36 suites, 514 tests. Reviewer suites are included and unchanged. The first run exposed the prose-date fallback (`N/A 3`); after fixing it, the final run passes. Regression tests cover Back followed by opening a done card, cancel/error reset, reason cap/danger tone, invalid calendar dates, duplicate guidance and document path search/empty groups.

```sh
pnpm exec biome check docs/design/microcopy.es.json 'src/app/projects/[slug]/_actions/discard-change.ts' 'src/app/projects/[slug]/_components/tab-changes/ChangesPanel.tsx' 'src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.test.tsx' 'src/app/projects/[slug]/_components/tab-changes/changePresentation.ts' 'src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.test.tsx' 'src/app/projects/[slug]/_components/tab-commands/tab-commands.tsx' 'src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx' 'src/app/projects/[slug]/_components/tab-documents/tab-documents.tsx' src/components/core/Modal/DialogConfirm.tsx src/components/modules/DocumentReader/DocIndex.tsx src/lib/copy/_tests/copy.test.ts src/lib/copy/dates.ts src/lib/docs/tree.ts src/lib/next-step/next-step.ts
```

GREEN: 14 source/test files checked, no fixes applied in the final check (the catalogue is ignored by the existing Biome configuration). Earlier formatting passes used the same explicit changed paths with `--write`.

```sh
pnpm exec knip
pnpm exec knip --reporter json > /private/tmp/s5c-round2-knip.json
pnpm exec tsc --noEmit
```

Global Knip remains RED: 24 unresolved imports in unchanged test files and three unused exports in unchanged `src/lib/command-modes.ts`. Comparing the JSON issue file paths against `git diff --name-only -- mission-control` reports **zero issues in changed files**. TypeScript remains RED: 45 diagnostics in unchanged reviewer/review test files (retired Party modules and the old `observabilidad` tab ID); zero diagnostics in changed files. Full outputs: `/private/tmp/s5c-round2-{knip,tsc}.log`; Vitest: `/private/tmp/s5c-round2-vitest.log`.

`git diff --check`: GREEN. No browser/Playwright, production build or full `verify.sh` run; browser focus, responsive layout and visual fidelity remain unverified. All changes are uncommitted and unstaged on `orch/s5c`; no merge, push, merge queue, reviewer-test/baseline edit, decision-log write or `.pandacorp` state write.

Round 2 changed files (relative to `mission-control/`):

- `docs/design/microcopy.es.json`
- `docs/frds/frd-04-project-workspace/work-orders/wo-04-012-cambios-documentos.md`
- `src/app/projects/[slug]/_actions/discard-change.ts`
- `src/app/projects/[slug]/_components/tab-changes/ChangesPanel.tsx`
- `src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.test.tsx`
- `src/app/projects/[slug]/_components/tab-changes/changePresentation.ts`
- `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.test.tsx`
- `src/app/projects/[slug]/_components/tab-commands/tab-commands.tsx`
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx`
- `src/app/projects/[slug]/_components/tab-documents/tab-documents.tsx`
- `src/components/core/Modal/DialogConfirm.tsx`
- `src/components/modules/DocumentReader/DocIndex.tsx`
- `src/lib/copy/_tests/copy.test.ts`
- `src/lib/copy/dates.ts`
- `src/lib/docs/tree.ts`
- `src/lib/next-step/next-step.ts`
