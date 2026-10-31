---
id: WO-13-013
type: work-order
slug: retire-v1-skin
title: 'WO-13-013 — Retire the v1 skin and dead v1 code; flip target_platforms to responsive'
status: ACTIVE
parent: FRD-13
foundation: false
implementation_status: IN_REVIEW
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
  - "src/components/core/{Tabs,SectionHead,Card,Notice,PageHead}/**"
  - "src/components/modules/{DocumentReader,IdeaCard,ProjectCard}/*.module.css"
  - "src/app/(dashboard)/_components/Home.module.css"
  - "src/app/achievements/{RankLadder,_components/{missions,summary,trophies}}/*.module.css"
  - "src/app/manual/_components/DocsHome/DocsHome.module.css"
  - "src/app/portfolio/PortfolioOverview.module.css"
  - "src/app/proposals/_components/ProposalsSummary/Proposals.module.css"
  - "src/app/globals.css"
  - "src/app/layout.tsx"
  - "public/prototype/assets/**"
  - "package.json"
  - "pnpm-lock.yaml"
  - "README.md"
  - ".pandacorp/status.yaml"
  - "src/app/manual/**"
  - "content/manual/**"
  - "src/components/modules/CampaignPipeline/**"
  - "src/components/core/{Banner,Chip,RankEmblem,ProgressBar,CmdRow}/**"
  - "src/components/modules/{SectionedMarkdown,GuildHero,AppShell,Nav}/**"
  - "src/app/{error,global-error,not-found}.tsx"
  - "src/app/_components/OnboardingGate/OnboardingGate.tsx"
  - "src/app/board/_components/CardDetail/**"
  - "src/app/_tests/{layout.theme,globals.css}.test.ts*"
  - "src/lib/achievements/{definitions,tiers}.ts"
  - "src/lib/achievements/_tests/seals-rarity.test.ts"
  - "src/lib/_tests/active-projects.test.ts"
  - "src/lib/events/_tests/events.multi-runtime.test.ts"
source_requirements: [REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-008]
dependsOn: [WO-01-011, WO-02-015, WO-02-016, WO-02-018, WO-02-020, WO-03-007, WO-04-011, WO-04-012, WO-05-008, WO-05-009, WO-07-006, WO-08-003, WO-08-004, WO-10-017, WO-11-004, WO-17-008, WO-18-002, WO-19-003, WO-22-002]
last_updated: 2026-10-31
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

**2026-10-31 scope exception (owner/orchestrator, S7 round 2):** the Manual, its authored diagrams,
CampaignPipeline, command modes and any remaining live v1-layer consumer may be migrated here to
complete retirement. This explicit grant supersedes the live-consumer stop clause for these migrations.
Reviewer files matching `*.reviewer.*`, FRD-21's kept suites, visual baselines and the decision log remain
outside this worker's write scope. The delivery stays uncommitted.

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

### 2026-10-31 — FRD-13 final gate: NOT READY, patch-first, status stays IN_REVIEW

Independent reviewer, branch `orch/s7`. WO-13-010 to WO-13-013 stay IN_REVIEW; `reopen_count` unchanged.

Reconciled (no behaviour test dropped): removed the three derogated suites plus the subject-only
root-observability, StateBadge and CelebrationSurface suites and `globals.css.adversarial2.test.ts`, whose
subject (the fenced v1 block) is gone. Surviving cases were re-authored in
`src/lib/gamification/_tests/gamification.guild-survivors.reviewer.test.tsx`,
`src/components/core/Chip/_tests/state-shapes.reviewer.test.tsx` and
`src/app/_tests/agentColorTokens.integration.reviewer.test.ts`. Rewrote `fixtureSeams.reviewer`,
`active-projects.adversarial` and `frd-03-page-assembly.reviewer`. FRD-21's kept suites are untouched.

Gate-applied production edits: the parenthesised `"use client"` in `manualPages.tsx` and `CardDetail.tsx`
(it broke the build while tsc, Biome and Vitest passed; now guarded by
`src/app/_tests/client-directive.reviewer.test.ts`) and the small overflow, clipping and occlusion repairs
behind the responsive gate. `e2e/_responsive-helper.ts` gained the visually-hidden exemption of BL-0259 and
now differs from the verbatim stack template until BL-0259 lands.

Open RED, owed by a patch round: `src/app/_tests/frd13.source-contracts.reviewer.test.ts` (10 cases) and
`e2e/frd-13-visual-gate.reviewer.spec.ts` (tabular figures on every route, La Fragua contrast in light),
`e2e/responsive-widths.reviewer.spec.ts` (card link below 24 px at 375), the desktop workspace baseline and
the first mobile baselines. Details and the traceability table are in the gate report.

### 2026-10-31 — S7 round 2; retirement implemented, awaiting reviewer reconciliation

The explicit scope grant above resolves the previous round's live-consumer blocker. Set
`implementation_status: IN_REVIEW` and removed `blocked_reason`; this is a review handoff, not a green
full-project gate or a visual approval.

Implemented facts:
- Authored Manual pages and diagrams use Card, CountPill, BadgeIcon, shared inline SVG icons and
  raw Órbita tokens. The reader no longer attaches the `.manual-live` compatibility scope.
- CampaignPipeline derives its disclosures from BUILD_MODES once. The catalog points at existing,
  typed microcopy keys; IMPLEMENT_MODES, its duplicate labels/hints and unused flag-selector helpers
  are gone. The shared BuildModePicker remains the live interactive picker.
- Migrated the remaining source consumers of v1 tokens and Tabler, including SectionedMarkdown,
  RankEmblem, IdeaCard metadata, error/onboarding surfaces, and shared heading/tab/banner fallbacks.
  Chip accepts only the nine Órbita hues. No compatibility token declarations or v1 global surfaces
  remain; the live Fragua scene token override and its own module styles remain. Removed the old
  global button/card embossed hover overrides, unused portfolio/skip-link/banner rules, dead spec
  helpers and unreferenced global Fragua courier/smoke/panda animations after checking their users.
- Retired the obsolete primitives, top-bar GuildBar (kept GuildCard), ProposalsBadge, navTab,
  root `_observability` implementation, FlowGraph/skill flows, unused Manual navigation callbacks,
  agent XP and celebration engines, the old pending-merge reader, and ProjectListItem snapshot/lastSync.
  Kept the live guild engine, agent roster/state vocabulary, data-model layout engines and FRD-21
  worktree/pill readers. Updated implementer fixtures/tests without changing any reviewer suite.
- Removed eight unreferenced grids, bridges, camp/infirmary art files. Kept the sprites/rooms used by
  CampaignPipeline and Fragua and all staged Órbita assets. Removed Dagre from package.json and lock;
  elkjs remains required by DataModelViewer.
- Preserved all round-1 repairs, README and the target_platforms-only change to responsive.
- A live-source reference scan found zero retired primitive imports, root observability imports,
  retired reader/engine imports, IMPLEMENT_MODES, v1 colour/font variables or Tabler class renders.
  package.json and pnpm-lock.yaml have zero Dagre references. Git shows no staged paths and no diff
  in any `*.reviewer.*`, decision-log.md or factory/memory/_inbox.md file.

**Reviewer reconciliation list, plan section 3 / Before W7 (not performed by this worker):**
- Remove the three fully derogated suites: `src/lib/gamification/_tests/gamification.integration.reviewer.test.tsx`,
  `src/app/_design/tokens/_tests/tokens.adversarial.review.test.ts`, and
  `src/app/_design/tokens/_tests/frd13.integration.reviewer.test.tsx`. Re-author any surviving guild cases.
- Remove subject-only root-observability suites: `src/app/_observability/_tests/frd12.gate.review.test.tsx`,
  `src/app/_observability/_tests/frd12.integration.review.test.tsx`,
  `src/app/_observability/selectors/freshness/_tests/freshness.adversarial.test.ts`,
  `src/app/_observability/selectors/rate/_tests/rate.adversarial.test.ts`,
  `src/app/_observability/selectors/rate/_tests/rate.review.test.ts`,
  `src/app/_observability/selectors/timeline/_tests/timeline.adversarial.test.ts`,
  `src/app/_observability/selectors/timeline/_tests/timeline.review2.test.ts`, and
  `src/app/_observability/selectors/topn/_tests/topn.adversarial.test.ts`.
- Remove/re-author `src/components/core/StateBadge/_tests/StateBadge.adversarial.test.tsx` and
  `src/components/core/CelebrationSurface/_tests/wo-09-003-celebration-honesty.adversarial.test.tsx`.
- Rewrite `src/app/_tests/agentColorTokens.integration.reviewer.test.ts` to require absence of per-role
  tokens while preserving its dangling-reference cases; retire the v1-block-presence assertion in
  `src/app/_tests/globals.css.adversarial2.test.ts`.
- Rewrite retired-reader cases of `src/lib/git/_tests/fixtureSeams.reviewer.test.ts` and the stale
  ProjectListItem fixture in `src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx`.
  Reconcile snapshot-only assertions in `src/lib/_tests/active-projects.adversarial.test.ts`.
- Keep BOTH FRD-21 suites unchanged:
  `src/lib/pendingMerge/_tests/worktreesByRepo.malformed.reviewer.test.ts` and
  `src/lib/pendingMerge/_tests/worktreesByRepo.realgit.reviewer.test.ts`.
  Keep `src/lib/gamification/_tests/ledger.adversarial.reviewer.test.ts`,
  `src/app/_tests/layout.shell.reviewer.test.tsx` and the nested workspace observability reviewers.
- No reviewer suite was removed, rewritten, skipped or excluded by this worker. The pending suites
  retain imports/assertions about removed subjects, so the project-wide static/test gates remain red.

Verification (commands run in mission-control with `export PORT=3999 PANDACORP_E2E_PORT=3999`):
- `pnpm exec knip`: exit 1, 22 unresolved imports, all in retained reviewer/adversarial suites; no unused
  source/dependency finding. Existing configuration hints remain.
- `pnpm exec tsc --noEmit`: exit 2, diagnostics only in retained reviewer/adversarial suites (retired
  imports/exports and removed snapshot/lastSync fields). No production-source diagnostic remains.
- `pnpm exec biome check .`: exit 0, 1,241 files checked; existing 2.5.1/2.5.2 schema-version info.
- `pnpm lint:cycles`: exit 0, no circular dependency, 17 warnings reported.
- `pnpm exec tsc --noEmit --project /tmp/s7-production-tsconfig.json`: exit 0. Supplemental temporary
  config extends this checkout's tsconfig, includes production src and excludes tests; it does not
  replace or modify the failing project-wide gate.
- The repair run across Manual, primitives, migrated modules and related libraries passed all 1,325
  collected tests (136 suites); two conserved adversarial suites failed to load removed primitives.
- `pnpm exec vitest run src/app src/components/core src/components/modules/CampaignPipeline src/components/modules/manual-diagrams src/components/modules/FreshnessBadge src/components/modules/IdeaCard src/components/modules/ProjectCard src/components/modules/AppShell src/components/modules/Nav src/components/modules/SectionedMarkdown src/components/modules/GuildHero src/components/modules/DocumentReader src/lib/gamification src/lib/portfolio src/lib/achievements src/lib/pendingMerge src/lib/events src/lib/_tests src/lib/git --maxWorkers=2`: exit 1, 331 suites: 314 passed / 17 failed; 2,826 tests passed / 15 failed. Every failing suite is on the retained reviewer/adversarial reconciliation list above.
- `pnpm exec vitest run src/lib/_tests/active-projects.test.ts src/lib/_tests/command-modes.test.ts --maxWorkers=2`: exit 0, 2 suites / 40 tests passed after removing the retired snapshot-only implementer cases.
- `pnpm exec vitest run src/app/_tests src/components/core/Button 'src/app/projects/[slug]/_components/wo-board' --maxWorkers=2`: exit 1 after the last CSS retirement; 14 suites passed / 2 retained reviewer suites failed, 68 tests passed / 2 failed. The failures require the removed v1 compatibility block and per-agent tokens.
- `git diff --check`: exit 0.

No Playwright or browser check was run. Responsive widths, themes, clipping, tap targets and visual
fidelity remain unverified. No commit, staging, merge, push, merge queue or decision-log write occurred.

Changed-file inventory, including preserved round-1 edits (M = modified, D = deleted; paths relative
to mission-control). Every retired implementer/source/art path is listed here; no reviewer was deleted:

```text
M	.pandacorp/status.yaml
M	README.md
M	docs/frds/frd-13-visual-system-accessibility/work-orders/wo-13-013-retire-v1-skin.md
M	package.json
M	pnpm-lock.yaml
D	public/prototype/assets/agents/grid-v2.png
D	public/prototype/assets/agents/grid.png
D	public/prototype/assets/zones/bridge-h.png
D	public/prototype/assets/zones/bridge-v.png
D	public/prototype/assets/zones/camp.png
D	public/prototype/assets/zones/infirmary.png
D	public/prototype/assets/zones/zones-grid-v2.png
D	public/prototype/assets/zones/zones-grid.png
M	src/app/(dashboard)/_components/Home.module.css
M	src/app/_components/OnboardingGate/OnboardingGate.tsx
M	src/app/_design/tokens/_tests/tokens.test.ts
M	src/app/_design/tokens/tokens.ts
D	src/app/_observability/EventsRateChart/EventsRateChart.tsx
D	src/app/_observability/EventsRateChart/_tests/EventsRateChart.test.tsx
D	src/app/_observability/EventsRateChart/helpers.ts
D	src/app/_observability/EventsRateChart/parts.tsx
D	src/app/_observability/EventsRateChart/styles.ts
D	src/app/_observability/FreshnessBadge/FreshnessBadge.tsx
D	src/app/_observability/FreshnessBadge/_tests/FreshnessBadge.test.tsx
D	src/app/_observability/RpgTimelineToggle/RpgTimelineToggle.tsx
D	src/app/_observability/RpgTimelineToggle/_tests/RpgTimelineToggle.test.tsx
D	src/app/_observability/TimelineView/TimelineView.tsx
D	src/app/_observability/TimelineView/_tests/TimelineView.test.tsx
D	src/app/_observability/dag/WorkOrderDag/WorkOrderDag.tsx
D	src/app/_observability/dag/WorkOrderDag/_tests/WorkOrderDag.test.tsx
D	src/app/_observability/dag/dag/_tests/dag.test.ts
D	src/app/_observability/dag/dag/dag.ts
D	src/app/_observability/selectors/freshness/_tests/freshness.test.ts
D	src/app/_observability/selectors/freshness/freshness.ts
D	src/app/_observability/selectors/rate/_tests/rate.test.ts
D	src/app/_observability/selectors/rate/rate.ts
D	src/app/_observability/selectors/timeline/_tests/timeline.acceptance.test.ts
D	src/app/_observability/selectors/timeline/_tests/timeline.test.ts
D	src/app/_observability/selectors/timeline/accumulate.ts
D	src/app/_observability/selectors/timeline/timeline.ts
D	src/app/_observability/selectors/timeline/types.ts
D	src/app/_observability/selectors/topn/_tests/topn.test.ts
D	src/app/_observability/selectors/topn/topn.ts
M	src/app/_tests/globals.css.test.ts
M	src/app/_tests/layout.theme.test.tsx
M	src/app/achievements/RankLadder/RankLadder.module.css
M	src/app/achievements/_components/missions/missions.module.css
M	src/app/achievements/_components/summary/summary.module.css
M	src/app/achievements/_components/trophies/trophies.module.css
M	src/app/board/_components/CardDetail/CardDetail.tsx
M	src/app/board/_components/CardDetail/IdeaPitch/IdeaPitch.styles.ts
M	src/app/board/_components/CardDetail/IdeaPitch/IdeaPitch.tsx
M	src/app/error.tsx
M	src/app/global-error.tsx
M	src/app/globals.css
M	src/app/layout.tsx
M	src/app/manual/ManualNavContext.tsx
M	src/app/manual/ManualShell.tsx
M	src/app/manual/_components/ArquitecturaDetail.tsx
M	src/app/manual/_components/CockpitDetail.tsx
M	src/app/manual/_components/DesatendidaDetail.tsx
M	src/app/manual/_components/DocsHome/DocsHome.module.css
M	src/app/manual/_components/EstadoDetail.tsx
M	src/app/manual/_components/EstandaresDetail.tsx
M	src/app/manual/_components/FeedbackDetail.tsx
M	src/app/manual/_components/HooksDetail.tsx
M	src/app/manual/_components/ManualLink.tsx
M	src/app/manual/_components/PipelineDetail.tsx
M	src/app/manual/_components/PluginDetail.tsx
M	src/app/manual/_components/StacksDetail.tsx
M	src/app/manual/_tests/manual-content-v2.test.tsx
M	src/app/manual/manualPages.tsx
M	src/app/not-found.tsx
M	src/app/portfolio/PortfolioOverview.module.css
M	src/app/projects/[slug]/_components/Fragua/Fragua.module.css
M	src/app/projects/[slug]/_components/deps/DependencyMap.module.css
M	src/app/proposals/_components/ProposalsSummary/Proposals.module.css
M	src/components/a11y/constants.ts
M	src/components/core/Banner/Banner.tsx
M	src/components/core/Banner/_tests/Banner.test.tsx
M	src/components/core/Card/Card.module.css
D	src/components/core/CelebrationSurface/CelebrationSurface.tsx
D	src/components/core/CelebrationSurface/_tests/CelebrationSurface.test.tsx
D	src/components/core/CelebrationSurface/_tests/wo-09-003-celebration-overlay.test.tsx
M	src/components/core/Chip/Chip.tsx
M	src/components/core/Chip/_tests/Chip.test.tsx
M	src/components/core/Chip/_tests/vocabulary.test.tsx
M	src/components/core/Chip/vocabulary.ts
M	src/components/core/CmdRow/CmdRow.tsx
D	src/components/core/CountBadge/CountBadge.tsx
D	src/components/core/CountBadge/_tests/CountBadge.test.tsx
D	src/components/core/DocHeading/DocHeading.tsx
D	src/components/core/DocHeading/_tests/DocHeading.test.tsx
D	src/components/core/ItemSlot/ItemSlot.tsx
D	src/components/core/ItemSlot/_tests/ItemSlot.test.tsx
D	src/components/core/KanbanColumn/KanbanColumn.tsx
D	src/components/core/KanbanColumn/_tests/KanbanColumn.test.tsx
M	src/components/core/Notice/Notice.module.css
M	src/components/core/PageHead/PageHead.module.css
D	src/components/core/PageLayout/PageLayout.tsx
D	src/components/core/PageLayout/_tests/PageLayout.test.tsx
D	src/components/core/PageTitle/PageTitle.tsx
D	src/components/core/PageTitle/_tests/PageTitle.test.tsx
D	src/components/core/Panel/Panel.tsx
D	src/components/core/Panel/_tests/Panel.test.tsx
M	src/components/core/ProgressBar/ProgressBar.tsx
M	src/components/core/RankEmblem/RankEmblem.tsx
M	src/components/core/SectionHead/SectionHead.module.css
M	src/components/core/SectionHead/SectionHead.tsx
M	src/components/core/SectionHead/_tests/SectionHead.test.tsx
D	src/components/core/Shield/Shield.tsx
D	src/components/core/Shield/_tests/Shield.test.tsx
D	src/components/core/StateBadge/StateBadge.tsx
D	src/components/core/StateBadge/_tests/StateBadge.test.tsx
M	src/components/core/Tabs/Tabs.module.css
M	src/components/core/Tabs/Tabs.tsx
M	src/components/core/Tabs/_tests/Tabs.test.tsx
D	src/components/core/TierBadge/TierBadge.tsx
D	src/components/core/TierBadge/_tests/TierBadge.test.tsx
D	src/components/core/XpBar/XpBar.tsx
D	src/components/core/XpBar/_tests/XpBar.test.tsx
M	src/components/modules/AppShell/_tests/AppShell.test.tsx
M	src/components/modules/CampaignPipeline/phases.ts
M	src/components/modules/DataModelViewer/ModelEdges.tsx
M	src/components/modules/DataModelViewer/viewer.module.css
M	src/components/modules/DocumentReader/DocumentReader.module.css
M	src/components/modules/FreshnessBadge/FreshnessBadge.tsx
M	src/components/modules/FreshnessBadge/_tests/FreshnessBadge.test.tsx
M	src/components/modules/GraphControls/graphControls.module.css
D	src/components/modules/GuildBar/GuildBar.tsx
D	src/components/modules/GuildBar/_tests/GuildBar.embedded.test.tsx
D	src/components/modules/GuildBar/_tests/GuildBar.test.tsx
D	src/components/modules/GuildBar/_tests/wo-09-003-guildbar.test.tsx
M	src/components/modules/GuildHero/GuildHero.tsx
M	src/components/modules/IdeaCard/IdeaCard.module.css
M	src/components/modules/IdeaCard/IdeaCard.tsx
M	src/components/modules/Nav/_tests/persistentNavigation.test.tsx
D	src/components/modules/Nav/navTab.ts
M	src/components/modules/ProjectCard/ProjectCard.module.css
D	src/components/modules/ProposalsBadge/ProposalsBadge.tsx
D	src/components/modules/ProposalsBadge/_tests/ProposalsBadge.test.tsx
M	src/components/modules/SectionedMarkdown/SectionedMarkdown.tsx
M	src/components/modules/manual-diagrams/ArchDiagram.tsx
M	src/components/modules/manual-diagrams/ChannelsDiagram.tsx
M	src/components/modules/manual-diagrams/CockpitDataDiagram.tsx
M	src/components/modules/manual-diagrams/DocH.tsx
D	src/components/modules/manual-diagrams/FlowGraph.tsx
M	src/components/modules/manual-diagrams/HooksDiagram.tsx
M	src/components/modules/manual-diagrams/ModificationGuide.tsx
M	src/components/modules/manual-diagrams/MultiRuntimeDiagram.tsx
M	src/components/modules/manual-diagrams/PipelineDiagram.tsx
M	src/components/modules/manual-diagrams/ProseTable.tsx
M	src/components/modules/manual-diagrams/RuntimeComparison.tsx
M	src/components/modules/manual-diagrams/SelfLearningLoop.tsx
M	src/components/modules/manual-diagrams/SnapshotMini.tsx
M	src/components/modules/manual-diagrams/SourceOfTruthMap.tsx
M	src/components/modules/manual-diagrams/StacksTable.tsx
M	src/components/modules/manual-diagrams/StateTable.tsx
M	src/components/modules/manual-diagrams/TeamDiagram.tsx
M	src/components/modules/manual-diagrams/VaultDiagram.tsx
M	src/components/modules/manual-diagrams/WorkflowShapeDiagram.tsx
D	src/components/modules/manual-diagrams/_tests/FlowGraph.test.tsx
M	src/components/modules/manual-diagrams/atoms.tsx
M	src/components/modules/manual-diagrams/prose.tsx
M	src/lib/_tests/active-projects.test.ts
M	src/lib/_tests/command-modes.test.ts
M	src/lib/achievements/_tests/seals-rarity.test.ts
M	src/lib/achievements/definitions.ts
M	src/lib/achievements/tiers.ts
M	src/lib/command-modes.ts
M	src/lib/constants.ts
M	src/lib/events/_tests/events.multi-runtime.test.ts
D	src/lib/gamification/_tests/gamification.test.ts
D	src/lib/gamification/agents.ts
M	src/lib/gamification/gamification.ts
D	src/lib/manual/skill-flows.ts
D	src/lib/pendingMerge/_tests/pendingMerge.test.ts
D	src/lib/pendingMerge/pendingMerge.ts
M	src/lib/portfolio/portfolio.ts
```


### 2026-10-31 — S7 partial implementation; retirement blocked by live consumers

Owner-directed responsive repairs extend the artifact list above. No commit, staging, merge, push,
merge queue, reviewer-suite edit, baseline change or decision-log write was performed.

Implemented and locally tested:
- Tabs reserve the actual 28 px overflow-control width when revealing keyboard-focused tabs. The
  dimension is shared between the reveal calculation and CSS through one custom property. Added a
  regression covering tabs beneath both arrows without changing the selected tab or window scroll.
- SectionHead places the note after the trailing rule; added a DOM-order regression.
- Single-column grid tracks use `minmax(0, 1fr)` in home, achievements, portfolio, documentation and
  idea/project cards. Notice bodies can shrink and wrap; card headers wrap and page headings break
  long words. These are static layout repairs, NOT browser-verified overflow fixes.
- The shared visually-hidden utility now resets margin, padding and border and uses `clip-path`.
  The responsive helper still needs reviewer attention: it currently classifies overflowing
  visually-hidden accessible text as clipped content, without checking its intentional clip.
- README describes the v2 shell/Fragua and lists static checks and oracle startup.
- Only `target_platforms` changed in `.pandacorp/status.yaml`, from `desktop` to `responsive`.
  This enables the existing blocking mobile pass; it does not certify the four-width gate.

The WO's explicit stop-on-live-consumer clause prevents completing retirement within its current
scope. Live source evidence in this checkout:
- `src/app/manual/DocReader.tsx` imports `getManualPageComponent`; `manualPages.tsx` imports Panel and
  ItemSlot, renders legacy Chip tones and authored diagrams. Those diagrams still import Panel,
  ItemSlot, v1 tokens and Tabler classes. Deleting the compatibility block, Panel, ItemSlot, Chip's
  legacy branch or the CDN would damage this live reader. Migrating these consumers is outside the
  retirement artifacts. Owner scope clarification was requested; no answer was received at writing.
- `src/components/modules/CampaignPipeline/phases.ts:24,167,193` still imports and uses
  `IMPLEMENT_MODES`; it is not a dead export.
- No retirement paths were deleted, and Dagre/package/lockfile remain unchanged while this scope
  dependency is unresolved. This WO is BLOCKED, not built/IN_REVIEW.

Already resolved in the incoming tree, verified by source reads rather than reimplemented:
- VersionFreshness uses an amber Notice; the retired MemoryHealth component is absent and the live
  proposals summary uses Notice for its positive state.
- No nested main remains in page source. HTTP SSR confirms one main and one h1 on 13 manifest routes.
- TierBadge already maps rarity tones through Chip; deleting TierBadge itself remains retirement work.

Reviewer reconciliation required before retirement (all files preserved):
- Remove the three explicitly derogated suites: `src/lib/gamification/_tests/gamification.integration.reviewer.test.tsx`,
  `src/app/_design/tokens/_tests/tokens.adversarial.review.test.ts`,
  `src/app/_design/tokens/_tests/frd13.integration.reviewer.test.tsx`.
- Rewrite `src/app/_tests/agentColorTokens.integration.reviewer.test.ts` and the retired-reader cases
  of `src/lib/git/_tests/fixtureSeams.reviewer.test.ts` (imports `readPending`).
- Inspect/remove subject-only suites under `src/app/_observability/`: `_tests/frd12.gate.review.test.tsx`,
  `_tests/frd12.integration.review.test.tsx`, `selectors/freshness/_tests/freshness.adversarial.test.ts`,
  `selectors/rate/_tests/{rate.adversarial,rate.review}.test.ts`,
  `selectors/timeline/_tests/{timeline.acceptance,timeline.adversarial,timeline.review2}.test.ts`,
  `selectors/topn/_tests/topn.adversarial.test.ts`.
- Remove/rewrite retired-subject cases in
  `src/components/core/StateBadge/_tests/StateBadge.adversarial.test.tsx` and
  `src/components/core/CelebrationSurface/_tests/wo-09-003-celebration-honesty.adversarial.test.tsx`.
  Inspect `src/components/modules/Nav/_tests/persistentNavigation.test.tsx` for its navTab contract.
- Keep BOTH FRD-21 suites unchanged:
  `src/lib/pendingMerge/_tests/worktreesByRepo.malformed.reviewer.test.ts` and
  `src/lib/pendingMerge/_tests/worktreesByRepo.realgit.reviewer.test.ts`.
  Also keep `src/lib/gamification/_tests/ledger.adversarial.reviewer.test.ts`.
- `src/lib/events/_tests/events.multi-runtime.test.ts` imports the retired agent XP engine outside
  this WO's artifacts; its event-contract cases need preservation when that assertion is retired.
- `src/app/_tests/layout.shell.reviewer.test.tsx` only mentions GuildBar in a source assertion and
  `projects/[slug]/_components/wo-views/_tests/frd-05-gate.reviewer.test.tsx` imports the KEPT nested
  observability modules. These search hits are NOT permission to delete either suite.

Verification from `mission-control/`, with `export PORT=3999 PANDACORP_E2E_PORT=3999`:
- `pnpm exec knip`: exit 0, no unused-code findings; existing configuration hints remain.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm exec biome check .`: exit 0; existing schema-version info (2.5.1 config / 2.5.2 CLI).
- `pnpm lint:cycles`: exit 0, no circular dependencies; madge reports one warning.
- `pnpm exec vitest run src/components/core/Tabs src/components/core/SectionHead --maxWorkers=2`:
  exit 0, 4 files / 36 tests passed.
- `pnpm exec vitest run 'src/app/(dashboard)' src/app/portfolio src/app/manual src/app/proposals src/app/achievements src/components/core/Tabs src/components/core/SectionHead src/components/core/Card src/components/core/PageHead src/components/core/Notice src/components/modules/IdeaCard src/components/modules/ProjectCard --maxWorkers=2`:
  exit 0, 62 files / 545 tests passed.
- `pnpm exec vitest run src/app src/components/core/Tabs src/components/core/SectionHead src/components/core/Card src/components/core/PageHead src/components/core/Notice src/components/modules/IdeaCard src/components/modules/ProjectCard --maxWorkers=2`:
  exit 0, 208 files / 2,285 tests passed (expanded app coverage for the global CSS change).
- `git diff --check`: exit 0.

Runtime limits and remaining red evidence:
- No Playwright was run, as instructed. CUA browser inventory reports the browser access host
  unavailable. Overflow, clipping, tap targets, arrow visibility and themes at 320/375/768/1280
  remain unverified; no visual gate pass is claimed.
- `pnpm dev:oracle --port 3999` initially reported EMFILE watcher errors and served 404s. Restarting
  the same checkout with `WATCHPACK_POLLING=1000` removed those errors and restored HTTP 200 on 13
  routes. No cache or fixture directory was deleted/recreated.
- A bounded Python urllib/HTMLParser SSR probe against all 14 `e2e/routes.ts` paths found exactly one
  main and h1 on every 200 response. `/projects/mission-control` still returns 404 in oracle mode.
- The existing `e2e/responsive.spec.ts` iterates BLESSED (8 routes) at `MOBILE_WIDTH = 390` only;
  flipping the platform alone does NOT produce the promised four widths on all 14 routes. A
  reviewer-owned gate reconciliation is still required; no test was weakened or skipped here.

The isolated dev server was stopped after the SSR probe. All 24 tracked changes remain unstaged.
