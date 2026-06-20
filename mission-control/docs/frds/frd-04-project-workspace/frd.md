---
id: FRD-04
type: frd
title: FRD-04 — Project workspace
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-04 — Project workspace

On opening a project from the portfolio, its workspace: a **tabs-first** surface — a compact header, the tab bar, then the tab content. The overview lives in the Resumen (Summary) tab, not above the tabs.

## Acceptance criteria (EARS)
- The workspace SHALL be **tabs-first**: a **compact header** (title · stage · version · a thin work-order progress bar) at the top, the **tab bar** directly below it (reachable without scrolling), and the selected tab's content beneath. The overview content lives INSIDE the Resumen tab (the default), not above the tabs.
- The workspace SHALL offer tabs, in this order: **Summary · Work orders · Party · Observability · Documents · Commands** (Commands last, because it is contextual and repetitive).
- The compact header SHALL show title, stage, version and a thin progress bar (% of work orders completed), visible on all tabs; the detailed **"Mission Objectives"** bar (work orders done / total + %) lives inside the Summary tab.
- The **Summary** tab SHALL show: summary, key points, the **Mission Objectives** progress, **decision points** (highlighted, with a count) and a high-level **activity log** (what was done and what decisions were made), read from `.pandacorp/inbox/decisions.md` and `.pandacorp/comms/progress.md`.
- WHEN there are pending decisions, it SHALL highlight them; WHERE a pending decision carries an AI recommendation, the Summary SHALL offer an **"Aprobar la recomendación" one-click** that copies `/pandacorp:decide "Aprobado: <recommendation>"` to the clipboard (it only copies the command — the app never writes or calls Claude).
- The **Summary** tab SHALL show the **snapshot panel** when a last-green build commit exists: the last commit that passed all gates (with its FRD label and short SHA) and a copyable **`git worktree add ../<slug>-review <sha>`** command, so the owner can test that safe commit in a separate worktree without stopping the running build.
- The **Commands** tab SHALL show the commands relevant to the stage (continue `implement`, `release`, `iterate`, with when to use each) and the **build mode selector** ([FRD-11](../frd-11-build-modes/frd.md)).
- The **Documents** tab SHALL allow navigating and reading the project's documents rendered.
- The **Party** tab is the one in [FRD-06](../frd-06-party/frd.md); **Work orders** the one in [FRD-05](../frd-05-work-orders/frd.md); the **Observability** tab is a sibling of Party (the timeline / DAG observability view, [FRD-12](../frd-12-observability-dataviz/frd.md)).
