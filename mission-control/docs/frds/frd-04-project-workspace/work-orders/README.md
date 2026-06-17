# FRD-04 — Work orders

Implementation chunks for the **project workspace** shell, each small and testable in isolation.
Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first.

## Work orders

| WO | Title | Layer | Implements |
|---|---|---|---|
| [WO-04-001](./wo-04-001-docs-reader.md) | `lib/docs.ts` — doc tree + raw read + comms readers | lib (TDD) | IF-04-docs |
| [WO-04-003](./wo-04-003-workspace-commands.md) | `lib/next-step.ts` — `workspaceCommands(phase)` | lib (TDD) | IF-04-next-step |
| [WO-04-004](./wo-04-004-workspace-shell.md) | Workspace shell: header + Mission Objectives bar + tab bar | app + component | CMP-04-workspace/header/objectives-bar/tabbar |
| [WO-04-005](./wo-04-005-tab-summary.md) | Summary tab: summary, key points, decisions, activity log | component | CMP-04-tab-summary/decisions/activity-log |
| [WO-04-006](./wo-04-006-tab-documents.md) | Documents tab: nav + rendered markdown | component | CMP-04-tab-documents |
| [WO-04-007](./wo-04-007-tab-commands.md) | Commands tab: stage commands + FRD-11 selector slot | component | CMP-04-tab-commands |

## Order & parallelization

- **First (parallel):** WO-04-001 and WO-04-003 are independent pure-`lib` readers — TDD with
  fixtures, no UI. They can run concurrently. (WO-04-001 owns the whole `lib/docs.ts`: doc tree + raw
  read + activity-log/decisions comms readers, built together to avoid same-file collisions.)
- **Then:** WO-04-004 (shell) depends on `lib/status.ts` (FRD-01) and the readers above for the
  objectives bar.
- **Then (parallel after the shell):** WO-04-005 (needs WO-04-001), WO-04-006 (needs WO-04-001),
  WO-04-007 (needs WO-04-003; slots FRD-11's selector behind a placeholder until FRD-11 lands).
- The **Work orders** and **Party** tabs are mounted from FRD-05 / FRD-06 — out of scope here; the
  shell renders a placeholder slot for them until those features land.

## Cross-feature dependencies

- **FRD-01** (data layer): `lib/config.ts`, `lib/status.ts` base, `lib/portfolio.ts` must exist.
- **FRD-02** (`lib/next-step.ts` base) — WO-04-003 extends it.
- **FRD-03** (portfolio rail) — provides the selected `slug` that opens this workspace.
- **FRD-05 / FRD-06 / FRD-11** — mounted tabs/selector; this feature only reserves the slots.
