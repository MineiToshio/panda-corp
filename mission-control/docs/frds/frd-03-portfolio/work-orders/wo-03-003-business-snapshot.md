---
id: WO-03-003
type: work-order
slug: business-snapshot
title: WO-03-003 — Business snapshot (shipped projects)
status: DRAFT
parent: FRD-03
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-03-003 — Business snapshot (shipped projects)

**Module:** `components/BusinessSnapshot.tsx`
**IDs touched:** `CMP-03-snapshot`; REQ-03-003
**Dependencies:** WO-03-002 (rail/row)

## EARS criteria (from FRD-03)

- AC-03-003.1 — EACH `shipped` project SHALL also show its **business snapshot** when present in the
  portfolio (active users / return metric / last review verdict, filled by
  `/pandacorp:review-launch`, DR-043), so the owner sees winners vs zombies at a glance.

## Design

- Renders the `snapshot` from `ProjectListItem` (`users` / `returnMetric` / `verdict`) as compact
  chips, `tabular-nums` on numeric values. Only for shipped/`operation` projects.
- **Absent snapshot → render nothing** (no placeholder noise). `data-testid="business-snapshot"`.
- Design tokens only; Spanish labels via i18n.

## Definition of done

- `components/BusinessSnapshot.test.tsx` (RED first, jsdom):
  - a shipped project with users/return/verdict → all three chips render.
  - a shipped project with only some fields → only those render.
  - no snapshot → component renders nothing (zombie vs winner: a zombie simply has no metrics).
- Read-only; no write.
- `.pandacorp/verify.sh` green.

## Status Note

**Built:** Standalone `BusinessSnapshot` component (CMP-03-snapshot) exported from
`components/BusinessSnapshot.tsx`. Renders active users / return metric / verdict as compact
chips for shipped/operation projects. Returns `null` when all props are absent (no placeholder
noise, per WO design). The inline `BusinessSnapshot` function already embedded in
`ProjectRail.tsx` (WO-03-001) continues to serve the rail internally; this WO delivers the
separately-importable, testable component that CMP-03-snapshot requires per the blueprint.

**Interface/contract exposed:**
```tsx
// components/BusinessSnapshot.tsx
export interface BusinessSnapshotProps {
  users?: string;
  returnMetric?: string;
  verdict?: string;
}
export function BusinessSnapshot(props: BusinessSnapshotProps): React.JSX.Element | null
```
Returns `null` when all three props are `undefined`. Server Component safe — no hooks, no
browser APIs. Read-only: no interactive controls.

**data-testid contract (WO-03-003):**
- `"business-snapshot"` — root `<div>` (only rendered when ≥1 prop is defined)
- `"business-snapshot-users"` — users chip
- `"business-snapshot-return"` — return metric chip
- `"business-snapshot-verdict"` — verdict chip

**Design invariants:**
- `fontVariantNumeric: "tabular-nums"` on the root container (numeric readability, AC-13-003).
- Zero hardcoded hex/rgb/hsl — all values via CSS custom properties with Canvas/currentColor
  fallbacks.

**Integration seams:**
- Consumers import `BusinessSnapshot` from `"@/components/BusinessSnapshot"` and pass the
  `snapshot` fields from `ProjectListItem` directly as props.
- `ProjectRail.tsx` and `PortfolioTable.tsx` have their own inline snapshot rendering; they can
  optionally delegate to this component. No breaking change to existing consumers.

**Test files:**
- `components/BusinessSnapshot.test.tsx` — 23 tests (RED → GREEN), 7 groups covering:
  all-fields-present, partial fields (each combination), no-snapshot renders nothing,
  tabular-nums invariant, design-token invariant (no hardcoded hex/rgb/hsl), read-only
  invariant, arbitrary string value rendering.

**verify.sh:** 117 test files, 3354 tests pass, 2 expected-fail, 5 skipped. biome + tsc clean.
