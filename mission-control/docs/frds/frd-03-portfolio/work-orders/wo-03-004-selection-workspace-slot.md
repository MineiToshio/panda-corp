---
id: WO-03-004
type: work-order
slug: selection-workspace-slot
title: WO-03-004 — Selection + default + workspace slot
status: DRAFT
parent: FRD-03
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-03-004 — Selection + default + workspace slot

**Module:** `app/portfolio/page.tsx` (right panel + selection)
**IDs touched:** `CMP-03-workspace-slot`; REQ-03-004, REQ-03-005
**Dependencies:** WO-03-002 (rail), FRD-04 (workspace component — stub until it lands)

## EARS criteria (from FRD-03)

- AC-03-004.1 — WHEN the owner selects a project in the list, the system SHALL show its workspace
  (FRD-04) in the right-hand panel.
- AC-03-005.1 — WHEN no project is selected, the system SHALL select the **first one by default**.

## Design

- Selection is **URL-driven**: `app/portfolio/page.tsx?project=<slug>` (Server-rendered, no client
  selection state, no flash). Clicking a row navigates to that param.
- Default: if no `project` param, render the **first** active project's workspace.
- Right panel hosts the FRD-04 workspace component for the selected project. **Until FRD-04 lands,**
  render a placeholder slot (`data-testid="workspace-slot"`) carrying the selected project slug — so
  selection + default-select are testable in isolation now.

## Definition of done

- Page/integration test (RED first):
  - no `project` param → the first active project is selected (its slug reaches the slot).
  - `?project=<slug>` → that project is selected.
  - selecting a row updates the slot to that project.
- Read-only; no write.
- `.pandacorp/verify.sh` green.

## Note for the report

The actual workspace render is **FRD-04**; this WO ships the host slot + selection only. Wiring the
real FRD-04 component into the slot is a one-line follow-up once FRD-04's component exists (tracked as
a cross-feature dependency, not a re-do).
