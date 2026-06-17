---
id: WO-02-006
type: work-order
slug: intake-modal
title: WO-02-006 — Intake modal
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
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
- `pnpm biome check .` → clean (171 files)
- `bash .pandacorp/verify.sh` → **3080 passed | 2 expected fail | 5 skipped** — all gates green
- Adversarial finding fixed: real focus trap implemented (`Tab` wraps inside dialog per `aria-modal="true"` contract)
- Commits: `26152fa`, `a96a134`, `5e2dded`, `c7d395c`

## Status Note

**What was built:** `components/IntakeModal.tsx` — a `"use client"` modal overlay (CMP-02-intake-modal) that renders a dark backdrop + blur over the still-mounted board with the four `/pandacorp:*` intake commands. Satisfies AC-02-003.1 (four command rows each with icon, Spanish title/description, copy-command row via `<CopyButton>`), AC-02-003.2 (closes on backdrop click, ✕ button click, and Escape key), and AC-02-003.3 (board stays mounted — overlay, not replacement).

**Interfaces/contracts exposed:**
```ts
// components/IntakeModal.tsx
export interface IntakeModalProps {
  open: boolean;
  onClose: () => void;
}
export function IntakeModal({ open, onClose }: IntakeModalProps): React.JSX.Element | null;
```

**Behavioural details:**
- `open=false` → returns `null` (not mounted)
- `open=true` → renders `data-testid="intake-modal"` (role="dialog" aria-modal="true") + `data-testid="intake-backdrop"` + `data-testid="intake-close"` + four `data-testid="intake-command-{slug}"` rows (slugs: `explore`, `new-idea`, `discover`, `recommend`)
- Real focus trap: `Tab` and `Shift+Tab` wrap inside the dialog; document-level `keydown` listener removed on unmount/close — no stale-closure or listener-leak bugs
- Zero hardcoded colors — all via CSS custom properties (`var(--color-backdrop)`, `var(--color-surface-panel)`, etc.)
- Spanish copy throughout (AGENTS.md)

**Integration seams:**
- Consumer: `app/board/page.tsx` (board page) — renders `<IntakeModal open={modalOpen} onClose={() => setModalOpen(false)} />` alongside the board (not replacing it)
- Depends on `CMP-02-copy-button` (`components/CopyButton.tsx`, WO-02-002) for each command row

**Test files covering this WO:**
- `components/IntakeModal.test.tsx` — 60 acceptance tests (14 groups, jsdom)
- `components/IntakeModal.adversarial.test.tsx` — 11 adversarial tests (stale-closure, listener leak, inner-click bubbling, singleton uniqueness, rapid-toggle overlay semantics, real focus-trap enforcement)
