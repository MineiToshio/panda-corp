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
