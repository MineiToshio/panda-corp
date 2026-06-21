---
id: WO-04-004
type: work-order
slug: workspace-shell
title: 'WO-04-004 — Workspace shell: header + tabbar + objectives bar'
status: DRAFT
parent: FRD-04
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/page.tsx'
  - 'src/app/projects/[slug]/_components/workspace-header.tsx'
  - 'src/app/projects/[slug]/_components/tabbar.tsx'
  - 'src/app/projects/[slug]/_components/objectives-bar.tsx'
source_requirements: [REQ-04-001, REQ-04-002]
last_updated: '2026-06-20'
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

## Status Note

**What was built:**
- `WorkspaceHeader` (`workspace-header.tsx`, Server Component): compact light header rendering title as H1 at 16px/500, optional `ti-player-play` running pip in `var(--color-ok)`, stage `Chip` (accent tone, shared primitive WO-13-007), version at 12px/text2, optional progress line with `ti-hammer` icon. Padding `10px 14px` matches prototype `compactProjectHeader()`. No `PageTitle` — this is the workspace's own compact header per DR-062.
- `TabBar` (`tabbar.tsx`, Client Component `"use client"`): 6-tab bar built on shared `SubTabs` primitive (WO-13-006, DR-062). Tabs in order: Resumen · Work orders · Party · Observabilidad · Documentos · Comandos. URL-driven via `router.push("?tab=<id>")` onChange. `testIdPrefix="tab-"` for stable test ids. `data-testid="tabbar"` on the nav container.
- `ObjectivesBar` (`objectives-bar.tsx`, Server Component): persistent "Objetivos de la misión" section between header and tabs (visible on all tabs per AC-04-002.3). Consumer of shared `ProgressBar` primitive (WO-13-007, DR-057). Shows sword icon, label row with done/total/pct, and full-width ProgressBar. Omitted when total is 0/absent. `data-testid="objectives-bar"` on root, `"objectives-bar-counts"`, `"objectives-bar-pct"`, `"objectives-bar-fill"` on children.
- `page.tsx` updated: `VALID_TABS` set extended to include `"observabilidad"`; `resolveTabBody()` switch extended with `"observabilidad"` case rendering a placeholder `data-testid="tab-observabilidad-body"` pending FRD-12.

**Interfaces/contracts exposed:**
- `WorkspaceHeaderProps`: `{ title: string; stage: Phase; version: string; progress?: string; running?: boolean }`
- `TabBarProps`: `{ activeTab: TabId }`
- `TabId` type: `"summary" | "work-orders" | "party" | "observabilidad" | "documents" | "commands"`
- `ObjectivesBarProps`: `{ done: number; total: number | undefined }`

**Integration seams for consuming WOs:**
- Tab bodies are mounted via `resolveTabBody(tab, project, searchParams)` switch in `page.tsx`. Each FRD plugs into its own `case`: FRD-05 → `"work-orders"`, FRD-06 → `"party"`, FRD-12 → `"observabilidad"` (placeholder), FRD-11 → `"commands"`.
- The server reads `?tab=` param and passes `activeTab` to `TabBar`. Client pushes `?tab=<id>` on selection. The FRD-12 `"observabilidad"` case is a `<div data-testid="tab-observabilidad-body">` placeholder for FRD-12's implementer to replace.

**Implicit decisions and assumptions:**
- ObjectivesBar is placed **between header and tabs** (visible on all tabs), not inside the Resumen tab body. This diverges from the prototype's `progressBar()` placement (inside `projResumen()`), but satisfies AC-04-002.3 explicitly. The prototype's inline mini bar (`height:6px`) in the header title row was intentionally omitted — the persistent ObjectivesBar below the header replaces it.
- The progress text (`progress` prop) appears below the title row in the header as a separate line with a `ti-hammer` icon. The prototype shows this inside the Resumen tab body (`projResumen()`), but the WO-04-004 AC-04-002.1 explicitly includes it in the header.
- `TabId` uses English slug identifiers (`"summary"`, `"work-orders"`, etc.), with Spanish display labels in `WORKSPACE_TABS`. The URL param `?tab=summary` (not `?tab=resumen`) — this is the URL key convention.
- `SubTabs` from WO-13-006 uses `background:var(--color-card2)` for the active state, matching `.stab.on { background:var(--secondary) }` in the prototype via the token alias.
- `vi.mock("next/navigation", ...)` was added to 4 test files after TabBar switched from `<a href>` links to `useRouter().push()` — this is the required pattern for all tests that render the workspace page or TabBar.

**Test files covering this WO:**
- `src/app/projects/[slug]/_components/_tests/workspace-shell.test.tsx` — 30 tests covering all ACs (6-tab order, default tab, header fields, objectives bar, running pip, omit-when-zero, tab persistence)
- `src/app/projects/[slug]/_tests/page.reviewer.test.tsx` — page-level reviewer tests (updated with navigation mock)
- `src/app/projects/[slug]/_tests/page.reviewer.integration.test.tsx` — integration reviewer tests (updated with navigation mock)
- `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx` — WO detail integration (updated with navigation mock)

**Fidelity check (DR-056):**
Cycle 1 performed via `/preview-wo04004` route (portfolio slug resolution for `mission-control` is blocked by WO-03-002's pre-existing portfolio parser bug with Spanish headers). Preview shows header, objectives bar, and 6-tab bar rendering correctly against the prototype. The ObjectivesBar-below-header layout differs from the prototype's in-Resumen placement by design (WO-04-004 AC-04-002.3).

**Preview route:** `/preview-wo04004` (`src/app/preview-wo04004/page.tsx`) — exists for the fidelity check; not shipped behavior.
