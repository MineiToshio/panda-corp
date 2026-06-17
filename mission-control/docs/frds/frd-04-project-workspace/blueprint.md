---
id: FRD-04-blueprint
type: blueprint
parent: FRD-04
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-16'
---
# FRD-04 — Project workspace · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-FRD blueprint** (DR-049): how *this* feature is implemented on top of the
> platform. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) rather than restating it.
> Visual reference: the approved `prototype/index.html` (`projectPane`, `projResumen`,
> `progressBar`, `decisionesBox`, `logBox`, `projComandos`).

## 0. Scope & traceability note

The FRD's acceptance criteria are bare EARS bullets. This blueprint assigns the canonical
traceability IDs (`REQ-04-MMM` → `AC-04-MMM.K`) consumed by the work orders. Each EARS bullet of
`frd.md` maps 1:1 to a `REQ-04-MMM` in source order.

This feature is the **shell** that hosts the per-project tabs. Two tabs are owned by other FRDs and
only **mounted** here:
- **Work orders** tab → [FRD-05](../frd-05-work-orders/blueprint.md) (`CMP-05-*`).
- **Party** tab → [FRD-06](../frd-06-party/frd.md) (`CMP-06-*`).
- The **build mode selector** inside the Commands tab → [FRD-11](../frd-11-build-modes/blueprint.md) (`CMP-11-*`).

FRD-04 owns the **workspace chrome** (tab bar, header, "Mission Objectives" bar) and the three tabs
it implements directly: **Summary**, **Documents**, **Commands** (the command list; the mode
selector is FRD-11's component slotted in).

## 1. Requirements (derived IDs)

| REQ | EARS (from `frd.md`) |
|---|---|
| REQ-04-001 | The workspace SHALL offer tabs in order **Summary · Work orders · Party · Documents · Commands**. |
| REQ-04-002 | The header SHALL show title, stage, version, the `progress` line and a **"Mission Objectives"** bar (% of work orders completed), visible on all tabs. |
| REQ-04-003 | The **Summary** tab SHALL show summary, key points, **decision points** (highlighted, with a count) and a high-level **activity log**, read from `.pandacorp/inbox/decisions.md` and `.pandacorp/comms/progress.md`. |
| REQ-04-004 | WHEN there are pending decisions, the workspace SHALL highlight them. |
| REQ-04-005 | The **Commands** tab SHALL show the stage-relevant commands (continue `implement`, `release`, `iterate`, with when to use each) and the **build mode selector** (FRD-11). |
| REQ-04-006 | The **Documents** tab SHALL allow navigating and reading the project's documents rendered. |

### Acceptance criteria (EARS, expanded)

- **AC-04-001.1** GIVEN a selected project, the workspace SHALL render exactly five tabs in the
  order Summary, Work orders, Party, Documents, Commands.
- **AC-04-001.2** WHEN no tab is explicitly selected, the workspace SHALL default to **Summary**.
- **AC-04-002.1** The header SHALL render `title`, the stage label (from `phase`), `version` and the
  `progress` string when present; when `progress` is absent the line is omitted (no empty line).
- **AC-04-002.2** The Mission Objectives bar SHALL show `work_orders_done / work_orders_total` and the
  percentage; WHEN `work_orders_total` is 0 or absent the bar is omitted.
- **AC-04-002.3** The header and Mission Objectives bar SHALL be visible regardless of the active tab.
- **AC-04-003.1** The Summary tab SHALL render the project summary and key points.
- **AC-04-003.2** The Summary tab SHALL render the activity log read from `.pandacorp/comms/progress.md`;
  WHEN the file is absent it SHALL show a graceful "no activity yet" empty state.
- **AC-04-003.3** The Summary tab SHALL render the decision points read from `.pandacorp/inbox/decisions.md`,
  each highlighted, with a total count badge.
- **AC-04-004.1** WHEN `pending_decisions > 0`, the decision points block SHALL be visually highlighted
  (warning treatment) and show the count; otherwise it SHALL show a neutral "no pending points" state.
- **AC-04-005.1** The Commands tab SHALL render the stage-relevant command rows from `lib/next-step.ts`,
  each with a copy button and a "when to use" description.
- **AC-04-005.2** The Commands tab SHALL mount the FRD-11 build mode selector (`CMP-11-mode-selector`).
- **AC-04-006.1** The Documents tab SHALL render the feature-centric document tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected, the Documents tab SHALL render its markdown body
  (`react-markdown`); the first available document is selected by default.
- **AC-04-006.3** WHEN the project has no readable documents, the Documents tab SHALL show a graceful empty state.

## 2. Interfaces (`lib/**`)

This feature **owns** `lib/docs.ts` (shared with FRD-05/08) and **extends** `lib/status.ts` (base
shipped by FRD-01) and `lib/next-step.ts` (base shipped by FRD-02). It consumes — never re-reads —
the platform readers per [architecture §6](../../product/architecture.md#6-read-interfaces-lib--the-data-layer-boundary).

### IF-04-docs — `lib/docs.ts` (NEW, owned here)
Pure readers over the feature-centric `docs/` tree and the owner-facing `.pandacorp/` comms.

```ts
// Path in → typed data out. Tolerates missing files (returns empty, never throws on absence).
export interface DocNode {
  id: string;          // stable key, e.g. "product/prd" | "frds/frd-02-ideas-board/frd"
  label: string;       // display name, e.g. "prd.md"
  group: string;       // "Product" | "Feature: frd-NN-<slug>" | "Global" | "Comms"
  relPath: string;     // path relative to the project root
}
export function listProjectDocs(projectPath: string): DocNode[];      // discovers the tree (§4.5)
export function readDoc(projectPath: string, relPath: string): string | null; // raw markdown or null
export interface ActivityLog { entries: string[]; }                  // from .pandacorp/comms/progress.md
export function readActivityLog(projectPath: string): ActivityLog;    // [] when absent
export interface DecisionPoint { title: string; recommendation?: string; resolved: boolean; }
export function readDecisions(projectPath: string): DecisionPoint[];  // from .pandacorp/inbox/decisions.md; [] when absent
```

> `readDoc` only returns paths that `listProjectDocs` would surface (no arbitrary path traversal —
> the `relPath` is validated against the discovered set). Read-only; never writes.

### IF-04-status — `lib/status.ts` (EXTENDS FRD-01 base)
FRD-01 ships the base parser. FRD-04 relies on the already-defined fields
(`phase`, `version`, `progress`, `work_orders_total`, `work_orders_done`, `pending_decisions`) —
no new fields are added by FRD-04. Header/objectives read these. Partial-tolerant (architecture §4.4).

### IF-04-next-step — `lib/next-step.ts` (EXTENDS FRD-02 base)
Pure map `phase → { commands: CommandRow[] }`. FRD-02 ships the base for pre-project statuses;
FRD-04 adds the **building/release/operation** command sets used by the Commands tab.

```ts
export interface CommandRow { command: string; when: string; } // "/pandacorp:implement", "continue/resume the build"
export function workspaceCommands(phase: Phase): CommandRow[];  // pure; no fs
```

## 3. Components (`CMP-04-*`) and app surface

App surface (architecture §11): `app/projects/[slug]` is the workspace, reached from the FRD-03
portfolio rail. In the prototype this is `projectPane`; here it is decomposed into Server Components
(default) with a thin client tab-state holder.

| Component | Kind | Responsibility | Implements |
|---|---|---|---|
| `CMP-04-workspace` | Server | Loads project (status + docs + decisions + log via `lib/**`), renders header + tab bar + active tab. | REQ-04-001, REQ-04-002 |
| `CMP-04-tabbar` | Client | Tab selection state (URL `?tab=` or local), keyboard-navigable, a11y `role=tablist`. | REQ-04-001 |
| `CMP-04-header` | Server | Title, stage, version, progress line. | REQ-04-002 |
| `CMP-04-objectives-bar` | Server | "Mission Objectives" progress bar (done/total, %). | REQ-04-002 |
| `CMP-04-tab-summary` | Server | Summary + key points + `CMP-04-decisions` + `CMP-04-activity-log`. | REQ-04-003 |
| `CMP-04-decisions` | Server | Decision points block, highlighted with count. | REQ-04-003, REQ-04-004 |
| `CMP-04-activity-log` | Server | High-level activity log list. | REQ-04-003 |
| `CMP-04-tab-documents` | Server | Doc nav (`DocNode[]`) + rendered markdown body. | REQ-04-006 |
| `CMP-04-tab-commands` | Server | Stage command rows + slot for `CMP-11-mode-selector`. | REQ-04-005 |
| `IF-04-docs` | lib | The `docs.ts` readers above. | REQ-04-003, REQ-04-006 |

**Mounted, not owned:** the Work orders tab renders `CMP-05-board`; the Party tab renders
`CMP-06-*`; the Commands tab slots `CMP-11-mode-selector`. The workspace passes `projectPath`/slug
down; it does not implement those panels.

## 4. Cross-cutting

- **Read-only**: all access via `lib/**` readers; no writes (the only write in the app is FRD-02
  discard). The `.pandacorp/inbox/decisions.md` / `comms/progress.md` reads are owner-facing Spanish
  files — rendered as-is, never transmitted (architecture §7).
- **Empty/partial states**: every reader tolerates absence; the workspace renders partial data and
  never crashes (architecture §7, FRD-01 edge cases).
- **Tokens & a11y**: UI strings in Spanish (i18n), `tabular-nums` on the objectives counts, tabs are
  `role=tablist`/`aria-selected`, no state-by-color-alone (FRD-13).
- **Server-first**: only `CMP-04-tabbar` is `"use client"`; everything else is a Server Component.

## 5. Traceability matrix

| REQ | AC | Component(s) | Interface(s) |
|---|---|---|---|
| REQ-04-001 | AC-04-001.1/.2 | CMP-04-workspace, CMP-04-tabbar | — |
| REQ-04-002 | AC-04-002.1/.2/.3 | CMP-04-header, CMP-04-objectives-bar | IF-04-status |
| REQ-04-003 | AC-04-003.1/.2/.3 | CMP-04-tab-summary, CMP-04-decisions, CMP-04-activity-log | IF-04-docs |
| REQ-04-004 | AC-04-004.1 | CMP-04-decisions | IF-04-status, IF-04-docs |
| REQ-04-005 | AC-04-005.1/.2 | CMP-04-tab-commands | IF-04-next-step |
| REQ-04-006 | AC-04-006.1/.2/.3 | CMP-04-tab-documents | IF-04-docs |
