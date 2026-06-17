---
id: WO-04-004
type: work-order
slug: workspace-shell
title: 'WO-04-004 — Workspace shell: header + Mission Objectives bar + tab bar'
status: DRAFT
parent: FRD-04
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-04-004 — Workspace shell: header + Mission Objectives bar + tab bar

**Feature:** FRD-04 · **Implements:** CMP-04-workspace, CMP-04-header, CMP-04-objectives-bar, CMP-04-tabbar · **REQ-04-001, REQ-04-002**
**Deploy unit:** `app/projects/[slug]/page.tsx` + `app/projects/[slug]/_components/` (header, objectives-bar, tabbar) + colocated tests.

## Acceptance criteria (copied)
- **AC-04-001.1** GIVEN a selected project, the workspace SHALL render exactly five tabs in the order Summary, Work orders, Party, Documents, Commands.
- **AC-04-001.2** WHEN no tab is explicitly selected, the workspace SHALL default to **Summary**.
- **AC-04-002.1** The header SHALL render title, the stage label (from `phase`), `version` and the `progress` string when present; when absent the line is omitted.
- **AC-04-002.2** The Mission Objectives bar SHALL show `work_orders_done / work_orders_total` and the percentage; WHEN `work_orders_total` is 0 or absent the bar is omitted.
- **AC-04-002.3** The header and Mission Objectives bar SHALL be visible regardless of the active tab.

## Scope
- `CMP-04-workspace` (Server): resolve the project from the slug (via FRD-03 portfolio + FRD-01
  `lib/status.ts`), render header + objectives bar + tab bar + the active tab body.
- `CMP-04-header` (Server): title, stage label, version, optional progress line.
- `CMP-04-objectives-bar` (Server): progress bar from `work_orders_done/total` (`tabular-nums`).
- `CMP-04-tabbar` (Client, `"use client"`): `role=tablist`, five tabs in order, default Summary,
  selection via `?tab=` search param (URL-driven so Server Components can render the body).
- Tab bodies are **placeholders/slots** in this WO: Summary → WO-04-005, Documents → WO-04-006,
  Commands → WO-04-007, Work orders → FRD-05 slot, Party → FRD-06 slot.
- **Out of scope:** the tab bodies' content (their own WOs); markdown rendering.

## Dependencies
- **Intra:** none for the shell itself (bodies depend on WO-04-005/006/007).
- **Cross:** FRD-01 `lib/status.ts`, `lib/config.ts`; FRD-03 `lib/portfolio.ts` (slug → project path).

## TDD (RED → GREEN → refactor)
Component tests (`@testing-library/react` + jsdom), colocated `*.test.tsx`:
1. Renders five tabs in exact order (AC-04-001.1).
2. Defaults to Summary when `?tab=` is absent; reflects `?tab=documents` when present (AC-04-001.2).
3. Header shows title/stage/version/progress; omits progress line when absent (AC-04-002.1).
4. Objectives bar shows `2 / 7 · 29%` for those counts; omitted when total is 0/absent (AC-04-002.2).
5. Header + objectives bar present on every tab (AC-04-002.3).

## Definition of done
- [x] Component tests written first and green.
- [x] `CMP-04-tabbar` is the only `"use client"` piece; the rest are Server Components.
- [x] `data-testid` on tabs and the objectives bar; `aria-selected` on the active tab; Spanish copy via i18n.
- [x] No hardcoded colors (design tokens only); `tabular-nums` on counts.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**Built:** Workspace shell — header + Mission Objectives bar + tab bar — for `app/projects/[slug]/`.

**Components delivered:**

| File | Component | Kind |
|---|---|---|
| `app/projects/[slug]/page.tsx` | `CMP-04-workspace` | Server |
| `app/projects/[slug]/_components/workspace-header.tsx` | `CMP-04-header` | Server |
| `app/projects/[slug]/_components/objectives-bar.tsx` | `CMP-04-objectives-bar` | Server |
| `app/projects/[slug]/_components/tabbar.tsx` | `CMP-04-tabbar` | Client (`"use client"`) |

**Interfaces/contracts exposed:**

```tsx
// workspace-header.tsx
export interface WorkspaceHeaderProps { title: string; stage: Phase; version: string; progress?: string; }
export function WorkspaceHeader(props: WorkspaceHeaderProps): React.JSX.Element

// objectives-bar.tsx
export interface ObjectivesBarProps { done: number; total: number | undefined; }
export function ObjectivesBar(props: ObjectivesBarProps): React.JSX.Element | null  // null when total is 0/absent

// tabbar.tsx
export type TabId = "summary" | "work-orders" | "party" | "documents" | "commands";
export interface TabBarProps { activeTab: TabId; }
export function TabBar(props: TabBarProps): React.JSX.Element
```

**Page routing:** `app/projects/[slug]/page.tsx` resolves the project via `activeProjects()` (slug = project name), reads status with `readStatus()`, derives tab from `?tab=` param (defaults to `"summary"`), renders the appropriate tab body. Tab bodies for WO-04-005/006/007 are wired to the already-shipped components (TabSummary, TabDocuments) and to FRD-05/06 slots (WorkOrderBoard, PartyTab). Commands tab has a named placeholder (`data-testid="tab-commands-placeholder"`).

**Integration seams:**
- Slug resolution: `activeProjects().find(p => p.name === slug)` — project must exist in portfolio.
- `progress` field from `status.yaml` is `number` (e.g. 75); rendered as `"75% completado"` string.
- Tab bodies receive pre-fetched data from lib/ readers passed as props.
- `WorkspaceSlot` in `app/portfolio/WorkspaceSlot.tsx` still shows a placeholder — it can be wired to link to `/projects/<slug>` as a follow-up (out of scope for this WO).

**Test file:** `app/projects/[slug]/_components/workspace-shell.test.tsx` — 29 tests covering all 5 ACs (AC-04-001.1/2, AC-04-002.1/2/3).

**verify.sh result:** GREEN — 119 test files, 3410 tests, biome clean, tsc clean. Commit: `5ac5809`.
