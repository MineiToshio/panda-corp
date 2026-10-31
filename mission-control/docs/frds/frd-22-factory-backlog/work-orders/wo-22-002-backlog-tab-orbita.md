---
id: WO-22-002
type: work-order
slug: backlog-tab-orbita
title: Backlog tab Órbita - priority tiles, topic bars, Cómo avanzar, groups, history, item dialog
status: ACTIVE
parent: FRD-22
foundation: false
implementation_status: VERIFIED
difficulty: medium
reopen_count: 0
artifacts: ["src/app/proposals/_components/{BacklogPanel,AreaBar}/**", "src/app/proposals/_actions/**", "src/components/core/StateTile/**", "e2e/backlog.spec.ts", "e2e/fixtures/factory-root/factory/backlog/BL-90*.md", "e2e/persistent-navigation/proposals.spec.ts"]
source_requirements: [REQ-22-001, REQ-22-003, REQ-22-004, REQ-22-005, REQ-22-006, REQ-22-007, REQ-22-009, REQ-22-010]
dependsOn: [WO-22-001, WO-13-012, WO-25-001]
last_updated: '2026-10-30'
---

# WO-22-002 Backlog tab Órbita

> Blueprint: [`../blueprint.md`](../blueprint.md) (`CMP-22-*`). Design: [`../fdd.md`](../fdd.md).
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Summary

Rebuild the Backlog panel of Propuestas on the Órbita system: three priority tiles and the "Por tema" bars that
filter, the "Cómo avanzar" card with the two commands, a type toolbar, En curso then Abiertos grouped by P0,
P1 and P2 and paged, one collapsed "Hechos y descartados N" card, a coral read-error notice naming the broken
files, and the item dialog with its own command and the discard confirmation that replaces it. The tab shell
and the count badge are WO-17-008's; this work order exports `BacklogPanel({ result })` and the core
`StateTile`.

## In Scope

- `BacklogPanel` (client, props `{ result: BacklogReadResult }`, root `data-testid="backlog-panel"`), with the
  parts named in the blueprint: priority tiles, `AreaBar` bars, "Cómo avanzar" card, type chips with the item
  count and "Quitar filtros", En curso card, Abiertos card with P0, P1, P2 and "Sin prioridad" sub-groups,
  the history card, the read-error notice, the item dialog and the confirmation.
- `src/components/core/StateTile/` (new, generic, relocated from the components.md path; see blueprint
  `CMP-22-statetile`): label with dot, display number, hint, optional bar, `aria-pressed`; used here for the
  priority tiles and by WO-05-008 later.
- The filter semantics, page sizes, `MoreBar` rule, history ordering and status labels of the blueprint
  "Contracts" section; the opened item through the codec's `backlogItem` key; everything else is component
  state (AC-22-002.4 is delivered by WO-17-008's tab shell, which keeps this panel mounted).
- `discardBacklogAction(id, reason?)` in `src/app/proposals/_actions/discard-backlog.ts`: validate the input
  shape (id pattern, reason bound) with a narrow type guard (no new dependency), call the write, revalidate
  `/proposals` on success, return the typed result; the dialog closes on success and shows the typed failure
  inline otherwise.
- A behaviour e2e spec `e2e/backlog.spec.ts` (`gotoHydrated`, `getByRole`, no hard waits) over three fixture
  items added only as `e2e/fixtures/factory-root/factory/backlog/BL-90*.md` (never editing an existing
  fixture file): filter by tile and by bar, "Quitar filtros", open an item dialog, copy command visible, open the
  confirmation and cancel (the real write is covered by the lib and action tests, so the spec leaves no
  persistent test data).

## Out of Scope

- The tab strip, the count badge on "Backlog" and keeping the panels mounted with `data-volatile`: WO-17-008.
- The reader, the area helpers and the write itself: WO-22-001.
- Creating or editing backlog items; any execution of a command (Mission Control only shows commands).

Owned elsewhere: AC-22-001.1, AC-22-004.1, AC-22-004.3, AC-22-007.2, AC-22-008.1 (WO-22-001); AC-22-002.1 to
AC-22-002.4 (WO-17-008, the tab shell that mounts this panel).

### Removals (map §6.C item 20; delete in this work order, with their tests)

- The evidence line (`source` + `links`) on the cards and the source, links and dates block in the dialog.
- The "Ver hechos" / "Ver descartados" toggle buttons and the separate lists they opened.
- `BacklogCard.tsx` and `DiscardBacklogButton.tsx` (their roles move into `BacklogRow` and the dialog), and the
  v1 tests that pin them (`_tests/BacklogPanel.test.tsx` is rewritten; `_tests/DiscardBacklogButton.test.tsx`
  is deleted).
- The prototype's slate "Esta maqueta…" notice is NOT built: it is prototype wording with no catalogue key
  (reported in the ledger); the confirmation shows the sentence, the optional field and the two buttons.

## Requirements & Acceptance Criteria

REQ-22-001 (grouping and cards), REQ-22-003, REQ-22-004 (panel half), REQ-22-005, REQ-22-006, REQ-22-007
(dialog half), REQ-22-009, REQ-22-010. The acceptance criteria this work order owns, copied from `frd.md`:

- **AC-22-001.2** — The Backlog panel SHALL group items by `status`; **En curso** (doing) and **Abiertos** (open) render by default, in that order, each a section with its count, its items ordered by priority then id (see REQ-22-008). **Hechos** (done) and **Descartados** (discarded) do NOT render by default — they sit together in one collapsed card, "Hechos y descartados N" (REQ-22-006, REQ-22-007). An empty backlog SHALL show an explicit empty state.
- **AC-22-001.3** — Each item SHALL render as a card visually consistent with the memory ProposalCard (DR-062): mono `id`, a type chip ("Bug" or "Mejora", an outline chip), the area as plain text in plain names ("Motor de construcción", "Skills", "Plantillas de proyecto", "Controles automáticos", "Estándares", "Agentes", "Plugin"), a priority label ("P0 · URGENTE", "P1 · IMPORTANTE", "P2 · CUANDO HAYA TIEMPO"; text, never colour alone) and the title. **Out of v2 (owner decision 2026-10-21):** the evidence line (`source` + `links`) on the card; it shows in the item dialog metadata.
- **AC-22-003.1** — The Backlog panel SHALL explain, in the "Cómo avanzar" card (AC-22-010.3, which replaced the how-to note), that these are actionable items worked by asking an agent (e.g. «implementa BL-0007»), and that Mission Control only displays and (per REQ-22-007) lets the owner discard them — it never creates, closes or edits the content of a `factory/backlog/` item (consistent with the FRD-17 read-only boundary, minus the one bounded discard write).
- **AC-22-004.2** — WHEN the reader reports one or more errors, the Backlog panel SHALL render a coral error notice (`role="alert"`) naming the offending file(s) and reason(s) (including a duplicate id), while still listing the items it could parse (state `backlog-errors`, M1 2026-10-22).
- **AC-22-005.1** — Each backlog card SHALL be an accessible control (a `<button>`, keyboard-operable, with an `aria-label` naming the item) that opens a **detail modal** for that item. The detail opens in the shared `Modal` primitive (focus-trapped, Escape-closes, backdrop-click-closes) — never an inline expand (the app's modal-for-detail rule).
- **AC-22-005.2** — The backlog reader SHALL expose each item's markdown **body** (everything after the frontmatter), and the detail SHALL render it as **titled, colour-coded sections** via the shared `SectionedMarkdown` primitive — each `## Heading` (Problem / Root cause / Fix plan / Tests / Done when / Out of scope) becomes a real section header (icon + coloured label) with its content rendered as markdown (lists, code, tables), NOT one wall of text or a raw string. This is the same `SectionedMarkdown` primitive the memory-lesson detail uses (it auto-detects `## Heading` vs `**Label:**` sections), so both detail modals share one look (DR-062).
- **AC-22-005.3** — The detail SHALL show the item's metadata (the title "<id> · <title>", a priority chip, a type badge "Bug" or "Mejora", and status and area chips — the status in Spanish: "En curso", "Abierto", "Hecho", "Descartado") above the rendered body. **Out of v2 (owner decision 2026-10-21):** source / links / dates in the detail. Section headings that come from the item file (for example "Proof") are shown content and keep their source language. Read-only: the detail has no write/close-item affordance (working an item is done by an agent, AC per Non-goals).
- **AC-22-006.1** — GIVEN the backlog has any `done` or `discarded` items, ONE collapsed card "Hechos y descartados N" (N = their combined count) SHALL render below the always-visible groups; the card SHALL be omitted entirely when there are none. (Amended 2026-10-22: it replaced the "Ver hechos (N)" and "Ver descartados (N)" toggle buttons.)
- **AC-22-006.2** — Opening the card SHALL reveal the history list (the same card list as the other groups, paged with "Mostrar N más · quedan M"); collapsing it hides the list again.
- **AC-22-006.3** — This mirrors the same default-hide pattern used by the project-level Cambios tab (Mission Control FRD-04, REQ-04-009) — so the closed-item history of neither queue clutters its actionable view as it accumulates over months.
- **AC-22-007.1** — WHEN a backlog item is `open` or `doing`, its detail dialog SHALL offer a **"Descartar del backlog"** action that opens a confirmation dialog replacing the detail (no nested modal) with an optional "Motivo (opcional)" field, and on confirm rewrites `status: discarded` (ADR-0002 pattern) and closes the dialog on success; never offered for `done` or already-`discarded` items.
- **AC-22-007.3** — A discarded item moves out of the default En curso/Abiertos view into the collapsed card "Hechos y descartados N" (REQ-22-006), mirroring the project-level Cambios tab (FRD-04 "Historial N").
- **AC-22-009.1** — WHEN the backlog has at least one `open`/`doing` item, the "Cómo avanzar" card (AC-22-010.3, above the list) SHALL render a `CmdRow` with the generic command `/pandacorp:implement-backlog` (no id) — the same copy-to-clipboard affordance used elsewhere in Mission Control (never executed by the app itself, FRD-01's golden rule). Omitted entirely when there are zero actionable items. (Amended 2026-10-22: the command moved from below the list into the card.)
- **AC-22-009.2** — An `open`/`doing` item's detail modal SHALL render a `CmdRow` with the item's own targeted command, `/pandacorp:implement-backlog <id>`; a `done` or `discarded` item never shows it (the same actionable set REQ-22-007 uses for the discard action).
- **AC-22-010.1** — WHEN a priority tile (P0, P1 or P2, each with its count) is activated, THE backlog SHALL show only that priority.
- **AC-22-010.2** — WHEN a bar of "Por tema" (the plain-name areas, with merged areas counted together) is activated, THE backlog SHALL show only that topic; "Quitar filtros" SHALL clear the filters and an empty result SHALL read "Nada abierto con este filtro."
- **AC-22-010.3** — THE backlog SHALL show a "Cómo avanzar" card with the whole-queue command first ("Todo de una vez.", with its cost warning) and then the one-at-a-time command ("Uno por uno.", recommended), each with where it runs.
- **AC-22-010.4** — THE open items SHALL be grouped by priority sub-groups (P0 URGENTE, P1 IMPORTANTE, P2 CUANDO HAYA TIEMPO) and paged with "Mostrar N más · quedan M".

Completeness (definition of done beyond the ACs): the empty backlog state (explicit `EmptyState`), the loading
state is none (server-delivered data, no client skeleton), the typed failure of the write shown inline in the
confirmation (never a raw exception), input validation of the Server Action (it is a public POST: id pattern
`BL-` + digits, reason at most 500 characters, status checked by the write), a11y (filters are `<button>`s in
named groups with `aria-pressed`, selected state neutral, rows are buttons with an `aria-label`, dialogs native
with focus return to the row), reduced motion (no motion beyond the dialog's), tabular numbers, no text below
12 px, tokens only.

## Components & interfaces it builds

`CMP-22-panel`, `CMP-22-tiles`, `CMP-22-areabar`, `CMP-22-howto`, `CMP-22-list`, `CMP-22-history`,
`CMP-22-errors`, `CMP-22-dialog`, `CMP-22-statetile` and `IF-22-action` (blueprint). Copy: every string comes
from `propuestas.backlog.*`, `propuestas.priority.*`, `dialogs.backlogItem.*`, `dialogs.confirm.*`,
`dialogs.default.close` through `t()`; the written priority headings and the status labels are catalogue keys;
no literal Spanish in the components. The opening date on a row ("17 oct. 2026") uses the shared absolute-date
formatter of `src/lib/copy/` (WO-13-010), not a local one.

## Reuse (components.md: reuse, then adapt, then create)

Reuse `Card`/`CardHeader`, `Chip`/`FilterChip`, `CommandBox`, `ListRow`, `MoreBar`, `Dialog`/`DialogConfirm`,
`EmptyState`/`Notice`, `SectionedMarkdown`, `Icon`. Adapt: `StateTile` (components.md lists it under the
Observabilidad route; created here in `components/core` and reused by WO-05-008). Create: `AreaBar` (row exists
in components.md, status new) and the panel parts. Check the inventory again at build time; append no row to
components.md (frozen) and report a gap in the ledger.

## Installs

None.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-22-factory-backlog/mocks/factory-backlog.html`, sections
  `backlog`, `backlog-priority-filter`, `backlog-area-filter`, `backlog-item-dialog`, `backlog-discard-confirm`,
  `backlog-history-open`, `backlog-errors`; screenshots in `mocks/screenshots/<id>-<width>-<theme>.jpg`
  (375/768/1280, light and dark; the two dialogs at 375 and 1280).
- **Oracle states** (`docs/design/prototype/reference/oracle-states.json`, recipes in `oracle-recipes.md`,
  frd slug `frd-22-factory-backlog`): the same seven ids plus `backlog-open-empty` («Nada abierto con este
  filtro.», scenario state reproduced from its `oracle-recipes.json` double); `backlog-errors` is the fixture
  overlay with a malformed card and a duplicate `BL-0013`. Keep the prototype's recorded classes and hooks (`.state-strip`,
  `.state-tile`, `.area-bars`, `.area-bar`, `.bl-row`, `.band-sub`, `.morebtn`) on those elements.
- **Token slice:** `--tint-strong` and the hue tokens of coral (P0, bug, error), amber (P1), slate (P2, plain
  chips), blue (Abiertos, Por tema, Mejora), violet (En curso, Cómo avanzar), green (history); `--surface`,
  `--surface-2`, `--line`, radii 16 (cards) and 22 (dialog), 40 px dashed `MoreBar`, 34 px `FilterChip`,
  display font for numbers, mono for ids and commands only.
- **FDD pointer:** `docs/frds/frd-22-factory-backlog/fdd.md`.
- **Fidelity acceptance criterion:** the built tab visually matches `mocks/factory-backlog.html` (layout,
  structure, components, density) on the frozen tokens, not an approximation; verified by the preview smoke and
  shell gates at the FRD gate and by the computed-style and pixel diff of the seven oracle states at the
  close-out Visual QA (DR-056, DR-129). The two cards side by side end at the same height and stack below
  1024 px with the actionable side first.

## Tests this work order owns

Component tests by role and name in `BacklogPanel/_tests/` (filters combine and clear, counts follow filters,
sub-groups and paging with the `MoreBar` label rule, history collapsed and omitted when empty, error notice with
`role="alert"` listing file and reason, dialog fields per status including no command and no discard for
`done`/`discarded`, confirmation replaces the detail and cancel returns to it, typed failure inline); the
Server Action test (validation, success revalidates, failure does not); the e2e spec above. Fixtures through
builders; no whole-component snapshots.

## Derogated tests (BL-0051)

- Implementer-authored, updated or deleted here: `BacklogPanel/_tests/BacklogPanel.test.tsx` (rewritten),
  `BacklogPanel/_tests/DiscardBacklogButton.test.tsx` (deleted with the component).
- Reviewer-authored, not edited here (DR-080): assertions about the Backlog panel inside
  `src/app/proposals/_tests/*.reviewer.test.tsx` are derogated by this work order and re-blessed or rewritten by
  the FRD gate's reviewer; WO-17-008 owns the page-level tests of the same folder.
- Visual baselines of `/proposals` are derogated by WO-19-002 and again here; implementers never touch
  `e2e/visual.spec.ts-snapshots/**` (the reviewer re-blesses at the close-out).
- `backlog-panel` (the `data-testid` of the panel root) is part of this work order's contract. The split oracle
  files created by WO-25-001 (W0) are updated here where the Órbita panel breaks them (BL-0051): the backlog
  read-only detail steps of `e2e/persistent-navigation/proposals.spec.ts` (WO-17-008 updates the tab steps of the
  same file in W4) and `BacklogPanel/_tests/persistentNavigation.test.tsx` (the completed-item case: Backlog
  filters and status disclosure are tab-local state in v2, AC-22-002.4, so `backlogGroups` leaves the URL while
  `backlogItem` stays).

## Dependencies

WO-22-001 (reader, area helpers, reason-aware write); WO-13-012 (composite primitives, through which the leaf
primitives of WO-13-011 are available); WO-25-001 (the split oracle files and the `backlogItem` key; W0, so the
wave stays W3). Consumer: WO-17-008. WO-05-008 reuses `StateTile` (ledger request).

## Status Note

- 2026-10-30 (S3C round 2): Kept `IN_REVIEW`. The individual how-to command now names the first actionable item and singular counts use catalogue plurals. Successful discard closes the URL from an effect after the action transition settles; confirmation kicker/placeholder, file-error formatting, empty-backlog and unknown-item copy were corrected. Added regression assertions for a pasted item URL and a browser discard/reload scenario; disposable BL-90 fixtures are swept before and after each test.
- 2026-10-30 (S3C round 2 verification, PORT=3962 and PANDACORP_E2E_PORT=3962): `pnpm exec knip`, `pnpm exec tsc --noEmit` and `pnpm exec biome check .` exited 0 (nine knip hints and one existing Biome schema-version informational notice). The requested scoped Vitest run with `--maxWorkers=2` passed 361/362 tests; only `frd-22-gate.reviewer.test.tsx:116` remains red because it expects `Nada abierto con este filtro.` for an empty backlog, while the requested patch renders the dedicated empty-backlog sentence. Reviewer tests and blessed baselines were left untouched. The temporary port-3962 Playwright run of `e2e/backlog.spec.ts` and `e2e/proposals.spec.ts` could not exercise the browser: Chromium failed to launch with sandbox `bootstrap_check_in` permission denied. The initial server attempt also hit Watchpack EMFILE; polling let the server start. Real discard/reload behavior remains unverified in a browser. Changes are uncommitted and unstaged; no queue, merge, push or decision-log write was performed.

- 2026-10-30 (S3C): Built priority/topic/type filters, paged status groups and combined history, native item detail and replacing discard confirmation, bounded reason-aware action, and reusable StateTile. Targeted Vitest: 3 files / 10 tests passed; `pnpm exec tsc --noEmit` passed. Added behavior e2e with per-test fixture restoration; Playwright and visual fidelity are unverified (worker sandbox). Reviewer suites and blessed baselines remain untouched; page-level v1 backlog assertions require reviewer reconciliation. Changes remain uncommitted by owner instruction.
- 2026-10-30: Final local slice: 3 Vitest suites / 13 tests passed (panel, persistent detail and bounded action); all 18 owned ACs are cited. Cross-WO tab citations were moved to Out of Scope, as required by the W3 plan, to keep this WO's AC gate independent. After WO-17-008's module removals the combined TypeScript/knip gates are RED only on the five untouched reviewer imports listed in that WO; full Vitest has eight derogated reviewer suites RED. No claim of a green full gate is made.
- 2026-10-30 (agent-inferred): React 19 resets an uncontrolled form after an action resolves even when the result is a typed failure. The reason field is controlled so a failed discard preserves the owner's explanation for retry; the regression test covers the failure followed by a successful retry. The shared SectionedMarkdown renderer is consumed unchanged, including its existing visual section labels; semantic section-heading tags and browser visual/focus fidelity were not independently verified in this slice.
