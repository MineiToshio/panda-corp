# FRD-14 — Work orders

Implementation chunks for the **probable snapshot panel, status chips and feedback-channels doc**,
each testable in isolation. Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first.

## Work orders

| WO | Title | Layer | Status | Implements |
|---|---|---|---|---|
| [WO-14-001](./wo-14-001-snapshot-helpers.md) | `lib/snapshot.ts` — `buildSnapshot` + `isSnapshotStale` | lib (TDD) | VERIFIED | IF-14-snapshot |
| [WO-14-002](./wo-14-002-snapshot-panel.md) | SnapshotPanel — último commit en verde + worktree command + building-now + staleness | UI | PLANNED (reopened at gate — `safe_to_test` honesty) | CMP-14-snapshot-panel |
| [WO-14-003](./wo-14-003-status-chips.md) | `CMP-14-status-chips` — decisions/bugs/rethink chips on the rail | UI | VERIFIED | CMP-14-status-chips |
| [WO-14-004](./wo-14-004-feedback-channels-doc.md) | Manual: three feedback channels (doc) | docs | VERIFIED | REQ-14-006 |

## Phase 2 re-plan (2026-06-19)

The `lib/**` helper (WO-14-001) is correct and **VERIFIED** — untouched. Only **WO-14-002** (the snapshot
panel UI) was re-planned: re-anchored to the prototype `snapshotPanel()`/`bStalenessPanel()`, given the
clear canonical copy, and its warning refactored onto the **shared `Banner`**. WO-14-003 (rail chips,
lives in the FRD-03 portfolio surface) and WO-14-004 (doc, hosted by the FRD-08 Manual) are outside this
FRD's disjoint workspace subfolder (`_components/snapshot-panel`) and stay **VERIFIED**.

## Order & parallelization (Phase 2)

- **Lib VERIFIED:** WO-14-001 — not rebuilt.
- **WO-14-002** (panel) is the only re-planned WO; it mounts into the FRD-04 workspace via the Tabbar
  shell seam. See `../blueprint.md` → **Build Plan (Phase 2)**.
- The panel mounts in the FRD-04 workspace; the chips (WO-14-003) mount on the FRD-03 portfolio rail.

## Cross-feature dependencies

- **FRD-01** (`lib/status.ts` — `last_green_sha`, `safe_to_test`, `pending_decisions`, `pending_bugs`,
  `rethink_pending`, `running`, `progress`).
- **FRD-04** (workspace mounts `CMP-14-snapshot-panel`).
- **FRD-03** (portfolio rail mounts `CMP-14-status-chips`).
- **FRD-08** (Manual hosts the feedback-channels section, WO-14-004).
- **FRD-15/16** (the read-only `git` probe pattern reused for staleness inputs — see blueprint §5 flag).
- Shared `CopyButton` (FRD-02 component).
