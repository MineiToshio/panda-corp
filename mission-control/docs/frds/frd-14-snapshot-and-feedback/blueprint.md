---
id: FRD-14-blueprint
type: blueprint
parent: FRD-14
status: ACTIVE
implementation_status: BLOCKED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---
# FRD-14 Probable snapshot and feedback channels · feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049). It references [`docs/product/architecture.md`](../../product/architecture.md)
> (data layer §6, fixture seams and read-only invariant §7) rather than restating the platform. Visual
> contract: [`fdd.md`](./fdd.md) + [`mocks/snapshot-and-feedback.html`](./mocks/snapshot-and-feedback.html).

## 1. Purpose

FRD-14 draws one surface in v2: the **snapshot panel** «Último commit en verde» in the project Resumen,
below La Fragua, only while a build is running and a `last_green_sha` exists. It tells the owner which build
commit is safe to test in a separate worktree while the build continues, keeps «Construyendo ahora» apart
from that commit, warns when the commit fell far behind the build, refuses to dress a stale `running` flag
up as a live build, and gives the `git worktree add` command to copy. The feedback-channels explanation
stays a Documentación page. The portfolio-rail chips and the rethink indicator are out of v2 (the rail is
gone); FRD-03's WO-03-007 removes them.

## 2. What v2 keeps, changes and removes

| Kept | Changed | Removed |
|---|---|---|
| `src/lib/snapshot/snapshot.ts` (`buildSnapshot`, `isSnapshotStale`, thresholds 10 commits / 24 h), the Documentación guide `content/manual/guides/g-feedback.md` | `SnapshotPanel` restyled to the Órbita card; the staleness verdict is finally fed by a real read-only git probe (v1 always passed `stale: false`) | the rail `StatusChips` (decisions / bugs / rethink) with the rail itself (WO-03-007, map §6.C item 4) |

## 3. Components and interfaces

| ID | Kind | Responsibility | Path | REQ | WO |
|---|---|---|---|---|---|
| `CMP-14-snapshot-panel` | Server | `SnapshotPanel`: card header with the verdict pill, intro, commit row, building-now or no-signal line, behind-the-build notice, folder lead-in + `CommandBox`. Renders nothing without a snapshot. | `src/app/projects/[slug]/_components/snapshot-panel/` | REQ-14-001, REQ-14-002 | WO-14-005 |
| `IF-14-snapshot` | lib (pure) | `buildSnapshot(folder, status, nowMs?)` → `SnapshotInfo \| null` (sha, safeToTest, worktree command, buildingNow when live, noSignal when `running` lacks a fresh heartbeat, DR-066; v2 surfaces do not read this heartbeat-only `noSignal`, they read `buildSignal()`); `isSnapshotStale(commits, hours)`. | `src/lib/snapshot/snapshot.ts` | REQ-14-001, REQ-14-002 | WO-14-001 (history) |
| `IF-14-snapshot-gap` | lib (git, read-only) | `readSnapshotGap(projectPath, sha)` → `ok { commitsBehind, hoursBehind, stale, verified?: { wo, frd } }` or `unavailable { reason }`, through `runGit`. | `src/lib/snapshot/gap.ts` | REQ-14-001, REQ-14-002 | WO-14-005 |
| Feedback-channels page | content | `g-feedback` guide naming `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` as file-based channels picked up at the next safe point. | `content/manual/guides/g-feedback.md` | REQ-14-003 (AC-14-003.3) | WO-14-004 (history, owner) |
| Rail chips + rethink indicator | removed | Out of v2; verified by their removal. | `src/app/portfolio/_components/status-chips/` | REQ-14-003 (AC-14-003.1, .2) | WO-03-007 |

The panel is mounted by FRD-04's Resumen (`CMP-04-resumen`, WO-04-011), which decides «only while a build is
running and a green SHA exists», passes the project name and folder, the `buildSnapshot` result, the
`readSnapshotGap` result and the no-signal age derived from FRD-06's single build-signal resolver `buildSignal()`
(`src/lib/fragua/build-signal.ts`, WO-06-013: running and fresh by the freshest of the supervisor heartbeat OR
the latest event, AC-06-019.7) through `WorkspaceProject.build`, never from a heartbeat-only check or a second
derivation (DR-115): La Fragua, the hero chip and this panel read the same verdict on `build-no-signal`.

## 4. Contracts

- **`SnapshotPanel` props (restyle in place, map §0.4):** the v1 props stay valid
  (`slug` = the project folder name used in the worktree path, `snapshot: SnapshotInfo | null`), plus optional
  `projectName` (the «córrelo en la carpeta de …» name; falls back to the folder), `gap` (the
  `IF-14-snapshot-gap` result) and `noSignalAgo` (formatted age, passed only when `buildSignal()` reads
  `no-signal`; the panel chooses building-now vs no-signal from this prop alone and ignores the v1
  heartbeat-only `SnapshotInfo.noSignal`). This keeps the v1 Resumen compiling between
  W3 and W6. The map's seam wording `SnapshotPanel({ project })` is replaced by these explicit props
  (deviation recorded in the ledger).
- **`readSnapshotGap`:** input an absolute project path and the green sha; success `ok` as above, with
  `hoursBehind` = HEAD committer time minus the green commit's committer time (whole hours, git only, no
  clock) and `verified` = the first `WO-NN-MMM` id in the green commit's subject with its FRD `FRD-NN`;
  failure `unavailable` (unknown sha, no repository, git error) carrying a reason. Every call through
  `runGit` (read-only commands), so oracle mode answers from the git fixture (`MC_GIT_FIXTURE`).
- **Panel states:** default (pill «Seguro para probar»), stale (pill «Quedó atrás del build» + amber
  `role="status"` notice with commits and hours), no signal (coral line replaces building-now), unsafe
  (`safe_to_test` false: the stale state's amber alert pill with the `unsafeChip` text, the FDD's data-case
  rule), gap unavailable (no notice, commit row uses the `passedGates` text). Strings from
  `workspace.resumen.snapshot.*` in the frozen catalogue.
- **Read-only:** Mission Control never runs `git worktree` or a dev server; git use is read-only.

## 5. Dependencies and risks

- Upstream: WO-13-012 (primitives), WO-01-010 (`runGit` + fixture mode). Consumer: WO-04-011.
- The git fixture must answer the gap queries for `project-snapshot` and `project-snapshot-stale`
  (14 commits, 26 hours): ledger request to WO-01-010.
- Risk: an unparseable or missing sha must never produce a fabricated «al día»; the unavailable branch covers it.

## 6. Traceability

| REQ | AC | Components / interfaces | Work order |
|---|---|---|---|
| REQ-14-001 | AC-14-001.1, AC-14-001.2, AC-14-001.3 | `CMP-14-snapshot-panel`, `IF-14-snapshot`, `IF-14-snapshot-gap` | WO-14-005 |
| REQ-14-002 | AC-14-002.1, AC-14-002.2 | `CMP-14-snapshot-panel` (`noSignalAgo` from FRD-06 `buildSignal()`), `IF-14-snapshot-gap` | WO-14-005 |
| REQ-14-003 | AC-14-003.1, AC-14-003.2 (Out of v2, verified by removal) | rail chips removed | WO-03-007 |
| REQ-14-003 | AC-14-003.3 | feedback-channels page | WO-14-004 |
| REQ-14-004 | AC-14-004.1 struck (retired id) | none | none |
| REQ-14-005 | AC-14-005.1 struck (retired id) | none | none |

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-14-004 | — | `content/manual/guides/g-feedback.md`, `content/manual/wo-14-004.feedback-channels.test.ts` | false | W0 (history, VERIFIED) |
| WO-14-001 | WO-01-005 | `src/lib/snapshot/snapshot.ts`, `src/lib/snapshot/_tests/snapshot.test.ts` | false | W3 (history, VERIFIED) |
| WO-14-005 | WO-13-012, WO-01-010 | `src/app/projects/[slug]/_components/snapshot-panel/**`, `src/lib/snapshot/gap.ts`, `src/lib/snapshot/_tests/gap.test.ts` | false | W3 (with WO-04-013 and the other W3 work orders) |

- **Order:** WO-14-005 builds in W3 after the composite primitives and the git seam; WO-04-011 (W6) mounts it.
- **Disjointness:** in W3, WO-14-005 writes the panel folder and the new `gap.ts` + its test; WO-14-001's
  declared files (`snapshot.ts` and its test) are different files; WO-01-011 (W5) later edits
  `src/lib/snapshot/**` to adopt `now()`, ordered after this work order by its `dependsOn` edge to WO-14-005.
- **Visual spec (DR-054):** `mocks/snapshot-and-feedback.html#project-snapshot`, `#project-snapshot-stale`,
  `#build-no-signal`; oracle states with the same ids, plus the scenario state `snapshot-unsafe` («Aún no es
  seguro», `oracle-recipes.json` double). No raster assets.
- **Reconciliation (2026-10-22, binding).** WO-01-010 answers the snapshot gap queries in fixture mode (ledger
  C accepted). The restyle keeps `SnapshotPanel`'s v1 props plus optional `projectName`, `gap`, `noSignalAgo`
  instead of the map seam `SnapshotPanel({ project })` (TabSummary passes `{ slug, snapshot }` until WO-04-011);
  the components.md path/props difference is a design item, not a plan defect. The no-signal age is formatted
  by WO-13-010's shared relative formatter.

## Work Orders

WO-14-004 (W0, VERIFIED) · WO-14-001 (W3, VERIFIED) · WO-14-005 (W3). See [`work-orders/README.md`](./work-orders/README.md).

## Superseded (v1 history)

- WO-14-002 SnapshotPanel (v1 skin), superseded by WO-14-005.
- WO-14-003 Rail status chips, superseded by WO-03-007 (the rail and its chips are removed in v2).

## Readiness check (DR-100)

Every live REQ maps to a component or interface; every live AC is owned by exactly one live work order
(AC-14-003.1/.2 by WO-03-007, cross-FRD); `dependsOn` acyclic and live-only; same-wave artifacts disjoint;
no backend contract file; no open clarification marker. Lessons applied: LESSON-0365 (the worktree folder
is the stable project folder, never the display name), LESSON-0113 (v1 documented a staleness probe that was
never wired: this plan names the call site, `gap.ts` through `runGit`).
