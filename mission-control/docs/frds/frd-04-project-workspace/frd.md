---
id: FRD-04
type: frd
title: FRD-04 — Project workspace
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-30'
---
# FRD-04 — Project workspace

On opening a project from the portfolio, its workspace: a **tabs-first** surface — a compact header, the tab bar, then the tab content. The overview lives in the Resumen (Summary) tab, not above the tabs.

## Acceptance criteria (EARS)
- The workspace SHALL be **tabs-first**: a **compact header** (title · stage · version · a thin work-order progress bar) at the top, the **tab bar** directly below it (reachable without scrolling), and the selected tab's content beneath. The overview content lives INSIDE the Resumen tab (the default), not above the tabs.
- The workspace SHALL offer tabs, in this order: **Summary · Work orders · Party · Observability · Documents · Commands** (Commands last, because it is contextual and repetitive).
- The compact header SHALL show title, stage, version and a thin progress bar (% of work orders completed), visible on all tabs; the detailed **"Mission Objectives"** bar (work orders done / total + %) lives inside the Summary tab.
- The **Summary** tab SHALL show: summary, key points, the **Mission Objectives** progress, **decision points** (highlighted, with a count) and a high-level **activity log** (what was done and what decisions were made), read from `.pandacorp/inbox/decisions.md` and `.pandacorp/comms/progress.md`.
- WHEN there are pending decisions, it SHALL highlight them, EACH labeled with its stable `id` (`<date>-<n>` / `legacy-<n>`, derived from its heading — never invented, never reused) so the owner can reference one specific decision, plus an "hace N días" age hint derived from the heading's date (omitted for a legacy/undated heading); the **per-card command SHALL be `/pandacorp:decide <id>`** — scoped to that decision, not the bare un-scoped form (which would walk every pending one). WHERE a pending decision carries an AI recommendation, the Summary SHALL render the recommendation TEXT as context only — no one-click "approve" affordance (removed, owner decision 2026-06-30: answering must go through the real `/pandacorp:decide <id>` conversation, which shows full context before recording an answer).
- A decision marked **obsolete** (status `OBSOLETO`/`SUPERSEDIDO` in `decisions.md`, distinct from `RESUELTO`) SHALL render with a visible "Obsoleta" tag, never indistinguishable from one actually answered.
- The **Summary** tab SHALL show the **snapshot panel** when a last-green build commit exists: the last commit that passed all gates (with its FRD label and short SHA) and a copyable **`git worktree add ../<slug>-review <sha>`** command, so the owner can test that safe commit in a separate worktree without stopping the running build.
- The **Commands** tab SHALL show the commands relevant to the stage and the **build mode selector** ([FRD-11](../frd-11-build-modes/frd.md)). The **ModeSelector panel** (FRD-11) shows `/pandacorp:implement [mode]` (the full build command) always, and additionally shows `/pandacorp:implement <frd>` and `/pandacorp:implement change:<slug>` when the phase is `implementation` or `release`. The **CommandsBox** (below ModeSelector) shows stage-relevant non-build commands: in `implementation` — (1) `/pandacorp:release` — launch when all work orders are done, (2) `/pandacorp:iterate` — add or adjust; in `release` — (1) `/pandacorp:iterate` — add/adjust/fix, (2) `/pandacorp:new-version` — start a new major milestone.
- The **Documents** tab SHALL allow navigating and reading the project's documents, rendered at the **full width** of the reader pane. Every navigation link — both the doc tree AND links found inside a document — SHALL preserve the workspace context (stay on the Documents tab, same project), so selecting a document never bounces back to the Summary tab. A link inside a document to another document the reader surfaces SHALL open it in the **same reader**; an off-app URL SHALL open in a new tab; a relative link to a document the reader does not surface SHALL render as plain text (never a broken link).
- The **Party** tab is the one in [FRD-06](../frd-06-party/frd.md); **Work orders** the one in [FRD-05](../frd-05-work-orders/frd.md); the **Observability** tab is a sibling of Party (the timeline / DAG observability view, [FRD-12](../frd-12-observability-dataviz/frd.md)).
