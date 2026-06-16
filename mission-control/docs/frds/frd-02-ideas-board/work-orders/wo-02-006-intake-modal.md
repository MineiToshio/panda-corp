# WO-02-006 — Intake modal

**Module:** `components/IntakeModal.tsx`
**IDs touched:** `CMP-02-intake-modal`; REQ-02-003
**Dependencies:** WO-02-002 (`CopyButton`)

## EARS criteria (from FRD-02)

- AC-02-003.1 — WHEN the owner clicks "Capture ideas / oportunidades", the system SHALL open a
  **modal overlay** (dark backdrop + blur) with the four intake commands — `/pandacorp:explore`,
  `:new-idea`, `:discover`, `:recommend` — each with an icon, title, description and copy-command row.
- AC-02-003.2 — Clicking the backdrop or the ✕ button SHALL close the modal.
- AC-02-003.3 — The board SHALL remain visible behind the modal as context.

## Design

- `"use client"` overlay: dark backdrop + blur over the still-mounted board. Four command rows, each
  with icon + Spanish title/description + a `<CopyButton value="/pandacorp:…" />`.
- Close on backdrop click and on ✕; `Escape` also closes (a11y). `data-testid="intake-modal"`,
  `data-testid="intake-close"`. Focus trap + `aria-modal` for accessibility.
- Design tokens only; Spanish copy via i18n.

## Definition of done

- `components/IntakeModal.test.tsx` (RED first, jsdom):
  - renders the 4 commands with their copy buttons.
  - clicking the backdrop closes; clicking ✕ closes; `Escape` closes.
  - the board (passed as the page context) is not unmounted (overlay, not replacement).
- No write; no Claude call.
- `.pandacorp/verify.sh` green.
