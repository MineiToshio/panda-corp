---
id: WO-03-004
type: work-order
slug: selection-workspace-slot
title: WO-03-004 — Selection + default + workspace slot
status: DRAFT
parent: FRD-03
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

**Built:** URL-driven project selection (`?project=<slug>`) + default-select first project + workspace
slot placeholder. Three new modules under `app/portfolio/`:

**Interfaces/contracts exposed:**

```ts
// app/portfolio/selection.ts
export function deriveSelectedSlug(
  items: ProjectListItem[],
  param: string | undefined,
): string | undefined
```
Pure function: returns the matching item name when `param` matches, first item name when no match or
no param, `undefined` when items is empty.

```tsx
// app/portfolio/WorkspaceSlot.tsx
export interface WorkspaceSlotProps { selectedSlug: string | undefined; }
export function WorkspaceSlot(props: WorkspaceSlotProps): React.JSX.Element
```
Host element: `data-testid="workspace-slot"`, `data-slug="<selected-slug>"`. Renders
`workspace-slot-placeholder` (with slug text) when slug present; `workspace-slot-empty` when absent.
One-line FRD-04 wiring: replace placeholder body with `<ProjectWorkspace slug={selectedSlug} />`.

```tsx
// app/portfolio/SelectableProjectRail.tsx
export interface SelectableProjectRailProps {
  items: ProjectListItem[];
  selectedSlug: string | undefined;
}
export function SelectableProjectRail(props: SelectableProjectRailProps): React.JSX.Element
```
Rail with `<Link href="?project=<name>">` rows. Selected row: `data-selected="true"` + accent border.
Unselected: `data-selected="false"`. Empty state: `data-testid="selectable-project-rail-empty"`.

**Updated:** `app/portfolio/page.tsx` is now `async`, reads `searchParams` (Next.js 16 Promise API),
calls `deriveSelectedSlug`, renders `<SelectableProjectRail>` + `<WorkspaceSlot>`.

**Integration seams for FRD-04:**
- `WorkspaceSlot.tsx` — replace placeholder `<div data-testid="workspace-slot-placeholder">` body
  with the real workspace component; `data-testid="workspace-slot"` and `data-slug` remain as seams.
- `SelectableProjectRail.tsx` — no changes needed; rows already emit `?project=<name>` URLs.
- `page.tsx` — no changes needed; `deriveSelectedSlug` already produces the slug for FRD-04.

**Test file:** `app/portfolio/wo-03-004.test.tsx` — 27 tests (RED → GREEN):
- `WorkspaceSlot`: 10 tests (slot present, data-slug, placeholder/empty states, design-token invariant)
- `SelectableProjectRail`: 11 tests (rail, rows, links with `?project=`, data-selected, indicators,
  empty state, design-token invariant)
- `deriveSelectedSlug`: 7 tests (param match, no param default, no-match fallback, empty items,
  single item, case-sensitive match)

**verify.sh:** 118 test files, 3381 tests pass, 2 expected-fail, 5 skipped. biome clean. tsc clean.
