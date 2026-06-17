---
id: WO-03-003
type: work-order
slug: business-snapshot
title: WO-03-003 — Business snapshot (shipped projects)
status: DRAFT
parent: FRD-03
implementation_status: PLANNED
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
