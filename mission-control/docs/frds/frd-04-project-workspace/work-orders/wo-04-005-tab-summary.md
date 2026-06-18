---
id: WO-04-005
type: work-order
slug: tab-summary
title: 'WO-04-005 — Summary tab: summary, key points, decisions, activity log'
status: DRAFT
parent: FRD-04
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-04-005 — Summary tab: summary, key points, decisions, activity log

**Feature:** FRD-04 · **Implements:** CMP-04-tab-summary, CMP-04-decisions, CMP-04-activity-log · **REQ-04-003, REQ-04-004**
**Deploy unit:** `app/projects/[slug]/_components/tab-summary.tsx` (+ decisions + activity-log subcomponents) + colocated tests.

## Acceptance criteria (copied)
- **AC-04-003.1** The Summary tab SHALL render the project summary and key points.
- **AC-04-003.2** The Summary tab SHALL render the activity log read from `.pandacorp/comms/progress.md`; WHEN absent it SHALL show a graceful "no activity yet" empty state.
- **AC-04-003.3** The Summary tab SHALL render the decision points read from `.pandacorp/inbox/decisions.md`, each highlighted, with a total count badge.
- **AC-04-004.1** WHEN `pending_decisions > 0`, the decision points block SHALL be visually highlighted (warning treatment) and show the count; otherwise it SHALL show a neutral "no pending points" state.

## Scope
- `CMP-04-tab-summary` (Server): renders summary + key points, then `CMP-04-decisions` and
  `CMP-04-activity-log`.
- `CMP-04-decisions` (Server): consumes `readDecisions()` (WO-04-001), warning highlight when there
  are pending points, count badge; neutral empty state otherwise (mirrors prototype `decisionesBox`).
- `CMP-04-activity-log` (Server): consumes `readActivityLog()` (WO-04-001), bulleted log; "no
  activity yet" empty state (mirrors prototype `logBox`).
- **Out of scope:** the `/pandacorp:decide` command row reuses the shared `CopyButton` (already in
  components); no new write path.

## Dependencies
- **Intra:** WO-04-001 (`readActivityLog`, `readDecisions`), WO-04-004 (shell mounts this tab).
- **Cross:** FRD-01 `lib/status.ts` (`pending_decisions` for AC-04-004.1).

## TDD (RED → GREEN → refactor)
Component tests:
1. Renders summary + key points (AC-04-003.1).
2. Activity log renders entries from fixtures; "no activity yet" when empty (AC-04-003.2).
3. Decision points render with count badge; each highlighted (AC-04-003.3).
4. `pending_decisions > 0` → warning treatment + count; `0` → neutral state (AC-04-004.1).
5. State is not conveyed by color alone (icon/label too) — a11y (FRD-13).

## Definition of done
- [ ] Component tests written first and green.
- [ ] Server Components only (no client state needed here).
- [ ] Spanish copy via i18n; tokens only; `tabular-nums` on the count badge.
- [ ] `bash .pandacorp/verify.sh` passes.

## Status Note

**Built:** `TabSummary` (CMP-04-tab-summary), `DecisionsBlock` (CMP-04-decisions), `ActivityLogBlock` (CMP-04-activity-log) — all Server Components, no `"use client"`. The workspace page (`app/projects/[slug]/page.tsx`) mounts `TabSummary` for the `"summary"` tab, calling `readActivityLog(projectPath)` and `readDecisions(projectPath)` and deriving `pendingDecisions` server-side before passing props.

**Interfaces / contracts exposed:**

```tsx
// app/projects/[slug]/_components/tab-summary.tsx
export interface TabSummaryProps {
  summary: string;
  keyPoints: string[];
  activityLog: ActivityLog;           // from lib/docs.ts readActivityLog()
  decisions: DecisionPoint[];         // from lib/docs.ts readDecisions()
  pendingDecisions: number;           // caller: decisions.filter(dp => !dp.resolved).length
}
export function TabSummary(props: TabSummaryProps): React.JSX.Element
```

Consumed interfaces (WO-04-002, `lib/docs.ts`):
- `readActivityLog(projectPath): ActivityLog` — `{ entries: string[] }`, empty when `.pandacorp/comms/progress.md` absent.
- `readDecisions(projectPath): DecisionPoint[]` — `{ title, recommendation?, resolved }[]`, empty when `.pandacorp/inbox/decisions.md` absent.

**Integration seams:**
- `page.tsx` passes `pendingDecisions` count derived from `decisions.filter(dp => !dp.resolved).length` (not from `status.yaml` `pending_decisions`) — purely from the parsed file.
- Warning treatment is on `data-pending="true"` attribute; reviewer can assert it without CSS computed values.
- A11y: state never by color alone — `data-testid="decision-warning-icon"` (⚠ glyph) present on every unresolved decision item; `decisions-count-badge` has `role="status"`; empty states have `role="status"`.
- `tabular-nums` applied via `fontVariantNumeric: "tabular-nums"` inline style on the count badge.

**Test files:** `app/projects/[slug]/_components/tab-summary.test.tsx` — 25 tests, all GREEN, covering AC-04-003.1, AC-04-003.2, AC-04-003.3, AC-04-004.1 and a11y (FRD-13 icon-not-color-alone).

**Gate:** `bash .pandacorp/verify.sh` → biome clean, tsc clean, 3440 tests pass (120 files, 2 expected-fail, 5 skipped).
