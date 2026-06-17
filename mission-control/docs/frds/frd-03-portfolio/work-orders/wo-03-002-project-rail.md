---
id: WO-03-002
type: work-order
slug: project-rail
title: WO-03-002 — Project rail + rows + indicators
status: DRAFT
parent: FRD-03
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-03-002 — Project rail + rows + indicators

**Module:** `app/portfolio/page.tsx`, `components/ProjectRail.tsx`, `components/ProjectRow.tsx`
**IDs touched:** `CMP-03-rail`, `CMP-03-row`; REQ-03-001, REQ-03-002
**Dependencies:** WO-03-001 (`activeProjects`)

## EARS criteria (from FRD-03)

- AC-03-001.2 — The portfolio SHALL list the active projects in a **vertical panel on the left**.
- AC-03-002.1 — EACH project row SHALL show its **title**, its **stage** and an **indicator**:
  "building" if `running`, "stopped" if not.

## Design

- `app/portfolio/page.tsx` (Server Component): `activeProjects()` → render `<ProjectRail>` on the
  left. (The right workspace slot is WO-03-004.)
- `ProjectRow.tsx`: title, stage label (architecture/building/shipped), and a building/stopped
  indicator that is **not color-only** (icon + Spanish label, architecture §7).
  `data-testid="project-row"`.
- Design tokens only; Spanish UI copy.

## Definition of done

- Component test (RED first, jsdom) with fixture-shaped `ProjectListItem[]`:
  - one row per active project with title + stage.
  - `running: true` → "building" indicator; `running: false` → "stopped" indicator (text present,
    not color alone).
- Read-only; no write.
- `.pandacorp/verify.sh` green.

## Status Note

**Built:** Standalone `ProjectRow` component (CMP-03-row) as a named exported function in
`components/ProjectRow.tsx`. The portfolio page (`app/portfolio/page.tsx`) and rail
(`components/ProjectRail.tsx`) were already delivered by WO-03-001; this WO adds the separable
row component the blueprint specifies under `CMP-03-row`.

**Interfaces/contracts exposed:**
```tsx
// components/ProjectRow.tsx
export interface ProjectRowProps { item: ProjectListItem; }
export function ProjectRow({ item }: ProjectRowProps): React.JSX.Element
```
Consumes `ProjectListItem` from `IF-03-activeProjects` (`lib/portfolio.ts`). Read-only: no writes,
no browser APIs, Server Component safe.

**data-testid contract (WO-03-002):**
- `project-row` — article root
- `project-row-name` — project name heading
- `project-row-stage` — stage chip
- `project-row-indicator` — building/stopped indicator (text present, not color-only)
- `project-row-not-found-badge` — path-not-found badge (when `exists=false`)

**Indicator invariant (AC-03-002.1, architecture §7):** indicator always carries a Spanish text
label ("Construyendo" / "Parado") plus `role="status"` and `aria-label`; never color-only.
Suppressed when `exists=false` (missing path takes priority).

**Integration seams:**
- `ProjectRail.tsx` can import and delegate to `ProjectRow` for row rendering (currently uses its
  own inline row; both coexist without conflict).
- The `app/portfolio/page.tsx` page renders `<ProjectRail items={items} />` which internally
  renders all rows. `ProjectRow` is available for direct use by any consumer (e.g. FRD-04 workspace).

**Test files:**
- `components/ProjectRow.test.tsx` — 20 tests (RED → GREEN): data-testid contract, title,
  stage chip (all 4 phases), building indicator, stopped indicator, not-color-only invariant,
  path-not-found badge, design-token invariant (no hardcoded hex/rgb/hsl).

**verify.sh:** 116 test files, 3331 tests passed, 2 expected-fail, 5 skipped. biome + tsc clean.
