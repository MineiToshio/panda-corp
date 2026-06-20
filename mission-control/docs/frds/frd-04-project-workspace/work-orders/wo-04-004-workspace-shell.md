---
id: WO-04-004
type: work-order
slug: workspace-shell
title: 'WO-04-004 — Workspace shell: header + tabbar + objectives bar'
status: DRAFT
parent: FRD-04
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/page.tsx'
  - 'src/app/projects/[slug]/_components/workspace-header.tsx'
  - 'src/app/projects/[slug]/_components/tabbar.tsx'
  - 'src/app/projects/[slug]/_components/objectives-bar.tsx'
source_requirements: [REQ-04-001, REQ-04-002]
last_updated: '2026-06-19'
---
# WO-04-004 — Workspace shell: header + tabbar + objectives bar

## Goal
Re-implement the **project workspace chrome** so it renders pixel-faithfully to the approved
prototype `projectPane()`: a **compact, light header** (DR-062 — its **H1 is the project name**, NOT a
heavy panel), the **6-tab bar** below it, and the **"Objetivos de la misión"** progress bar — all
visible on every tab. This is the mount seam the per-tab FRDs plug into.

The `lib/**` data layer (`lib/status.ts`, `lib/docs.ts`, `lib/next-step.ts`) is correct and VERIFIED —
this WO is **presentational only**: it re-anchors the shell components to the prototype and the frozen
tokens, reusing the FRD-13 foundation primitives instead of bespoke markup.

## Scope
- **`CMP-04-workspace`** (`src/app/projects/[slug]/page.tsx`, Server) — resolves the project from the
  slug (FRD-03 portfolio + FRD-01 `lib/status.ts`), renders the header + objectives bar + tab bar +
  active tab body. It is the **provider of the Tabbar mount seam** for FRD-05/06/11/12/14.
- **`CMP-04-header` / `WorkspaceHeader`** (`workspace-header.tsx`, Server) — the **compact light
  header** of the prototype `projectPane()`: the **project name as the H1** (with the live
  `ti-player-play` `var(--ok)` running pip), a right cluster with the **status `Chip`** + version, and
  the thin progress line. **NOT a `PageTitle`** and **not a heavy `Panel`** — it is the workspace's own
  light `compactProjectHeader` per DR-062 / `components.md`.
- **`CMP-04-tabbar` / `Tabbar`** (`tabbar.tsx`, Client `"use client"`) — the **six-tab bar** built on
  the shared **`Tabs`** primitive (the project-scoped `.stab` pills), in this order:
  **Resumen · Work orders · Party · Observabilidad · Documentos · Comandos**. The new **Observabilidad**
  tab (FRD-12, sibling of Party) is included. `role=tablist`, keyboard-navigable, `aria-selected`,
  default Resumen, selection URL-driven (`?tab=`) so Server Component bodies render.
- **`CMP-04-objectives-bar` / `ObjectivesBar`** (`objectives-bar.tsx`, Server) — the **"Objetivos de la
  misión"** bar, a **consumer of the shared `ProgressBar`** primitive (accent fill, `var(--ok)` at
  100%, `done / tot · pct%`, `tabular-nums`). Omitted when `work_orders_total` is 0/absent.
- Tab bodies are **mounted, not owned** here: Resumen/Documentos → WO-04-005; Comandos → FRD-11;
  Work orders → FRD-05; Party → FRD-06; Observabilidad → FRD-12. The shell renders the slot.
- **Reuse before create** (`docs/design/components.md`): use `Tabs`, `ProgressBar`, `Chip`, `ItemSlot`
  — do not fork a second tab bar, progress bar or pill.

## Acceptance criteria
- **AC-04-001.1** GIVEN a selected project, the workspace SHALL render exactly six tabs in order
  Resumen, Work orders, Party, Observabilidad, Documentos, Comandos.
- **AC-04-001.2** WHEN no tab is explicitly selected, the workspace SHALL default to **Resumen**.
- **AC-04-002.1** The header SHALL render the project name as the H1, the stage label (from `phase`),
  `version` and the `progress` string when present; the progress line is omitted when absent. The
  header is a **compact light** block (DR-062), not a heavy panel.
- **AC-04-002.2** The objectives bar (`ProgressBar` consumer) SHALL show
  `work_orders_done / work_orders_total` + the percentage; omitted when total is 0/absent.
- **AC-04-002.3** The header and objectives bar SHALL be visible regardless of the active tab.
- Rendered output matches `projectPane()` on the frozen tokens; no hardcoded colors; the browser
  fidelity/smoke gate is clean.

## Dependencies
- **Foundation (FRD-13):** WO-13-006 (`PageTitle`/`SectionHead`/`Tabs`), WO-13-007
  (`Chip`/`ProgressBar`/`Button`).
- **Intra (FRD-04):** WO-04-001 (`lib/docs.ts`), WO-04-003 (`workspaceCommands`) — VERIFIED libs.
- **Cross-FRD:** `frd-13` (foundation primitives), `frd-01`/`frd-03` (`lib/status.ts`,
  `lib/portfolio.ts`, slug → project).

## Visual reference
`docs/design/prototype/index.html` → `projectPane()` (header + subtabs shell), `progressBar()`
(objectives bar). Reach it in the `portfolio` view with a project selected. Fidelity, not novelty
(DR-056) — see `../fdd.md` and `../mocks/README.md`.
