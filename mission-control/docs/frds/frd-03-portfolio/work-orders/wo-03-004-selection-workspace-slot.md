---
id: WO-03-004
type: work-order
slug: selection-workspace-slot
title: WO-03-004 — Selection + default + workspace slot
status: DRAFT
parent: FRD-03
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-18'
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

## Reviewer finding — REOPENED (FRD-03 gate, 2026-06-18, Opus 4.8)

**Blocking integration regression.** WO-03-004 introduced `SelectableProjectRail`
(`src/app/portfolio/SelectableProjectRail.tsx`, commit `1bd7c6f`) and wired it into
`src/app/portfolio/page.tsx` as the LIVE rail, **superseding** the original
`ProjectRail` module. But `SelectableProjectRail` dropped two acceptance criteria the
original rail carried, and nothing on the live `/portfolio` page renders them:

- **AC-03-003.1 (business snapshot)** — a shipped/operation project's `snapshot`
  (`users` / `returnMetric` / `verdict`) never reaches the DOM. The standalone
  `BusinessSnapshot` component (WO-03-003) is built and unit-tested but has **zero
  importers** in the live page tree.
- **AC-03-006.2/3/4 (path-not-found badge + recovery)** — a row with `exists === false`
  only suppresses the running indicator; the `⚠ ruta no encontrada` badge and the
  copyable `git clone <repo> <path> && /pandacorp:sync-portfolio` recovery command are
  never rendered. The standalone `RecoveryHint` component (WO-03-005) is built and
  unit-tested but has **zero importers** in the live page tree (`ProjectRail` and
  `PortfolioTable`, which DO wire them, are orphaned — no route renders them).

Why the per-WO gates stayed green: every component is tested in isolation, but no test
exercised the assembled page rail. The 194 FRD-03 unit tests all pass; the integration
is what's broken.

**Reviewer RED anchor (kept on disk, not committed):**
`src/app/portfolio/_tests/frd-03-integration.reviewer.test.tsx` — 3 tests that render
`SelectableProjectRail` (the LIVE rail) with a shipped+snapshot project and a
missing-path+repo project. All 3 fail today (snapshot absent, badge absent, recovery
absent). They must pass after the fix.

**Concrete fix (file:line):**
- `src/app/portfolio/SelectableProjectRail.tsx` (the row body, around lines 195-220):
  - render `BusinessSnapshot` (import from
    `./_components/BusinessSnapshot/BusinessSnapshot`) when
    `item.stage === "operation" && item.snapshot !== undefined`, passing
    `item.snapshot.users / returnMetric / verdict`.
  - render `RecoveryHint` (import from `./_components/RecoveryHint/RecoveryHint`) when
    `item.exists === false`, passing `exists`, `path={item.path}`, `repo={item.repo}`.
  - the not-found badge must appear on the row (today only the indicator is suppressed).
- Reuse the existing standalone components (that is exactly why WO-03-003/005 built them
  as separable). Do NOT re-introduce the orphaned inline copies in
  `components/modules/ProjectRail` / `PortfolioTable` — prefer deleting those dead
  parallel implementations (DR clean-code, no-dead-code) or wiring the live page to a
  single rail, in a separate refactor change.

**Status: REOPENED → PLANNED.** WO-03-001/002/003/005 stay IN_REVIEW (their components
are correct; only the integration into the live rail is missing).

## Status Note — integration repair (2026-06-18, baseline-repair)

**Built:** Composed the two orphaned standalone components into the LIVE rail
(`src/app/portfolio/SelectableProjectRail.tsx`), turning the reviewer's RED anchor
(`src/app/portfolio/_tests/frd-03-integration.reviewer.test.tsx`) 3/3 GREEN — no test weakened:

- **AC-03-003.1 (business snapshot)** — render `<BusinessSnapshot users / returnMetric / verdict />`
  (imported from `./_components/BusinessSnapshot/BusinessSnapshot`) inside the row's `<article>` when
  `item.snapshot !== undefined` (`activeProjects` only populates `snapshot` for `stage === "operation"`;
  `BusinessSnapshot` itself returns null when no field is present).
- **AC-03-006.2/3/4 (path-not-found badge + recovery)** — render `<RecoveryHint exists path repo />`
  (imported from `./_components/RecoveryHint/RecoveryHint`) on every row; it renders nothing when
  `item.exists === true`, and shows the `⚠ ruta no encontrada` badge + copyable
  `git clone <repo> <path> && /pandacorp:sync-portfolio` recovery (or the no-repo warning) when the path
  is missing.

Reused the existing standalone components per the reviewer's instruction (no re-introduction of the
orphaned inline copies in `ProjectRail` / `PortfolioTable`).

**Interfaces/contracts exposed:** unchanged — `SelectableProjectRail({ items, selectedSlug })`. New
internal imports: `BusinessSnapshot`, `RecoveryHint` (both already-VERIFIED standalone components).

**data-testid anchors now on the rail:** `business-snapshot*` (from BusinessSnapshot) and
`recovery-hint*` (from RecoveryHint), in addition to the existing `selectable-project-row` chrome.

**Test files covering it:**
- `src/app/portfolio/_tests/frd-03-integration.reviewer.test.tsx` — reviewer RED anchor, now 3/3 GREEN.
- `src/app/portfolio/_tests/wo-03-004.test.tsx` — existing rail tests, still GREEN (no regression).

**Gate:** full `.pandacorp/verify.sh` GREEN (209 test files, 5435 pass). Returned to IN_REVIEW for the
FRD-03 gate's re-verification (never VERIFIED by the implementer — DR-015/DR-050).

## Reviewer finding — REOPENED again (FRD-03 gate, 2026-06-18, Opus 4.8)

**Blocking integration regression — nested interactive content (invalid HTML + click hijack).**
The integration repair above correctly wired `BusinessSnapshot` + `RecoveryHint` into the LIVE rail,
turning the snapshot/badge/recovery anchors green. But it placed `RecoveryHint` — which renders a
`CopyButton` (`<button>`) for the recovery command — INSIDE the row's navigation `<Link>` (an `<a>`).

`SelectableProjectRail.tsx` wraps each whole `<article>` row in
`<Link href="?project=<name>">` (line ~184), and `<RecoveryHint>` (line ~244) is rendered inside
that `<article>`. So on a missing-path row with a repo, the DOM is
`<a> … <button data-testid="copy-button"> … </a>` — a `<button>` nested inside an `<a>`. This is:

- **Invalid interactive-content nesting** (HTML spec; WCAG 4.1.2). React's `validateDOMNesting`
  flags `<button>` cannot be a descendant of `<a>`; it is a hydration-class defect.
- **Broken UX:** clicking "copiar" also fires the anchor's navigation to `?project=<name>` (the
  click bubbles up to the row link), so the copy affordance the FRD requires (AC-03-006.3,
  copyable recovery — same shape as FRD-15/16 banners) cannot be used in place.

Why it slipped the prior gate: `RecoveryHint`'s standalone unit tests render it OUTSIDE any link,
and the page-level tests never asserted nesting validity — the defect only exists in the assembled
rail. This is exactly the integration class the FRD gate exists to catch.

**Reviewer RED anchor (kept on disk, not committed):**
`src/app/portfolio/_tests/frd-03-nested-interactive.reviewer.test.tsx` — asserts the `copy-button`
on the live rail has NO ancestor `<a>`. RED today; must be GREEN after the fix.

**Concrete fix (file:line):** `src/app/portfolio/SelectableProjectRail.tsx`.
- Stop wrapping the WHOLE row (including `RecoveryHint`/`CopyButton`) in `<Link>`. Options:
  1. Make only the row's **navigational chrome** (name + stage + indicator header) the link target,
     and render `RecoveryHint` (and any future interactive content) as a SIBLING of the link inside
     the `<article>`, not a descendant of it; or
  2. Drop the `<Link>` wrapper and make the row a non-anchor container, moving selection navigation
     onto a dedicated link/button in the header (`aria-current` stays on the selected row).
- Keep `data-testid="selectable-project-row"`, `data-selected`, the snapshot, the badge and the
  recovery command all present — only the nesting changes. Re-run the FRD gate:
  `bash .pandacorp/verify.sh --since dbcf75d` must be green, including the reviewer anchors
  (`frd-03-integration.reviewer.test.tsx`, `frd-03-integration.gate.reviewer.test.tsx`,
  `frd-03-nested-interactive.reviewer.test.tsx`).

**Status: REOPENED → PLANNED.** WO-03-001/002/003/005 stay IN_REVIEW (their standalone components
are correct; only WO-03-004's rail composition nests a button inside an anchor).
