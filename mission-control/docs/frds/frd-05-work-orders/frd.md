---
id: FRD-05
type: frd
title: FRD-05 — Work orders (live view)
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-05 — Work orders (live view)

Read-only kanban of the work orders' state, with their FRD and reading the full document.

## Acceptance criteria (EARS)
- **REQ-05-001** — The kanban SHALL show **five** columns, in this order: **To do · In progress · Review · Fail · Done**, all the **same width** and **wide** (not tiny), with **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- **REQ-05-002** — WHEN a work order is in the **Fail** column, its card SHALL carry the **failed-card danger treatment** (danger background + border, a warning icon and danger-colored text on the title), and the Fail column header SHALL itself read in the danger color, so a failure is visually unmistakable.
- **REQ-05-003** — EACH work order card SHALL indicate which **FRD** it belongs to; since work orders now live **per feature** under `docs/frds/frd-NN-<slug>/work-orders/` (DR-049), the kanban MAY group/filter the cards by their FRD (the FRD grouping is now the natural one).
- **REQ-05-004** — WHEN the owner clicks a work order, it SHALL show a **Summary** and a **Full document** tab that renders the entire work order (acceptance criteria, scope, definition of done, evidence).
- **REQ-05-005** — It SHALL show the project's progress (work orders done / total and %), aggregated across every feature's `work-orders/`.
- **REQ-05-006** — The kanban SHALL reflect the live state (written by the agents in each feature's `docs/frds/frd-NN-<slug>/work-orders/`); the owner does NOT edit it.
- **Real-time / event-driven**: the work-order board SHALL update LIVE as the agents change work-order state — when a work order moves column (e.g. into Review, Fail or Done) the board SHALL reflect it without the owner reloading the page. **(reconciled from code 2026-07-07)** — the board (`WoLiveRefresh`) refreshes on TWO triggers, not just fresher events: a genuinely newer event, OR a moved SSE `stateVersion` (the max mtime of `status.yaml` + WO frontmatter, via the shared `lib/status/state-version-moved.ts`). The `stateVersion` trigger is what makes a **backward** transition visible — a gate reopen (`IN_REVIEW → PLANNED`) rewrites only the frontmatter and emits no event, so an event-only board would leave the reopened WO stranded in the wrong column. The open **WO detail pane** mounts the same `WoLiveRefresh` (`ProjectWorkspace.renderWorkOrdersTab`), so an open work order's status badge updates live too — same SSE transport, no second subscription.

## Edge cases
- Project with no work orders yet → message indicating they are generated in `/pandacorp:architecture`.
