---
id: WO-13-013
type: work-order
slug: retire-v1-skin
title: 'WO-13-013 — Retire the v1 skin and dead v1 code; flip target_platforms to responsive'
status: DRAFT
parent: FRD-13
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: medium
reopen_count: 0
artifacts:
  - "src/components/core/{Panel,ItemSlot,Shield,XpBar,DocHeading,KanbanColumn,TierBadge,CountBadge,StateBadge,PageTitle,PageLayout,CelebrationSurface}/**"
  - "src/components/modules/ProposalsBadge/**"
  - "src/components/modules/Nav/navTab.ts"
  - "src/components/modules/GuildBar/GuildBar.tsx"
  - "src/components/modules/GuildBar/_tests/{GuildBar,GuildBar.embedded,wo-09-003-guildbar}.test.tsx"
  - "src/app/_observability/**"
  - "src/app/_design/**"
  - "src/lib/gamification/{gamification.ts,agents.ts}"
  - "src/lib/gamification/_tests/**"
  - "src/lib/pendingMerge/**"
  - "src/components/modules/manual-diagrams/FlowGraph.tsx"
  - "src/components/modules/manual-diagrams/_tests/FlowGraph.test.tsx"
  - "src/lib/manual/skill-flows.ts"
  - "src/app/manual/{ManualNavContext,ManualShell}.tsx"
  - "src/components/modules/FreshnessBadge/**"
  - "src/lib/portfolio/**"
  - "src/app/projects/[slug]/_components/_tests/workspace-navigation.test.tsx"
  - "src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx"
  - "src/lib/constants.ts"
  - "src/lib/command-modes.ts"
  - "src/lib/_tests/command-modes*.test.ts"
  - "src/app/globals.css"
  - "src/app/layout.tsx"
  - "public/prototype/assets/**"
  - "package.json"
  - "pnpm-lock.yaml"
  - "README.md"
  - ".pandacorp/status.yaml"
source_requirements: [REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-008]
dependsOn: [WO-01-011, WO-02-015, WO-02-016, WO-02-018, WO-02-020, WO-03-007, WO-04-011, WO-04-012, WO-05-008, WO-05-009, WO-07-006, WO-08-003, WO-08-004, WO-10-017, WO-11-004, WO-17-008, WO-18-002, WO-19-003, WO-22-002]
last_updated: 2026-10-22
---

# WO-13-013 — Retire the v1 skin and dead v1 code; flip target_platforms to responsive

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`../blueprint.md`](../blueprint.md) (CMP-13-retirement, Build Plan W7). Removal rule:
> work-order map §0.6 and §6.C.

## Summary

The last v2 work order, alone in the final wave once every surface is rebuilt on Órbita: it deletes
what v2 no longer uses (the fenced v1 compatibility block of `globals.css`, the Tabler icon CDN link,
the retired pixel-RPG primitives and compatibility names, the unmounted observability code, the
celebration tiers and the agent XP engine, the interactive flow graph and its skill-flow data, the old
pending-merge reader if nothing reads it, the per-agent colour tokens, unused v1 art and the Dagre
dependency), finalises the README, and flips `target_platforms` to `responsive` so the responsive gate
covers every route from now on.

## In Scope

Each deletion is preceded by a reference search; knip, madge and `tsc` clean afterwards are the evidence.

1. **Retired primitives and compatibility names** (map §6.C items 24 and 3): `Panel` (RpgPanel),
   `ItemSlot`, `Shield`, `XpBar`, `DocHeading`, `KanbanColumn`, `TierBadge`, `CountBadge`, `StateBadge`,
   `PageTitle`, `PageLayout`, `CelebrationSurface`, the v1 top-bar `GuildBar` component
   (`GuildBar/GuildBar.tsx`; `GuildCard` in the same folder stays), `ProposalsBadge` and the shared
   `Nav/navTab.ts` it used, with their implementer tests.
2. **Dead v1 code**: `src/app/_observability/**` (KPI selector, events-per-minute chart, top-N helper,
   the duplicate `FreshnessBadge`, `WorkOrderDag`; map §6.C item 9); `classifyCelebration` and the
   celebration tier types in `src/lib/gamification/gamification.ts` and the agent XP engine
   `src/lib/gamification/agents.ts` (§6.C items 3 and 16) with their test cases; `FlowGraph` and
   `src/lib/manual/skill-flows.ts` (§6.C item 17, owner default O2 confirmed; `workflow-flows.ts` was
   already deleted by WO-08-004 in W3 together with its last importer, reconciliation 2026-10-22), and the
   then-dead `goToSkill` / `goToAgent` members of `src/app/manual/ManualNavContext.tsx` with their
   `ManualShell.tsx` implementation (REQ-08-012, REQ-07-007/011/012 removed every caller in W3/W4);
   `getPendingMerge()`, `src/lib/pendingMerge/pendingMerge.ts` and its test (callers gone: the layout badge
   with WO-19-002, `PendingMergeBlock` with WO-04-011) and any other part of `src/lib/pendingMerge/` that
   `getWorktreesByRepo()` / `pendingPillSummary()` (WO-21-003) no longer use.
2b. **Dead constants and props** (DR-115: no dead reader fields): the `IMPLEMENT_MODES` export of
   `src/lib/command-modes.ts` and its test case (its last consumer `mode-selector` went with WO-11-004);
   `STALENESS_THRESHOLD_DAYS` and
   `FRESHNESS_THRESHOLD_MS` in `src/lib/constants.ts` (last importer `src/app/_observability/**`, deleted
   here); `FreshnessBadge`'s v1 `lastSignalAt` prop (its last `_party/**` callers went with WO-04-010);
   `ProjectListItem.snapshot` and `.lastSync` in `src/lib/portfolio/portfolio.ts` (no reader after
   WO-03-007), fixing the implementer test fixtures that still set them (the two workspace tests declared
   above and `src/lib/portfolio/_tests/*`; a reviewer suite that sets them is listed as derogated).
3. **Tokens**: the fenced v1 compatibility block of `globals.css` (v1 token names, per-agent colours,
   `--font-pixel`, the v1 global classes), every other dead v1 rule, and in
   `src/app/_design/tokens/tokens.ts` the v1 token-schema validator and `AGENT_COLOR` (REQ-13-008: no
   per-role colour set). `AGENT_ROLES`, `AGENT_STATES` and `STATE_BADGE` stay if still referenced.
4. **Layout**: the Tabler Icons CDN `<link>` (no `.ti` icon remains anywhere, proven by a search).
5. **Art**: files under `public/prototype/assets/` that no source, CSS or fixture references any more
   (the v1 Party zones, bridges, camp, infirmary and sprite grids); everything WO-13-010 staged from
   the prototype stays.
6. **Dependency**: `pnpm remove @dagrejs/dagre` (the map's only install change).
7. **README**: the root `README.md` Getting Started reflects v2 (install, `pnpm dev`, `pnpm dev:oracle`
   as documented by WO-01-010, test and gate commands); no new env variable.
8. **Platforms**: in `.pandacorp/status.yaml`, only the `target_platforms` line changes, `desktop` →
   `responsive` (DR-074; owner decision 2026-10-21; map §8.9). Nothing else in that file is touched (the
   build engine owns it).

If a retired name is still referenced by a live consumer, that consumer's work order left it behind:
stop and report it (BLOCKED, `blocked_reason: error`) instead of editing a file outside this WO's
artifacts.

## Out of Scope

- Any visual change to a rebuilt surface; any new feature; baselines (the close-out Visual QA
  re-blesses them).
- `RankEmblem`, `GuildHero`, `LiveRegion`, `useKeyboardNav`, the data-model layout engine (kept).

## Requirements & Acceptance Criteria

No acceptance criterion is owned here (map §7). It completes REQ-13-001 (only the two themes and the
Órbita token set remain), REQ-13-002 and REQ-13-004 (no pixel-RPG primitive or per-component shadow /
radius survives), REQ-13-005 (no v1 animation rules) and REQ-13-008 (no per-role colour set).

**Completeness (DR-100).** Evidence is mechanical: `tsc`, knip (no unused export or file), madge (no
cycle), `biome`, the full Vitest suite, and with `target_platforms: responsive` the responsive gate at
320 / 375 / 768 / 1280 on every route of `e2e/routes.ts` plus the shell gate's mobile check. The
reviewer checks the §6.C list item by item.

## Visual reference

N/A (removal and configuration; the rebuilt surfaces' own visual references bind).

## Tests (owned)

- The implementer tests of every deleted module are deleted with it; the surviving cases of
  `src/lib/gamification/_tests/gamification.test.ts` (guild engine) stay green.
- `src/app/_design/tokens/_tests/tokens.test.ts`: v1 validator and `AGENT_COLOR` cases removed; the
  roster and state-vocabulary cases stay.
- No new behaviour spec: the responsive and shell gates, now covering mobile, are the check.

### Derogated tests (map §3.3, BL-0051)

Reviewer-authored suites whose subject this WO deletes are removed with `git rm` and listed in the
Status Note (rule 3, FRD-mandated removal); the FRD-13 gate reviewer re-authors any surviving case:
- `src/lib/gamification/_tests/gamification.integration.reviewer.test.tsx` (imports `CelebrationSurface`,
  `XpBar`, the top-bar `GuildBar` and `agents.ts`, all removed here).
- `src/app/_design/tokens/_tests/tokens.adversarial.review.test.ts` (probes the v1 validator and
  `AGENT_COLOR`).
- `src/app/_design/tokens/_tests/frd13.integration.reviewer.test.tsx` (renders `StateBadge`).

`src/app/_design/tokens/_tests/frd13-wo06-09.adversarial.reviewer.test.tsx` and
`frd13-wo07-09.adversarial.reviewer2.test.tsx` are not this work order's: WO-04-010 removes them in W5 with
the `party/*` set they import (reconciliation 2026-10-22, one owner).

Derogated but not removed (the FRD-13 gate reviewer rewrites it): `src/app/_tests/agentColorTokens.integration.reviewer.test.ts`
(its sync case loses its subject when the per-agent tokens go).

## Definition of done

- Every §6.C item assigned to this WO is gone (reference search empty), the gate is green with
  `target_platforms: responsive`, `pnpm-lock.yaml` has no `@dagrejs/dagre`.
- Status Note lists every deleted path and every removed reviewer suite.

## Dependencies

Every surface WO of v2 (frontmatter `dependsOn`), so no retired name still has a consumer and no
mobile-gated v1 surface remains when the flip lands. Cites LESSON-0278 (check a shared helper's live
consumer count before deleting it).

## Status Note
