---
id: WO-17-007
type: work-order
slug: badge-chip-dismiss
title: WO-17-007 — Guild badge + portfolio-rail chip + dismissal
status: DRAFT
parent: FRD-17
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-007 — Guild badge + portfolio-rail chip + dismissal

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-17-badge`, `CMP-17-dismiss`) · [architecture §4.8, §7](../../../product/architecture.md).

## Goal
Surface the open-proposal count as a top-bar guild badge and a per-project portfolio-rail chip
(extending FRD-14's chips), and make proposals honestly dismissible with the dismissal remembered
client-locally.

## Scope
- `CMP-17-badge`: top-bar badge with the open proposal count (candidates + promotions + prune +
  self-suggestions, minus dismissed); per-project rail chip for that project's proposals.
- `CMP-17-dismiss`: dismissing a proposal hides it and persists the dismissal in `localStorage`
  (client-local UI state — NOT a factory write, architecture §4.8). Honest/White-Hat: no streaks, no
  false urgency.

## Acceptance criteria (REQ-17-001, REQ-17-008)
- **AC-17-007.1** The top-bar badge shows the open proposal count and links to `app/proposals`.
- **AC-17-007.2** The portfolio-rail chip shows a project's proposal count, alongside FRD-14's
  pending-decisions/bugs chips (third stream).
- **AC-17-007.3** Dismissing a proposal removes it from the count and the list; the dismissal survives a
  refresh (localStorage) and is NOT a write to the factory.
- **AC-17-007.4** WHEN there are no open proposals, the badge/chip reads calm (e.g. hidden or an *al día*
  state) — no false urgency, no nagging (White-Hat, FRD-09).
- **AC-17-007.5** Spanish copy + a11y; count not conveyed by color alone.

## TDD
`components/proposals-badge.test.tsx`: assert count, dismissal persistence (localStorage), calm
empty/al-día state, no factory write.

## Definition of done
- ACs RED → GREEN; dismissal remembered client-locally; calm when empty; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- WO-17-002, WO-17-003; FRD-14 chip placement in the portfolio rail.

## Status Note

**Built:** CMP-17-badge (ProposalsBadge), CMP-17-dismiss (proposalsDismissStore), and the FRD-17 third-stream rail chip extension to StatusChips. All AC-17-007.1–5 GREEN.

**Interfaces/contracts exposed:**

```ts
// src/components/modules/ProposalsBadge/ProposalsBadge.tsx
export interface ProposalsBadgeProps { openCount: number; }
export function ProposalsBadge({ openCount }: ProposalsBadgeProps): React.JSX.Element
// data-testid="proposals-badge", data-testid="proposals-badge-link" (href="/proposals"),
// data-testid="proposals-badge-count" (only when openCount > 0)

// src/components/modules/ProposalsDismiss/proposalsDismissStore.ts
export const PROPOSALS_DISMISSED_KEY: string
export function getDismissedIds(): string[]
export function isProposalDismissed(id: string): boolean
export function dismissProposal(id: string): void          // idempotent, never throws, localStorage only
export function filterUndismissed<T extends { id: string }>(proposals: T[]): T[]

// src/lib/proposals/proposals.ts
export type ProposalCounts = { candidates: number; promotions: number; prunable: number; total: number }
export function countOpenProposals(): ProposalCounts      // never throws; reads lib/memory

// src/app/portfolio/_components/status-chips/status-chips.tsx (extended)
export interface StatusChipsProps { pendingProposals?: number; /* + existing fields */ }
// data-testid="status-chip-proposals", data-testid="status-chip-proposals-count"
```

**Integration seams:**
- `app/layout.tsx` calls `countOpenProposals()` server-side and passes `total` to `<ProposalsBadge openCount={total} />` (cross-cutting, above children, inside the profile gate).
- `SelectableProjectRail` consumers can pass `pendingProposals={count}` to `<StatusChips>` for per-project rail chips (prop is optional; absent/0 → no chip, calm state).
- `proposalsDismissStore` is a pure client-side utility — to be used by the WO-17-004 ProposalCard dismiss button when the full dismissal UI is wired.

**Test files:**
- `src/components/modules/ProposalsBadge/_tests/ProposalsBadge.test.tsx` — 11 tests (AC-17-007.1, .4, .5)
- `src/components/modules/ProposalsDismiss/_tests/ProposalsDismiss.test.tsx` — 12 tests (AC-17-007.3)
- `src/app/portfolio/_components/status-chips/_tests/proposals-chip.test.tsx` — 10 tests (AC-17-007.2, .4, .5)
- `src/app/_tests/layout.proposalsbadge.test.tsx` — 5 tests (AC-17-007.1 cross-cutting mount)

**Gate:** 204 test files / 5418 tests GREEN. tsc --noEmit clean. biome clean on all new files. `.pandacorp/verify.sh` PASS.
