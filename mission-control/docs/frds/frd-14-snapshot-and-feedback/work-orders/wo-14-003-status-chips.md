---
id: WO-14-003
type: work-order
slug: status-chips
title: 'WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink chips'
status: DRAFT
parent: FRD-14
implementation_status: IN_REVIEW
source_requirements: ['REQ-14-004', 'REQ-14-005']
last_updated: '2026-06-17'
---
# WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink chips

**Feature:** FRD-14 · **Implements:** CMP-14-status-chips · **REQ-14-004, REQ-14-005**
**Deploy unit:** `app/portfolio/_components/status-chips.tsx` (shared, also usable in the workspace) + colocated tests.

## Acceptance criteria (copied)
- **AC-14-004.1** EACH portfolio rail row SHALL show an amber chip with `pending_decisions` when `> 0`.
- **AC-14-004.2** EACH portfolio rail row SHALL show a red chip with `pending_bugs` when `> 0`.
- **AC-14-005.1** WHEN `rethink_pending: true`, the row/workspace SHALL show a "rethink pending — build will pause" indicator.

## Scope
- `CMP-14-status-chips` (Server): given a `ProjectStatus`, render:
  - amber chip with `pending_decisions` when `> 0` (AC-14-004.1),
  - red chip with `pending_bugs` when `> 0` (AC-14-004.2),
  - a "rethink pending" indicator when `rethink_pending === true` (AC-14-005.1).
  Mirrors prototype rail `dchip`/`bchip`. Renders nothing when all are zero/false (no empty chips).
- Mounted on the FRD-03 portfolio rail rows; reusable in the FRD-04 workspace header.
- **Out of scope:** the rail layout (FRD-03), the snapshot panel (WO-14-002).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-03 rail (mounts the chips); FRD-01 `lib/status.ts` fields.

## TDD (RED → GREEN → refactor)
Component tests:
1. `pending_decisions > 0` → amber chip with the number (AC-14-004.1).
2. `pending_bugs > 0` → red chip with the number (AC-14-004.2).
3. `rethink_pending: true` → "rethink pending" indicator (AC-14-005.1).
4. All zero/false → nothing rendered (no empty chips).
5. Chips carry number + `aria-label`/label (not color alone) — a11y.

## Definition of done
- [x] Component tests written first and green.
- [x] Server Component; tokens only; `tabular-nums` on counts; `data-testid` on each chip; Spanish copy via i18n.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**Built:** `CMP-14-status-chips` — a Server Component that renders amber decision chip, red bug chip, and rethink indicator from `ProjectStatus` pending counters. Mounted on the FRD-03 `SelectableProjectRail` rows. Returns `null` when all counters are zero/false (no empty DOM wrapper).

**Interfaces / contracts exposed:**

```tsx
// app/portfolio/_components/status-chips.tsx
export interface StatusChipsProps {
  pendingDecisions?: number;  // amber chip when > 0 (AC-14-004.1)
  pendingBugs?: number;       // red chip when > 0 (AC-14-004.2)
  rethinkPending?: boolean;   // rethink indicator when true (AC-14-005.1)
}
export function StatusChips(props: StatusChipsProps): React.JSX.Element | null
```

**data-testid contract:**
- `status-chip-decisions` + `data-variant="amber"` — decisions chip wrapper
- `status-chip-decisions-count` — count `<span>` with `fontVariantNumeric: tabular-nums`
- `status-chip-bugs` + `data-variant="red"` — bugs chip wrapper
- `status-chip-bugs-count` — count `<span>` with `fontVariantNumeric: tabular-nums`
- `status-chip-rethink` + `data-variant="rethink"` — rethink indicator

**Integration seams:**
- `SelectableProjectRail.tsx` extracts `pendingDecisions`, `pendingBugs`, `rethinkPending` from `item.status.status` (the `Partial<ProjectStatus>`) and passes them to `<StatusChips>`.
- Reusable in the FRD-04 workspace header — same props surface, no coupling to FRD-03.

**Color tokens used:** `--color-agent-researcher` (amber), `--color-agent-security-auditor` (red), `--color-surface`/`--color-text` (rethink border chip). Zero hardcoded colors.

**Test coverage:** `app/portfolio/_components/status-chips.test.tsx` — 24 tests covering AC-14-004.1, AC-14-004.2, AC-14-005.1, empty state, coexistence, a11y (title label), design tokens.

**Gate:** 180 test files, 4973 tests GREEN + 2 expected-fail + 5 skipped. tsc clean. biome clean. verify.sh PASS.
