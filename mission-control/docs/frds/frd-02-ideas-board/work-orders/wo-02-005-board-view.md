---
id: WO-02-005
type: work-order
slug: board-view
title: WO-02-005 — Board view + columns + cards
status: DRAFT
parent: FRD-02
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-02-005 — Board view + columns + cards

**Module:** `app/board/page.tsx`, `components/IdeaCard.tsx`
**IDs touched:** `CMP-02-board-view`, `CMP-02-card`; REQ-02-002, REQ-02-005, REQ-02-006 (badges)
**Dependencies:** WO-02-001 (`deriveColumn`), WO-02-002 (`CopyButton`), FRD-01 (`readIdeas`, `readStatus`)

## EARS criteria (from FRD-02)

- AC-02-002.1 — The board SHALL NOT allow moving cards by hand (no drag/arrows).
- AC-02-002.2 — Columns SHALL be equal-width, **wide** (not tiny), with **horizontal scroll** when
  they don't fit; text SHALL wrap onto several lines.
- AC-02-005.1 — EACH card SHALL show two labels besides the score: **category** (`project_type`) and
  **return** (`return_type`).
- AC-02-006.2 — A `recommended` card SHALL show a "recommended" badge.

## Design

- `app/board/page.tsx` (Server Component): `readIdeas()` → for each `in-pipeline` card,
  `readStatus(card.project)` → `deriveColumn(card, status)` → bucket into the 7 columns. Render the
  columns in fixed order.
- `components/IdeaCard.tsx`: title (wraps), score (`tabular-nums`), category chip, return chip,
  "recommended" badge when applicable. No move controls. `data-testid="idea-card"`.
- Layout: equal-width wide columns, horizontal scroll container. Design tokens only.

## Definition of done

- Component test (RED first, jsdom) feeding fixture-shaped data:
  - cards land in the expected columns (uses `deriveColumn`).
  - a card renders its category + return chips and the score with `tabular-nums`.
  - a `recommended` card shows the badge.
  - no drag handles / move buttons exist in the DOM.
- Read-only; no write.
- `.pandacorp/verify.sh` green.

## Status Note

**Built:** 7-column two-axis board view wiring `deriveColumn` end-to-end.

**What was built:**
- `app/board/IdeaBoardView.tsx` — upgraded from 4 status-based columns to 7 canonical `BoardColumn` columns (`discovered`, `documented`, `design`, `architecture`, `building`, `shipped`, `discarded`). Cards are routed by a pre-computed `boardColumn` prop; legacy callers without `boardColumn` fall back to status-based routing (backward-compat). Added `data-testid="board-scroll-container"` on the horizontal-scroll container (AC-02-002.2). No drag handles, no move controls (AC-02-002.1).
- `app/board/page.tsx` — Server Component wired with the full two-axis derivation: `readIdeas()` → per in-pipeline card `readStatus(projectPath)` → `deriveColumn(card, status)` → `boardColumn` on each `BoardCardEntry`. Also resolves `isRunning` from `status.running` (REQ-02-008).
- `app/board/IdeaBoardView.wo02005.test.tsx` — 33 component tests (TDD RED→GREEN): all 7 columns present, boardColumn routing, category+return chips (AC-02-005.1), recommended badge (AC-02-006.2), no drag controls (AC-02-002.1), scroll container testid, backward-compat fallback, empty state.

**Interfaces/contracts exposed:**
- `BoardCardEntry` (exported from `IdeaBoardView.tsx`) — `IdeaCardProps & { boardColumn?: BoardColumn }`. Page passes `boardColumn` always; downstream consumers can omit for fallback.
- `IdeaBoardViewProps.cards: BoardCardEntry[]` — replaces the previous `IdeaCardProps[]` (backward-compat: `BoardCardEntry extends IdeaCardProps` — no breaking change for existing callers).

**Integration seams:**
- `IdeaBoardView` consumes `BoardColumn` from `lib/board.ts` (WO-02-001, already verified).
- `page.tsx` consumes `readStatus` (WO-01-005) + `resolveFactoryRoot` (lib/config) + `deriveColumn` (WO-02-001) + `readIdeas` (WO-01-003) — all already verified.
- Downstream: `IntakeModal` (WO-02-003), `DiscardButton` (WO-02-004), `CardDetail` (WO-02-007), `CategoryFilter` (WO-02-008) mount inside the board — their testids are unaffected.

**Test files covering this WO:**
- `app/board/IdeaBoardView.wo02005.test.tsx` — 33 tests (primary, all AC criteria)
- `app/board/IdeaBoardView.test.tsx` — 22 tests (regression — 2 updated to reflect 7-column world)
- `components/IdeaCard.test.tsx` — 30 tests (regression, unchanged, all pass)
- `lib/board.test.ts` — 42 tests (regression, unchanged — `deriveColumn` pure-function coverage)

**verify.sh result:** 3113 tests pass | 2 expected fail | 5 skipped. biome clean. tsc clean.
