---
id: WO-04-005
type: work-order
slug: tab-summary
title: 'WO-04-005 — Summary tab: summary, key points, decisions, activity log'
status: DRAFT
parent: FRD-04
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
