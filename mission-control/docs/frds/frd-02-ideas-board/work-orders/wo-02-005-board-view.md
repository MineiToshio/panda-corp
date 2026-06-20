---
id: WO-02-005
type: work-order
slug: board-surface
title: 'WO-02-005 — Board surface (columns + cards + filter + legend + intake + discard)'
status: DRAFT
parent: FRD-02
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/board/**'
  - 'src/components/modules/IdeaCard/**'
  - 'src/components/modules/CategoryFilter/**'
  - 'src/components/modules/BoardLegend/**'
source_requirements: [REQ-02-002, REQ-02-005, REQ-02-006, REQ-02-008, REQ-02-003, REQ-02-007]
last_updated: '2026-06-19'
---
# WO-02-005 — Board surface

## Goal

Re-paint the whole `/board` page so it matches the approved prototype: the read-only kanban
(equal-width, wide columns, horizontal scroll, wrapping text), the idea cards, the category filter,
the legend, the intake modal, and the discard affordance — H1 **"Tablero"** rendered via `PageTitle`.
The `lib/board.ts` derivation, `lib/discard.ts` write and the discard Server Action are VERIFIED and
consumed as-is; this WO is presentational.

## Scope (components from `docs/design/components.md`)

Re-paint, reusing the foundation primitives before creating anything:
- **`IdeaCard`** (`src/components/modules/IdeaCard/IdeaCard.tsx`) — board idea card: title, score
  (`tabular-nums`), category + return chips (reuse foundation **`Chip`**), recommended badge and the
  building indicator. Reuse `Chip`/`CountBadge`/`Shield`/`TierBadge` presets — no ad-hoc pills.
- **`CategoryFilter`** (`src/components/modules/CategoryFilter/CategoryFilter.tsx`) — filter by
  `project_type`; built from foundation `Chip`/`Button`, not a bespoke control.
- **`BoardLegend`** (`src/components/modules/BoardLegend/BoardLegend.tsx`) — legend for
  category / return / score; reuse `Panel` + `Chip`.
- **Page** (`src/app/board/page.tsx` + `_components/`) — kanban columns via the shared
  `KanbanColumn` foundation primitive (WO-13-008); H1 **"Tablero"** via `PageTitle`, section heads via
  `SectionHead`. The **intake modal** (`_components/IntakeModal/`) reuses `Panel` + `CmdRow` + `Button`
  (backdrop + blur, focus-trap, Escape, return-focus). The **discard button**
  (`_components/DiscardButton/`) reuses foundation `Button` + `Toast`; it calls the existing
  `app/board/actions.ts` Server Action (VERIFIED) — do not re-plan the action.
- Reuse foundation **`Button`** / **`CmdRow`** (WO-13-007) for the clipboard-copy affordance and all
  actions (the old standalone `CopyButton` is absorbed into `Button`/`CmdRow`).

reuse → adapt → create-only-if-new: everything here reuses an existing foundation primitive or an
already-inventoried module; no new shared component is introduced by this WO.

## Acceptance criteria (anchored in FRD-02 EARS)

- AC-02-002 — No manual move (no drag/arrows); columns equal-width, **wide**, horizontal scroll on
  overflow; card text wraps onto several lines.
- AC-02-005 — Each card shows **category** + **return** chips beside the score.
- AC-02-006 — The board allows **filtering by category**; a `recommended` card shows a
  "recommended" badge.
- AC-02-008 — Building indicator while the project is `running: true`; the legend explains
  category / return / score.
- AC-02-003 — "Capture ideas / oportunidades" opens a **modal overlay** (dark backdrop + blur) with
  the four intake commands, each with icon · title · description · copy-command row; backdrop / ✕
  closes; the board stays visible behind.
- AC-02-007 — "Discard idea" rewrites `status: discarded` via the existing Server Action (the only
  app write); optimistic UI, revert on failure.
- Page renders with H1 "Tablero" via `PageTitle`; matches `la-campana.html` / prototype board surface;
  light + dark; the Preview Smoke Gate is green (route renders, no console error).

## Dependencies

- Foundation (FRD-13): **WO-13-006** (`PageTitle`/`SectionHead`/`Tabs`), **WO-13-007**
  (`Banner`/`Chip`/`CountBadge`/`Panel`/`CmdRow`/`Button`/`Toast`/`ProgressBar`), **WO-13-008**
  (`Shield`/`TierBadge`/`ItemSlot`/`KanbanColumn`).
- Read/write layer (VERIFIED, consumed as-is): WO-02-001 (`lib/board.ts` `deriveColumn`),
  WO-02-004 (`lib/discard.ts`), the discard Server Action (`app/board/actions.ts`), FRD-01
  `readIdeas` / `readStatus`.
- Cross-FRD: **frd-13** (foundation primitives must land first).

## Visual reference

`docs/frds/frd-02-ideas-board/mocks/la-campana.html` + `docs/design/prototype/index.html`
(the board surface: columns, cards, filter, legend, intake modal).

## Status Note

**Built:** The `/board` page is fully re-painted. `page.tsx` (Server Component) resolves all
cards via `readIdeas` + `readStatus` + `deriveColumn`, then passes them to `BoardShell`
(new `"use client"` component at `src/app/board/_components/BoardShell/BoardShell.tsx`).

**Interfaces / contracts exposed:**

- `BoardShell({ cards: BoardCardEntry[], discardAction: (slug) => Promise<DiscardResult> }): JSX.Element`
  — the interactive client boundary; manages `selectedCategory`, `intakeOpen`, `openSlug` state.
- `IdeaBoardView` extended with `onCardClick?: (slug: string) => void` prop (backward-compat;
  when absent, cards are read-only articles; when present, each card is wrapped in a `<button>`).
- `Button` extended with `testId?: string` and `"data-testid"?: string` props
  (override the default `data-testid="button"` when multiple buttons share a surface).

**Integration seams:**

- `page.tsx` → `BoardShell` (passes resolved `BoardCardEntry[]` + `discardIdeaAction` Server Action).
- `BoardShell` → `IdeaBoardView` (passes `filteredCards` + `onCardClick`).
- `BoardShell` → `CategoryFilter` (passes `categories`, `selected`, `onSelect`).
- `BoardShell` → `IntakeModal` (passes `open`, `onClose`).
- `BoardShell` → `CardDetail` (passes `slug`, `title`, `status`, `body`, `onEnterForge`).
- `BoardShell` → `DiscardButton` (passes `slug`, `discardAction`; shown when `status` is not
  `"discarded"` or `"shipped"`).

**Implicit decisions / assumptions made:**

- Card clickability: the `<button>` wrapper approach (not `<article role="button">`) preserves
  semantic `<article>` identity; the wrapper has `background:none; border:none; padding:0; cursor:pointer`.
- `discardIdeaAction` is injected as a prop on `BoardShell` (not imported directly) so the
  component is testable without Next.js infrastructure.
- `IntakeModal` is always mounted (not conditionally rendered) so the overlay fades in/out without
  remounting — the board is always visible behind it (AC-02-003.3).
- Filter: `CategoryFilter` chip-style was used (WO specifies this module) rather than the
  prototype's search+select. The WO wins over the prototype for component choice.
- The "Volver al tablero" back button uses `variant="secondary" size="sm"` and
  `data-testid="card-detail-back"`.
- `canDiscard` = `status !== "discarded" && status !== "shipped"` — only active, non-terminal ideas.

**Test files:** `src/app/board/_tests/wo-02-005-board-surface.test.tsx` (29 tests, all green).

**Verification:** 274 test files / 6372 tests pass; tsc --noEmit clean; biome clean;
Playwright smoke gate green (route 200, no console errors, no blank render).
