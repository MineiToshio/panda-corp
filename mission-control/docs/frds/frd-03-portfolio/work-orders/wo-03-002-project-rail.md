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
