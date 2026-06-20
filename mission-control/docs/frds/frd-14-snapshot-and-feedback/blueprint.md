---
id: FRD-14-blueprint
type: blueprint
parent: FRD-14
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-18'
---
# FRD-14 — Probable snapshot & feedback channels · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049). References the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) rather than restating it.
> Visual reference: `prototype/index.html` (`snapshotPanel`, the portfolio rail dchip/bchip).

## 0. Scope & traceability note

The FRD's acceptance criteria are bare EARS bullets; this blueprint assigns the canonical IDs
(`REQ-14-MMM` → `AC-14-MMM.K`), 1:1 with the EARS bullets in source order.

FRD-14 is **read-only** and renders three things from `.pandacorp/status.yaml`:
1. A **snapshot panel** (last probable point + worktree command) inside the FRD-04 workspace.
2. **Chips** (pending decisions / bugs / rethink) on the FRD-03 portfolio rail.
3. A **documentation note** about the three feedback channels (`bug`/`iterate`/`decide`).

Per architecture §11 FRD-14 uses only `lib/status.ts` (read). It introduces **no new `lib/` module**
— it reads fields FRD-01 already defines (`last_green_sha`, `safe_to_test`, `pending_decisions`,
`pending_bugs`, `rethink_pending`, `running`, `progress`) and derives the worktree command + the
staleness warning with **pure helpers** added to `lib/snapshot.ts` (see §2).

## 1. Requirements (derived IDs)

| REQ | EARS (from `frd.md`) |
|---|---|
| REQ-14-001 | FOR each project being built, MC SHALL show a snapshot panel with the last probable point (FRD closed green + `last_green_sha`), a "green" badge, and the `git worktree add ../<project>-review <sha>` command ready to copy. Reads `last_green_sha` and `safe_to_test`. |
| REQ-14-002 | The panel SHALL distinguish "building now" (work order in progress, "don't test this yet") from the "last probable point". |
| REQ-14-003 | IF `last_green_sha` is far behind HEAD (many commits/hours), it SHALL warn that the probable snapshot is getting stale. |
| REQ-14-004 | EACH project in the portfolio rail SHALL show chips with the number of pending decisions (amber) and bugs in the inbox (red), from `pending_decisions` and `pending_bugs`. |
| REQ-14-005 | IF a project has `rethink_pending: true`, it SHALL indicate it (the build is going to pause for a major change). |
| REQ-14-006 | MC's documentation SHALL explain the three feedback channels to an in-progress build: `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` (all via files, picked up at the next safe point). |

### Acceptance criteria (EARS, expanded)

- **AC-14-001.1** FOR a project that is building, the snapshot panel SHALL render the last probable
  point label (closed-green FRD) + a "green" badge + `last_green_sha`.
- **AC-14-001.2** The panel SHALL render `git worktree add ../<slug>-review <last_green_sha>` with a copy button.
- **AC-14-001.3** WHEN `last_green_sha` is absent, the panel SHALL be omitted (nothing probable yet) — no broken command.
- **AC-14-002.1** WHEN `running` and a work order is in progress, the panel SHALL show "building now: <progress> · don't test this yet", visually distinct from the probable point.
- **AC-14-003.1** WHEN `last_green_sha` is far behind HEAD (staleness threshold by commits/hours), the panel SHALL show a "snapshot getting stale" warning.
- **AC-14-004.1** EACH portfolio rail row SHALL show an amber chip with `pending_decisions` when `> 0`.
- **AC-14-004.2** EACH portfolio rail row SHALL show a red chip with `pending_bugs` when `> 0`.
- **AC-14-005.1** WHEN `rethink_pending: true`, the row/workspace SHALL show a "rethink pending — build will pause" indicator.
- **AC-14-006.1** The Manual SHALL document the three feedback channels (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`) as file-based, picked up at the next safe point.

## 2. Interfaces (`lib/**`)

No new reader module — FRD-14 reads `lib/status.ts` fields (FRD-01). The non-trivial derivations are
isolated as **pure helpers** in a small `lib/snapshot.ts` (path in → typed data out; no fs except the
optional HEAD probe, see below).

### IF-14-snapshot — `lib/snapshot.ts` (NEW, pure helpers)

```ts
export interface SnapshotInfo {
  sha: string;                 // last_green_sha
  safeToTest: boolean;         // safe_to_test
  worktreeCommand: string;     // git worktree add ../<slug>-review <sha>
  buildingNow?: string;        // progress string when running
  stale: boolean;              // staleness verdict
}
// Pure: derives the command + buildingNow from already-read status fields.
export function buildSnapshot(slug: string, status: ProjectStatus): SnapshotInfo | null; // null when no last_green_sha
// Pure staleness verdict from the gap (commits behind / hours since green).
export function isSnapshotStale(commitsBehind: number, hoursSinceGreen: number): boolean;
```

> **Staleness input source.** `commitsBehind` / `hoursSinceGreen` need a read of repo HEAD vs
> `last_green_sha`. The gate script publishes `last_green_sha`; computing "behind HEAD" needs a
> read-only `git` probe (like FRD-15/16 use a route handler). FRD-14 keeps the **verdict pure**
> (`isSnapshotStale`) and gets its inputs from either (a) a thin read-only route handler
> (`git rev-list --count <sha>..HEAD`, `git show -s --format=%ct`) reused from the FRD-15/16 probe
> pattern, or (b) a timestamp already in `status.yaml` if the gate publishes one. The verdict is
> testable in isolation regardless. Flagged in §5.

### IF-14-chips — portfolio rail chips
No reader; the rail (FRD-03) already reads `status.yaml`. FRD-14 adds the **chip presentation** for
`pending_decisions` / `pending_bugs` / `rethink_pending` to the FRD-03 rail rows.

## 3. Components (`CMP-14-*`) and app surface

App surfaces (architecture §11): the snapshot panel lands in the FRD-04 workspace (above the tabs,
as in the prototype `projectPane`), and the chips land on the FRD-03 portfolio rail.

| Component | Kind | Responsibility | Implements |
|---|---|---|---|
| `CMP-14-snapshot-panel` | Server | Last probable point + green badge + worktree command + "building now" + staleness warning. Mounted in the FRD-04 workspace. | REQ-14-001, REQ-14-002, REQ-14-003 |
| `CMP-14-status-chips` | Server | Amber `pending_decisions` chip, red `pending_bugs` chip, `rethink_pending` indicator. Mounted on the FRD-03 rail rows (and reusable in the workspace). | REQ-14-004, REQ-14-005 |
| `IF-14-snapshot` | lib | `lib/snapshot.ts` pure helpers. | REQ-14-001, REQ-14-003 |
| (doc) Manual feedback-channels section | docs | The three-channel explanation in the Manual (FRD-08). | REQ-14-006 |

**Mounting note:** `CMP-14-snapshot-panel` is rendered by the FRD-04 workspace; `CMP-14-status-chips`
by the FRD-03 portfolio rail. FRD-14 owns the components; FRD-03/04 reserve the slots. Both consume
already-read `ProjectStatus` (no duplicate `status.yaml` reads).

## 4. Cross-cutting

- **Read-only / non-goal respected** (FRD-14 non-goals): MC **shows** the worktree command, never
  runs `git worktree` or the dev server (architecture §1/§7). The only `git` touch is a read-only
  probe for staleness (same pattern/policy as FRD-15/16).
- **Partial tolerance**: absent `last_green_sha` → panel omitted (AC-14-001.3); absent counters →
  no chips; never breaks (architecture §7).
- **Tokens & a11y** (FRD-13): amber/red chips carry a number + label/`aria-label` (not color alone),
  `tabular-nums` on counts; the green badge and staleness warning use icon + text.
- **Server-first**: both components are Server Components; the copy button is the shared client `CopyButton`.

## 5. Traceability matrix & flags

| REQ | AC | Component(s) | Interface(s) |
|---|---|---|---|
| REQ-14-001 | AC-14-001.1/.2/.3 | CMP-14-snapshot-panel | IF-14-snapshot, lib/status |
| REQ-14-002 | AC-14-002.1 | CMP-14-snapshot-panel | IF-14-snapshot, lib/status |
| REQ-14-003 | AC-14-003.1 | CMP-14-snapshot-panel | IF-14-snapshot (`isSnapshotStale`) |
| REQ-14-004 | AC-14-004.1/.2 | CMP-14-status-chips | lib/status |
| REQ-14-005 | AC-14-005.1 | CMP-14-status-chips | lib/status |
| REQ-14-006 | AC-14-006.1 | Manual section (FRD-08) | — |

**Flags:**
1. **Staleness inputs (AC-14-003.1):** computing "behind HEAD" needs a read-only `git` probe or a
   gate-published timestamp. The verdict (`isSnapshotStale`) is pure/testable now; the input source
   reuses the FRD-15/16 route-handler probe pattern or a `status.yaml` field. Confirm which before the
   panel WO goes GREEN. No requirement is unbuildable.
2. **REQ-14-006** is a Manual/doc deliverable owned by FRD-08's surface; FRD-14 contributes the
   content. Tracked as a doc WO here, authored under the Manual when FRD-08 lands.

## 6. Build Plan (Phase 2)

Re-implement the snapshot **presentation** to match the approved prototype (`snapshotPanel`,
`bStalenessPanel`) with the clear canonical copy. The pure helper (`lib/snapshot.ts`) is **VERIFIED**
and not rebuilt; the rail chips (WO-14-003, FRD-03 surface) and the feedback-channels doc (WO-14-004,
FRD-08 surface) stay VERIFIED — neither is in this FRD's disjoint workspace subfolder.

**Coarse work order (PLANNED):**

| WO | Surface | Disjoint artifacts |
|---|---|---|
| WO-14-002 | SnapshotPanel: último commit en verde + worktree cmd + building-now + staleness (`Banner`) | `src/app/projects/[slug]/_components/snapshot-panel/**` |

**DAG & parallelism:**
```
WO-14-001 (VERIFIED) ─┐
FRD-13 foundation ────┼─► WO-14-002 (SnapshotPanel)
FRD-04 Tabbar seam ───┘
```
- Single coarse UI WO; no intra-FRD parallelism. It depends on the FRD-04 shell seam being in place
  (mounted in the workspace), but touches **only** `_components/snapshot-panel/**` — disjoint from every
  sibling tab FRD, so it never collides on a file.

**Cross-FRD deps:** `frd-13` (the **ONE shared `Banner`** + `Chip`/`Panel`/`CmdRow`/`Toast`), `frd-04`
(workspace mounts the panel via the Tabbar shell seam; FRD-01 `lib/status.ts` supplies the fields).

**In-loop fidelity:** WO-14-002 renders against `prototype/index.html` (`snapshotPanel`,
`bStalenessPanel`) on the frozen tokens; the staleness warning MUST reuse the shared `Banner` (no second
banner — DR-057). The browser fidelity/smoke gate must be clean before VERIFIED. Reuse
`docs/design/components.md` rows.
