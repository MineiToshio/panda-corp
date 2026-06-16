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
- [ ] Component tests written first and green.
- [ ] Server Component; reuses shared `CopyButton`; any `git` probe is read-only (`git rev-list`/`git show`).
- [ ] Tokens only; `tabular-nums`; green/stale shown with icon + text (not color alone); Spanish copy via i18n; `data-testid`.
- [ ] `bash .pandacorp/verify.sh` passes.
