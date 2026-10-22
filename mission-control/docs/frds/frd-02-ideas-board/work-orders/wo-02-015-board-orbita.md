---
id: WO-02-015
type: work-order
slug: board-orbita
title: WO-02-015 Tablero Órbita (columns, search, phase chips, hide-empty, filters, favourite star)
status: DRAFT
parent: FRD-02
foundation: false
implementation_status: PLANNED
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/app/board/page.tsx'
  - 'src/app/board/IdeaBoardView/**'
  - 'src/app/board/_tests/**'
  - 'src/app/board/_components/{BoardShell,IntakeModal,DiscardedModal,PhaseNav,BoardColumn}/**'
  - 'src/components/modules/{IdeaCard,BoardLegend}/**'
  - 'src/components/core/FavoriteButton/**'
  - 'e2e/ideas-board.spec.ts'
source_requirements: [REQ-02-001, REQ-02-002, REQ-02-003, REQ-02-005, REQ-02-006, REQ-02-012, REQ-02-014, REQ-02-016]
dependsOn: [WO-13-012, WO-25-001, WO-02-012]
last_updated: '2026-10-22'
---

# WO-02-015 Tablero Órbita

## Summary

Rebuild `/board` on the Órbita design: the six numbered campaign-phase columns of equal width with horizontal
scroll, the toolbar (search across columns, category filter chips with the live «N ideas coinciden» count and
«Limpiar», the «Ocultar columnas vacías» switch remembered per browser), the phase selector chips that jump to a
column, the restyled idea cards with the favourite star, the accessible empty-column marker, and the restyled
«Capturar ideas» and «Descartadas · N» dialogs. It also creates the FRD's behaviour e2e spec.

## In Scope

- **Page head** (`PageHead`, h1 «Tablero» equal to the nav label, subtitle as drawn) with the actions «Descartadas · N»
  (always shown, N = discarded ideas) and the primary «Capturar ideas».
- **Toolbar**: `SearchField` («Buscar por nombre o contenido…») matching an idea's title and body text across every
  phase column, as the prototype indexes it; category `FilterChip`s («Todas N» + one per `project_type` with its
  count, selected = neutral, never a hue); «Limpiar» and the polite live line «N ideas coinciden» while a search or a
  category is active; the `Switch` «Ocultar columnas vacías» (browser-local preference, blueprint Contracts C6). Search
  and category stay URL-owned through the existing FRD-25 keys (`boardQuery`, `category`); typing replaces history.
- **`PhaseNav`**: one chip per visible phase with its count; activating a chip scrolls that column into view; hidden
  phases lose their chip.
- **`BoardColumn`**: the six columns «1 Investigación» to «6 Lanzamiento» (La Campaña's names, no «Descartada» column),
  placed by the unchanged two-axis `deriveColumn` (WO-02-001); equal width, wide, horizontal scroll region
  (`role="region"`, keyboard scrollable), wrapping text; head with step number, name and count chip; an empty column
  is narrow and shows the `role="status"` marker «Sin ideas en esta fase» with its 0; a column whose cards are all
  filtered out shows «Sin coincidencias». No drag, no arrows, no move action (REQ-02-002).
- **`IdeaCard` / `IdeaCardProject`** (restyle in place): title as a link to the idea page (FRD-25 idea navigation slug),
  favourite star top-right, category chip and return chip (words, never colour alone), «Score N» with its bar; the project variant adds «n/m WO» with its bar or «Proyecto creado», and «Construyendo» while the
  project is `running` (REQ-02-006). Keep the exports `projectMetaChips`, `CATEGORY_LABELS`, `RETURN_LABELS` and the
  `IdeaCardProps` type stable (consumed by the digests, the idea pitch and the v1 detail branch).
- **`FavoriteButton`** (restyle in place): `IconButton` star, outline ↔ filled gold, `aria-pressed`, Spanish label
  naming the idea, `useOptimistic` flip that auto-reverts on `{ ok: false }` from `toggleFavoriteAction`
  (unchanged Server Action, ADR-0003). Toggling never moves the card.
- **Dialogs** on the `Dialog` primitive (native dialog, kicker, focus trap, Escape, focus return): «Capturar ideas»
  (kicker «Ideas», intro sentence, four `CommandBox` rows `/pandacorp:explore`, `/pandacorp:new-idea`,
  `/pandacorp:discover`, `/pandacorp:recommend`, copy-only); «Ideas descartadas · N» (`ListRow` per idea: title,
  category, «leer propuesta y restaurar», «Motivo: …» when recorded; a row navigates to that idea's page). The board
  stays rendered behind both.
- **Transitional seam:** the v1 idea-detail branch of `BoardShell` (back button, header actions, discard banner,
  `CardDetail` mount) keeps rendering through its current props, unchanged, until WO-02-016 moves the idea to its own
  route and deletes it. Do not restyle or extend that branch here.
- **E2E**: create `e2e/ideas-board.spec.ts` (`gotoHydrated`, `getByRole` first): board renders the six phases, search
  narrows across columns and shows the match line, category chip, hide-empty survives a reload, phase chip jumps,
  star toggles `aria-pressed`, and each dialog (capture, discarded) traps focus, closes on Escape and returns focus
  to its opener.

**Removals (map §6.C item 12 and the frozen design, §0.6: code, exports and tests in this WO):**
- the «recomendada» badge on `IdeaCard` and the favourite gold card background/border (AC-02-012.4 is Out of v2);
- `src/components/modules/BoardLegend/**` and its mount (not drawn by the frozen prototype; the chips carry their
  words);
- the v1 empty-column dash and «Sin ideas en esta columna» wording (WO-02-014, superseded);
- the native category `<select>` and the v1 «+ Capturar ideas / oportunidades» / «Ver descartadas» triggers
  (hidden at zero) in favour of the drawn controls.

## Out of Scope

- The idea page, its header and tabs, the discard/restore dialogs, and removing the v1 detail branch (WO-02-016).
- The digests (WO-02-017), the data-model viewer (WO-02-018), La Campaña (WO-02-020).
- The bounded writes and their Server Actions (WO-02-004, WO-02-012: unchanged), `deriveColumn` (WO-02-001).
- The sidebar/shell and its Tablero count (WO-19-002, WO-19-003).

## Requirements & Acceptance Criteria

Delivers REQ-02-002, REQ-02-003, REQ-02-005, REQ-02-006, REQ-02-014, REQ-02-016 (board part), FRD-02#U4 (the
«Descartadas · N» button and dialog) and renders REQ-02-001. The favourite write itself stays with WO-02-012
(AC-02-012.1, AC-02-012.2); the star in the idea header is mounted by WO-02-016 with this component.

- **AC-02-016.1** — (amended 2026-10-22, v2 reconciliation) WHEN the owner types in the board search ("Buscar por nombre o contenido…"), THE system SHALL show only the ideas whose title or content matches, across every phase column.
- **AC-02-016.2** — THE board SHALL show one phase selector chip per phase with its idea count, and WHEN a chip is activated THE system SHALL scroll that phase's column into view.
- **AC-02-016.3** — WHEN the owner turns on "Ocultar columnas vacías", THE board SHALL remove the empty phases and their selector chips, and SHALL remember the choice in this browser.
- **AC-02-016.4** — WHILE a category filter is active, THE board SHALL show the live count "N ideas coinciden".
- **AC-02-012.3** — THE system SHALL render a **star toggle** in the top-right corner of **every** board
  card (in any column) and in the card-detail header; clicking it SHALL toggle the favourite flag
  via a Server Action with **optimistic UI** (the star flips immediately and auto-reverts on
  failure). The star SHALL be an outline star when not a favourite and a filled gold star
  when it is, with a Spanish `aria-label` that names the idea ("Marcar como favorita: <título>" /
  "Quitar de favoritas: <título>") and `aria-pressed` reflecting the state.
- **AC-02-012.4** — **Out of v2 (owner decision 2026-10-21):** WHEN a card is a favourite, THE system SHALL highlight it with a distinct **gold
  card background + border** (the `--color-warn` token, distinct from the teal accent used by
  "recomendada"/"en construcción"). The highlight SHALL **not** be conveyed by colour alone — the (drawn in FRD-04's captured states)
  card's `aria-label` SHALL include "favorita" and carry the filled-star control (accessibility.md).
  In v2 the filled gold star of AC-02-012.3 alone marks a favourite.

AC-02-012.4 is satisfied by its "In v2" sentence: no gold card background or border remains, the filled star and
its label carry the state. AC-02-016.1 is verified on titles; the search also matches the idea's body text as the
prototype's index and placeholder do (the oracle `board-search` count depends on it; wording recorded for the PM in
the architecture ledger).

**Worked example (FRD):** six phases with Diseño and Lanzamiento empty; turning on «Ocultar columnas vacías» leaves
4 columns and 4 chips, a reload keeps them hidden; activating the «Arquitectura» chip scrolls that column into view.

**Completeness (DR-100):** empty board (no ideas) renders the six empty columns and no match line; a malformed card
does not break the board (FRD-01 readers are fail-loud per card, the board renders the rest); filter with zero
matches shows «Sin coincidencias» in every column and «0 ideas coinciden»; the hide-empty preference read happens after
hydration without a layout jump of the default state. **NFRs:** accessibility (one h1, `role="region"` scroller with
an accessible name, chips and switch keyboard-operable with `aria-pressed` / `role="switch"` + `aria-checked`, the live
match line `aria-live="polite"`, 44 px design targets, state never by colour alone), reduced motion (scroll jump
without smooth animation under `prefers-reduced-motion`), performance (the board page reads only what the board shows;
no per-card project document reads are added here; LCP within the platform budget), security (no new write; the star
calls the existing bounded action only).

## Components

Builds `CMP-02-board-view`, `CMP-02-board-column`, `CMP-02-phase-nav`, `CMP-02-card`, `CMP-02-favorite-action`
(restyle), `CMP-02-intake-dialog`, `CMP-02-discarded-dialog`, `IF-02-hide-empty-pref` (blueprint § Components).
Reuse first (components.md): `PageHead`, `Button` (primary, default), `SearchField`, `FilterChip`, `Switch`, `Chip`,
`ProgressBar`, `Dialog`, `CommandBox`, `ListRow`, `IconButton`, `Icon` (WO-13-011/012). Restyle in place: `IdeaCard`,
`FavoriteButton`, `IntakeModal`, `DiscardedModal`, `BoardShell`, `IdeaBoardView`. Create only the components.md rows
`PhaseNav` and `BoardColumn` (folders, blueprint § Relocations). Installs: none.

## Visual reference

- **Mock screens:** `docs/frds/frd-02-ideas-board/mocks/ideas-board.html#board`, `#board-hide-empty`, `#board-search`,
  `#board-category-filter`, `#board-favorite`, `#board-phase-jump`, `#board-capture-dialog`, `#board-discarded-dialog`
  (oracle states of the same ids; screenshots `mocks/screenshots/board-*-{1280,768,375}-{light,dark}.jpg`).
- **Token slice:** phase tones via `data-tone` (`--tone`, `--tint`, `--tint-strong`), `--surface`, `--surface-2`,
  `--surface-3` (selected `FilterChip`), `--line`, `--text`, `--text-2`, `--text-3`, `--r-lg` (cards), `--r-pill`
  (chips), `--s2`..`--s6`, `--fs-xs`..`--fs-h1`, `--shadow`, `--shadow-dialog`, `--backdrop`, `--gold` (filled star);
  fonts `--font-display` (h1, column heads), `--font-body`, `--font-mono` (commands only); `tabular-nums` on counts and
  scores. Reference CSS: 06-card, 07-chip, 09-form-field, 12-command, 13-list-row, 23-tablero, 33-dialog,
  40-board-pipeline, 41-board-columns.
- **FDD pointer:** `docs/frds/frd-02-ideas-board/fdd.md` (Screens: Tablero, Capturar ideas, Descartadas; States: board
  search, category filter, favourite, phase jump, empty columns hidden; Responsive & accessibility).
- **Fidelity criterion:** the built board matches `mocks/ideas-board.html` (layout, structure, components, density, both
  themes, 1280/768/375: at 375 the chips wrap, the phase chips scroll sideways and the next column peeks) on the
  frozen tokens, keeping the recorded ids/classes/`data-*` hooks (`.kanban.ideas`, `.kcol`, `.kcard`, `.phase-nav`,
  `#idea-search`, `#board-count`, `#board-scroller`); verified by the preview smoke gate (DR-055) and the close-out
  Visual QA.

## Tests

- Component tests (`getByRole`) for `BoardColumn` (empty marker, filtered marker), `PhaseNav` (counts, jump, hidden
  phases), `IdeaCard` (chips, project line, building chip, no gold highlight, no recommended badge), `FavoriteButton`
  (label, `aria-pressed`, optimistic flip and revert), `BoardShell` (search across columns, category + match line,
  clear, hide-empty persisted), both dialogs.
- `e2e/ideas-board.spec.ts` as described in scope (created here; WO-02-016 extends it).

### Derogated tests (BL-0051)

- Implementer tests updated or deleted here: `src/app/board/_tests/board-search.test.tsx`,
  `src/app/board/_tests/wo-02-005-board-surface.test.tsx` (board assertions only; its idea-detail assertions move with
  WO-02-016), `src/app/board/IdeaBoardView/_tests/{IdeaBoardView.test.tsx,IdeaBoardView.wo02005.test.tsx,IdeaBoardView.wo02014.test.tsx}`,
  `src/app/board/_components/IntakeModal/_tests/*`, `src/app/board/_components/DiscardedModal/_tests/DiscardedModal.test.tsx`,
  `src/components/modules/IdeaCard/_tests/*`, `src/components/core/FavoriteButton/_tests/FavoriteButton.test.tsx`;
  `src/components/modules/BoardLegend/_tests/*` deleted with the module.
- Reviewer-authored, derogated for the FRD-02 gate reviewer (never edited here): the board assertions of
  `src/app/board/_tests/frd-02.integration.reviewer.test.tsx` and `src/app/board/_tests/frd-02.shell-integration.reviewer.test.tsx`.
- Visual baseline `e2e/visual.spec.ts-snapshots/*tablero*`: re-blessed by the reviewer at the close-out Visual QA.

## Dependencies

WO-13-012 (framing patterns, dialog family; leaf primitives through WO-13-011), WO-25-001 (URL codec keys),
WO-02-012 (the favourite write and action, kept). Runs in W3 in parallel with WO-02-017, WO-02-018, WO-02-020
(disjoint artifacts). WO-02-016 builds on it in W4.

## Definition of done

The ACs above pass with tests that fail without the change; the removals are gone (code, exports, tests); the e2e
spec passes hydrated; `.pandacorp/verify.sh --since <ref>` green; no hardcoded colour, spacing or radius; every string
from `t()`.

## Status Note
