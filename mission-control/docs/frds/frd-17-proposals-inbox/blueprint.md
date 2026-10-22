---
id: BP-17
type: blueprint
slug: proposals-inbox
title: Proposals inbox (Propuestas - to-do, memory, automatic signals)
status: DRAFT
parent: FRD-17
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: '2026-10-22'
---

# Blueprint — FRD-17 Proposals inbox (self-learning gate + self-suggestion)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049) on top of [`docs/product/architecture.md`](../../product/architecture.md)
> (§6 `memory/`, `self-suggest/`, `proposals/`, §7 read-only invariant, §11 mapping, route map rows
> `/proposals`, `/proposals/:tab`, `/proposals/memory/:stream/:lesson`). It does not restate the platform.
> v2 revision: the v1 blueprint described four dismissable proposal streams, a memory-health panel with
> nudges and a top-bar badge and rail chip. The frozen design replaced them with an ordered to-do (Resumen),
> a lesson-flow Memoria tab and a sidebar count; dismissal, stream explainers, the staleness nudge, the
> harvest-orphans banner, rejection and the rail chip are out of v2. What still describes live code (the
> `memory` and `self-suggest` readers, the read-only rule, the lesson detail) is kept.

## Purpose

The owner-facing surface of the factory's self-learning loop (DR-047) and the place where Mission Control
suggests improvements on its own, read-only: it shows what needs a decision, the exact command and where to
run it, and never harvests, promotes, prunes or runs a skill. Propuestas opens on Resumen ("Qué te toca, en
orden": only the actions that need the owner, in order), keeps Memoria (how a lesson advances, the lessons
waiting for the owner, the collapsed candidates, "Para podar" only when something is prunable) and hosts
FRD-22's Backlog tab. One new resolver, `ownerActions()`, produces the ordered actions and the navigation
badge count, so the page and the sidebar never disagree.

## Components & Interfaces

| ID | Kind | Responsibility | Location | REQ |
|---|---|---|---|---|
| `IF-17-memory` | interface | `readLessons()`, `candidateLessons()`, `promotionQueue()`, `prunable()`, `memoryHealth()` (kept): typed lessons (`id`, `type`, `domain`, `status`, `promotion`, `source`, `links`, `projects`, `evalGate`, `body`, `context`, loop-v2 `trigger` and `appliedIn`, all fail-soft per lesson), and the health facts (`rawNotes`, `candidates`, `lastMemoryRunAt`, `staleDays`, `lastSweepAt`, `harvestOrphans`). `harvestOrphans` and `trigger` stay in the reader because the FRD still requires them to be reported; v2 renders neither. | `src/lib/memory/` (exists; WO-17-001/005 history, edited by WO-17-008 only if a v2 AC needs it) | REQ-17-009 |
| `IF-17-suggest` | interface | `computeSuggestions(input)` and `gatherSuggestionsInput()` (kept): the six local, no-Claude derivations (`bottleneck`, `velocity`, `unused-capability`, `policy-friction`, `recurring-lesson`, `launch-review`), capped event tail. `unused-capability` fires only for invocable skills. | `src/lib/self-suggest/` (exists; WO-17-003) | REQ-17-011 |
| `IF-17-data` | interface | `loadProposalsData()`: one request-cached bundle of the raw reads (lessons, health, suggestions, backlog result, discovered-ideas count from the board derivation, skill count). The page, `ownerActions()` and the segment validation all derive from it, so nothing is read twice (DR-115). | `src/lib/proposals/data.ts` (new) | REQ-17-011 |
| `IF-17-actions` | interface | `ownerActions(): { actions; badgeCount; upkeep; facts }`, request-cached. `actions` are only those that need the owner, in this order: `urgent` (P0 backlog items still open; command `/pandacorp:implement-backlog <first P0 id>`), `decide` (lessons waiting for a yes or no: the promotion queue plus the "seen in 2 projects" signals, counted once per lesson id; command `/pandacorp:learn <first lesson id>`), `important` (P1 open items; command with the first P1 id), `ideas` (ideas in the first board column; `/pandacorp:recommend`), `memoryStale` (only when the daily routine has not run for more than `MEMORY_UNREVIEWED_DAYS`; `/pandacorp:memory harvest`). `badgeCount = actions.length` (the sidebar count: AC-17-011.2). `upkeep` is `current` with the last review date ("La memoria se revisa sola") or `stale` with the days. `facts` carries the numbers the cards and tiles show (active rules, waiting lessons, candidates, backlog P0/P1/P2, in progress, actionable) so each is derived once. An action with count zero is absent; with no actions the card reads "Nada necesita tu decisión ahora.". | `src/lib/proposals/ownerActions.ts` (new) | REQ-17-011 |
| `IF-17-signals` | interface | `groupSignals(suggestions, skillCount)`: pure grouping of the automatic signals by kind (board columns, lessons seen in 2 projects, skills without recorded use, others) with `unreliable: true` on a group that flags most of its population (the unused-skills group at or above `UNRELIABLE_SIGNAL_RATIO`, 0.6, of the invocable skills). | `src/lib/proposals/signals.ts` (new) | REQ-17-011 |
| `CMP-17-page` | component | `ProposalsPage` (Server Component): `PageHead` (h1 "Propuestas", the catalogue subtitle), then `ProposalsTabs` with three server-rendered panels as slots. | `src/app/proposals/page.tsx` | REQ-17-011 |
| `CMP-17-routes` | component | `[...segments]/page.tsx`: validates `/proposals/<tab>[/<stream>/<lesson>]` (tab: resumen, memory or backlog) and `/proposals/backlog/<item>` against `IF-17-data`; an unknown tab, stream, lesson or item is a bounded not-found, never another item; renders the same page with the codec state seeded. Streams: `promotions`, `candidate-lesson`, `prune`. | `src/app/proposals/[...segments]/page.tsx` | REQ-17-011, FRD-25 |
| `CMP-17-tabs` | component | `ProposalsTabs` (client): the shared `Tabs` (Resumen, Memoria with the waiting-lessons count, Backlog with the actionable count when greater than zero), tab selection in the URL (`proposalsTab`), all three panels mounted and toggled with `hidden`, each carrying `data-volatile` (DR-088), so tab-local state (Backlog filters, opened card, history paging) survives a tab switch. Keeps the `data-testid`s `proposals-tab-resumen`, `proposals-tab-memoria`, `proposals-tab-backlog` (the persistent-navigation spec asserts them). | `src/app/proposals/_components/ProposalsTabs/` | REQ-17-011; FRD-22 REQ-22-002 |
| `CMP-17-summary` | component | `ProposalsSummary`: the Resumen panel: the "Qué te toca, en orden" card (`Card` + the count pill "N para ti" + the ordered `ProposalActionRow` list + the calm "La memoria se revisa sola." strip), the two cards side by side (Memoria de la fábrica, Backlog de la fábrica) ending at the same height, and the "Señales automáticas" card. | `src/app/proposals/_components/ProposalsSummary/` | REQ-17-011 |
| `CMP-17-actionrow` | component | `ProposalActionRow({ action })`: number, kind label with icon (not colour alone), bold title, reason, `CommandBox`, "Córrelo <where>", and the link button (codec URL). | `src/app/proposals/_components/ProposalActionRow/` | AC-17-011.1 |
| `CMP-17-signals` | component | `SignalGroup({ kind, items, unreliable })`: native expander with icon, title, count pill; the unreliable group opens with "Señal poco fiable:" and asks for no action; `recurring-lesson` items carry their own `/pandacorp:learn <id>` command with copy; signals are not clickable (no markdown body). | `src/app/proposals/_components/SignalGroup/` | AC-17-011.3 |
| `CMP-17-flow` | component | `LessonFlow`: the four tiles joined by arrows that say who moves each step (notas sin refinar → rutina diaria → candidatas → 2+ proyectos → esperan tu decisión → tú decides → reglas activas), the "Última revisión automática: <fecha>" line (" · al día" or "hace N días") and the prune sentence ("Ninguna lección obsoleta." or the count). Stacks vertically with downward arrows on phones. | `src/app/proposals/_components/LessonFlow/` | AC-17-011.4 |
| `CMP-17-stream` | component | `ProposalStream`: one lesson list card used for "Candidatas" (collapsed native expander, right-hand "No piden nada", intro, no command) and "Para podar" (drawn only when something is prunable, with the group command `/pandacorp:memory review` shown once under the title); rows are `LessonRow` buttons; paged by the shared `MoreBar` (candidates 10). Replaces the v1 `DismissableProposalStream`. | `src/app/proposals/_components/ProposalStream/` | AC-17-001.1, AC-17-001.3, AC-17-010.1 to AC-17-010.4 |
| `CMP-17-promoqueue` | component | `PromotionsQueue` (module, emits `onSelectLesson` only) renders the "Esperan tu decisión" card (intro, `LessonRow`s paged 8 at a time, then "Recién detectadas en 2 proyectos" rows with the "Nueva" chip and each one's own command); `PromotionsQueuePanel` (route-local) holds the dialog state. `LessonRow` (`ListRow` pattern: tinted icon tile, lesson `context` as title in its source language, "LESSON-NNNN · domain · projects", type chip) is shared by the queue and the stream. | `src/components/modules/PromotionsQueue/`, `src/app/proposals/_components/PromotionsQueuePanel/` | AC-17-001.2, AC-17-001.3, AC-17-011.4 |
| `CMP-17-lesson` | component | `LessonDetail` / `LessonDetailModal`: native dialog with the tinted head (kicker "Lección · <type>", title = the lesson id, close), chips (type, domain, "Promoción: <estado>", "Corroborada"), the bold `context` sentence, the `SectionedMarkdown` body (source language), "Aplicada en: <projects>" when `appliedIn` is not empty, and, only for a promotion `proposed`, "Promoverla a estándar, regla o skill:" with the `/pandacorp:learn <id>` `CommandBox`. Opened and closed through the codec keys `stream` and `lesson`. | `src/app/proposals/_components/LessonDetail.tsx`, `LessonDetailModal.tsx` | AC-17-011.4, REQ-17-009 |
| `CMP-17-backlog` | component | The Backlog panel is FRD-22's `BacklogPanel` (WO-22-002), mounted by `CMP-17-tabs`. | `src/app/proposals/_components/BacklogPanel/` (WO-22-002) | FRD-22 |

Reuse (components.md, in order): `PageHead`, `Tabs`, `Card`/`CardHeader`, `CommandBox`/`CommandCompact`, `Chip`
family and `CountPill`, `ListRow`, `MoreBar`, `Dialog`, `EmptyState`/`Notice`, `SectionedMarkdown` (carried
over), `Icon`. The Resumen action blocks, the flow tiles and the signal groups are the inventory's
`ProposalActionRow`, `LessonFlow` and `SignalGroup`; no other component is created.

## Contracts

**`ownerActions()`.** Inputs: none (reads through `IF-17-data`). Success: the object above. Invariants: every
count derives from the same read as the list it summarizes; `badgeCount` equals the number of
`ProposalActionRow`s on Resumen (worked example of AC-17-011.2: 42 signals, 16 promotions and 24 candidates
group into 4 actions, so the badge reads 4); the "decide" count equals the Memoria tab badge, the flow tile and
the pill of "Esperan tu decisión". Errors: an unreadable backlog directory or memory store is the reader's own
fail-loud result and renders the designed error `Notice` on the affected card, never a count of zero that reads
as "all clear"; the other cards still render.

**Paging (`MoreBar`).** Candidatas 10, Esperan tu decisión 8; "Señales automáticas" shows all. Each press reveals
the next `2 x pageSize` cards of the already-loaded list, in place, with no fetch, and the bar reads "Mostrar N
más · quedan M" (N the cards it reveals, M the cards hidden before the press; the captured "Mostrar 14 más ·
quedan 14" follows from 24 candidates and a page of 10). There is no collapse back. A list not longer than its
page shows no bar. One shared component serves every stream kind (AC-17-010.4).

**URL (FRD-25).** `/proposals/<tab>` with `tab` in `resumen`, `memory`, `backlog`; `/proposals/memory/<stream>/<lesson>`
opens the lesson dialog; `/proposals/backlog/<item>` opens FRD-22's item dialog. Search typing replaces history;
no URL write runs a mutation. Escape or "Cerrar" removes the keys and returns focus to the row.

**Honesty (White-Hat, FRD-09).** No streaks, no false urgency, no nagging; high-risk proposals are displayed with
their command only (DR-047). Item sentences of the automatic signals are produced by the kept reader, in
Spanish; every label Mission Control itself writes comes from `propuestas.*` and `dialogs.lesson.*` through `t()`.

## Removals (v1 things the frozen design dropped; map §6.C item 19)

WO-17-008 deletes, in the same work order and with their tests: the per-card dismiss affordance and the
remembered dismissal (`src/components/modules/ProposalsDismiss/**`, its local-storage keys); the per-stream
explainers; the stale-memory nudge and the harvest-orphans banner with the whole `MemoryHealth` panel
(`src/components/modules/MemoryHealth/**`, replaced by `LessonFlow`); the reject affordance of the promotions
queue; the "Úsala cuando" trigger row of the lesson detail; the "Crónica del gremio" alias in the page
metadata; the "ver más / ver menos" toggle and the whole `DismissableProposalStream`; the v1 `ProposalCard`
(its roles split between `ProposalActionRow` and `LessonRow`); `src/app/proposals/_components/streamMeta.ts`;
`countOpenProposals` in `src/lib/proposals/proposals.ts` (the top-bar badge it served is removed by WO-19-002,
the rail chip by WO-03-007, the sidebar count is `ownerActions().badgeCount`).

## Traceability

| REQ or FRD bullet | Satisfied by | Work order |
|---|---|---|
| REQ-17-001 Group-level command and lesson grouping | `CMP-17-stream`, `CMP-17-promoqueue`, `CMP-17-flow` | WO-17-008 (AC-17-001.1 to AC-17-001.3) |
| REQ-17-009 Loop v2 fields and signals (reader fields, "Aplicada en") | `IF-17-memory`, `CMP-17-lesson` | WO-17-005 (history), WO-17-008 (detail row) |
| REQ-17-010 "Mostrar más" paging | `MoreBar` in `CMP-17-stream`, `CMP-17-promoqueue` | WO-17-008 (AC-17-010.1 to AC-17-010.4) |
| REQ-17-011 Resumen to-do, badge, signals, lesson flow | `IF-17-actions`, `IF-17-signals`, `CMP-17-summary`, `CMP-17-actionrow`, `CMP-17-signals`, `CMP-17-flow` | WO-17-008 (AC-17-011.1 to AC-17-011.4) |
| Sidebar destination with the action count | `IF-17-actions` (`badgeCount`) consumed by the sidebar | WO-19-003 mounts it; the number is WO-17-008 (AC-17-011.2) |
| Four proposal kinds aggregated (candidates, promotions, prune, signals) | `IF-17-memory`, `IF-17-suggest`, `CMP-17-stream`, `CMP-17-promoqueue`, `CMP-17-signals` | WO-17-001, WO-17-003 (readers, history), WO-17-008 (surface) |
| Evidence, suggested action and exact command per proposal; Mission Control never runs it | `CommandBox` in `CMP-17-actionrow`, `CMP-17-signals`, `CMP-17-lesson` | WO-17-008 |
| Local self-suggestions, no Claude | `IF-17-suggest` | WO-17-003 (history) |
| Memory-health facts and the daily-routine line | `IF-17-memory` (`memoryHealth`), `CMP-17-flow` | WO-17-005 (reader, history), WO-17-008 (display) |
| Promotions queue is durable and read-only | `CMP-17-promoqueue`, `CMP-17-lesson` | WO-17-008 |
| Candidates visually distinct, eval gate shown | `CMP-17-stream` (collapsed card, chips), `CMP-17-lesson` ("Corroborada") | WO-17-008 |
| Honest, high-risk display-only | whole surface (no write path in `lib/memory` or `lib/self-suggest`) | WO-17-008 |
| Out of v2: dismiss, explainers, staleness nudge, orphans banner, reject, "Úsala cuando", rail chip, "Crónica del gremio" | the Removals list above | WO-17-008 (rail chip: WO-03-007; top-bar badge: WO-19-002) |

## Visual spec (WO-17-008; binding, DR-054)

FDD: [`fdd.md`](fdd.md). Mock: `mocks/proposals-inbox.html`; screenshots in `mocks/screenshots/` (375/768/1280,
light and dark; the dialog at 375 and 1280). Oracle states of this FRD's gate (`oracle-states.json`):
`proposals-summary`, `proposals-memory` (Candidatas opened, long list) and `proposals-lesson-dialog` (reached by
clicking the first lesson row of Memoria), plus the scenario states `proposals-memory-prune` («Para podar»
present) and `proposals-calm` (no action: «Nada necesita tu decisión ahora.»), reproduced from their
`oracle-recipes.json` doubles. Assets: icons through `Icon` only. The Backlog tab's states belong
to FRD-22. Keep the recorded hooks (`.pa-row`, `.pa-n`, `.lf`, `.lf-step`, `.sig-group`, `.lrow` with
`data-lesson`, `.morebtn`) on those elements.

## Dependencies & Risks

- Upstream: WO-13-012 (composite primitives), WO-25-001 (codec keys `proposalsTab`, `stream`, `lesson`),
  WO-22-002 (`BacklogPanel`, `StateTile`, area helpers), and the kept readers WO-17-001, WO-17-003, WO-17-005.
- Consumers: WO-19-003 (sidebar Propuestas count from `ownerActions().badgeCount`), WO-13-013.
- Risk: three panels mounted at once make the server render heavier. Mitigation: one cached read bundle, panels
  as server-rendered slots, no client fetching.
- Risk: the lesson `context` field and bodies are in English inside a Spanish interface; they are shown
  content and are never translated (platform i18n rule).
- Design/FRD conflicts decided here (reported in the ledger): FDD-17 describes the retrieval-trigger box in the
  lesson dialog and says "there is no prune list in v2", while FRD-17 (owner, 2026-10-21) puts "Úsala cuando"
  out of v2 and AC-17-001.3 draws "Para podar" when something is prunable; FRD > FDD, so the box is not built
  and the prune card is built conditionally.

Lessons applied: LESSON-0077 (one resolver behind every surface that counts the same fact: `ownerActions()`
feeds the Resumen list, the tab badges, the flow tile and the sidebar count), LESSON-0484 (the two summary
cards end at the same height; red, amber and green stay reserved for status, one hue per other category),
LESSON-0185 (the behaviour e2e spec uses `gotoHydrated` and web-first assertions, no `networkidle`).

## Build Plan

> The build engine reads this table. `Parallel with` carries the global wave (`W<n>`, computed from `dependsOn`).
> Kept-live v1 work orders (the readers) are history; only WO-17-008 builds.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-17-001 | — | `src/lib/memory/memory.ts`, `src/lib/memory/_tests/memory.test.ts`, `src/lib/memory/_tests/memory.adversarial.test.ts` | false | W0; history, VERIFIED |
| WO-17-003 | WO-17-001 | `src/lib/self-suggest/self-suggest.ts`, `src/lib/self-suggest/_tests/self-suggest.test.ts` | false | W1; WO-17-005, history, VERIFIED |
| WO-17-005 | WO-17-001 | `src/lib/memory/memory.ts`, `src/lib/memory/memory-health.ts`, `src/lib/memory/_tests/memory-loop-v2.test.ts`, `src/lib/memory/_tests/memory-health.test.ts`, `src/components/modules/MemoryHealth/MemoryHealth.tsx`, `src/components/modules/MemoryHealth/_tests/memory-health.loop-v2.test.tsx`, `src/app/proposals/_components/LessonDetail.tsx`, `src/app/proposals/_tests/wo-17-005-lesson-detail-v2.test.tsx` | false | W1; WO-17-003, history, VERIFIED |
| WO-17-008 | WO-13-012, WO-25-001, WO-22-002, WO-17-001, WO-17-003, WO-17-005 | `src/app/proposals/page.tsx`, `src/app/proposals/[...segments]/**`, `src/app/proposals/_components/{ProposalsTabs,ProposalsSummary,ProposalCard,ProposalActionRow,LessonFlow,SignalGroup,PromotionsQueuePanel,DismissableProposalStream,ProposalStream}/**`, `src/app/proposals/_components/{LessonDetail,LessonDetailModal}.tsx`, `src/app/proposals/_components/streamMeta.ts`, `src/app/proposals/_tests/**`, `src/lib/{proposals,self-suggest,memory}/**`, `src/components/modules/{PromotionsQueue,MemoryHealth,ProposalsDismiss}/**`, `e2e/proposals.spec.ts`, `e2e/fixtures/factory-root/factory/memory/LESSON-90*.md`, `e2e/persistent-navigation/proposals.spec.ts` | false | W4; WO-03-007, WO-10-016, WO-02-016 (other FRDs) |

- **Order and integration.** The three kept readers are VERIFIED and untouched in behaviour (WO-17-008 may edit
  their files for v2 needs, in a later wave). WO-17-008 starts after WO-22-002 (the Backlog tab it mounts) and
  builds the resolvers first, then the Resumen and Memoria panels, then the dialog and the routes. WO-19-003
  (W6) then mounts the sidebar count.
- **Disjointness.** `src/app/proposals/_components/{BacklogPanel,AreaBar}/**` and `_actions/**` belong to
  WO-22-002 (W3, earlier); everything else under `src/app/proposals/**` belongs to WO-17-008. WO-17-005 (W1)
  and WO-17-003 (W1) have disjoint files; WO-17-001 (W0) shares `src/lib/memory/**` with later waves only.
  The shared constants file is not touched here (WO-18-002 retires the two memory-nudge constants when the last
  importer, `src/app/page.tsx`, changes); the memory upkeep threshold is a named constant of `src/lib/proposals/`.
- **No backend contract file.** No route handler or HTTP API is added or changed (`ownerActions()` is an
  in-process resolver), so no `docs/api/<wo-id>.md` (DR-060).
- **Reconciliation (2026-10-22, binding).** WO-17-008 updates the tab steps of the split
  `e2e/persistent-navigation/proposals.spec.ts` (W4, after WO-22-002's backlog steps in W3) and
  `src/app/proposals/_tests/persistentNavigation.test.tsx` (inside its `_tests/**`); it derogates the
  `ProposalsBadge` cases of `frd-17-gate-opus.reviewer.test.tsx` and `frd-17-reuse.gate.reviewer.test.tsx`
  (the module stays on disk until WO-13-013 deletes it in W7, so later gates keep compiling); it renders no
  `<main>`. WO-25-001 ships `proposalsTab=resumen`, the stream slugs `promotions`, `candidate-lesson`,
  `prune`, and `backlogItem`.

## Work Orders

1. WO-17-001, WO-17-003, WO-17-005 - kept live as history (VERIFIED readers).
2. WO-17-008 `propuestas-orbita` (high, W4): the whole v2 surface, `ownerActions()` and the removals.

## Superseded (v1 history)

- WO-17-002 `memory-views` (superseded by WO-17-008): the derived views now live under WO-17-008's `src/lib/memory`.
- WO-17-004 `proposals-surface` (superseded by WO-17-008): the four-stream surface, memory-health panel, badge and chip.
- WO-17-006 `remove-solo-demo-frame` (superseded by WO-17-008): the demo frame of the deleted `MemoryHealth` panel.
- WO-17-007 `stream-show-more` (superseded by WO-17-008): the "ver más" toggle replaced by the shared `MoreBar`.

## Readiness check (DR-100)

Every explicit `REQ-17-001`, `REQ-17-009`, `REQ-17-010`, `REQ-17-011` and every unnumbered FRD bullet maps to a
component or interface above; each live `AC-17-MMM.K` and `AC-22-002.K` assigned to this FRD is owned by exactly
one work order (WO-17-008; see the AC coverage table); `dependsOn` is acyclic and every named work order exists;
the foundation it needs is FRD-13's; no unresolved question survives in this feature's documents.
