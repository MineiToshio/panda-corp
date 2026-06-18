---
id: WO-14-002
type: work-order
slug: snapshot-panel
title: >-
  WO-14-002 — `CMP-14-snapshot-panel`: probable point + worktree command +
  building-now + staleness
status: DRAFT
parent: FRD-14
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-14-002 — `CMP-14-snapshot-panel`: probable point + worktree command + building-now + staleness

**Feature:** FRD-14 · **Implements:** CMP-14-snapshot-panel · **REQ-14-001, REQ-14-002, REQ-14-003**
**Deploy unit:** `app/projects/[slug]/_components/snapshot-panel.tsx` + colocated tests (+ optional read-only git probe route handler for staleness inputs).

## Acceptance criteria (copied)
- **AC-14-001.1** FOR a building project, render the last probable point label + a "green" badge + `last_green_sha`.
- **AC-14-001.2** Render `git worktree add ../<slug>-review <last_green_sha>` with a copy button.
- **AC-14-001.3** WHEN `last_green_sha` is absent, omit the panel — no broken command.
- **AC-14-002.1** WHEN running with a work order in progress, show "building now: <progress> · don't test this yet", distinct from the probable point.
- **AC-14-003.1** WHEN the snapshot is far behind HEAD, show a "snapshot getting stale" warning.

## Scope
- `CMP-14-snapshot-panel` (Server): consume `buildSnapshot(slug, status)` (WO-14-001). Render the
  probable point + green badge + sha + worktree command (shared `CopyButton`), the "building now"
  block when running, and the staleness warning when `stale`. Mirrors prototype `snapshotPanel`.
- Omit entirely when `buildSnapshot` returns `null` (AC-14-001.3).
- Staleness inputs (`commitsBehind`/`hoursSinceGreen`): obtain via the read-only `git` probe
  (reuse the FRD-15/16 route-handler pattern) or the gate-published `status.yaml` timestamp — see
  blueprint §5 flag; the panel passes them into `isSnapshotStale`.
- **Out of scope:** the helpers (WO-14-001), the rail chips (WO-14-003).

## Dependencies
- **Intra:** WO-14-001 (`buildSnapshot`, `isSnapshotStale`).
- **Cross:** FRD-04 workspace (mounts this panel); FRD-01 `lib/status.ts`; FRD-15/16 probe pattern;
  shared `CopyButton`.

## TDD (RED → GREEN → refactor)
Component tests:
1. Building project renders probable point + green badge + sha (AC-14-001.1).
2. Worktree command rendered with slug + sha + copy button (AC-14-001.2).
3. Absent `last_green_sha` → panel not rendered (AC-14-001.3).
4. Running + progress → "building now … don't test this yet", visually separate (AC-14-002.1).
5. Stale verdict → staleness warning shown; fresh → not shown (AC-14-003.1).

## Definition of done
- [x] Component tests written first and green.
- [x] Server Component; reuses shared `CopyButton`; any `git` probe is read-only (`git rev-list`/`git show`).
- [x] Tokens only; `tabular-nums`; green/stale shown with icon + text (not color alone); Spanish copy via i18n; `data-testid`.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**Built:** `CMP-14-snapshot-panel` — Server Component that renders the FRD-14 snapshot panel inside the FRD-04 workspace, wired into `app/projects/[slug]/page.tsx` in the chrome area (above the tab bar).

**Files delivered:**
- `src/app/projects/[slug]/_components/snapshot-panel/snapshot-panel.tsx` — `SnapshotPanel` Server Component
- `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.test.tsx` — 25 tests RED→GREEN covering all 5 ACs
- `src/app/projects/[slug]/page.tsx` — wired: imports `buildSnapshot` + `SnapshotPanel`, derives snapshot from status, mounts panel in chrome

**Interfaces/contracts exposed:**

```tsx
// src/app/projects/[slug]/_components/snapshot-panel/snapshot-panel.tsx

export interface SnapshotPanelProps {
  slug: string;                   // project slug (panel identification)
  snapshot: SnapshotInfo | null;  // null → panel omitted (AC-14-001.3)
}

export function SnapshotPanel({ slug, snapshot }: SnapshotPanelProps): React.JSX.Element | null
```

**data-testid contract:**
- `snapshot-panel` — root `<section aria-label="Snapshot del proyecto">` (omitted when null)
- `snapshot-panel-probable-point` — probable point section container
- `snapshot-panel-label` — "Último punto probable" heading label
- `snapshot-panel-green-badge` — green badge with `role="status"` + icon + text (not color alone)
- `snapshot-panel-sha` — SHA value with `className="tabular-nums"` + `fontVariantNumeric`
- `snapshot-panel-worktree-cmd` — `<code>` with full `git worktree add ...` command
- `copy-button` — shared `CopyButton` (from `@/components/core/CopyButton/CopyButton`)
- `snapshot-panel-building-now` — "building now" block (only when `buildingNow !== undefined`)
- `snapshot-panel-stale-warning` — staleness warning with `role="alert"` (only when `stale === true`)
- `snapshot-panel-stale-icon` — warning icon inside the stale warning

**Integration seam (page.tsx):**
```ts
// Derives snapshot from already-read status — pure, no git probe
const snapshot = buildSnapshot(slug, status);
// Mounts in chrome between ObjectivesBar and TabBar
<SnapshotPanel slug={slug} snapshot={snapshot} />
```

**Staleness flag:** `stale` is `false` by default from `buildSnapshot` (pure/no-git). Blueprint §5 flag: a git probe route-handler (`git rev-list --count <sha>..HEAD`) would compute `commitsBehind`/`hoursSinceGreen` and call `isSnapshotStale` to update it. This follow-up is documented in the blueprint but not in scope for this WO — the panel is wired and the staleness verdict is observable when set.

**Gate:** 25/25 own tests GREEN. 191 test files, 5197 tests total GREEN. tsc clean (zero errors). biome clean (no new errors; pre-existing `noExcessiveCognitiveComplexity` warning on `page.tsx` is pre-existing, not introduced here). verify.sh PASS.
