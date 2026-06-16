# FRD-14 — Work orders

Implementation chunks for the **probable snapshot panel, status chips and feedback-channels doc**,
each testable in isolation. Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first.

## Work orders

| WO | Title | Layer | Implements |
|---|---|---|---|
| [WO-14-001](./wo-14-001-snapshot-helpers.md) | `lib/snapshot.ts` — `buildSnapshot` + `isSnapshotStale` | lib (TDD) | IF-14-snapshot |
| [WO-14-002](./wo-14-002-snapshot-panel.md) | `CMP-14-snapshot-panel` — probable point + worktree command + building-now + staleness | component | CMP-14-snapshot-panel |
| [WO-14-003](./wo-14-003-status-chips.md) | `CMP-14-status-chips` — decisions/bugs/rethink chips on the rail | component | CMP-14-status-chips |
| [WO-14-004](./wo-14-004-feedback-channels-doc.md) | Manual: three feedback channels (doc) | docs | REQ-14-006 |

## Order & parallelization

- **First:** WO-14-001 (pure helpers) — no UI, no dependency.
- **Then (parallel):** WO-14-002 (panel, needs WO-14-001 + FRD-04 mount slot), WO-14-003 (chips, needs
  FRD-03 rail slot), WO-14-004 (doc — independent, can run anytime FRD-08 Manual exists).
- The panel mounts in the FRD-04 workspace; the chips mount on the FRD-03 portfolio rail.

## Cross-feature dependencies

- **FRD-01** (`lib/status.ts` — `last_green_sha`, `safe_to_test`, `pending_decisions`, `pending_bugs`,
  `rethink_pending`, `running`, `progress`).
- **FRD-04** (workspace mounts `CMP-14-snapshot-panel`).
- **FRD-03** (portfolio rail mounts `CMP-14-status-chips`).
- **FRD-08** (Manual hosts the feedback-channels section, WO-14-004).
- **FRD-15/16** (the read-only `git` probe pattern reused for staleness inputs — see blueprint §5 flag).
- Shared `CopyButton` (FRD-02 component).
