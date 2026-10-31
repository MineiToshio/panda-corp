---
id: WO-04-011
type: work-order
slug: resumen
title: 'WO-04-011 — Resumen: La Fragua head, tiles, next step, Avance por FRD, decisions, Tu turno, Últimos avances, snapshot, upgrade notice'
status: ACTIVE
parent: FRD-04
foundation: false
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_panels/ResumenPanel.tsx'
  - 'src/app/projects/[slug]/_components/{tab-summary,version-freshness,ProgressList}/**'
  - 'e2e/resumen.spec.ts'
  - 'e2e/frd-14-snapshot-and-feedback.behaviour.spec.ts'
source_requirements: [REQ-04-004, REQ-04-005, REQ-04-014, REQ-06-020, REQ-20-001, REQ-20-002, REQ-20-003, REQ-20-004]
dependsOn: [WO-04-010, WO-06-013, WO-14-005, WO-04-013, WO-20-001, WO-18-002, WO-12-007]
last_updated: 2026-10-31
---

# WO-04-011 — Resumen: La Fragua head, tiles, next step, Avance por FRD, decisions, Tu turno, Últimos avances, snapshot, upgrade notice

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED`. Blueprint: [`../blueprint.md`](../blueprint.md) §3, §4.1, §4.4.

## Summary

Rewrites the Resumen panel to the Órbita design: the upgrade notice (only when the project's engine is
behind, with the folder line), «Siguiente paso» with its copyable command, La Fragua, the snapshot card while
a build runs, then «Avance por FRD» and «Decisiones» beside the project's «Tu turno» and «Últimos avances»
(Tu turno first below 1024 px), the decision dialog, and the collapsed «Bitácora técnica del motor». FRD-20's
notice is folded here (DR-100 fold).

## In Scope

- `CMP-04-resumen` (`_panels/ResumenPanel.tsx` + `_components/tab-summary/`): composition in the drawn order;
  reads `project` (the `WorkspaceProject` of WO-04-010) for counts, next step and liveness, and loads the rest
  through `src/lib` readers. It renders no `<main>`: the shell's `main#content` is the page's only main
  landmark (AC-19-001.5, REQ-13-009); tests that queried `getByRole("main")` in `tab-summary/_tests/` are
  updated here.
- Upgrade notice (`CMP-20-upgrade-notice`, `_components/version-freshness/`): `VersionFreshness` restyled as a
  consumer of `Notice` (amber, accessible name «Actualización pendiente», alert icon) + `CommandBox`
  (`/pandacorp:upgrade`) + «Córrelo en la carpeta de <Proyecto>»; the detail is the drawn body of
  `overlay-behind` naming both versions, whether or not a build is live (no separate while-building wording
  is drawn, so none is built; reconciliation 2026-10-22); verdict from `getOverlayFreshness` (WO-20-001);
  `up-to-date` and `unknown` render nothing.
- La Fragua: mounts `FraguaScene` (WO-06-013) immediately after the optional upgrade notice, as
  `FraguaScene({ project, openChanges, ownerPending, lastActivityAt, frds })` with
  `project.counts.openChanges` (`countOpenChanges`), this project's `ownerTurnItems({ project }).count`
  (WO-18-002), `project.lastMove` (WO-03-007's `getLastCommit()`) and `listProjectFrds()` (WO-12-007): the
  single resolvers AC-06-020.2 («Espera tu decisión», «En pausa»), AC-06-020.4 (FRD title in the token card)
  and AC-06-020.7 (foot chips) read; the scene derives none of them itself.
- «Siguiente paso:» follows La Fragua, from `project.nextStep` (sentence + `CommandBox`), omitted when there is no command.
- «Avance por FRD» names FRDs through `listProjectFrds()` (one FRD index, DR-115).
- Snapshot: mounts `SnapshotPanel` (WO-14-005) between La Fragua and the columns, passing the project name,
  the folder, the `buildSnapshot` result, the `readSnapshotGap` result and `noSignalAgo`, set only when
  `project.build` (the value of FRD-06's `buildSignal()`, WO-06-013: running and fresh by the freshest of the
  supervisor heartbeat OR the latest event, AC-06-019.7) is `no-signal`, formatted from its signal age; never a
  heartbeat-only check and never `src/lib/status/liveness.ts` (DR-115: La Fragua, the hero chip and the panel
  share one verdict); rendered only while a build is running and a `last_green_sha` exists.
- `CMP-04-frd-progress`: «Avance por FRD» card with count pill, «Primero lo que falta terminar.», FRD rows
  (code, title, `StackBar` with its text alternative, n/m) with unfinished FRDs first, eight shown, «N FRDs en
  total» + «Ver todos» to the Observabilidad tab, each row linking to Observabilidad filtered by its FRD;
  the `workspace.resumen.frdProgress.empty` sentence when none.
- `CMP-04-decisions`: «Decisiones» list from `readDecisions` (WO-04-013 contract): engine-log entries hidden
  through `isEngineLogEntry` with the «N entrada(s) automática(s) del motor oculta(s) (no son preguntas para
  ti).» line; each row shows the title (stripped), date, «Resuelta» or «Pendiente» chip word and «ya resuelta
  en el archivo» when `resolvedInFile`; «Sin decisiones tuyas registradas.» when none; a row opens the
  decision dialog (kicker «Decisión · <Proyecto>», title, status/project/date chips, the sentence on what the
  capture holds, the recommendation as text only, the scoped `/pandacorp:decide <id>` command, «Abrir
  <Proyecto>»); no approve affordance.
- Project «Tu turno»: the project's items from `ownerTurnItems({ project })` (WO-18-002, filtered to this
  project, engine-log entries excluded through `isEngineLogEntry`: pending decisions with
  `/pandacorp:decide <id>` and an age hint, ready changes with
  `/pandacorp:implement change:<id>`), rendered with the shared `AskRow` (`src/components/dashboard/TuTurno/`,
  WO-18-002) and its «Detalles» dialog; count pill; the `workspace.resumen.turn.empty` sentence when empty (drawn in FRD-06's captured states);
  placed first in the single-column layout below 1024 px.
- `CMP-04-progress-list` (`_components/ProgressList/`): «Últimos avances» from verified work orders (build
  track end times grouped by day, «N work orders verificadas» + the FRD codes) and changes with a date
  (status label from the `workspace.resumen.progress.change*` keys, e.g. «Listo para construir»,
  «Terminado»), newest first, six lines, each with icon, status label, subject and absolute date; change lines
  open the change in the Cambios tab; the `workspace.resumen.progress.empty` sentence when none (drawn in FRD-06's captured states). Dates compared
  with `Date.parse` (LESSON-0009).
- «Bitácora técnica del motor»: native `details`, collapsed, count pill, «Notas en crudo del build», entries from
  `readActivityLog`; omitted when there are none.
- Dates and ages through the shared formatter of the copy layer (ledger request to WO-13-010).

**Removal list (map §6.C items 6, 7, 21, 22), deleted here:** `PendingMergeBlock` (+ its test) and the
`readPending` call that fed it (REQ-21-004); the Resumen deploy row (deploy target and URL); the «Obsoleta»
tag; the quiet «Última versión de Pandacorp» badge (ok branch of `VersionFreshness`); the v1 `TabSummary`
summary/key-points panel and decision cards; any now-unused export of `tab-summary/`.

## Out of Scope

- The hero and its stats (WO-04-010; the four key facts come from `WorkspaceProject`), `FraguaScene` internals
  (WO-06-013), `SnapshotPanel` internals (WO-14-005), `AskRow` and `ownerTurnItems()` (WO-18-002), the reader
  changes (WO-04-013, WO-20-001).
- Answering a decision in the app (never; `/pandacorp:decide <id>` only).

## Requirements & Acceptance Criteria

REQ-04-004, REQ-04-005, REQ-04-014 (Resumen), FRD-06 REQ-06-020, FRD-20 REQ-20-001..004.

- **AC-04-014.3** — THE Resumen SHALL show four key tiles (avance, falta, cambios abiertos, último movimiento) and the next step with its copyable command ("Siguiente paso").
- **AC-04-014.4** — THE Resumen SHALL list each FRD in "Avance por FRD" with a stacked work-order state bar and n/m, with unfinished FRDs first.
- **AC-04-014.5** — THE Resumen SHALL list the project's decisions with a "Resuelta" or "Pendiente" chip, SHALL open each one in a decision dialog (the recommendation as text), and SHALL flag a pending entry whose file already records a resolution as "ya resuelta en el archivo".
- **AC-04-014.6** — THE Resumen SHALL show the project's own "Tu turno" items, and SHALL place them first when the layout is a single column (below 1024 px).
- **AC-04-014.7** — THE Resumen SHALL build "Últimos avances" only from verified work orders and filed or started changes, each line with an icon, a status label and a date, and SHALL keep the raw engine log collapsed as "Bitácora técnica del motor".
- **AC-14-001.1** — WHILE a build is running with a `last_green_sha`, THE Resumen SHALL mount the snapshot card using the folder identity and the shared `WorkspaceProject.build` signal; WHEN idle or without a green SHA, THE Resumen SHALL omit it.
- **AC-06-020.1** — THE project Resumen SHALL open with the La Fragua scene (there is no Party tab), drawn with the always-dark scene tokens in both light and dark themes.
- **AC-20-001.1** — IF the project's `overlay_version` is **strictly behind** the factory's
  `OVERLAY_VERSION` (semver), Mission Control SHALL show the warn notice in Resumen — heading
  "Este proyecto usa una versión vieja del motor de Pandacorp", a detail naming both versions, and the copyable
  `/pandacorp:upgrade` command.
- **AC-20-001.2** — **Out of v2 (owner decision 2026-10-21):** IF the project's `overlay_version` **equals or is newer than** the factory's,
  Mission Control SHALL show the ok badge ("al día") with **no** command row. In v2, the same condition shows nothing. (drawn in FRD-18's captured states)
- **AC-20-001.3** — IF either version is missing or unparseable, Mission Control SHALL treat the
  state as `unknown` and show **nothing** (no false alarm).
- **AC-20-002.1** — The warn notice SHALL show the **command to copy** `/pandacorp:upgrade`.
- **AC-20-002.2** — The notice SHALL NOT execute the command — it only shows it so the owner runs it
  in the project's folder.
- **AC-20-004.1** — THE upgrade notice SHALL name the project folder where the command runs ("Córrelo en la carpeta de <Proyecto>").

How AC-04-014.3 is met: the drawn tiles are the hero stats (avance ring with verified n/m, cambios abiertos,
último movimiento, rendered by WO-04-010 on Resumen) and La Fragua's foot chips («Falta N» / «Todo forjado»,
«N cambios abiertos», «Último movimiento …», WO-06-013); all read the one `WorkspaceProject` / shared resolvers.
This work order adds «Siguiente paso» and owns the AC's acceptance test over the whole Resumen.

Fidelity criterion: the Resumen visually matches the mock states below on the frozen tokens, in both themes
and at 375 / 768 / 1280 px, verified by the preview smoke gate (DR-055) and the close-out fidelity diff.

Completeness (DR-100): each card has its empty state (catalogue strings above); a reader error renders that
card's error (never an empty card): an unreadable `decisions.md` or change queue says so; the dialog traps focus,
closes on Escape and returns focus to its row; state never by colour alone (chip words, icons); reduced motion
leaves La Fragua static (WO-06-013); the panel never writes and never runs a command.

## Visual reference

- **Mock screens:** `docs/frds/frd-04-project-workspace/mocks/project-workspace.html` sections
  `#project-summary`, `#project-summary-funko`, `#project-summary-decisions`, `#project-decision-dialog`,
  `#project-snapshot`; `docs/frds/frd-20-overlay-freshness/mocks/overlay-freshness.html#overlay-behind`.
  Oracle states: `project-summary`, `project-summary-funko`, `project-summary-decisions`,
  `project-decision-dialog`, `project-snapshot`, `overlay-behind`, and the scenario state `resumen-no-frds`
  («Aún no hay FRDs publicados.», reproduced from its `oracle-recipes.json` double).
- **Token slice:** card surface `--surface` / `--line` / `--r-lg`, `--shadow`; hues `--amber` (notice,
  decisions, Tu turno), `--violet` (Avance por FRD), `--teal` (Últimos avances), `--slate` (Bitácora),
  `--green`/`--pink`/`--blue` (progress lines) with `--tint`/`--tint-strong`; `--fs-h3` card titles,
  `--fs-sm`/`--fs-xs` meta; `--font-mono` for FRD codes and commands; `--scene-*` belongs to La Fragua;
  `--shadow-dialog`, `--r-xl` for the dialog.
- **FDD pointer:** `docs/frds/frd-04-project-workspace/fdd.md` (Resumen screens, decision dialog,
  snapshot state, Interaction & flow) and `docs/frds/frd-20-overlay-freshness/fdd.md`. Reference CSS:
  `docs/design/prototype/reference/css/{06-card,07-chip,12-command,13-list-row,14-empty-notice,22-inicio}.css`.

## Components and reuse

Builds `CMP-04-resumen`, `CMP-04-frd-progress`, `CMP-04-decisions`, `CMP-04-progress-list`,
`CMP-20-upgrade-notice`. Reuses `Card`/`CardHeader`/`CountPill`, `Notice`, `CommandBox`, `ListRow`, `StackBar`,
`Chip`, `Dialog`, `Button`, `EmptyState`, `Icon`, `AskRow`, `FraguaScene`, `SnapshotPanel`. Creates only the
components.md row `ProgressList`. Installs: none.

## Tests

- Component tests per card against production-shaped fixtures (a `decisions.md` with the PersonalPage v2
  `2026-07-01-1` shape, an engine-log entry, a legacy heading; a change queue with every status; a build track
  with verified work orders), plus a malformed `decisions.md`/queue that must show the error state.
- Panel test: drawn order, Tu turno first in the single-column order, snapshot only while running with a green
  SHA, notice only when behind, `FraguaScene` receives the four facts from the shared resolvers.
- `e2e/resumen.spec.ts` (the behaviour spec of the Resumen and of La Fragua inside it, because WO-06-013 has
  no route before this mount; reconciliation 2026-10-22): scene present at the head of Resumen, four stations,
  token card on focus, idle line, no control in the scene; the decision dialog opens and returns focus.
  `gotoHydrated`, `getByRole` first, no hard waits.
- **Derogated tests (map §3.3):** implementer-authored, rewritten or deleted here:
  `tab-summary/_tests/tab-summary.test.tsx`, `tab-summary.wo04005.test.tsx`,
  `tab-summary.markdown-and-deploy.test.tsx` (deploy row removed: deleted), `PendingMergeBlock.test.tsx`
  (deleted with the block), `version-freshness/_tests/version-freshness.test.tsx` (ok branch removed).
  Reviewer-authored, NOT edited (the FRD-04 gate reviewer re-blesses or rewrites them):
  `tab-summary/_tests/frd-04-gate-opus.reviewer.test.tsx`, `tab-summary/_tests/tab-summary.reviewer.test.tsx`.
  Visual baselines: never touched.

## Dependencies

WO-04-010 (panel contract, `WorkspaceProject`), WO-06-013 (`FraguaScene`), WO-14-005 (`SnapshotPanel`,
`readSnapshotGap`), WO-04-013 (`resolvedInFile`, `isEngineLogEntry`), WO-20-001 (verdict), WO-18-002
(`AskRow`, `ownerTurnItems({ project })`), WO-12-007 (`listProjectFrds()`).

## Definition of done

The ACs above met with tests that fail without the change; the removal list gone (knip, tsc clean);
`.pandacorp/verify.sh` green; Status Note filled.

## Status Note

### 2026-10-31 — S5A round 2 patch handoff (uncommitted)

This note supersedes the dependency-blocked handoff below. WO-18-002 is now present;
implementation_status is IN_REVIEW, with no blocked_reason. Review and the full project gate remain pending.

- Wired the project's `ownerTurnItems({ project: project.projectPath })` and shared `AskRow`:
  real count, explicit source errors alongside readable items, the empty state, stable decision IDs,
  scoped commands and heading-date relative ages. La Fragua receives this count and displays
  «Espera tu decisión» when the project has pending owner work.
- Moved engine-entry classification into the pure `lib/docs/decision-kind.ts`; the activity API
  delegates to it. DecisionsCard imports no runtime value from the filesystem reader.
- Promoted the existing Inicio decision reader into shared `readDecisionSource`; Inicio, Resumen
  and the live status-count reader use it. An unknown heading retains valid rows and surfaces an
  error alongside them; fields inside an unknown block cannot reopen a resolved decision.
- FRD precedence ruling applied: optional upgrade notice, La Fragua, then Siguiente paso.
  Updated the composition contract above and the implementer-owned ordering test.
- Keyboard focus survives the browser's scroll-into-view event; pointer-hover tooltips still close
  on scrolling. La Fragua token navigation preserves the `/projects/` namespace.
- Command copy labels use `t()`. Removed the unused PendingItem export. Fixed the e2e polish
  fixture's invalid PENDING state to PLANNED. Current source inspection finds exactly one
  `data-testid="tab-summary"` declaration; the workspace wrapper uses `workspace-tab-summary`.
- Added regressions for partial decision-source failure, resolved-block isolation/count agreement,
  the project owner queue/verdict/scoped command/relative age, and focused-token scrolling.

Verification from `mission-control/`, with `export PORT=3981 PANDACORP_E2E_PORT=3981`:

```sh
pnpm exec vitest run 'src/app/projects/[slug]/_components/tab-summary' 'src/app/projects/[slug]/_components/version-freshness' 'src/app/projects/[slug]/_components/ProgressList' 'src/app/projects/[slug]/_components/snapshot-panel' 'src/app/projects/[slug]/_components/Fragua' src/lib/fragua src/lib/inicio src/lib/docs --maxWorkers=2 --reporter=dot
pnpm exec tsc --noEmit
pnpm exec knip
pnpm exec biome check 'src/app/projects/[slug]/_components/tab-summary' 'src/app/projects/[slug]/_components/version-freshness' 'src/app/projects/[slug]/_components/ProgressList' 'src/app/projects/[slug]/_components/snapshot-panel' 'src/app/projects/[slug]/_components/Fragua' 'src/app/projects/[slug]/_panels/ResumenPanel.tsx' src/lib/fragua src/lib/inicio src/lib/docs src/lib/pendingMerge/pendingMerge.ts src/components/dashboard/TuTurno/AskRow.tsx
node /private/tmp/s5a-r2-client-boundary.mjs
git diff --check
```

- Vitest: exit 0, **495 tests / 38 files passed**, including all requested slices and additional
  shared decision-reader coverage. Log: `/private/tmp/s5a-r2-vitest-final.log`.
- Biome: exit 0, **78 files checked**, no fixes. Log: `/private/tmp/s5a-r2-biome-final.log`.
- Client-boundary audit: exit 0, **22 workspace client roots, zero transitive local-source node:
  import chains**, excluding type-only imports. This static audit does not replace a browser build.
- TypeScript: exit 2, **45 diagnostics in 11 unchanged test files** (Party modules, token tests,
  old objectives-bar integration and the navigation review contract); none in modified files.
  Log: `/private/tmp/s5a-r2-tsc-final.log`.
- Knip: exit 1, **24 unresolved imports in unchanged tests** and two unused exports in
  `src/lib/constants.ts` (`MEMORY_RAW_NOTES_THRESHOLD`, `MEMORY_STALE_DAYS_THRESHOLD`).
  PendingItem is no longer reported. Log: `/private/tmp/s5a-r2-knip-final.log`.
- `git diff --check`: exit 0. No reviewer files, visual baselines, decision logs or .pandacorp
  files changed. No staging, commits, merge, queue invocation or push.
- Not verified: Playwright/e2e, a live Next.js/browser render, visual/a11y gates, production build
  and full verify.sh. The invalid fixture fix is present, but its browser effect is unverified.



### 2026-10-31 — S5A implementation (uncommitted)

- Replaced the v1 summary/key-points/deploy/pending-merge composition with the Órbita Resumen;
  mounted the existing FraguaScene, FRD progress, decisions/dialog, structured progress, upgrade notice
  and native collapsed engine log. No additional main landmark.
- Removed the heartbeat-only interim. Snapshot visibility is gated on running + green SHA, the worktree
  command uses `project.folder`, `readSnapshotGap` is wired, and the no-signal age comes solely from
  `project.build`. Both e2e specs restore their status fixture unconditionally in setup and teardown.
- Dependency observed missing in this checkout: WO-18-002's `src/lib/inicio/turn.ts` and
  `src/components/dashboard/TuTurno/AskRow.tsx`. Their published implementation exists on `orch/s4b`
  (`cf3284620198dc5d937fe37a6b86a77a88733b04`), read only. Owner/orchestrator notified;
  no cross-stream files copied and no merge attempted. Tu turno integration is pending that dependency.
- RED evidence: progressItems import absent before implementation; upgrade tests failed for the legacy
  heading/visible up-to-date badge. Initial focused implementation run: 20 passing tests across five files.
- Scope preserves reviewer suites and visual baselines. No decision-log, .pandacorp, staging or commit.
  Integration must reconcile the protected tab-summary reviewer contracts before the full gate.

### 2026-10-31 — Verification and handoff

**Not complete / not IN_REVIEW:** the branch lacks WO-18-002's shared `ownerTurnItems` and
`AskRow`. The owned composition exposes an owner-turn slot, but the route currently renders an
explicit unavailable notice and passes no invented pending count to La Fragua. The real queue,
its Details dialogs and the empty state remain to be wired after that dependency is supplied.
No acceptance claim is made for that portion of AC-04-014.6 or the owner-pending verdict.
The work order remains IN_PROGRESS; there is no green full gate.

Verification ran from `mission-control/` with `export PORT=3981 PANDACORP_E2E_PORT=3981`:

```sh
pnpm exec vitest run 'src/app/projects/[slug]/_components/tab-summary' 'src/app/projects/[slug]/_components/version-freshness' 'src/app/projects/[slug]/_components/ProgressList' 'src/app/projects/[slug]/_components/snapshot-panel' --maxWorkers=2 --reporter=dot
pnpm exec tsc --noEmit
pnpm exec knip
pnpm exec biome check 'src/app/projects/[slug]/_panels/ResumenPanel.tsx' 'src/app/projects/[slug]/_components/tab-summary' 'src/app/projects/[slug]/_components/version-freshness' 'src/app/projects/[slug]/_components/ProgressList' e2e/resumen.spec.ts e2e/frd-14-snapshot-and-feedback.behaviour.spec.ts
git diff --check
```

- Vitest: exit 1, **79 passed / 18 failed**, 12 passing files / 3 failing files. All failures are
  in the three protected tab-summary suites below, which still supply the v1 props. They require
  reviewer reconciliation, not compatibility behavior that resurrects the removed summary.
- TypeScript: exit 2, diagnostics in **14 protected reviewer files only**, including the v1 summary
  API and the deleted Party/objectives modules. No diagnostics in production or implementer tests.
- Knip: exit 1, **24 unresolved imports** in protected suites and the now-unused exported `PendingItem`
  in `src/lib/pendingMerge/pendingMerge.ts:28`, outside the owned paths. Integration must remove that
  export or assign its cleanup explicitly; no artificial consumer was added to evade the gate.
- Biome: exit 0, 25 files checked, no fixes applied. `git diff --check`: exit 0.
- Snapshot real-boundary tests cover the idle/missing-SHA mount gate, folder/display-name mismatch,
  readSnapshotGap git arguments and stale result, and freshest event/heartbeat agreement with the
  mounted scene. AC-14-001.1 has component coverage; browser verification is still pending.
- No Playwright, browser rendering, visual/a11y gate, full verify.sh, merge queue, staging, commit,
  push, decision-log write or baseline change was performed. No tracked e2e fixture was changed.

**Protected suites that need to move (reviewer owns the edits):**

- `src/app/projects/[slug]/_components/tab-summary/_tests/frd-04-gate-opus.reviewer.test.tsx`
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.reviewer.test.tsx`
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.snapshot-liveness.reviewer.test.tsx`

Per the W5 plan, also reconcile/review the unchanged
`snapshot-panel/_tests/{frd-14-gate-opus,frd-14-rebuild,snapshot-panel.gate}.reviewer.test.tsx`
and the header-marked `snapshot-panel.adversarial.test.tsx` against the new mount contract;
these panel suites passed in this run. The owned non-reviewer FRD-14 behaviour spec was updated
for running:true plus the mount gate and unconditional restoration, but was not executed.
The inherited Party, token, page-integration and v2-survivors reviewer diagnostics are listed
in `/private/tmp/s5a-tsc-final.log`; Knip details are in `/private/tmp/s5a-knip-final.log`.

**Explicit WO-04-011 path list (repo-root relative; includes removals):**

```text
mission-control/docs/frds/frd-04-project-workspace/work-orders/wo-04-011-resumen.md
mission-control/e2e/frd-14-snapshot-and-feedback.behaviour.spec.ts
mission-control/e2e/resumen.spec.ts
mission-control/src/app/projects/[slug]/_components/ProgressList/ProgressList.module.css
mission-control/src/app/projects/[slug]/_components/ProgressList/ProgressList.tsx
mission-control/src/app/projects/[slug]/_components/ProgressList/_tests/ProgressList.test.tsx
mission-control/src/app/projects/[slug]/_components/ProgressList/_tests/progressItems.test.ts
mission-control/src/app/projects/[slug]/_components/ProgressList/progressItems.ts
mission-control/src/app/projects/[slug]/_components/tab-summary/DecisionsCard.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/FrdProgress.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/PendingMergeBlock.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/SourceError.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/PendingMergeBlock.test.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/readSummary.test.ts
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/summaryFixture.ts
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.markdown-and-deploy.test.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.snapshot-liveness.test.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.test.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.wo04005.test.tsx
mission-control/src/app/projects/[slug]/_components/tab-summary/readSummary.ts
mission-control/src/app/projects/[slug]/_components/tab-summary/tab-summary.module.css
mission-control/src/app/projects/[slug]/_components/tab-summary/tab-summary.tsx
mission-control/src/app/projects/[slug]/_components/version-freshness/_tests/version-freshness.test.tsx
mission-control/src/app/projects/[slug]/_components/version-freshness/version-freshness.module.css
mission-control/src/app/projects/[slug]/_components/version-freshness/version-freshness.tsx
mission-control/src/app/projects/[slug]/_panels/ResumenPanel.tsx
```

### Superseded sequence ruling (2026-10-31)

The recorded forge-first precedence ruling and copied AC-06-020.1 above are superseded by the reconciled FRD-06 AC-06-020.1: upgrade notice when present, Siguiente paso, La Fragua, snapshot. The work order remains historical evidence; its earlier sequence must not be reused as the current contract. The reviewer-owned e2e/resumen-fragua.reviewer.spec.ts forge-first assertion requires integration review.
