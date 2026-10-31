---
id: WO-13-012
type: work-order
slug: composite-primitives
title: 'WO-13-012 — Órbita composite primitives and framing patterns'
status: ACTIVE
parent: FRD-13
foundation: true
implementation_status: IN_REVIEW
difficulty: high
reopen_count: 0
artifacts:
  - "src/components/core/{Card,PageHead,PageTitle,PageLayout,Crumbs,SectionHead,Tabs,EmptyState,Notice,Banner,Modal,Table,ListRow,Markdown}/**"
source_requirements: [REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007, REQ-13-009]
dependsOn: [WO-13-011]
last_updated: 2026-10-30
---

# WO-13-012 — Órbita composite primitives and framing patterns

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`../blueprint.md`](../blueprint.md) (CMP-13-composite). Inventory:
> [`docs/design/components.md`](../../../design/components.md) § Framing patterns and § Primitives;
> rules in root `DESIGN.md` § Shared component rules.

## Summary

Builds or restyles in place the composite primitives and the app-wide framing patterns that keep
Mission Control one coherent application (DR-062): `Card` with `CardHeader` and `CardFoot`, `PageHead`
with `Crumbs`, `SectionHeading`, the one `Tabs` pattern, `EmptyState`, `Notice`, `AlertBanner`, the
`Dialog` family (`DialogConfirm`, `DialogSheet`), `Table` (one card per row below 1024 px from one DOM),
`ListRow` and the type-tinted `Markdown`. After this work order every surface assumes the whole
inventory exists.

## In Scope

Each pattern keeps the prototype hooks on its root (`.card`, `.card-head`, `.card-title`, `.card-foot`,
`.pagehead`, `nav.crumbs`, `.saga-head`, `.saga-line`, `.tabs-wrap > .tabs[role=tablist]`, `.empty`,
`.notice`, `.alert-banner`, `dialog#dlg`, `table.t`, `.table-wrap`, `.lrow`, `.divided`, `.md`) and uses
the leaf primitives of WO-13-011 (no re-implemented chip, button or icon tile).

1. `Card` (new folder `Card/`; restyles the look v1 `Panel` gave, `Panel` itself is deleted by
   WO-13-013): surface `--surface`, hairline `--line`, radius 16, padding 20 / 24, optional `data-tone`;
   variants `flush` (divided list inside) and `tinted` (top gradient of the hue); `CardHeader` = 26 px
   `BadgeIcon` (sm) in the hue + ONE title size (19 px / 700, any heading `level`) + count pill in the
   same hue + optional action; `CardFoot` (top hairline, actions). Card pairs end at the same height and
   collapse to one column below 1024 px, actionable side first (layout helpers in the same module).
2. `PageHead` (new folder `PageHead/`) with optional `Crumbs`, optional eyebrow slot, ONE `h1` (32 px
   display) equal to the nav label on top-level pages and to the item's own name on drill-ins, subtitle
   at most 70ch, actions at the right (wrapping). `Crumbs` (new folder): last item `aria-current="page"`,
   accessible name from the catalogue's breadcrumb label (drawn by the drill-in states of FRD-02, FRD-04
   and FRD-08). `PageTitle` and `PageLayout` are restyled as thin
   compatibility wrappers over `PageHead` (exports unchanged; `PageLayout` renders a section, leaving
   the sole `main#content` to the shell, resolving plan risk R16 in S1A on 2026-10-30; both wrappers
   are deleted by WO-13-013). `PageHead` itself never renders a `<main>`.
3. `SectionHeading` (restyle in place: module and export stay `SectionHead/SectionHead.tsx` /
   `SectionHead`): display 15 px / 700 in TEXT colour, icon in the section hue, hairline, muted note and
   optional link at the right.
4. `Tabs` (restyle in place, `Tabs/Tabs.tsx`): 46 px buttons with a 15 px icon and optional count chip;
   selected = text colour, tinted icon and a 2.5 px bottom bar in the tab's hue (`tone` per tab); overflow
   arrows with 28 px fades and the catalogue's previous / next names (`common.tabs.*`); arrow keys move
   between tabs (`useKeyboardNav`, REQ-13-009); the selected tab scrolls into view on phones. Selection
   is controlled by the caller (URL-owned, FRD-25); `SubTabs` keeps compiling for its v1 consumers.
5. `EmptyState` (new folder): dashed box, 22 px icon, one sentence. `Notice` (new folder): tinted by
   tone with an icon, for upgrade, error and unavailable-source messages; the error variant is the one
   every surface uses for its read-error state.
6. `AlertBanner` (restyle in place: module and export stay `Banner/Banner.tsx` / `Banner`, consumer of
   `Notice`'s anatomy): the only coral alert banner (the plugin warning is its sole v2 use, FRD-15 /
   FRD-18); hosts a `CommandBox`. No second banner style anywhere (DR-057).
7. `Dialog` family (restyle in place: module and export stay `Modal/Modal.tsx` / `Modal`, plus new
   exports `DialogConfirm` and `DialogSheet`): one native `<dialog>` (`#dlg` hook), width
   `min(680px, 100vw − 32px)`, radius 22, tinted sticky head with an uppercase kicker in the dialog's
   hue, display title, close icon button, 20 px body; native Escape; focus moves in on open and returns on
   close to the opener **only if the opener is still in the document** (the 2026-10-16 shared modal focus
   rule); the pop animation is transform only and the text never fades (REQ-13-005). `DialogConfirm`
   adds Cancelar / verb and an optional reason field; `DialogSheet` is the label | content rows layout
   (128 px labels) for detail sheets. Renders in place, no portal.
8. `Table` (new folder): uppercase 12 px heads on `--surface-2`, hairline rows; below 1024 px each row
   becomes a card with `data-label` captions from the SAME markup (CSS switch, no second DOM tree).
9. `ListRow` (new folder): icon tile + title + small muted line + chips + chevron, min 56 px, `divided`
   hairlines; on phones chips and commands move under the title.
10. `Markdown` (restyle in place): rendered markdown in the document type's hue (tinted h1 underline and
    h2, small-label h4 to h6, tinted table heads and zebra rows, tinted code), tables keep whole words
    and scroll sideways with the catalogue's scroll hints (`states.scrollable.*`); `tone` and `compact`
    props; existing heading-anchor behaviour unchanged.

Removals in this WO: none (compat wrappers stay until WO-13-013).

## Out of Scope

- `Paper` / `DocIndex` (WO-08-003), `DataModelViewer` (FRD-02), `AppShell` (WO-19-002).
- Migrating consumers; deleting `Panel`, `PageTitle`, `PageLayout`, `DocHeading`, `KanbanColumn`
  (WO-13-013).

## Requirements & Acceptance Criteria

No acceptance criterion is owned here (map §7: AC-less foundation WO). It delivers REQ-13-004
(elevation and radius only from the token scales), REQ-13-005 (transform-only motion, dialog pop
without fading text), REQ-13-007 (notices and empty states carry an icon and text) and REQ-13-009
(keyboard tab strips, dialog focus management, Spanish accessible names) at the pattern level, and
REQ-13-002's neutral chrome. AC-13-010.1 is WO-13-011's; its rule binds these patterns too.

**Fidelity criterion.** Each pattern's computed styles match its `computed-styles.json` record (L1
exact, L2 ±1 px) on the frozen tokens in both themes; the dialog box is compared at the shard size
(`fidelity-checklist.md` § Signature details 12).

**Completeness (DR-100).** Dialog: focus trap, Escape, focus return guarded by `isConnected`, the
backdrop token, scroll lock without layout shift. Tabs: roving tabindex, `aria-selected`,
`aria-controls`. Table: header association preserved in the card layout (`data-label`). Notice error
variant: never a raw exception string, the caller passes the domain message. Reduced motion: no
dialog pop, no tab-bar slide. Contrast: tokens only.

## Reuse (components.md)

Restyle in place: `Tabs`, `SectionHead` (SectionHeading), `Banner` (AlertBanner), `Modal` (Dialog),
`Markdown`, `PageTitle` / `PageLayout` (compat over `PageHead`). Create (status new): `Card`
(+ `CardHeader`, `CardFoot`), `PageHead`, `Crumbs`, `EmptyState`, `Notice`, `Table`, `ListRow`, each in
its own folder because it owns tests (relocation recorded in the blueprint). Reuses WO-13-011's
`Chip`, `Button`, `IconButton`, `BadgeIcon`, `CommandBox`, `Field`, and WO-13-010's `Icon`, `t()`,
`useKeyboardNav`, `LiveRegion`.

## Installs

None.

## Visual reference

- **Mock screens:** `docs/design/prototype/components.html` (rows Card, CardHeader, CardFoot, PageHead,
  Crumbs, SectionHeading, Tabs, EmptyState, Notice, AlertBanner, Dialog, DialogConfirm, DialogSheet,
  Table, ListRow, Markdown). These patterns have no FRD-13 oracle state; they are exercised by every
  surface's states (for example FRD-15's `plugin-banner` for `AlertBanner`, FRD-02's `idea-frd-dialog`
  for `DialogSheet`). Portable CSS: `docs/design/prototype/reference/css/06-card.css`,
  `13-list-row.css`, `14-empty-notice.css`, `16-table.css`, `19-page-header.css`, `20-tabs.css`,
  `29-markdown.css`, `33-dialog.css`, `55-shared-rules.css`.
- **Token slice:** `--surface`, `--surface-2`, `--line`, `--text`, `--text-3`, `--tone` / `--tint` /
  `--tint-strong`, `--r-lg` (16), `--r-xl` (22), `--fs-h1` (32), `--fs-h3` (19), `--shadow`,
  `--shadow-dialog`, `--backdrop`, `--s5` / `--s6`, `--dur`, `--ease`.
- **FDD pointer:** `docs/frds/frd-13-visual-system-accessibility/fdd.md` (shared modal focus rule) and
  root `DESIGN.md` § Shared component rules.

## Tests (owned)

- `Card`: header anatomy (icon tile, one title size at any `level`, same-hue count pill); `flush` and
  `tinted` variants.
- `PageHead`: exactly one `h1`; crumbs' last item `aria-current="page"`; compat `PageTitle` /
  `PageLayout` render through it (their existing tests updated).
- `Tabs`: arrow-key navigation, controlled selection, count chip accessible name, overflow buttons'
  names.
- `Dialog`: opens as a native dialog with focus inside; Escape closes; focus returns to a connected
  opener and does not move to a detached one (project switch); `DialogConfirm` reason field labelled;
  `DialogSheet` rows.
- `Table`: one DOM; each cell carries its `data-label`.
- `Notice` / `EmptyState` / `AlertBanner`: icon plus text, never colour alone; the banner hosts a
  `CommandBox`.
- `Markdown`: tone application and the scroll hint on wide tables (existing anchor tests unchanged).

### Derogated tests (map §3.3, BL-0051)

- Implementer-authored tests of the restyled modules (`Tabs`, `SectionHead`, `Banner`, `Modal`,
  `Markdown`, `PageTitle`, `PageLayout`, `Panel`-dependent assertions): updated in this change.
- Reviewer-authored, never edited: `src/components/core/Modal/_tests/Modal.focus.reviewer.test.tsx`
  must stay green (the focus rule is unchanged); the two `frd13-wo0*-09*.reviewer*` suites (see
  WO-13-011) must also stay green until WO-04-010 (W5) `git rm`s them with the `party/*` set they import
  (their only ending; nothing re-blesses them): the restyle in place keeps the behaviour and `data-testid`s
  they pin of `Tabs`, `SectionHead`, `PageTitle`, `Banner`; if it would turn one red, stop and report.

## Definition of done

- All owned tests green; `.pandacorp/verify.sh` green; every v1 consumer still compiles and renders.
- Status Note lists each pattern's export, path and props, including the canonical-name mapping
  (Dialog = `Modal`, AlertBanner = `Banner`, SectionHeading = `SectionHead`).

## Dependencies

WO-13-011 (Chip, Button, BadgeIcon, CommandBox, Field). Consumers: WO-19-002 and every surface WO.
Cites LESSON-0364 (only the inner content cap goes; the shell frame keeps its envelope, relevant to
`PageHead` / `Card` widths inside the 1180 px frame).

## Status Note

### 2026-10-30 — S1A round 2 review patches

- Tabs scrolls only its own horizontal strip on phone widths, with keyboard focus using
  `preventScroll`; it never calls `scrollIntoView`. Both global icon hooks (`.i` and `.ti`) take the
  selected tone or inactive `--text-3`. Panel associations are emitted only for caller-supplied
  `panelId` or `panelIdPrefix`; the published blueprint default now states this contract.
- Dialog retains native top-layer positioning by removing `position: relative`. Only `::backdrop`
  paints the backdrop token and blur; the transparent test-host dismissal hook remains. Reopening a
  DialogConfirm clears the typed reason. Banner uses `--tint-strong` and the 55% border mix.
- B1's main landmark is outside this patch and remains owned by WO-19-002.
- No commits, staging, merges, pushes, merge queue, reviewer-test edits or baseline changes.

- Verification from `mission-control/`, with `export PORT=3941 PANDACORP_E2E_PORT=3941`:
  - `pnpm exec tsc --noEmit --project /private/tmp/mission-control-s1a-round2.tsconfig.json` passed.
    This temporary config extends this checkout's tsconfig, includes the eight affected core folders
    and their tests, vitest.setup.ts and installed Next CSS declarations; it is not a whole-app check.
  - `git diff --name-only --relative -- src/components/core | xargs pnpm exec biome check` passed
    (11 changed source/style files); `git diff --check` passed.
  - `pnpm exec vitest run src/components/core/{Tabs,Modal,CmdRow}/_tests/*.s1a.reviewer.test.tsx src/components/modules/BuildModePicker/_tests/BuildModePicker.reviewer.test.tsx --maxWorkers=2 --reporter=dot`
    passed: 36 tests, four files, including all eight new S1A reviewer tests.
  - `pnpm exec vitest run src/components/core/{CmdRow,CopyButton,Toast,TierBadge,ProgressBar,Tabs,Modal,Banner} --maxWorkers=2 --reporter=dot`
    passed: 169 tests, 18 files. This includes the restored stable Toast test hook; an earlier broad
    run caught the temporary accidental change to that hook before its restoration.
  - `pnpm exec vitest related src/components/core/{CmdRow/CmdRow.tsx,CopyButton/CopyButton.tsx,Tabs/Tabs.tsx,Modal/DialogConfirm.tsx,Toast/Toast.tsx,TierBadge/TierBadge.tsx,ProgressBar/ProgressBar.tsx,Banner/Banner.module.css,Modal/Dialog.module.css,Tabs/Tabs.module.css,CmdRow/CmdRow.module.css} --run --maxWorkers=2 --reporter=dot`
    completed with 2435 passed / 2 failed tests in 190 files before the final progress compatibility
    correction. Failures: `src/app/proposals/_tests/proposals-page.test.tsx:319` requires a standalone
    main landmark (B1, explicitly outside S1A); the unchanged legacy reviewer2 test requires the
    `--color-ok` completion token. ProgressBar now uses `var(--green, var(--color-ok))`, preserving
    the v2 hue with a legacy fallback. The full related suite was not repeated after this correction.
  - `pnpm exec vitest related src/components/core/ProgressBar/ProgressBar.tsx --run --maxWorkers=2 --reporter=dot`
    passed after the final correction: 140 tests, four files, including the unchanged reviewer2 test.
  - Node localStorage, legacy test act() and manual derivation warnings were emitted. B1 remains red.
    No full verify.sh, browser/Playwright, phone computed-style measurement, theme visual check or
    pixel/fidelity gate was run. Reviewer tests and blessed visual baselines are unchanged.


### 2026-10-30 — S1A completion (supersedes the deferred-restyle assumption below)

- `Tabs/Tabs.tsx`: additive contract published in the blueprint first. Existing level/tabs/active/
  onChange/ariaLabel/testIdPrefix/tabIdPrefix remain accepted; level now defaults to top and tabs may
  be readonly. Exported `TabDef` adds tone/panelId/disabled, and Tabs adds panelIdPrefix. SVG and legacy
  ti-* icons work. The one strip uses 46 px buttons, hue underline, count pill, 28 px fades and named
  overflow controls. Arrow keys/Home/End skip disabled tabs; Enter/Space select without owning the URL.
  Panel associations and selected-tab scroll are provided; SubTabs stays exported.
- `SectionHead/SectionHead.tsx` (SectionHeading): neutral 15 px/700 title, tinted icon, hairline;
  existing label/count/icon/rightHtml plus optional tone/note/link. Root hooks saga-head/saga-line.
- `Banner/Banner.tsx` (AlertBanner): coral rounded alert anatomy with the same tone/kind/icon/heading/
  detail/children/commandRow/dismissible/onDismiss/items/collapseAfter contract and old test hooks.
  Legacy tone values keep distinct geometric icons; the alert surface is uniformly coral. Command rows
  compose CmdRow's box presentation, with no edge stripes. Existing legacy collapse phrases remain
  compatibility copy; no frozen catalogue keys were changed.
- `Modal/Modal.tsx` (Dialog): native in-place dialog#dlg with showModal/close/cancel, 680 px default cap,
  tinted sticky head, optional tone/kicker/footer/className, labelled title, SVG close control and
  20 px body. Existing props, backdrop/close/panel test hooks and `Cerrar modal` accessible name remain.
  Focus moves to the dialog, both Tab directions are trapped, current close callbacks do not reopen it,
  and only a connected opener regains focus. Root scroll locks preserve overflow and scrollbar-gutter
  values and are released after the last open dialog. Non-native DOM hosts use the same dialog markup
  with open-attribute/keyboard fallback for jsdom. DialogConfirm and DialogSheet still compose it.
- `Markdown/Markdown.tsx`: additive tone/compact, raw Órbita typography, tinted heading/code/table
  styling, zebra rows and whole-word table cells. New Markdown/Scrollable exposes a named keyboard
  scroll region and catalogue hint on overflow. Heading demotion, ids, async anchor restoration and
  link resolver behavior are preserved.
- `PageTitle/PageTitle.tsx` now composes PageHead with existing title/subtitle/tail and test hooks;
  icon remains accepted for callers. `PageLayout/PageLayout.tsx` retains all props and uses a section
  rather than a nested main. R16 has a regression test rendering it under main#content and asserting
  one main and one h1. No caller was edited.
- Scoped verification and Git publication limitation: see WO-13-011's dated S1A entry. tsc and Biome
  passed; 224 Vitest cases in 22 touched-folder suites passed, including the unchanged Modal focus
  reviewer suite. No reviewer tests or blessed visual baselines were changed. No outside-folder
  foundation/board/gamification reviewer suites, full gate or browser/fidelity checks were run.
  No reviewer test has been identified as needing a move; the external suites remain unverified.

### Prior build record (superseded where the completion above differs)

**Built.** New folders (CSS module per folder on the raw tokens, prototype hooks on the roots, `data-tone` for the hue): `Card/Card.tsx` (`Card`, `CardHeader`, `CardFoot`, `CardPair`), `PageHead/PageHead.tsx`, `Crumbs/Crumbs.tsx`, `EmptyState/EmptyState.tsx`, `Notice/Notice.tsx`, `Table/Table.tsx`, `ListRow/ListRow.tsx` (`ListRow`, `DividedList`). The dialog family extends the shared `Modal` in place: `Modal/DialogConfirm.tsx` and `Modal/DialogSheet.tsx` compose it, so the focus trap, Escape and focus return of `Modal` (and its reviewer test) are unchanged.

**Contracts.**
- `Card({ tone?, variant?: "default"|"flush"|"tinted", children })`; `CardHeader({ title, level?: 2|3|4, icon?, count?, action? })` (icon tile `BadgeIcon` sm + one title size + `CountPill`); `CardFoot({ children })`; `CardPair({ children })` (equal height, one column under 1024 px; put the actionable card first).
- `PageHead({ title, subtitle?, crumbs?: Crumb[], eyebrow?, actions? })` renders ONE `h1`, never a `<main>`; `Crumbs({ items: {label, href?}[] })` (last item `aria-current="page"`, nav named `common.breadcrumb.aria` «Ruta»).
- `EmptyState({ icon, children })`; `Notice({ icon, tone?, kind?: "info"|"error", children })` (`error` is coral with `role="alert"`; the caller passes the domain message; `info` is `role="status"`).
- `Table({ caption, columns: {id,label}[], rows: {id, cells: Record<colId, ReactNode>}[] })`: one DOM, `scope="col"` heads, every `td` has `data-label`; under 1024 px the CSS turns rows into cards.
- `ListRow({ title, meta?, icon?, tone?, extra?, href?, onClick? })` (link, button or static; chips in `extra` must not be interactive) and `DividedList({ items: {id,row}[] })`.
- `DialogConfirm({ open, title, testIdBase, cancelLabel, confirmLabel, reasonLabel?, onCancel, onConfirm(reason), children? })`; `DialogSheet({ rows: {id,label,content}[] })` (128 px label column).

**Decisions and assumptions a consumer inherits.** `Tabs`, `SectionHead`, `Banner`, `Markdown`, `PageTitle` and `PageLayout` were NOT restyled in place or turned into wrappers (their v1 contracts and pinned reviewer tests stay; they already adopt the Órbita palette through WO-13-010's mapping): the surface work orders that need the drawn Órbita Tabs (hue bar, overflow arrows), SectionHeading, AlertBanner hosting a command box, hue-tinted Markdown and the compat wrappers over `PageHead` do that when they rebuild those screens, and WO-13-013 removes the v1 names. The shared `Modal` stays an overlay `div` with `role="dialog"` (not a native `<dialog>`) so its reviewer-authored focus tests keep passing; `DialogConfirm` closes through `onCancel` on Escape and backdrop. No behaviour e2e spec was added for the dialogs here: no route renders them yet (this WO's commit declares no e2e file); the first surface that mounts them carries it. Canonical-name mapping: Dialog = `Modal`, AlertBanner = `Banner`, SectionHeading = `SectionHead`.

**Tests.** `Card/_tests/Card.test.tsx`, `Table/_tests/Table.test.tsx`.
