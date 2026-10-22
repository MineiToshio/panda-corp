---
id: BP-18
type: blueprint
slug: dashboard
title: Inicio (the command center)
status: DRAFT
parent: FRD-18
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: '2026-10-22'
---

# Blueprint — FRD-18 Dashboard ("Inicio", the command center)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049) on top of [`docs/product/architecture.md`](../../product/architecture.md)
> (§6 `inicio/` module, §7 read-only invariant and fixture seams, §11 mapping, route map row `/`). It does not
> restate the platform. v2 revision of the v1 blueprint: the six stacked sections (health banners, digest, Tu
> turno, Pulso, Cartera, Tu progreso) become the drawn two-column composition; the digest and `visto_hasta` are
> gone; everything that still describes live code (a composition layer over existing readers, no new factory
> data, no write, event-driven refresh) is kept.

## Purpose

Inicio answers "what needs me now, what is the factory already doing, and where do my projects stand". It is a
composition layer: it adds one new resolver module (`src/lib/inicio/`) for the facts no other surface owns
(the owner's turn, the in-flight groups, the idea funnel, the pulse tiles, the last achievement) and otherwise
renders other features' resolvers: the project cards (FRD-03), the guild state (FRD-09), the worktrees card
(FRD-21), the plugin verdict (FRD-15) and the freshness voice (FRD-06). One work order builds it (WO-18-002),
late (W5), because it joins everything.

## Components & Interfaces

| ID | Kind | Responsibility | Location | REQ |
|---|---|---|---|---|
| `IF-18-turn` | interface | `ownerTurnItems(): { items; count }`, request-cached, the single resolver of "what waits on the owner on Inicio" and of its count (the sidebar Inicio count and the "Tu turno N" pill both read it, DR-115). Items: pending decisions of every portfolio project first (a decision whose own file says RESUELTO or OBSOLETO is excluded: `DecisionPoint.resolvedInFile`, WO-04-013), then changes with status `ready`; each item carries `kind`, `id`, title, project name and slug, age (`ageDays` of the decision date, or the request date of the change), the scoped command (`/pandacorp:decide <id>` or `/pandacorp:implement change:<id>`), where it runs, and the detail payload of the dialog. Running builds, auto-retried work orders and `advance_pending` are never items (REQ-18-011). Decision entries that are engine-log lines (`isEngineLogEntry`, exported by WO-04-013) are excluded too. An optional `{ project }` argument narrows it to one project, so the workspace Resumen's own "Tu turno" (WO-04-011, DR-057, DR-115) reads the same resolver; `AskRow` stays exported from the `TuTurno` folder for that second route. Dates ("hace N días", "pedido el …") use the shared Spanish date formatters of `src/lib/copy/` (WO-13-010). | `src/lib/inicio/turn.ts` (new) | REQ-18-010, REQ-18-011, REQ-18-012 |
| `IF-18-flight` | interface | `inFlightGroups(): FlightGroup[]` (building, review, draft): changes with status `building`; work orders in `review`; one row per project that has drafts ("N cambios en borrador"). A group with no row is absent; no row at all means the card is not drawn. Never asks the owner for anything. | `src/lib/inicio/flight.ts` (new) | AC-18-022.3 |
| `IF-18-funnel` | interface | `ideaFunnel(): { rows; discarded }`: active ideas per pipeline phase through the board's own derivation (`lib/board` `deriveColumn`), the Lanzamiento row from `countLaunched` (the one bridge resolver, REQ-18-014), discarded ideas counted apart. | `src/lib/inicio/funnel.ts` (new) | REQ-18-013, REQ-18-014, AC-18-022.4 |
| `IF-18-pulse` | interface | `pulseTiles(cards): Tile[]`: Proyectos, FRDs and work orders verificadas "de N", totals taken from the same project-card list the Cartera renders (no second derivation); at most `PULSE_MAX_SIGNALS = 5` tiles (AC-12-001.3), three today. | `src/lib/inicio/pulse.ts` (new; replaces `src/app/_lib/pulse.ts`) | REQ-18-013, AC-12-001.3 |
| `IF-18-achievement` | interface | `lastAchievement(): { title; unlockedAt; fresh } or null`: the newest unlocked unique achievement; `fresh` is the FRD-09 rule (flagged new or unlocked within 7 days, AC-09-008.2). The guild level, XP and rank come from `getGuildState()`, the one guild source, never recomputed here. | `src/lib/inicio/achievement.ts` (new) | Gremio bullet |
| `IF-18-decision-detail` | interface | Additive fields `ask` and `context` on `DecisionPoint` (the first paragraph of the block's "Qué necesito de ti" or "Qué decidir" field and its "Contexto" field), so the Tu turno dialog shows "Lo que se necesita de ti" and "Contexto" from the decision file, not from invented text. Ids and the existing fields are unchanged (FRD-24 golden vectors stay byte-identical). | `src/lib/docs/activity.ts` (additive, W5) | AC-18-022.2 |
| `CMP-18-page` | component | `HomePage`: Server Component. `PageHead` (h1 "Inicio"), the plugin `AlertBanner` first when behind, then the `home-grid`: left column Tu turno, Tu cartera, En marcha; right column Pulso, Gremio, Embudo de ideas, Árboles de trabajo; one column below 1024 px with Tu turno first. Each independently slow block sits in its own `Suspense`. | `src/app/page.tsx` | REQ-18-001, REQ-18-002, AC-18-022.1 |
| `CMP-18-banner` | component | `PluginSyncBanner`: client component that reads `/api/plugin-sync`, renders the shared `AlertBanner` ("El plugin instalado está atrás", both versions, the two steps, `claude plugin update pandacorp@panda-corp` in a `CommandBox`) only when the installed version is strictly behind, and clears itself on the next poll. Unknown or in-sync renders nothing. | `src/app/_components/plugin-sync-banner/` (restyled in place) | REQ-15-002, REQ-15-004, REQ-15-005 |
| `CMP-18-turn` | component | `TuTurno` card (`CardHeader` with the amber icon tile and the count pill, or the green "Al día" chip), the `AskRow` list and the calm `EmptyState` "Nada espera tu acción ahora mismo."; `TurnDetailDialog` for "Detalles". `AskRow` (components.md path `src/app/(dashboard)/_components/AskRow.tsx`) is relocated into this folder, next to the card that owns its rows and its dialog (a relocation components.md allows; the name does not change). | `src/components/dashboard/TuTurno/` | REQ-18-003, REQ-18-010, REQ-18-012, AC-18-022.2 |
| `CMP-18-cartera` | component | `Cartera`: the `SectionHeading` "Tu cartera" with its link "Ver portafolio", one `ProjectCard` (compact, WO-03-007) per project in the portfolio's last-commit order, or the first-action card ("Tu fábrica todavía no tiene proyectos" with `/pandacorp:new-idea` and `/pandacorp:spec <idea>`) when there are no projects. | `src/components/dashboard/Cartera/` | REQ-18-016, REQ-18-021 |
| `CMP-18-flight` | component | `EnMarchaCard` with its collapsible `FlightGroup`s (native `details`, closed at rest, title, hint, count) and the `TurnRow` rows; route-local pieces at the components.md paths. | `src/app/(dashboard)/_components/` (`EnMarchaCard`, `FlightGroup`, `TurnRow`) | AC-18-022.3 |
| `CMP-18-pulso` | component | `Pulso` (components.md `KpiTiles`): the tiles of `IF-18-pulse` with display numbers. | `src/components/modules/Pulso/` (restyled in place) | AC-18-022.4 |
| `CMP-18-embudo` | component | `EmbudoCard` with a `FunnelRow` per phase and the foot "N descartadas" plus the link "Abrir tablero". | `src/app/(dashboard)/_components/` (`EmbudoCard`, `FunnelRow`) | AC-18-022.4 |
| `CMP-18-gremio` | component | `Progreso` becomes the Gremio card: crest (`public/ranks/`), rank name, "Nivel N · XP", the gold bar, "X XP para el nivel N+1 · T trofeos", `LastAchievement` (with the "Nuevo" chip when fresh, drawn in FRD-03's captured states) and the link "Ver logros". No streaks, no urgency. | `src/components/dashboard/Progreso/` + `LastAchievement` in `src/app/(dashboard)/_components/` | Gremio bullet |
| `CMP-18-live` | component | `DashboardLiveWatcher` (kept): subscribes to `useLiveSnapshot` and calls `router.refresh()` when a new event arrives and when the frame's `stateVersion` moves (the same `state-version-moved` rule WO live refresh uses; AC-06-019.7 last sentence). It owns no transport and polls nothing. | `src/components/dashboard/DashboardLiveWatcher/` | REQ-18-004 |
| `CMP-18-worktrees` | component | The hosted FRD-21 mount `FactoryWorktrees` ("Árboles de trabajo"); placed last in the right column. FRD-21 owns it. | `src/components/dashboard/FactoryWorktrees/` (WO-21-003) | AC-18-022.1 |

Reuse (components.md, in order): `PageHead`, `AlertBanner`, `Card`/`CardHeader`, `AskRow`, `CommandBox`/
`CommandCompact`, `Dialog`, `ProjectCard` (compact) with `PhaseStepper` and `Ring`, `Chip` family,
`EmptyState`/`Notice`, `KpiTiles`, `FunnelRow`, `FlightGroup`, `LastAchievement`, `Icon`. Nothing is created
beyond the rows the inventory lists.

## Contracts

**Page data flow.** The page calls the resolvers once per request (`React.cache` inside each), in parallel
(`Promise.all`), and passes plain data down: `ownerTurnItems()`, `inFlightGroups()`, the project-card list of
WO-03-007, `ideaFunnel()`, `pulseTiles()`, `getGuildState()` and `lastAchievement()`. Components never read
`fs`, git or events directly (structure guard). Every "now" comes from `now()` and every git read from
`runGit` (WO-01-010) through the resolvers, so oracle mode freezes ages ("hace 6 días") and last-change times.

**Tu turno item (`IF-18-turn`).** Success: ordered `items` (decisions first, then ready changes, each kind in
project order then file order) and `count = items.length`, which also feeds the sidebar's Inicio count
(WO-19-003). Errors: an unreadable decisions file or change queue for one project is reported through the
reader's own fail-loud result (DR-078) and surfaces as a `Notice` row naming the project, never as a silent
"Al día"; the other projects still list. Invariants: an item exists only if it needs the owner (REQ-18-010);
`count` equals the rows shown; the dialog text of a decision is the decision file's text, in its source
language.

**Dialog (`AC-18-022.2`).** Decision: kicker "Decisión · <project>", the sentence of `dialogs.turnDecision.intro`,
chips (age, decision id), "Lo que se necesita de ti", "Recomendación del agente", the collapsed "Contexto", the
drawn run sentence `dialogs.turnDecision.runStale` when the decision is 7 days old or more, and the command.
A younger decision shows the command without a run sentence: the fresh-decision variant sits in
the catalogue, but no captured state of this FRD draws it (`home-turn-dialog` shows a decision 7 days old or
more), so it is not built (DR-130; reconciliation 2026-10-22).
Change: kicker "Cambio en cola · <project>", the change body, `dialogs.turnChange.*` and the command. Native
dialog: focus in, Tab trapped, Escape closes, focus returns to "Detalles: <title>".

**Freshness voice (AC-06-019.7).** A running build whose freshest signal is older than the freshness TTL shows
"Sin señal · último evento hace N" on the card instead of "Construyendo". The verdict is computed once by the
resolver FRD-06 owns, `buildSignal()` (`src/lib/fragua/build-signal.ts`, WO-06-013, rendered by the restyled
`FreshnessBadge`); the card (WO-03-007's `ProjectCard`), the workspace hero and the scene read it;
this work order owns the AC because it is the first wave where the scene, this card and the Portafolio card
all exist, and proves it with one cross-surface test over a stale-signal fixture.

**URL.** Inicio has no URL state of its own. The pill link `#worktrees-card` (FRD-21) and the card links go
through the FRD-25 codec; the "Detalles" dialog is ephemeral (a confirmation-like read, not a shareable
selection).

## Removals (v1 things the frozen design dropped; map §6.C item 11)

WO-18-002 deletes, with their tests, in the same work order: the digest "Desde tu última visita" (`Digest`
module, `src/app/_lib/digest.ts`, the `visto_hasta` marker and its local-storage keys), the v1 `Cartera` card
facts that the design dropped (version, age-in-stage, "estancado", "N bugs", the inline blocker reason and the
"estable · en operación" presentation: `src/app/(dashboard)/_lib/card.ts` and its test), the v1 turn builder
`buildTurnQueue` with its extra gate kinds (shipped awaiting review, memory nudge, undiscovered ideas: these
live in Propuestas, REQ-18-010), `src/app/_lib/pulse.ts` (moved to `IF-18-pulse`), the page-level
`OnboardingGate` branch (unreachable: the root layout guard already replaces the page while
`factory/profile.md` is absent), and the two dead memory-nudge constants `MEMORY_RAW_NOTES_THRESHOLD` and `MEMORY_STALE_DAYS_THRESHOLD` in
`src/lib/constants.ts` (their last importers go with the page; the `MemoryHealth` panel went with WO-17-008). Knip does not catch a tested-but-unmounted leftover, so the work
order's removal checklist is explicit and the reviewer ticks it.

## Traceability

| REQ | Satisfied by | Work order |
|---|---|---|
| REQ-18-001 Default landing, other destinations reachable | `CMP-18-page`; the shell (FRD-19) | WO-18-002 |
| REQ-18-002 Read-only, exact command with copy, click navigates | `CMP-18-turn`, `CMP-18-cartera` (`CommandBox`, linked cards) | WO-18-002 |
| REQ-18-003 Quiet when healthy | `CMP-18-turn` (calm state, "Al día") | WO-18-002 |
| REQ-18-004 Live | `CMP-18-live` | WO-18-002 |
| REQ-18-005 to REQ-18-009 Digest | removed in v2 (Out of v2); verified by the removal list | WO-18-002 |
| REQ-18-010 to REQ-18-012 Tu turno | `IF-18-turn`, `CMP-18-turn` | WO-18-002 (AC-18-022.2) |
| REQ-18-013 Pulso and Embudo, at most five signals | `IF-18-pulse`, `IF-18-funnel`, `CMP-18-pulso`, `CMP-18-embudo` | WO-18-002 (AC-18-022.4, AC-12-001.3) |
| REQ-18-014 Launched count from the one resolver | `IF-18-funnel` (`countLaunched`) | WO-18-002 |
| REQ-18-015 Stale build reads "Sin señal" | freshness resolver (FRD-06), `ProjectCard` chip | WO-18-002 (AC-06-019.7, AC-12-001.2) |
| REQ-18-016, REQ-18-017 Card content, "Sin señal" chip | `ProjectCard` compact (WO-03-007), `CMP-18-cartera` | WO-18-002 |
| REQ-18-018 to REQ-18-020 Stalled, bugs, blocker | removed in v2 (Out of v2) | WO-18-002 |
| REQ-18-021 Next command by phase | `ProjectCard` (`lib/next-step`) | WO-18-002 |
| First-action card | `CMP-18-cartera` | WO-18-002 |
| Gremio card | `CMP-18-gremio`, `IF-18-achievement` | WO-18-002 |
| REQ-18-022 Layout, Tu turno detail, En marcha, Pulso and Embudo | `CMP-18-page`, `CMP-18-turn`, `CMP-18-flight`, `CMP-18-pulso`, `CMP-18-embudo` | WO-18-002 (AC-18-022.1 to AC-18-022.4) |
| REQ-15-002, REQ-15-004 (FRD-15 banner) | `CMP-18-banner` | WO-18-002 (AC-15-002.1 to AC-15-002.3, AC-15-004.1) |
| REQ-15-006 (FRD-15 pill) | `CMP-15-pill` (defined in the FRD-15 blueprint, hosted in the sidebar) | WO-19-003 |
| FRD-12 Pulso limit and freshness declaration | `IF-18-pulse`, freshness resolver | WO-18-002 (AC-12-001.2, AC-12-001.3) |

## Visual spec (WO-18-002; binding, DR-054)

FDD: [`fdd.md`](fdd.md). Mock: `mocks/dashboard.html`; screenshots in `mocks/screenshots/`. Oracle states of this
FRD's gate (`oracle-states.json`, recipes in `oracle-recipes.md`): `home`, `home-turn-dialog`,
`home-in-flight-open`, `home-calm` (fixture overlay: the only pending decision marked RESUELTO),
`factory-empty` (fixture overlay: no ideas, no projects), `build-no-signal` (the build claims to run with no
fresh signal); plus `plugin-banner` of FRD-15 (`mocks/plugin-out-of-sync-warning.html` in the FRD-15 folder).
Assets: the rank crest PNG from `public/ranks/` (original bytes, `image-rendering: pixelated`), icons through
`Icon`; no other image.

## Dependencies & Risks

- Upstream, all earlier waves: WO-21-003 (the worktrees card and reader), WO-03-007 (`ProjectCard` and the
  project-card list), WO-04-013 (`resolvedInFile`), WO-06-013 (the freshness voice), WO-13-012 (composite
  primitives), WO-19-002 (the shell; co-writer of `src/lib/constants.ts`), WO-25-001 (URL codec). Legacy readers it composes stay as they are: `lib/ideas`, `lib/board`,
  `lib/changes`, `lib/work-orders`, `lib/gamification`, `lib/achievements`, `lib/plugin-sync`.
- Consumers: WO-19-003 reads `ownerTurnItems().count` and `lastAchievement().fresh` (one predicate for the
  «Nuevo» chip and the `CMP-09-achievement-notice` of the FRD-09 blueprint), WO-04-011 reads
  `ownerTurnItems({ project })` and `AskRow`, WO-10-017 imports `FunnelRow` (kept at its components.md path,
  props `phase`, `count`, `max`), WO-13-013 deletes whatever v1 name stays unreferenced.
- **Reconciliation (2026-10-22, binding).** Tu cartera reads `getProjectOverview()` (WO-03-007) including
  `nextCommand` and reuses `FirstProjectCard`; the Árboles card anchor `id="worktrees-card"` belongs to
  WO-21-003's card; the page renders no `<main>`; the fresh-decision run sentence is not built (no captured
  state draws it; see Dialog above).
- Risk: the heaviest dependency surface of the app. Mitigation: one new lib module, every other fact read from
  its owner; the cross-surface test for AC-06-019.7 and the oracle-mode states catch drift early.
- Risk: the page is slow when it reads every portfolio project. Mitigation: parallel reads, request cache, a
  `Suspense` per block, bounded `runGit` calls (WO-01-010).

Lessons applied: LESSON-0077 (the count of the owner's turn, the launched-ideas count and the guild level are each
derived by one resolver that every surface reads), LESSON-0484 (the two columns end near the same height, red/amber/
green only for status), LESSON-0185 (the Inicio behaviour spec avoids `networkidle`, which the open live stream
would never reach; it uses `gotoHydrated` and web-first assertions).

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-18-002 | WO-21-003, WO-03-007, WO-04-013, WO-06-013, WO-13-012, WO-19-002, WO-25-001 | `src/app/page.tsx`, `src/app/(dashboard)/**`, `src/components/dashboard/{TuTurno,Progreso,Cartera,DashboardLiveWatcher}/**`, `src/components/modules/{Pulso,Digest}/**`, `src/app/_lib/**`, `src/app/_components/plugin-sync-banner/**`, `src/lib/inicio/**`, `src/lib/docs/activity.ts`, `src/lib/docs/_tests/activity.turn-detail.test.ts`, `src/lib/constants.ts`, `src/app/_tests/{page.dashboard,wo-18-001-fixes,wo-18-001-inicio-dashboard}.test.tsx`, `e2e/inicio.spec.ts` | false | W5; WO-04-010, WO-01-011 (other FRDs) |

- **Order and integration.** A single, terminal work order of the surface; it must run after the worktrees card
  (W3) and the Portafolio card (W4) exist. WO-19-003 (W6) then reads its published resolvers; WO-04-011 (W6)
  does not depend on it.
- **Disjointness.** `src/app/page.tsx` was written by WO-21-003 in W3 (an earlier wave). `src/lib/docs/activity.ts`
  was written by WO-04-013 in W3. `src/lib/constants.ts` is also written by WO-19-002 (W3); the `dependsOn`
  edge to WO-19-002 orders the two writers (a wave label alone is not an ordering guarantee). In W5 the other writers
  are WO-04-010 (`src/app/projects/[slug]/**`) and WO-01-011 (kept readers), both disjoint.
- **No backend contract file.** `/api/live` and `/api/plugin-sync` keep their contracts; nothing is added, so no
  `docs/api/<wo-id>.md` (DR-060).

## Work Orders

1. WO-18-002 `inicio-orbita` (high, W5): the whole Inicio surface, its resolvers and its removals.

## Superseded (v1 history)

- WO-18-001 `inicio-dashboard` (superseded by WO-18-002): the six-section real-time dashboard with the digest.

## Readiness check (DR-100)

Every explicit `REQ-18-001..022` maps to a component or interface above (the digest and the three card flags as
removals); every live AC of FRD-18 and the cross-FRD ACs assigned by the plan (AC-15-002.1 to AC-15-002.3,
AC-15-004.1, AC-06-019.7, AC-12-001.2, AC-12-001.3) is owned by WO-18-002 only; `dependsOn` is acyclic and all
named work orders exist; the foundation it needs is FRD-13's; no unresolved question survives in this
feature's documents.
