---
id: FRD-03-blueprint
type: blueprint
parent: FRD-03
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
---
# FRD-03 — Portfolio & project navigation — Feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Feature blueprint (DR-049): how the portfolio list + project navigation + the read-only
> path-not-found recovery are implemented on the platform. References the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) — stack (§2), data model (§4),
> `lib/**` boundary (§6), read-only invariant (§7). Builds on the FRD-01 data layer
> ([`../frd-01-data-reading/blueprint.md`](../frd-01-data-reading/blueprint.md)) and reuses FRD-02's
> `CopyButton` + `nextStep`.

---

## 0. Scope

A left **vertical rail** listing active projects (`architecture`, `building`, `shipped`), each with
title, stage, a building/stopped indicator and — for shipped — its **business snapshot**. Selecting a
project shows its workspace (FRD-04) in the right panel; first project selected by default; graceful
empty state. A **path-not-found** detection (read-only) with a copyable recovery command.

FRD-03 owns no new heavy reader: it composes FRD-01's `readPortfolio`, `readStatus`, `pathExists`.
The **workspace render itself is FRD-04**; FRD-03 provides the rail + selection + the empty/not-found
states and the slot that hosts the workspace.

---

## 1. Components & interfaces

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-03-active-projects` | module (compose) | `lib/portfolio.ts` helper `activeProjects()` (or in the page) | Filter portfolio entries to phases `architecture`/`implementation`(building)/`operation`(shipped) using `readStatus`. | REQ-03-001 |
| `CMP-03-rail` | UI (Server) | `app/portfolio/page.tsx` + `components/ProjectRail.tsx` | Vertical list of active projects: title, stage, indicator, snapshot, not-found badge. | REQ-03-001, REQ-03-002, REQ-03-003 |
| `CMP-03-row` | UI | `components/ProjectRow.tsx` | One project row: building/stopped indicator + ⚠️ not-found badge + recovery. | REQ-03-002, REQ-03-006 |
| `CMP-03-snapshot` | UI | `components/BusinessSnapshot.tsx` | Shipped project's users / return / verdict chips from the portfolio row. | REQ-03-003 |
| `CMP-03-workspace-slot` | UI (Server) | `app/portfolio/page.tsx` right panel | Host the selected project's workspace (FRD-04); default-select the first. | REQ-03-004, REQ-03-005 |
| `CMP-03-empty` | UI | `components/PortfolioEmpty.tsx` | Graceful empty state when no active projects. | REQ-03-006 |
| `CMP-03-recovery` | UI | `components/RecoveryHint.tsx` | Copyable `git clone … && /pandacorp:sync-portfolio`, or the no-repo warning. | REQ-03-006 |
| `IF-03-activeProjects` | interface | `activeProjects(): ProjectListItem[]` | Portfolio rows ∩ active phases, each enriched with `status` + `exists`. | REQ-03-001..003, REQ-03-006 |

```ts
type ProjectListItem = {
  name: string; path: string; repo?: string;
  status: StatusResult;            // from FRD-01 readStatus
  exists: boolean;                 // from FRD-01 pathExists
  stage?: Phase; running?: boolean;
  snapshot?: { users?: string; returnMetric?: string; verdict?: string };  // shipped only
};
```

---

## 2. Active-set & ordering (REQ-03-001)

The rail lists projects whose **phase** (from `status.yaml`, authoritative) is `architecture`,
`implementation` or `release` ("building"), or `operation` ("shipped"). Phase is read via FRD-01
`readStatus(entry.path)`; when status is absent/malformed, fall back to the portfolio table's `phase`
cell (advisory). Stage label per row: architecture / building / shipped (mapped from phase, same map
as FRD-02 columns).

## 3. Indicators, snapshot, selection (REQ-03-002..005)

- **Indicator** (REQ-03-002): `running: true` → "building"; else "stopped". Not color-only (icon +
  label, architecture §7).
- **Business snapshot** (REQ-03-003): for shipped projects, render `users / returnMetric / verdict`
  from the portfolio row (filled by `/pandacorp:review-launch`, DR-043) when present; absent → omit
  silently (winners vs zombies at a glance).
- **Selection** (REQ-03-004/005): selecting a row shows the workspace (FRD-04) in the right slot;
  no selection → select the first project by default. Selection state can be URL-driven
  (`?project=<slug>`) so it is a Server-render concern, not client state.

## 4. Path-not-found recovery (REQ-03-006) — read-only

Detection uses FRD-01 `pathExists(entry.path)`:
- Path missing → `⚠️ path not found` badge on the row (same shape as FRD-15/16 banners).
- IF the portfolio row has a `repo:` → show the copyable recovery command:
  `git clone <repo> <path>` then re-run `/pandacorp:sync-portfolio` (via `CopyButton`).
- No `repo:` → warning: "No remote registered — check a local backup or recreate with
  `/pandacorp:spec`."
- **Read-only:** MC never clones, never writes the portfolio, never calls Claude (architecture §7).
- The badge disappears once the path exists again (re-detected on next read — no state stored).

## 5. Platform surfaces

- **`lib/**`** (architecture §6): no new module; a small compose helper `activeProjects()` lives in
  `lib/portfolio.ts` (FRD-01's module) or in the page. Reuses `readPortfolio`, `readStatus`,
  `pathExists`.
- **App surface** (architecture §11): `app/portfolio` (rail + workspace slot). Reuses FRD-02's
  `components/CopyButton.tsx` and `lib/next-step.ts`.
- Empty/not-found states tolerant (architecture §7); design tokens only; `tabular-nums` on metrics.

## 6. Requirement → component traceability (REQ-03-MMM)

| REQ | Acceptance criterion (abridged) | Component(s) / interface(s) |
|---|---|---|
| REQ-03-001 | Left vertical panel lists projects in architecture, building, shipped. | `CMP-03-active-projects`, `CMP-03-rail`, `IF-03-activeProjects` |
| REQ-03-002 | Each row shows title, stage and a building/stopped indicator. | `CMP-03-row` |
| REQ-03-003 | Each shipped project shows its business snapshot when present. | `CMP-03-snapshot` |
| REQ-03-004 | Selecting a project shows its workspace (FRD-04) in the right panel. | `CMP-03-workspace-slot` |
| REQ-03-005 | No selection → select the first by default. | `CMP-03-workspace-slot` |
| REQ-03-006 | No active projects → graceful empty state; path-not-found → ⚠️ badge + recovery (repo → clone+sync; no repo → warning); read-only; badge clears on re-detect. | `CMP-03-empty`, `CMP-03-row`, `CMP-03-recovery` |

> REQ numbering maps the FRD's EARS bullets in document order; the empty-state and the path-not-found
> sub-bullets are grouped under REQ-03-006.

## 7. AC ⇄ design check

- "lists architecture/building/shipped" → phase-driven from `readStatus` (authoritative), table cell
  fallback. ✅
- "select first by default" → URL/Server-render default, no flash of empty. ✅
- "detection is read-only; never clones/writes/calls Claude" → only `pathExists` + render; recovery
  is copyable text. ✅
- "badge disappears once path exists again" → no stored state; re-derived each read. ✅
- Workspace itself is FRD-04 — FRD-03 only hosts it. No overlap. ✅

No FRD-03 criterion is unbuildable.

---

## Build Plan (Phase 2)

Phase 2 re-implements the **presentational** portfolio surface to match the approved prototype. The
`lib/**` compose layer is VERIFIED and untouched (WO-03-001 `lib/portfolio.ts` `activeProjects`, on
top of FRD-01 `readPortfolio`/`readStatus`/`pathExists`). The UI WOs are collapsed into **one coarse
work order**.

**Cross-FRD dependency (foundation-first):** the coarse WO depends on **`frd-13`** — the foundation
primitives (`PageTitle`/`Tabs` · `Banner` for RecoveryHint · `CountBadge` for StatusChips ·
`Panel`/`CmdRow`/`Button`) must land (VERIFIED) before it runs.

**Coarse WO DAG (intra-FRD):**

```
frd-13 (foundation, VERIFIED)
        │
        └─ WO-03-002  Portfolio surface      artifacts: app/portfolio/**,
                      (rail + table + rows +             components/modules/{ProjectRail,
                       empty + recovery +                ProjectRow,PortfolioTable}/**
                       status chips)
```

- **Single coarse WO** — the whole `/portfolio` page is one cohesive surface (rail + table + rows +
  StatusChips + PortfolioEmpty + RecoveryHint + selection/workspace slot). No intra-FRD parallelism.
- **Deferred:** `BusinessSnapshot` is NOT built (FRD-03 "Out of scope / Future" — premature). Its WO
  was removed; the rail keeps conceptual space but renders nothing.
- **`RecoveryHint` refactors onto the shared `Banner`** (`frd-13`) — no second banner/alert.
- **Compose layer:** consumed as-is — never re-planned.
- One review/test gate per FRD; Preview Smoke Gate on `/portfolio` (renders, no console error,
  fidelity vs `prototype/index.html`).
