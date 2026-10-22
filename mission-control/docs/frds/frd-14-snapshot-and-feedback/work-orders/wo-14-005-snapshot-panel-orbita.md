---
id: WO-14-005
type: work-order
slug: snapshot-panel-orbita
title: 'WO-14-005 — Snapshot panel Órbita'
status: DRAFT
parent: FRD-14
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: low
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/snapshot-panel/**'
  - 'src/lib/snapshot/gap.ts'
  - 'src/lib/snapshot/_tests/gap.test.ts'
source_requirements: [REQ-14-001, REQ-14-002]
dependsOn: [WO-13-012, WO-01-010]
last_updated: 2026-10-22
---

# WO-14-005 — Snapshot panel Órbita

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED`. Blueprint: [`../blueprint.md`](../blueprint.md) §3, §4.

## Summary

Restyles `SnapshotPanel` to the Órbita card «Último commit en verde»: the «Seguro para probar» pill, the
intro that frames the commit as safe to test in a separate worktree while the build continues, the short SHA
with the work order and FRD it verified, the «Construyendo ahora» line kept apart from the green commit, the
copyable `git worktree add /Users/Shared/review-worktrees/<project> <sha>` command, the «Quedó atrás del build»
staleness notice and the no-signal line. Adds the read-only git gap probe (commits and hours behind HEAD, the
verified work order) through `runGit`, which v1 never wired (`stale` was always false).

## In Scope

- `IF-14-snapshot-gap` (`src/lib/snapshot/gap.ts`): `readSnapshotGap(projectPath, sha)` → a typed result:
  `ok` with `commitsBehind` (commits on the build's HEAD after `sha`), `hoursBehind` (HEAD committer time
  minus the green commit's committer time, whole hours), `stale` (from `isSnapshotStale`, WO-14-001's
  thresholds) and the first `WO-NN-MMM` id of the green commit's subject with its FRD (absent when the subject
  names none); or `unavailable` with a reason when git cannot answer (unknown sha, not a repository). Every git
  call through `runGit` (WO-01-010), read-only commands only; no clock needed.
- `CMP-14-snapshot-panel` (`snapshot-panel/`): the exported name `SnapshotPanel` and its v1 props
  (`slug`, `snapshot: SnapshotInfo | null`) stay valid (the v1 Resumen keeps compiling until WO-04-011);
  new optional props `projectName`, `gap` (the result above) and `noSignalAgo` (the formatted age of the
  freshest signal, present only when the build reads «Sin señal»). The caller derives it from FRD-06's single
  build-signal resolver `buildSignal()` (`src/lib/fragua/build-signal.ts`, WO-06-013: running and fresh by the
  freshest of the supervisor heartbeat OR the latest event, AC-06-019.7) through `WorkspaceProject.build`
  (WO-04-010/WO-04-011), never from a heartbeat-only check: the panel ignores `snapshot.noSignal` (the v1
  heartbeat-only flag of `buildSnapshot`) for the building-now / no-signal choice, so La Fragua, the hero chip
  and this panel never disagree on the same `build-no-signal` screen (DR-115). The panel takes a plain string,
  so it imports nothing from `src/lib/fragua/`. Renders nothing when `snapshot` is null. Structure as drawn: `Card` + `CardHeader` (green check tile, title «Último commit en verde», pill),
  intro line, commit row (mono SHA chip + «verificó <WO> de <FRD>»; the `workspace.resumen.snapshot.verified`
  / `.passedGates` keys when the subject names no FRD or no work order, or the gap is unavailable), the building-now line (blue, loader
  icon, «Construyendo ahora:» + «el build sigue avanzando. Eso todavía no está en verde: no lo pruebes.») or, when
  `noSignalAgo` is passed, the coral line «El build dice estar corriendo, pero no hay señal del supervisor desde
  hace N. Revisa si sigue vivo antes de fiarte de ese estado.», the amber `Notice` (`role="status"`) «Este commit
  quedó atrás del build» + «El build lleva N commits y N horas más. …» when `gap.stale`, then the lead-in «Para
  probarlo, córrelo en la carpeta de <Proyecto>:» and the `CommandBox` with the worktree command.
- Pill: «Seguro para probar» (green, check) when `safe_to_test` and not stale; «Quedó atrás del build»
  (amber, alert) when stale; the amber alert variant drawn by `project-snapshot-stale` with the
  `workspace.resumen.snapshot.unsafeChip` text when `safe_to_test` is false (FDD «data cases» rule).
- The worktree command uses the project's folder name (the caller passes it as `slug`, never the display
  name, LESSON-0365); Mission Control never runs it.
- Root id `#snapshot-panel` and the prototype's recorded classes/hooks; `h2` heading.

## Out of Scope

- `buildSnapshot`, `isSnapshotStale` and their thresholds (`src/lib/snapshot/snapshot.ts`, WO-14-001, read only).
- Mounting the panel in the Resumen and computing `noSignalAgo` from `buildSignal()` (WO-04-011); the
  resolver itself, La Fragua and the hero chips of the same `build-no-signal` screen (WO-06-013, WO-04-010).
- The Portafolio rail chips and the rethink indicator (out of v2, removed by WO-03-007).

## Requirements & Acceptance Criteria

REQ-14-001, REQ-14-002.

- **AC-14-001.1** — FOR each project being built, Mission Control SHALL show, in the project Resumen below La Fragua and ONLY while a build is running and a `last_green_sha` exists, a **snapshot panel** presenting the **last build commit that passed all gates** ("último commit en verde · seguro para probar"), the FRD it closed, and the **`git worktree add /Users/Shared/review-worktrees/<project> <sha>` command** ready to copy (the review worktree lives under the canonical review-worktrees root, outside `Proyectos/` — DR-090). It reads `last_green_sha` and `safe_to_test` from `.pandacorp/status.yaml`.
- **AC-14-001.2** — The copy SHALL state that the green commit is **safe to test in a separate git worktree while the build continues** — it SHALL NOT frame it as a local-vs-remote git matter, nor use the "punto verde" term.
- **AC-14-001.3** — The panel SHALL distinguish **"building now"** (the work order in progress — "this is not green yet, don't test it") from the **last green commit** — they are two different things.
- **AC-14-002.1** — IF the last green commit (`last_green_sha`) is **far behind the build's current HEAD** (many commits/hours), THEN Mission Control SHALL warn that the green commit has fallen behind the build, and that testing it no longer reflects the build's current state.
- **AC-14-002.2** — (amended 2026-10-22, gate fix) WHILE `status.yaml` claims `running: true`, THE panel SHALL show "building
  now" ONLY when the claim is LIVE — `running` AND a fresh signal, where the signal is the freshest of the
  supervisor heartbeat and the latest event (DR-066: never the flag alone). WHEN that signal is older than the freshness
  TTL (10 min) or absent, THE panel SHALL show "Sin señal · último evento hace N" instead — the flag is
  never dressed up as a live build. The panel SHALL read this state from the one resolver `buildSignal()` (via `WorkspaceProject.build`),
  the same rule as FRD-06 AC-06-019.7 (state `build-no-signal`), so the Resumen can never show «Construyendo» and «Sin señal» together (DR-115).
  (Change `mc-observability-consumer-dr066`, 2026-07-02.)

The «only while a build is running» condition of AC-14-001.1 is enforced by the mounting Resumen
(WO-04-011); this work order's tests cover the panel's own absence on a null snapshot.

Fidelity criterion: the panel visually matches the three mock states below on the frozen tokens at 375 /
768 / 1280 px in both themes, verified by the preview smoke gate (DR-055) and the close-out fidelity diff.

Completeness (DR-100): an unavailable gap never claims the commit is current nor fabricates a staleness
verdict (no notice, commit row falls back to the `passedGates` key); state by icon and text, never colour alone; the copy button
named «Copiar <comando>»; `role="status"` on the notice; one column at every width; no write, no git write.

## Visual reference

- **Mock screens:** `docs/frds/frd-14-snapshot-and-feedback/mocks/snapshot-and-feedback.html` sections
  `#project-snapshot`, `#project-snapshot-stale`, `#build-no-signal` (the same panel also appears in
  `docs/frds/frd-04-project-workspace/mocks/project-workspace.html#project-snapshot`). Oracle states:
  `project-snapshot`, `project-snapshot-stale`, `build-no-signal`, and the scenario state `snapshot-unsafe`
  («Aún no es seguro» when `safe_to_test` is false, reproduced from its
  `docs/design/prototype/reference/oracle-recipes.json` double).
- **Token slice:** `--surface`, `--line`, `--r-lg`, `--shadow`; `--green` (card tone, pill), `--amber`
  (stale pill and notice), `--blue` (building-now line), `--coral` (no-signal line) with
  `--tint`/`--tint-strong`; `--font-mono` for the SHA and the command; `--fs-sm` intro, `--fs-h3` title.
- **FDD pointer:** `docs/frds/frd-14-snapshot-and-feedback/fdd.md` (Screens, States, Responsive & accessibility).

## Components and reuse

Builds `CMP-14-snapshot-panel` (restyle in place) and `IF-14-snapshot-gap`. Reuses `Card`/`CardHeader`,
`Chip`, `Notice`, `CommandBox`, `Icon`. No new components.md row. Installs: none.

## Tests

- `src/lib/snapshot/_tests/gap.test.ts`: against the git fixture runner (`MC_GIT_FIXTURE`, WO-01-010): 0 commits
  behind, below and at both thresholds, subject with and without a work-order id, unknown sha → `unavailable`.
- Component tests (`snapshot-panel/_tests/`): the three drawn states, the unsafe pill, null snapshot renders
  nothing, v1 props still render, the no-signal line follows `noSignalAgo` and not `snapshot.noSignal` (a stale
  heartbeat with a fresh event, which `buildSignal()` reads as live, shows «Construyendo ahora»), copy and command text, no «punto verde», no local-vs-remote wording.
- **Derogated tests (map §3.3):** implementer-authored, updated here:
  `snapshot-panel/_tests/snapshot-panel.test.tsx`, `snapshot-panel.adversarial.test.tsx`. Reviewer-authored, NOT
  edited (the FRD-14 gate reviewer re-blesses or rewrites them): `snapshot-panel.gate.reviewer.test.tsx`,
  `frd-14-gate-opus.reviewer.test.tsx`. Visual baselines: never touched.

## Dependencies

WO-13-012 (composite primitives), WO-01-010 (`runGit` and its fixture mode). Consumer: WO-04-011.

## Definition of done

The ACs above met with tests that fail without the change; `.pandacorp/verify.sh` green; Status Note filled.

## Status Note
