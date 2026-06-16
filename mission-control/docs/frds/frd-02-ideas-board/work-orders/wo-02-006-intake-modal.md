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

- [x] `components/IntakeModal.test.tsx` (RED first, jsdom):
  - [x] renders the 4 commands with their copy buttons.
  - [x] clicking the backdrop closes; clicking ✕ closes; `Escape` closes.
  - [x] the board (passed as the page context) is not unmounted (overlay, not replacement).
- [x] No write; no Claude call.
- [x] `.pandacorp/verify.sh` green.

## Evidence

- `pnpm vitest run components/IntakeModal.test.tsx components/IntakeModal.adversarial.test.tsx` → **71 passed** (60 acceptance + 11 adversarial)
- `pnpm tsc --noEmit` → clean
- `pnpm biome check .` → clean (147 files)
- Adversarial finding fixed: real focus trap implemented (`Tab` wraps inside dialog per `aria-modal="true"` contract)
- Commit: see `feat(mission-control): WO-02-006 safe-point — focus trap + adversarial tests`
