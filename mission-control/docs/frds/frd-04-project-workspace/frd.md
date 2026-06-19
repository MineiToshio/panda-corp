---
id: FRD-04
type: frd
title: FRD-04 — Project workspace
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-04 — Project workspace

On opening a project from the portfolio, its workspace with tabs, a progress header and commands.

## Acceptance criteria (EARS)
- The workspace SHALL offer tabs, in this order: **Summary · Work orders · Party · Documents · Commands** (Commands last, because it is contextual and repetitive).
- The header SHALL show title, stage, version, the `progress` line and a **"Mission Objectives"** bar (% of work orders completed), visible on all tabs.
- The **Summary** tab SHALL show: summary, key points, **decision points** (highlighted, with a count) and a high-level **activity log** (what was done and what decisions were made), read from `.pandacorp/inbox/decisions.md` and `.pandacorp/comms/progress.md`.
- WHEN there are pending decisions, it SHALL highlight them.
- The **Commands** tab SHALL show the commands relevant to the stage (continue `implement`, `release`, `iterate`, with when to use each) and the **build mode selector** ([FRD-11](../frd-11-build-modes/frd.md)).
- The **Documents** tab SHALL allow navigating and reading the project's documents rendered.
- The **Party** tab is the one in [FRD-06](../frd-06-party/frd.md); **Work orders** the one in [FRD-05](../frd-05-work-orders/frd.md).
