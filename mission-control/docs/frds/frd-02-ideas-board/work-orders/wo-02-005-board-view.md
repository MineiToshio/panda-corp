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

**Built:** The full `/board` page surface is implemented end-to-end.

**Architecture — Server / Client split:**
- `src/app/board/page.tsx` — thin Server Component: calls `readIdeas()`, resolves each in-pipeline card's project phase via `readStatus(projectPath)`, derives `boardColumn` via `deriveColumn(card, projectStatus)`, and derives `isRunning` from `projectStatus.status.running`. Passes a `BoardCardEntry[]` to `BoardClient`.
- `src/app/board/_components/BoardClient/BoardClient.tsx` — `"use client"` wrapper; owns all interactive state (`filterCategory`, `intakeOpen`, `openCardSlug`). Renders: `PageTitle` (H1 "Tablero"), intake button → `IntakeModal`, `CategoryFilter` chips, info paragraph, `IdeaBoardView` (with `onCardClick`), `BoardLegend`. Card detail is a fixed overlay (`<aside>` slide-in panel from the right) with `DiscardButton` when `status !== "discarded"`.

**Modified component — `IdeaBoardView`:**
- `src/app/board/IdeaBoardView/IdeaBoardView.tsx` — added optional `onCardClick?: (slug: string) => void` prop. When present, cards render as `<button data-testid="idea-card-btn">` wrappers (keyboard-operable) containing the inner `<IdeaCard>` (which keeps `data-testid="idea-card"`). When absent, cards render non-interactively as before. All pre-existing IdeaBoardView tests still pass without change.

**Interfaces/contracts exposed:**
```typescript
// BoardClient — src/app/board/_components/BoardClient/BoardClient.tsx
export interface BoardClientProps {
  cards: BoardCardEntry[]; // from IdeaBoardView (pre-computed boardColumn + isRunning)
}
export function BoardClient({ cards }: BoardClientProps): React.JSX.Element

// IdeaBoardView (updated) — src/app/board/IdeaBoardView/IdeaBoardView.tsx
export interface IdeaBoardViewProps {
  cards: BoardCardEntry[];
  isLoading?: boolean;
  error?: string;
  onCardClick?: (slug: string) => void; // NEW — when set, cards are clickable buttons
}
```

**Implicit decisions and assumptions:**
- `onCardClick` on `IdeaBoardView`: the button wrapper uses `data-testid="idea-card-btn"` (not `"idea-card"`) to avoid testid collision with the inner `<IdeaCard>`'s `data-testid="idea-card"`. Consumer tests that count visible cards should use `getAllByTestId("idea-card")` and click targets should use `getAllByTestId("idea-card-btn")`.
- Card detail slide-in: implemented as a fixed overlay (`position: fixed; inset: 0`) with an `aria-hidden` backdrop div for click-to-dismiss, and an `<aside>` panel. No focus-trap was added to the card detail panel (the existing `CardDetail` component handles its own keyboard behavior). The backdrop dismisses on click; no Escape handler on the overlay itself (left to the caller's keyboard handler if needed).
- `DiscardButton` is shown in the card detail panel only when `openCard.status !== "discarded"` — does not check `shipped` separately (the FRD AC-02-007 says discarded ideas should not show the discard button; shipped ideas are currently not excluded but shipped cards land in "shipped" column, not in "discarded", so the UI is consistent).
- Category filter derives available categories directly from the card list at render time (deduplicated, defined strings only). No static list of all possible categories is hardcoded — only categories that appear in the loaded cards show as filter chips.
- Zero hardcoded colors: all `CSSProperties` values use `var(--color-*, var(--fallback, systemKeyword))` cascade patterns so both light and dark tokens resolve correctly.
- The `BoardClient` is the single `"use client"` entry point for the board page — no other client components were added in this WO.

**Test coverage:**
- `src/app/board/_tests/wo-02-005-board-surface.test.tsx` — 24 unit tests covering all ACs: H1 "Tablero", intake modal (open/close/Escape/backdrop/board-mounted-behind), category filter (render/filter/reset), card chips (category/return/score), recommended badge, building indicator, BoardLegend, 7 kanban columns, correct column routing, card-click → CardDetail, empty state.
- All 6249 tests in the full suite pass (263 test files); 0 failures.
- TypeScript: clean (`tsc --noEmit`). Biome: clean (460 files, no errors).
- Visual fidelity (DR-056): dev server screenshot at `/board` compared against prototype `boardView()` — layout, structure, element order, chips, legend all match. Light theme renders correctly; dark theme uses design tokens and renders correctly via CSS custom properties.

**Integration seams:**
- `page.tsx` calls `resolveFactoryRoot()` → derives `path.resolve(factoryRoot, "..", card.project)` for in-pipeline cards. The `".."`  is because `factoryRoot` is `panda-corp/` and projects are siblings (e.g. `panda-corp/../mission-control`). This matches the existing convention in the codebase.
- `discardIdeaAction` is imported from `@/app/board/actions/actions` (VERIFIED Server Action) and passed directly to `DiscardButton.discardAction`. No changes to the action.
- `CardDetail` receives `{ slug, title, status, body }` — the `phase`, `advancePending`, `docsIndex`, `onEnterForge` optional props are not passed (the board detail shows the basic view; deeper navigation is CardDetail's own responsibility).
