---
id: WO-04-011
type: work-order
slug: resumen
title: 'WO-04-011 — Resumen: La Fragua head, tiles, next step, Avance por FRD, decisions, Tu turno, Últimos avances, snapshot, upgrade notice'
status: DRAFT
parent: FRD-04
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_panels/ResumenPanel.tsx'
  - 'src/app/projects/[slug]/_components/{tab-summary,version-freshness,ProgressList}/**'
  - 'e2e/resumen.spec.ts'
source_requirements: [REQ-04-004, REQ-04-005, REQ-04-014, REQ-06-020, REQ-20-001, REQ-20-002, REQ-20-003, REQ-20-004]
dependsOn: [WO-04-010, WO-06-013, WO-14-005, WO-04-013, WO-20-001, WO-18-002, WO-12-007]
last_updated: 2026-10-22
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
- «Siguiente paso:» line from `project.nextStep` (sentence + `CommandBox`), omitted when there is no command.
- La Fragua: mounts `FraguaScene` (WO-06-013) first in the panel body after the two lines above, as
  `FraguaScene({ project, openChanges, ownerPending, lastActivityAt, frds })` with
  `project.counts.openChanges` (`countOpenChanges`), this project's `ownerTurnItems({ project }).count`
  (WO-18-002), `project.lastMove` (WO-03-007's `getLastCommit()`) and `listProjectFrds()` (WO-12-007): the
  single resolvers AC-06-020.2 («Espera tu decisión», «En pausa»), AC-06-020.4 (FRD title in the token card)
  and AC-06-020.7 (foot chips) read; the scene derives none of them itself.
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
