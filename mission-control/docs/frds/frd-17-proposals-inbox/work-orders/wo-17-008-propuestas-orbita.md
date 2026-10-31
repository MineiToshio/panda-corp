---
id: WO-17-008
type: work-order
slug: propuestas-orbita
title: Propuestas Órbita - Resumen to-do, Memoria lesson flow, tabs, lesson dialog and the owner-actions resolver
status: ACTIVE
parent: FRD-17
foundation: false
implementation_status: IN_REVIEW
difficulty: high
reopen_count: 0
artifacts: ["src/app/proposals/page.tsx", "src/app/proposals/[...segments]/**", "src/app/proposals/_components/{ProposalsTabs,ProposalsSummary,ProposalCard,ProposalActionRow,LessonFlow,SignalGroup,PromotionsQueuePanel,DismissableProposalStream,ProposalStream}/**", "src/app/proposals/_components/{LessonDetail,LessonDetailModal}.tsx", "src/app/proposals/_components/streamMeta.ts", "src/app/proposals/_tests/**", "src/lib/{proposals,self-suggest,memory}/**", "src/components/modules/{PromotionsQueue,MemoryHealth,ProposalsDismiss}/**", "e2e/proposals.spec.ts", "e2e/fixtures/factory-root/factory/memory/LESSON-90*.md", "e2e/persistent-navigation/proposals.spec.ts"]
source_requirements: [REQ-17-001, REQ-17-009, REQ-17-010, REQ-17-011, REQ-22-002]
dependsOn: [WO-13-012, WO-25-001, WO-22-002, WO-17-001, WO-17-003, WO-17-005]
last_updated: '2026-10-30'
---

# WO-17-008 Propuestas Órbita

> Blueprint: [`../blueprint.md`](../blueprint.md) (`IF-17-*`, `CMP-17-*`). Design: [`../fdd.md`](../fdd.md).
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Summary

Rebuild the Propuestas page on the Órbita system: tabs Resumen · Memoria · Backlog (count badges, all three
panels kept mounted), the Resumen to-do "Qué te toca, en orden" (only the actions that need the owner, each with
its count, reason, command, where to run it and a link, and "La memoria se revisa sola." while the daily routine
is current) with the two summary cards and the grouped "Señales automáticas", and the Memoria tab ("Cómo avanza
una lección" in four steps, "Esperan tu decisión" first, "Candidatas" collapsed under "No piden nada", "Para
podar" only when something is prunable) with the lesson dialog. It publishes `ownerActions()`, the one resolver
behind the Resumen list and the sidebar's Propuestas count, and removes the v1 dismissable streams, the
memory-health panel and their extras.

## In Scope

- `src/lib/proposals/`: `data.ts` (`loadProposalsData()`, request-cached bundle of the raw reads),
  `ownerActions.ts` (`ownerActions()`), `signals.ts` (`groupSignals()`), a named constant
  `MEMORY_UNREVIEWED_DAYS` (2) and `UNRELIABLE_SIGNAL_RATIO` (0.6); `countOpenProposals` is deleted.
  `src/lib/memory/` and `src/lib/self-suggest/` change only where a v2 AC needs it (no new field is invented;
  `harvestOrphans` stays reported, unrendered; `trigger` renders in the lesson dialog's drawn box).
- `src/app/proposals/page.tsx`, `[...segments]/page.tsx` (validates tabs, streams `promotions`, `candidate-lesson`,
  `prune`, lesson ids and backlog item ids against `loadProposalsData()`; unknown values are a bounded
  not-found), `_components/`: `ProposalsTabs`, `ProposalsSummary`, `ProposalActionRow`, `SignalGroup`,
  `LessonFlow`, `ProposalStream` (Candidatas, Para podar), `PromotionsQueuePanel`, `LessonDetail`,
  `LessonDetailModal`; `src/components/modules/PromotionsQueue/` (card of "Esperan tu decisión", `LessonRow`).
- Mounts `BacklogPanel` (WO-22-002) as the Backlog panel; passes the actionable count to the tab badge.
- The page renders no `<main>` (the shell's `main#content` is the page's only main landmark, AC-19-001.5,
  REQ-13-009); `src/app/proposals/_tests/proposals-page.test.tsx` cases that query `getByRole("main")` are
  updated here.
- Split oracle files created by WO-25-001 (W0): the tab steps of `e2e/persistent-navigation/proposals.spec.ts`
  (WO-22-002 updated its backlog steps in W3) and `src/app/proposals/_tests/persistentNavigation.test.tsx` (tab
  paste and history, promotion from its collection path) are updated here (AC-25-001.1, AC-25-002.1
  re-verified); WO-25-001's keys `proposalsTab` (`resumen` default), `stream`, `lesson`, `backlogItem`.
- A behaviour e2e spec `e2e/proposals.spec.ts` (`gotoHydrated`, `getByRole`, no hard waits) over the lesson
  fixtures it adds only as `e2e/fixtures/factory-root/factory/memory/LESSON-90*.md` (never editing an existing
  fixture file; it may use the `BL-90*` backlog fixtures WO-22-002 added): Resumen is the default tab and lists
  the actions in order; a lesson row opens the dialog, Escape closes it and focus returns to the row; a deep link
  `/proposals/memory/promotions/<lesson>` opens the dialog on load; "Candidatas" opens and "Mostrar … más" adds
  cards in place; a Backlog filter survives a switch to Resumen and back.

## Out of Scope

- The Backlog panel itself, the area helpers and `StateTile` (WO-22-002, WO-22-001).
- The sidebar item and its count badge markup (WO-19-003 reads `ownerActions().badgeCount`); the top-bar badge
  (WO-19-002 removes it) and the portfolio rail chip (WO-03-007 removes it).
- Harvesting, promoting, pruning or running any skill (FRD non-goal): Mission Control shows commands only.

### Removals (map §6.C item 19; delete in this work order, with their tests)

- Per-card dismiss and remembered dismissal: `src/components/modules/ProposalsDismiss/**` and its storage keys.
- Stream explainers, the stale-memory nudge and the harvest-orphans banner: the `MemoryHealth` component
  (`src/components/modules/MemoryHealth/**`, replaced by `LessonFlow`); `memoryHealth()` keeps reporting its facts.
- The reject affordance of the promotions queue; the "Úsala cuando" trigger row of the lesson detail; the
  "Crónica del gremio" alias in the page metadata.
- The "ver más / ver menos" (drawn in FRD-04's captured states) toggle: `DismissableProposalStream/**` (replaced by `ProposalStream` and the shared
  `MoreBar`), the v1 `ProposalCard/**`, `_components/streamMeta.ts`, and `countOpenProposals`.
- The lesson dialog shows the lesson's retrieval trigger in the drawn blue box with a target icon when the lesson
  has one (FDD-17, state `proposals-lesson-dialog`; REQ-17-009 amended 2026-10-22). Only the labelled «Úsala
  cuando» row stays out of v2.

## Requirements & Acceptance Criteria

REQ-17-001, REQ-17-009 (the "Aplicada en" row; the reader fields are history), REQ-17-010, REQ-17-011 and FRD-22
REQ-22-002 (the tab shell). The acceptance criteria this work order owns, copied from the owning `frd.md` files:

- **AC-17-001.1** — WHERE a proposal group shares a single activating command (e.g. candidate lessons and prunable/obsolete lessons both act through `/pandacorp:memory`), the command SHALL be shown **once at the group level**, under the group title — NOT as a per-item copy button.
- **AC-17-001.2** — A proposal item SHALL show its own per-item command **only when** its command genuinely differs from the rest of its group (e.g. each self-suggestion routes to a different skill); otherwise the item is title + evidence only and defers to the group-level command.
- **AC-17-001.3** — The Memoria tab SHALL list **"Esperan tu decisión"** (the promotions queue) first, then the collapsed **"Candidatas"**, then **"Para podar"** (the lesson-oriented groups stay adjacent; amended 2026-10-22), the last drawn ONLY WHEN at least one lesson is prunable (otherwise the health line reads "Ninguna lección obsoleta.").
- **AC-17-010.1** — WHERE a proposal stream has **more cards than its page size** (Candidatas 10, Esperan tu decisión 8; Señales automáticas show all), the shared stream component (`CMP-17-stream`) SHALL render only the first page and a full-width bar **"Mostrar N más · quedan M"**; the remaining cards SHALL NOT be in the rendered list until revealed. (Amended 2026-10-22: it replaced the "ver más" toggle with threshold 6.)
- **AC-17-010.2** — WHEN the owner activates the bar, the next page of the **already-loaded** cards SHALL appear **in-place** (no additional fetch or navigation); there is no collapse back ("ver menos" is not drawn). (drawn in FRD-04's captured states)
- **AC-17-010.3** — WHERE a stream has **no more cards than its page size**, **no bar** SHALL be shown and every card SHALL render (unchanged behavior).
- **AC-17-010.4** — The paging SHALL live in the **single shared** "Mostrar más" component the whole app uses (memory, backlog, rules, trophies, transitions; Órbita iteration 28) and apply **uniformly to every stream kind** it serves — one code path, not a per-kind fork (DR-057). Existing detail-dialog / group-level-command behavior SHALL be unchanged; the bar is a semantic `<button>`, keyboard-operable, Spanish copy, state not by color alone (FRD-13). Added 2026-07-05 (drains change `mc-proposal-stream-show-more`, DR-069).
- **AC-17-011.1** — THE Propuestas page SHALL open on the tab Resumen ("Qué te toca, en orden"): an ordered list of only the actions that need the owner, each with its count, its reason, its command, where to run it and a link to the detail; memory upkeep SHALL read "se revisa sola" while the daily routine is current.
- **AC-17-011.2** — THE Propuestas navigation badge SHALL count the owner's actions, not the proposal items.
- **AC-17-011.3** — THE "Señales automáticas" SHALL be grouped by kind, and a signal that flags most of its population (such as the unused-skills signal) SHALL be marked unreliable.
- **AC-17-011.4** — THE Memoria tab SHALL explain a lesson's four steps and who moves each one, SHALL list the lessons awaiting the owner ("Esperan tu decisión") first, and SHALL keep the candidates collapsed under "no piden nada".
- **AC-22-002.1** — The Propuestas page SHALL present three tabs, **Resumen**, **Memoria** and **Backlog**, using the shared `Tabs`/`SubTabs` primitive (DR-062) — no bespoke switcher.
- **AC-22-002.2** — (amended 2026-10-22, v2 reconciliation) **Resumen** SHALL be active by default (FRD-17 AC-17-011.1); **Memoria** SHALL contain the self-learning surface (the `LessonFlow` health line + the proposal streams + the promotions queue, FRD-17).
- **AC-22-002.3** — The **Backlog** tab SHALL show a count badge of its actionable items (open and in progress, for example "Backlog 11") when greater than zero.
- **AC-22-002.4** — Both panels SHALL stay mounted (toggled with `hidden`) so each panel's tab-local state (for example the Backlog filters, its opened card and the paging of its history) survives a tab switch; the memory streams have no dismiss state in v2 (FRD-17, per-card dismiss is out of v2). (Amended 2026-10-22, v2 plan.) Both panels SHALL carry `data-volatile` (DR-088) so the visual baseline masks their live, length-varying data.

Notes on how the criteria are read here: AC-22-002.2 "memory-health panel" is the drawn `LessonFlow` health line
(the v1 panel is removed); the three panels (Resumen too) are mounted, hidden and `data-volatile`. The group
command of AC-17-001.1 is shown once under "Para podar" (`/pandacorp:memory review`); "Candidatas" carries none
(the daily routine confirms them) and "Esperan tu decisión" rows differ by lesson id, so their commands live
per item in the dialog and in the "Recién detectadas" rows (AC-17-001.2). Owned elsewhere: the sidebar badge
markup (WO-19-003), AC-22-001.x to AC-22-010.x (WO-22-001, WO-22-002).

Completeness (definition of done beyond the ACs): error path per failure mode (an unreadable memory store or
backlog renders the designed error `Notice` on its card, never zero; a malformed lesson is skipped by the
reader without throwing, as built), the empty states (no actions: "Nada necesita tu decisión ahora."; no
candidates; no signals; empty backlog), input validation of the route segments (bounded not-found), a11y (lesson
rows are `<button>`s with an accessible name naming the lesson, dialogs native with focus trap, Escape and focus
return, the unreliable marker is text, action kinds carry label and icon, counts are text), keyboard-operable
`MoreBar`, reduced motion, tokens only, tabular numbers, no text below 12 px, source-language lesson content
inside the Spanish interface, no write and no outbound call.

## Components & interfaces it builds

`IF-17-data`, `IF-17-actions`, `IF-17-signals`, `CMP-17-page`, `CMP-17-routes`, `CMP-17-tabs`, `CMP-17-summary`,
`CMP-17-actionrow`, `CMP-17-signals`, `CMP-17-flow`, `CMP-17-stream`, `CMP-17-promoqueue`, `CMP-17-lesson`
(blueprint). Copy through `t()`: `propuestas.*`, `dialogs.lesson.*`, `dialogs.default.close`,
`common.workspaceTabs.resumen`, `shell.nav.propuestas`. Lesson titles (`context`), bodies and ids keep their
source language.

## Reuse (components.md: reuse, then adapt, then create)

Reuse `PageHead`, `Tabs`, `Card`/`CardHeader`, `CommandBox`/`CommandCompact`, `Chip` family and `CountPill`,
`ListRow`, `MoreBar` (WO-13-011), `Dialog`, `EmptyState`/`Notice`, `SectionedMarkdown`, `Icon`, `BacklogPanel`
(WO-22-002). Adapt: `ProposalCard` to `ProposalActionRow`, `PromotionsQueue` to the "Esperan tu decisión" card.
Create: `LessonFlow`, `SignalGroup` and the composition pieces the inventory lists. The v1 `DismissableProposalStream`
is replaced, not forked (`ProposalStream`). Check the inventory again at build time; a missing component is a
ledger item.

## Installs

None.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-17-proposals-inbox/mocks/proposals-inbox.html`, sections
  `proposals-summary`, `proposals-memory`, `proposals-lesson-dialog`; screenshots in
  `mocks/screenshots/<id>-<width>-<theme>.jpg` (375/768/1280, light and dark; the dialog at 375 and 1280).
- **Oracle states** (`oracle-states.json`, `oracle-recipes.md`, frd slug `frd-17-proposals-inbox`):
  `proposals-summary`, `proposals-memory` (Candidatas opened over a long list), `proposals-lesson-dialog`
  (first lesson row of Memoria), and the scenario states `proposals-memory-prune` («Para podar» present) and
  `proposals-calm` («Nada necesita tu decisión ahora.»), each reproduced from its `oracle-recipes.json` double in
  this WO's e2e and at the close-out Visual QA. The Backlog states are WO-22-002's. Keep the recorded hooks (`.pa-row`,
  `.pa-n`, `.pa-cmd`, `.lf`, `.lf-step`, `.lf-arrow`, `.sig-group`, `.lrow[data-lesson]`, `.band-sub`,
  `.morebtn`) on those elements.
- **Token slice:** amber (the Resumen card, "Importante"), coral ("Urgente", unreliable marker accent), teal
  (Decidir, Memoria), blue ("Ideas", candidates), pink (Trampa chip), violet (Problema→solución), slate
  (signals), `--surface`, `--line`, radii 16 and 22, 40 px dashed `MoreBar`, display numbers for the facts,
  mono only for commands and lesson ids.
- **FDD pointer:** `docs/frds/frd-17-proposals-inbox/fdd.md`.
- **Fidelity acceptance criterion:** the built page visually matches `mocks/proposals-inbox.html` (layout,
  structure, components, density) on the frozen tokens, not an approximation; verified by the preview smoke and
  shell gates at the FRD gate and by the computed-style and pixel diff of the three oracle states at the
  close-out Visual QA (DR-056, DR-129). At 768 the two summary cards are already stacked; at 375 the four flow
  tiles stack with downward arrows and commands wrap only at ":" and spaces.

## Tests this work order owns

Resolver tests with real-shaped fixtures and a malformed one each (`ownerActions()`: order, absent zero-count
actions, `badgeCount` equals the rows, the worked example 4 actions from 42 + 16 + 24 items, a lesson counted
once when it is both queued and a recurring signal, stale versus current upkeep, an unreadable backlog is an
error and not zero; `groupSignals()`: grouping and the unreliable threshold at the boundary); component tests by
role and name (action rows, signal expanders and the unreliable text, flow tiles and the health line, "Esperan
tu decisión" rows open the dialog, "Candidatas" collapsed by default, "Para podar" absent without prunables and
with the group command once when present, `MoreBar` label rule and in-place reveal, no bar on a short list,
dialog fields per lesson including "Aplicada en" and the command only for `proposed`, tabs keep panels mounted
and `data-volatile`); the route-segment validation tests; the e2e spec above.

## Derogated tests (BL-0051)

- Implementer-authored, deleted or rewritten here: `src/app/proposals/_tests/{proposals-page,wo-17-004-req17001,
  wo-17-005-lesson-detail-v2}*.test.tsx`, `_components/ProposalCard/_tests/*`,
  `_components/DismissableProposalStream/_tests/{lessonDetail,streamShowMore}.test.tsx`,
  `_components/PromotionsQueuePanel/_tests/*`, `_components/ProposalsTabs/_tests/*`,
  `components/modules/{PromotionsQueue,MemoryHealth,ProposalsDismiss}/_tests/*` (the last two modules are
  deleted), and the lib tests that pin `countOpenProposals`.
- Reviewer-authored, whole module deleted, so the implementer `git rm`s and lists them (DR-080):
  `components/modules/MemoryHealth/_tests/memory-health.wo006.adversarial.reviewer.test.tsx` and
  `_components/DismissableProposalStream/_tests/streamShowMore.reviewer.test.tsx`.
- Reviewer-authored, page rewritten not deleted, so derogated and re-blessed or rewritten by the FRD-17 gate
  reviewer: `src/app/proposals/_tests/{frd-17-gate,frd-17-gate-opus,frd-17-reuse.gate,proposals-composition,
  proposals-wiring,proposals-integration}.reviewer.test.tsx`. Explicitly derogated among them: the
  `ProposalsBadge` cases of `frd-17-gate-opus.reviewer.test.tsx` and `frd-17-reuse.gate.reviewer.test.tsx`
  (the sidebar count over `ownerActions()`, WO-19-003, replaces the badge; WO-13-013 deletes `ProposalsBadge` in
  W7), which the FRD-17 gate reviewer retires.
- The `data-testid`s `proposals-tab-memoria`, `proposals-tab-backlog` and `backlog-panel` are part of this
  contract (the core and split persistent-navigation specs assert them). Visual baselines of `/proposals` are
  derogated by WO-19-002 and again here; implementers never touch `e2e/visual.spec.ts-snapshots/**`.

## Dependencies

WO-13-012 (composite primitives, through it WO-13-011), WO-25-001 (codec keys), WO-22-002 (`BacklogPanel`,
`StateTile`, area helpers via WO-22-001), WO-17-001, WO-17-003 and WO-17-005 (the kept readers). Consumers:
WO-19-003 (sidebar Propuestas count), WO-13-013.

## Status Note

- 2026-10-30 (S3C round 2): Kept `IN_REVIEW`. Restored the durable proposed queue through `promotionQueue(lessons)`, including deprecated proposed lessons; retained parsed backlog counts and badge data after individual file errors; summary links now use the mounted tab navigation path. Restored the lesson high-risk badge, pending eval gate, status/source/reference metadata, signal commands and catalogue-backed missing-value copy. Fixture setup/teardown now removes its disposable records without restoring crash leftovers.
- 2026-10-30 (S3C round 2 verification, PORT=3962 and PANDACORP_E2E_PORT=3962): `pnpm exec knip` and `pnpm exec tsc --noEmit` exited 0 (knip emitted nine configuration hints). `pnpm exec biome check .` exited 0 with the existing schema-version informational notice. `pnpm exec vitest run src/app/proposals src/lib/proposals src/lib/memory src/lib/backlog src/lib/self-suggest src/components/modules/PromotionsQueue --maxWorkers=2` passed 361/362 tests in 31 passing suites; the remaining reviewer failure expects the old filtered-empty sentence for a globally empty backlog. Reviewer files were not edited. Browser verification of both e2e specs was attempted with a temporary port-3962 configuration: the server started after enabling Watchpack polling, but all eight browser cases failed before navigation because Chromium's `bootstrap_check_in` was denied by the sandbox. Real browser navigation/reload behavior remains unverified. No commit, merge, push or decision-log write was performed.

- 2026-10-30 (S3C): Built Resumen, the request-cached data bundle and ownerActions resolver (the badge counts actions, not items), grouped/unreliable signals, the four-step LessonFlow, paged waiting/candidate/prune lists, typed record validation, the lesson dialog, and three mounted volatile tabs. Removed the v1 dismissal, health and stream modules; countOpenProposals was already absent on this branch after WO-19-002.
- 2026-10-30: The 15 owned ACs are cited by implementer tests. Added e2e behavior and persistent-navigation coverage with byte-for-byte fixture restoration in afterEach. Playwright, browser focus behavior, light/dark responsive fidelity and pixel comparisons were not run, as directed. No baseline, reviewer test, decision log or .pandacorp state was edited. No commit, merge or push was made.
- 2026-10-30: Verification with PORT=3962 and PANDACORP_E2E_PORT=3962: Biome passed on changed source/spec files. Scoped Vitest including the backlog readers passed 287 tests in 24 suites when excluding derogated reviewer TSX suites; the complete run passed 289 tests and failed 11 tests in eight reviewer suites (five suites fail to import retired modules). TypeScript and knip remain RED on exactly five reviewer imports of retired MemoryHealth/DismissableProposalStream modules; no production-code diagnostic remains in those outputs. The unrelated knip configuration hints remain unchanged.
- 2026-10-30: Reviewer reconciliation still required, without implementer changes: delete MemoryHealth/_tests/memory-health.wo006.adversarial.reviewer.test.tsx and DismissableProposalStream/_tests/streamShowMore.reviewer.test.tsx with their retired modules; rewrite the six page suites frd-17-gate, frd-17-gate-opus, frd-17-reuse.gate, proposals-composition, proposals-wiring and proposals-integration for the three tabs, owner-actions resolver, LessonFlow, proposed-only queue, no dismissal, and shared paging/dialog contracts. The header-marked lib/memory/memory.adversarial.test.ts suite passed unchanged.
- 2026-10-30: LESSON-0077 / LESSON-0484 / LESSON-0185 applied: one cached fact resolver, equal-height paired cards, hydration-safe e2e navigation. A missing/malformed/future daily-sweep stamp is shown as unrecorded rather than inventing an elapsed age. The frozen copy catalogue has no dedicated memory-read or discard-failure key; these notices reuse existing catalogue messages and show the affected identity, without introducing out-of-scope catalogue edits.
