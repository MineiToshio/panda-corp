# WO-02-008 — Category filter + legend + building indicator

**Module:** `components/CategoryFilter.tsx`, `components/BoardLegend.tsx`
**IDs touched:** `CMP-02-category-filter`, `CMP-02-legend`, `CMP-02-card` (building badge); REQ-02-006, REQ-02-008
**Dependencies:** WO-02-005 (board view + card)

## EARS criteria (from FRD-02)

- AC-02-006.1 — The board SHALL allow **filtering by category** (`project_type`).
- AC-02-008.2 — WHILE an idea's project has `running: true` (phase implementation → "building"
  column), the system SHALL show an indicator on its card that it is being built.
- AC-02-008.3 — Category, return and score are shown with a **legend** explaining them.

## Design

- `CategoryFilter.tsx` (`"use client"`): chips/select of distinct `project_type` values; selecting
  filters the visible cards. "All" resets. `data-testid="category-filter"`.
- `BoardLegend.tsx`: a legend mapping each category, each return type and the score to a short
  Spanish explanation (i18n). Static, accessible.
- Building indicator: in `IdeaCard.tsx`, when the linked `readStatus(...).status.running === true`,
  render a "building" badge (not color-only; icon + label — architecture §7 a11y).

## Definition of done

- `components/CategoryFilter.test.tsx` (RED first): selecting a category hides non-matching cards;
  "All" restores them.
- `components/BoardLegend.test.tsx`: renders an entry for each category, return type and the score.
- `IdeaCard` test extended: a card whose status has `running: true` shows the building badge (with
  text, not color alone).
- Read-only; no write.
- `.pandacorp/verify.sh` green.
