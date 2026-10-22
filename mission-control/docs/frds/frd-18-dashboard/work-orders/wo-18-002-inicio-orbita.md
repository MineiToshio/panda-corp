---
id: WO-18-002
type: work-order
slug: inicio-orbita
title: Inicio Órbita - two-column command center, Tu turno, En marcha, Pulso, Gremio, Embudo and the plugin banner
status: ACTIVE
parent: FRD-18
foundation: false
implementation_status: PLANNED
difficulty: high
reopen_count: 0
artifacts: ["src/app/page.tsx", "src/app/(dashboard)/**", "src/components/dashboard/{TuTurno,Progreso,Cartera,DashboardLiveWatcher}/**", "src/components/modules/{Pulso,Digest}/**", "src/app/_lib/**", "src/app/_components/plugin-sync-banner/**", "src/lib/inicio/**", "src/lib/docs/activity.ts", "src/lib/docs/_tests/activity.turn-detail.test.ts", "src/lib/constants.ts", "src/app/_tests/{page.dashboard,wo-18-001-fixes,wo-18-001-inicio-dashboard}.test.tsx", "e2e/inicio.spec.ts"]
source_requirements: [REQ-18-001, REQ-18-002, REQ-18-003, REQ-18-004, REQ-18-010, REQ-18-011, REQ-18-012, REQ-18-013, REQ-18-014, REQ-18-015, REQ-18-016, REQ-18-017, REQ-18-021, REQ-18-022, REQ-15-002, REQ-15-004, REQ-15-005, REQ-06-019, REQ-12-001]
dependsOn: [WO-21-003, WO-03-007, WO-04-013, WO-06-013, WO-13-012, WO-19-002, WO-25-001]
last_updated: '2026-10-22'
---

# WO-18-002 Inicio Órbita

> Blueprint: [`../blueprint.md`](../blueprint.md) (`IF-18-*`, `CMP-18-*`). Design: [`../fdd.md`](../fdd.md).
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Summary

Rebuild the whole landing page `/` on the Órbita system: the plugin warning first when the installed plugin is
behind, then two columns. Left: Tu turno (one line per decision or ready change with its scoped command and a
"Detalles" dialog, calm "Al día" when nothing waits), Tu cartera (compact project cards or the first-action card)
and En marcha (three collapsible groups of work already in the factory's hands). Right: Pulso, Gremio, Embudo de
ideas and the Árboles de trabajo card hosted from FRD-21. It removes the digest and the card facts the design
dropped, and publishes `ownerTurnItems()` (the Tu turno list and its count, also the sidebar's Inicio count).

## In Scope

- `src/lib/inicio/` (new, request-cached resolvers, pure where possible, fail loud): `turn.ts`
  (`ownerTurnItems({ project? })` returning the items and their `count`: all projects by default, one
  project when asked (its `count` is the per-project figure WO-04-011 passes to La Fragua as `ownerPending`),
  engine-log entries excluded via `isEngineLogEntry` of WO-04-013; WO-04-011 reuses it and `AskRow`, which
  this work order keeps exported from `src/components/dashboard/TuTurno/`), `flight.ts` (`inFlightGroups()`), `funnel.ts`
  (`ideaFunnel()`), `pulse.ts` (`pulseTiles()`), `achievement.ts` (`lastAchievement()`, whose `fresh` flag
  (flagged new or unlocked within 7 days) is the one predicate for the «Nuevo» chip here and for WO-19-003's
  achievement notice); every "now" through
  `now()` and git through `runGit` (WO-01-010) via the resolvers; dates through the shared Spanish date
  formatters of `src/lib/copy/` (WO-13-010).
- `src/lib/docs/activity.ts` (additive, W5): `DecisionPoint.ask` and `DecisionPoint.context`, read from the
  decision block's "Qué necesito de ti" or "Qué decidir" field and its "Contexto" field (first paragraph each);
  ids and every existing field unchanged (FRD-24 golden vectors stay green), with one regression test in
  `src/lib/docs/_tests/activity.turn-detail.test.ts` over a real-shaped block and a block without the fields.
- `src/app/page.tsx` and `src/app/(dashboard)/_components/` (`EnMarchaCard`, `FlightGroup`, `TurnRow`,
  `EmbudoCard`, `FunnelRow`, `LastAchievement`): the page composition, the `home-grid` (two columns from
  1024 px, one column with Tu turno first below it), `Suspense` per independently slow block. The page renders
  no `<main>` (the shell's `main#content` is the only one). `FunnelRow` stays at
  `src/app/(dashboard)/_components/FunnelRow.tsx` (the components.md path) with props `phase`, `count`, `max`,
  importable by Logros' «Embudo ideas → lanzado» (WO-10-017, AC-10-023.1).
- `src/components/dashboard/TuTurno/` (card, `AskRow`, `TurnDetailDialog`), `Cartera/` (section heading, the
  compact `ProjectCard` list read from `getProjectOverview()` of WO-03-007 including `nextCommand`
  (REQ-18-021, derived once there, never recomputed here), and `FirstProjectCard` exported from
  `src/components/modules/ProjectCard/` for the empty factory), `Progreso/` (Gremio card), `DashboardLiveWatcher/`
  (also refreshes when the live frame's `stateVersion` moves), `src/components/modules/Pulso/` (KpiTiles),
  `src/app/_components/plugin-sync-banner/` (restyled onto the shared `AlertBanner` with the two versions, the
  two steps and the command box; clears itself).
- Hosts `FactoryWorktrees` (WO-21-003) as the last card of the right column; does not edit it (the card
  itself carries `id="worktrees-card"`, WO-21-003's `WORKTREES_CARD_ID`, the sidebar pill's anchor).
- The card freshness chip and the AC-06-019.7 test read `buildSignal()` (`src/lib/fragua/build-signal.ts`,
  WO-06-013) through the `ProjectCard` / `FreshnessBadge` (no second derivation).
- A behaviour e2e spec `e2e/inicio.spec.ts` (`gotoHydrated`, `getByRole`, no hard waits) against the e2e fixture
  factory: heading and landmarks, Tu turno before Pulso at a narrow viewport, a command with its copy button,
  "Detalles" opens the dialog and Escape closes it with focus back on the button (when the fixture has an item;
  otherwise the calm state is asserted), an En marcha group toggles.
- Cross-surface test for AC-06-019.7 (one stale-signal fixture, the scene verdict, the Inicio card chip and the
  Portafolio card chip all read "Sin señal · último evento hace N"; a fresh signal reads "Construyendo").

## Out of Scope

- The sidebar contents (Inicio count, guild card, plugin pill, worktrees pill): WO-19-003.
- `ProjectCard` itself and the project list: WO-03-007; the freshness resolver and `FraguaScene`: WO-06-013; the
  worktrees reader, card and dialog: WO-21-003; the shell: WO-19-002.
- The Resumen "Tu turno" of a single project (WO-04-011) and any write.
- The fresh-decision run sentence (a decision younger than 7 days): not built.
  The catalogue holds the key, but no captured state of this FRD draws it (`home-turn-dialog` shows a decision
  7 days old or more, so only `dialogs.turnDecision.runStale` is drawn; DR-130). A younger decision's dialog shows
  the command without a run sentence.

### Removals (map §6.C item 11 and §0.6; delete in this work order, with their tests)

- The digest "Desde tu última visita": `src/components/modules/Digest/**`, `src/app/_lib/digest.ts` and the
  `visto_hasta` marker with its browser-storage keys.
- On the project card: version, age-in-stage, "estancado", "N bugs", the inline blocker reason and "estable ·
  en operación": `src/app/(dashboard)/_lib/card.ts` and `_tests/card.test.ts`.
- `buildTurnQueue` and its extra gate kinds (`src/app/(dashboard)/_lib/turn.ts`): shipped-awaiting-review, the
  memory nudge and undiscovered ideas leave Tu turno (they live in Propuestas, REQ-18-010).
- `src/app/_lib/pulse.ts` (replaced by `src/lib/inicio/pulse.ts`), the page-level `OnboardingGate` branch
  (unreachable behind the root layout guard) and the two memory-nudge constants `MEMORY_RAW_NOTES_THRESHOLD`
  and `MEMORY_STALE_DAYS_THRESHOLD` in `src/lib/constants.ts` (their last importers are this page and the
  `MemoryHealth` panel WO-17-008 already deleted).
  `STALENESS_THRESHOLD_DAYS` and `FRESHNESS_THRESHOLD_MS` stay while `src/app/_observability/**` imports them
  (WO-13-013 removes them with it).
- The v1 page-level worktrees section wiring (already swapped by WO-21-003).

## Requirements & Acceptance Criteria

REQ-18-001 to REQ-18-004, REQ-18-010 to REQ-18-017, REQ-18-021, REQ-18-022 (the digest and the three card flags
are removals), plus the FRD-15 banner, the FRD-06 freshness AC and the FRD-12 Pulso ACs assigned to this work
order by the plan. The acceptance criteria it owns, copied from the owning `frd.md` files:

- **AC-18-022.1** — THE Inicio SHALL arrange its cards in two columns (left: Tu turno, Tu cartera, En marcha; right: Pulso, Gremio, Embudo de ideas, Árboles de trabajo) below the plugin warning, and SHALL put Tu turno first when the layout is one column (below 1024 px).
- **AC-18-022.2** — (amended 2026-10-22, gate fix) EACH Tu turno item SHALL be one line (title, "project · kind · age", its scoped command with copy), and WHEN "Detalles" is activated THE system SHALL open a dialog explaining what it is, what is needed, the recommendation, the context and the command; WHEN the decision is 7 days old or more, the dialog SHALL also carry the drawn sentence on what the command does (`dialogs.turnDecision.runStale`). A younger decision's dialog SHALL show the command without a run sentence (the fresh variant is drawn in no captured state).
- **AC-18-022.3** — THE Inicio SHALL list in-flight work in the "En marcha" card, apart from Tu turno, in collapsible groups: "Construyéndose ahora", "Esperan la revisión de su FRD" and "Borradores en la cola".
- **AC-18-022.4** — THE Inicio SHALL show the factory pulse (Proyectos, FRDs, work orders verificadas) and the "Embudo de ideas" per phase, with the discarded ideas counted apart.
- **AC-15-002.1** — IF the installed `version` is **strictly behind** the source `version` (semver), Mission Control SHALL show the banner — heading "El plugin instalado está atrás", the detail naming both versions, and the recall steps (run command → restart session).
- **AC-15-002.2** — IF the installed `version` **equals or is newer than** the source `version`, Mission Control SHALL show **nothing** (reason `in-sync`, no banner) — this is the up-to-date state `claude plugin update` reports.
- **AC-15-002.3** — IF either version is missing or unparseable, Mission Control SHALL treat the state as `unknown` and show **nothing** (no false alarm).
- **AC-15-004.1** — The banner SHALL show the **command to copy** `claude plugin update pandacorp@panda-corp`.
- **AC-06-019.7:** THE project's build state SHALL declare its own freshness, never trusting the `running` flag alone (DR-066): WHILE `running` is true and the freshest of the supervisor heartbeat (`status.yaml`) and the latest event is older than the freshness TTL, THE scene, the Inicio card (FRD-18) and the Portafolio card (FRD-03) SHALL replace "Construyendo" with **"Sin señal · último evento hace N"** (state `build-no-signal`, M1 2026-10-22); WHILE the signal is fresh they read as live. The live shell SHALL refresh its RSC-derived structure when the SSE frame's `stateVersion` moves (a build advancing state without emitting an event must not read as dead). The badge is `data-volatile` (DR-088).
- **AC-12-001.2** — The build state SHALL declare its freshness from the **timestamp of the last event** read from `~/.claude/dashboard-events.ndjson` and the supervisor heartbeat (DR-066), so the operator knows whether they're seeing something current or frozen: WHILE `running` is true and the signal is stale, the surfaces read **"Sin señal · último evento hace N"** instead of "Construyendo" (FRD-06 AC-06-019.7, state `build-no-signal`).
- **AC-12-001.3** — THE Inicio **Pulso** section (FRD-18 REQ-18-013) SHALL present at most **5 signals**, so as not to overwhelm the operator (amended 2026-10-22, v2 plan: restated from the generic "any grouping or ranking limited to top-5" rule, since no other v2 surface ranks agents, events or metrics).

Behaviour the FRD states without an AC id (delivered here and covered by tests): the calm state shows
"Nada espera tu acción ahora mismo." and the "Al día" badge (REQ-18-003); the Inicio updates live without a
reload (REQ-18-004); the queue is decisions first and never truncates silently (REQ-18-012); the launched count
comes from `countLaunched` (REQ-18-014); the next command per card is derived from the phase (REQ-18-021, via
`ProjectCard`); with no projects the first-action card shows `/pandacorp:new-idea` and `/pandacorp:spec <idea>`
(state `factory-empty`); the Gremio card shows rank, level, XP, the next level and the last achievement with
"Nuevo" when fresh, with no streaks (drawn in FRD-03's captured states). FRD-15's pill (AC-15-006.1) is WO-19-003's; the rest of FRD-06 belongs to WO-06-013
(AC-06-020.1 to WO-04-011).

Completeness (definition of done beyond the ACs): error path per failure mode (a project whose decisions file or
change queue cannot be read becomes a named `Notice` row, never a silent "Al día"; a failing guild or event read
degrades only its own card with the designed error state), the empty states (calm Tu turno, no En marcha card,
zero Pulso, empty funnel, first-action card), performance (parallel reads, `Suspense` per slow block, LCP of the
page not blocked by the worktrees card), a11y (one `h1`, `h2` per block, "Detalles: <title>" accessible name,
dialog focus trap and return, status by icon and text, `role="alert"` on the plugin banner), reduced motion,
tokens only, tabular numbers, the live refresh never steals focus or closes an open dialog.

## Components & interfaces it builds

`IF-18-turn`, `IF-18-flight`, `IF-18-funnel`, `IF-18-pulse`, `IF-18-achievement`, `IF-18-decision-detail`,
`CMP-18-page`, `CMP-18-banner`, `CMP-18-turn`, `CMP-18-cartera`, `CMP-18-flight`, `CMP-18-pulso`,
`CMP-18-embudo`, `CMP-18-gremio`, `CMP-18-live` (blueprint). Copy through `t()`: `inicio.*`, `dialogs.turnDecision.*`,
`dialogs.turnChange.*`, `dialogs.default.close`, `common.phases.*`; decision and change titles, commit-like
content and work-order titles keep their source language.

## Reuse (components.md: reuse, then adapt, then create)

Reuse `PageHead`, `AlertBanner`, `Card`/`CardHeader`, `CommandBox`/`CommandCompact`, `Dialog`, `Chip` family,
`EmptyState`/`Notice`, `SectionHeading`, `Icon`, `ProjectCard` (compact) with `PhaseStepper` and `Ring`
(WO-03-007), `FreshnessBadge` (WO-06-013). Adapt: `TuTurno` to `AskRow`, `Pulso` to `KpiTiles`, `Progreso` to the
Gremio card, `PluginSyncBanner` onto `AlertBanner`. Create: `FlightGroup`, `TurnRow`, `FunnelRow`,
`LastAchievement` and the two card wrappers, exactly as the inventory lists them. Check the inventory again at
build time; a missing component is a ledger item, not a fork.

## Installs

None.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-18-dashboard/mocks/dashboard.html`, sections `home`,
  `home-turn-dialog`, `home-in-flight-open`, `home-calm`, `factory-empty`, `build-no-signal`; and for the
  banner `docs/frds/frd-15-plugin-out-of-sync-warning/mocks/plugin-out-of-sync-warning.html#plugin-banner`.
  Screenshots in `mocks/screenshots/<id>-<width>-<theme>.jpg` (375/768/1280, light and dark).
- **Oracle states** (`oracle-states.json`, `oracle-recipes.md`): `home`, `home-turn-dialog`,
  `home-in-flight-open`, `home-calm`, `factory-empty`, `build-no-signal` (frd slug `frd-18-dashboard`) and
  `plugin-banner` (FRD-15). Keep the recorded hooks (`.home-grid`, `.ask-list`, `.ask-row`, `data-turn`,
  `.flight-group`, `.pulse`, `.funnel .frow`, `.first-action`, `.last-ach`) on those elements.
- **Token slice:** amber (Tu turno, decision), pink (change), violet (En marcha), blue (Cartera), teal (Pulso,
  Embudo), gold (Gremio bar and crest), coral (plugin banner), `--surface`, `--line`, radii 16 and 22,
  display numbers for Pulso, mono only for commands and ids.
- **FDD pointer:** `docs/frds/frd-18-dashboard/fdd.md`.
- **Fidelity acceptance criterion:** the built Inicio visually matches `mocks/dashboard.html` (layout,
  structure, components, density) on the frozen tokens, not an approximation; verified by the preview smoke and
  shell gates at the FRD gate and by the computed-style and pixel diff of the six oracle states at the
  close-out Visual QA (DR-056, DR-129). At 1280 the two columns sit side by side; at 768 and 375 it is one
  column, Tu turno first, then Tu cartera, En marcha, Pulso, Gremio, Embudo de ideas and Árboles de trabajo.

## Tests this work order owns

Resolver tests with `now()` fixed and real-shaped fixtures plus a malformed one per reader (decisions first,
resolved-in-file excluded and not counted, ready changes only, count equals rows, in-flight groups, funnel
counts and the discarded count apart, launched count equal to the Logros funnel's, pulse at most five tiles,
last achievement fresh/not fresh); component tests by role and name (calm state, "Detalles" dialog fields and
focus return, groups toggle, first-action card, Gremio, plugin banner states in-sync/behind/unknown, command
copy buttons); the cross-surface AC-06-019.7 test; the e2e spec above. No whole-component snapshots.

## Derogated tests (BL-0051)

- Implementer-authored, deleted or rewritten here: the v1 dashboard tests under `src/app/_tests/`
  (`page.dashboard`, `wo-18-001-fixes`, `wo-18-001-inicio-dashboard`), `src/app/_lib/_tests/*`,
  `src/app/(dashboard)/_lib/_tests/*`, `src/components/modules/Digest/_tests/*`, and the `TuTurno`, `Cartera`,
  `Progreso` and `Pulso` component tests.
- Reviewer-authored, not edited here (DR-080): `src/app/(dashboard)/_tests/frd-18-integration.reviewer.test.tsx`
  and `src/app/_components/plugin-sync-banner/_tests/plugin-sync-banner.reviewer.test.tsx` assert the v1 page and
  banner DOM; both are derogated and re-blessed or rewritten by the FRD-18 and FRD-15 gate reviewers.
- Visual baselines of `/` are derogated by WO-19-002 and again here; implementers never touch
  `e2e/visual.spec.ts-snapshots/**` (the reviewer re-blesses at the close-out).

## Dependencies

WO-21-003 (worktrees card), WO-03-007 (`ProjectCard`, project list), WO-04-013 (`resolvedInFile`), WO-06-013
(freshness voice), WO-13-012 (composite primitives), WO-19-002 (the shell; it also writes `src/lib/constants.ts`,
so this work order's constant removals run after it), WO-25-001 (URL codec). Consumers: WO-19-003 (reads
`ownerTurnItems().count` and `lastAchievement()`), WO-13-013.

## Status Note

