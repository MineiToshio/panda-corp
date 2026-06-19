# Component inventory — Mission Control (the PDD's living component list)

**This is the single source of truth for shared components across ALL Mission Control surfaces.**
Foundation primitives are built first (the foundation wave) and reused; **check this before creating
any component (DR-057)**. One inventory per project — never duplicated per feature. Seeded from the
frozen design system (`docs/design/design-tokens.json`, root `DESIGN.md`), extracted from the
owner-approved whole-app prototype (`docs/design/prototype/index.html`, the Party slices
`party-proposal.html` / `party-pipeline.html`; DR-054/056). Each row:
**name · purpose · path · key props/variants · status**. All components consume tokens only — no
hardcoded colors/spacing/radii.

> **Reuse order before creating anything new** (project-structure rule): `components/core` →
> `components/modules` → the route's `_components/` → the route itself. **Reuse → adapt/extend
> (add a prop/variant) → create new only if genuinely none fits.** A near-duplicate component (a
> second banner/card/modal/tabs) is a **defect**, rejected at review.
>
> **Status legend:** *real* = the component exists today at the cited path; *planned* = factored out
> of the frozen prototype by this re-anchor, to be implemented by the foundation / feature wave.
> Where an FDD named a primitive inline (a CSS class like `.cmd`/`.stab`/`.secthead`/`.panel`), the
> canonical primitive is listed once with its aliases — **do not fork a near-duplicate** for a class
> the FDD happened to name differently.

---

## 1. Core primitives — the FOUNDATION (built FIRST, reused by ALL surfaces)

`src/components/core/` (and the design-token runtime in `src/app/_design/`, the a11y set in
`src/components/a11y/`). These are the shared visual vocabulary every surface assembles from.

| Name | Purpose | Path | Key props / variants | Status |
|---|---|---|---|---|
| `Button` | The primary action / nav-back / small action button (1 primary per screen) | `src/components/core/Button/Button.tsx` | `variant` (primary/secondary/ghost), `size`; `≥44px` hit area | **planned** (factor out; today inline per surface) |
| `Chip` | Status / count / label pill — **the one pill primitive** (`.chip`) | `src/components/core/Chip/Chip.tsx` | `tone` (ok/warn/danger/info/accent/secondary); `frd`/`verde`/`live` are tone presets, not new components | **planned** (aliases: `frdChip`, `chip2`, `dchip`, `bchip`, `live`/`sin-señal` chips) |
| `CountBadge` | Numeric pill for rail/badge counts (decisions/bugs/proposals), `tabular-nums`, canvas-colored numeral, 17px min | `src/components/core/CountBadge/CountBadge.tsx` | `count`, `tone` (warn/danger/accent) | **planned** (a `Chip` count preset; keep as named variant, not a fork) |
| **`Banner`** | **THE shared warn/info/ok/danger banner strip** — left status icon + heading + detail + optional command row, dismissible, multi-item + collapse. **Single source for ALL app banners.** | `src/components/core/Banner/Banner.tsx` | `tone` (warn/info/ok/danger), `kind` (drift/orphan/gate/error/inline), `commandRow?`, `dismissible?`, `items[]` + `collapseAfter` | **planned** — **DR-057 dup-fix target (see ⚠ note below)** |
| `Panel` / `RpgPanel` | The app-wide surface — base `.panel` re-skinned by the RPG embossed override (`rpgpanel`/`rpggrid`); `.secondary` is the resting-tile variant | `src/components/core/Panel/Panel.tsx` | `variant` (panel/rpgpanel/secondary), `grid?` (rpggrid), `glow?` (warn/accent), `spot?`, elevation (shadow-0/1/2) | **planned** (aliases: `.panel`, `.rpgpanel`, `.rpggrid`, `.secondary`, `.rpghall` wrapper) |
| `Toast` | Transient bottom confirmation ("copiado") — small, sober, NOT a celebration | `src/components/core/Toast/Toast.tsx` | `message`, auto-dismiss; reduced-motion | **planned** (prototype `toast()`); distinct from `AchievementToast` (Party) |
| `CopyButton` | Copy-to-clipboard button (commands, ids, paths) | `src/components/core/CopyButton/CopyButton.tsx` | `value`, copied state, accessible label | **real** |
| `CmdRow` | Mono command row (`.cmd`): inset on canvas, `bd2` hairline, `mono` + `tabular-nums`, with a `CopyButton` | `src/components/core/CmdRow/CmdRow.tsx` | `command`, copy; **THE command-chip primitive** | **planned** (aliases: `cmdRow`, `docCmd`, `CommandChip`, `CommandClip`) |
| `SectionHead` | Section divider — display-font label + trailing 1px rule + optional right count (`.secthead`) | `src/components/core/SectionHead/SectionHead.tsx` | `label`, `count?`, `icon?` | **planned** (aliases: `secthead`, `SectHead`, `SectionHeader`, `.ln`) |
| `Tabs` / `SubTabs` | Tab/sub-tab pill switcher — **the one tab primitive** | `src/components/core/Tabs/Tabs.tsx` | `level` (top `.tab` / project `.stab`), `active`; `aria` tab semantics | **planned** (aliases: `.tab`, `.stab`, `SubTabs`, `DetailTabs`, `cfgTabs`, `logrosTabs`); reused as `RailItem`'s sibling but distinct |
| `ProgressBar` | Mission-objectives bar — accent fill, `var(--ok)` at 100%, `done/tot · pct%` | `src/components/core/ProgressBar/ProgressBar.tsx` | `done`, `total`, `pct`, `complete` tone | **planned** (today `objectives-bar.tsx` / `wo-progress.tsx` inline) |
| `XpBar` | RPG striped XP/progress bar (`rpgSkin.xpbar`), segmented stripes, accent fill | `src/components/core/XpBar/XpBar.tsx` | `value`, `max`; compact (9–14px) / full (18px) sizes; `role=progressbar` | **real** |
| `Shield` | The crest medallion (`rpgSkin.shield`, 96×96, accent-bordered glowing) with pixel NIVEL numeral | `src/components/core/Shield/Shield.tsx` | `level`, `size`, glow | **planned** (in `GuildHero` today) |
| `TierBadge` | Bronze→Legend rarity medal — tier **name text always rides with color** (never color alone) | `src/components/core/TierBadge/TierBadge.tsx` | `tier` (1–5 / `tiers.tier1..5`), `name` | **planned** (in `ChainCard` today; aliases: `.node` ladder pip) |
| `ItemSlot` | Pixel-art medal/icon slot (`rpgSkin.itemslot`, `image-rendering:pixelated`) | `src/components/core/ItemSlot/ItemSlot.tsx` | `icon`, `size`, tone (accent/warn/ok/danger), `lock`/`reveal` (locked-trophy) | **planned** (aliases: `.itemslot`, `.lockslot`, `.lockchip`) |
| `Avatar` | Pixel-art agent/role avatar (per-agent `AVCOL` color) | `src/components/core/Avatar/Avatar.tsx` | `role`/`id`, `size`, `pixelated` | **real** |
| `StateBadge` | Status pill conveying state by **icon + shape + text + color** (never color alone) — the canonical FRD-13 a11y idiom | `src/components/core/StateBadge/StateBadge.tsx` | `state` (ok/warn/danger/info/working/idle/failed/reviewing/blocked), label, `aria-label` | **real** |
| `ThemeToggle` | Light/dark theme switch (both first-class) | `src/components/core/ThemeToggle/ThemeToggle.tsx` | — | **real** |
| `DocHeading` | Page/section reading heading — accent ledge + title (`docH`) | `src/components/core/DocHeading/DocHeading.tsx` | `title`, `level` | **planned** (aliases: `docH`) |
| `KanbanColumn` | Fixed-width WO column (`.col`, 224px, header label + count, horizontal-scroll row) | `src/components/core/KanbanColumn/KanbanColumn.tsx` | `label`, `count`; horizontal scroll | **planned** (in `wo-board.tsx` today) |
| `CelebrationSurface` | Achievement/celebration surface — the reserved expressive moment, reduced-motion aware | `src/components/core/CelebrationSurface/CelebrationSurface.tsx` | reduced-motion variant | **real** |
| `DiscardButton` | Discard action (the app's only write) with confirm flow | `src/components/core/DiscardButton/DiscardButton.tsx` | confirm flow | **real** |
| `LiveRegion` | `aria-live="polite"` announcer — announce events without stealing focus | `src/components/a11y/LiveRegion.tsx` | `message`, politeness | **real** |
| `useKeyboardNav` | Keyboard list-navigation hook (a11y primitive) | `src/components/a11y/useKeyboardNav.ts` | list nav | **real** |
| design tokens | Frozen token runtime (`AGENT_ROLES`/`AGENT_COLOR`, surfaces/text/borders/accent/status/tiers) | `src/app/_design/tokens/tokens.ts` + `src/app/globals.css` | the contract; no hardcoded literals | **real** |

> ⚠ **The shared `Banner` — DR-057 duplicate-banner fix (the defect that started DR-057).**
> `PluginSyncBanner` (FRD-15, `src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx`) and
> `OrphansBanner` (FRD-16, `src/app/_components/orphans-banner/orphans-banner.tsx`) **each re-declare
> an identical** `BANNER_STYLE` / `ICON_STYLE` / `CMD_ROW_STYLE` / `RECALL_STYLE` block — this is the
> exact duplicate-banner bug. **There MUST be ONE core `Banner` primitive** (variants: tone
> warn/info/ok/danger; `kind` drift/orphan/gate/error/inline; optional command row; dismissible;
> multi-item + collapse). The two banners, the dashboard health banners (FRD-18 gate/drift/orphan),
> the portfolio path-not-found warning (FRD-03), the inline tab/board read-error banners (FRD-04/05),
> and the memory-health staleness nudge (FRD-17) are all **consumers of that one `Banner`**, not new
> components — see the modules below tagged *"refactor onto shared `Banner`"*.

---

## 2. Modules — composed, surface-specific but reusable

`src/components/modules/` and route-local `_components/`. Built FROM the core primitives above; never
re-implement a primitive inside one.

| Name | Purpose | Path | Key props / variants | Status |
|---|---|---|---|---|
| `PluginSyncBanner` | Plugin-drift warning banner (FRD-15) | `src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx` | `kind="drift"` consumer of `Banner` | **real** — ⚠ **refactor onto shared `Banner`** |
| `OrphansBanner` | Orphan/unlisted-project banner (FRD-16), multi-item + collapse + dismiss | `src/app/_components/orphans-banner/orphans-banner.tsx` | `kind="orphan"` consumer of `Banner` (dismissible, collapsible) | **real** — ⚠ **refactor onto shared `Banner`** |
| `OnboardingGate` | First-boot onboarding gate banner (FRD-01) | `src/app/_components/OnboardingGate/OnboardingGate.tsx` | `kind="gate"` consumer of `Banner` | **real** — should reuse shared `Banner` |
| `IdeaCard` | Board idea card (category + return labels, score, building indicator) | `src/components/modules/IdeaCard/IdeaCard.tsx` | `idea`, `recommended`, `building` | **real** |
| `CategoryFilter` | Filter the board by `project_type` | `src/components/modules/CategoryFilter/CategoryFilter.tsx` | `selected`, `onChange` | **real** |
| `BoardLegend` | Legend for category/return/score | `src/components/modules/BoardLegend/BoardLegend.tsx` | — | **real** |
| `IntakeModal` | New-idea intake modal (board) | `src/app/board/_components/IntakeModal/IntakeModal.tsx` | focus-trap, Escape, return-focus | **real** |
| `CardDetail` | Board card detail — three tabs Campaña · Documentos · Comandos (FRD-02) | `src/app/board/_components/CardDetail/CardDetail.tsx` | active tab persisted; uses `Tabs` | **real** |
| `CampaignPipeline` | La Campaña 6-phase trail (board card-detail Campaña tab, FRD-02) | `src/components/modules/CampaignPipeline/CampaignPipeline.tsx` | `activePhase`, `onPhaseClick`; phase rooms + connectors | **real** |
| `ProjectRail` / `RailItem` | Portfolio rail — selectable nav primitive (`.rail`/`.rail.on`): status icon + title + count badges + stage line | `src/components/modules/ProjectRail/ProjectRail.tsx` | `project`, `selected`; distinct from `Tabs` and docs `.navitem` | **real** |
| `ProjectRow` / `PortfolioTable` | Portfolio rows / table | `src/components/modules/{ProjectRow,PortfolioTable}/*.tsx` | `project` | **real** |
| `RecoveryHint` | Path-not-found recovery (clone/sync command) on a rail row (FRD-03) | `src/app/portfolio/_components/RecoveryHint/RecoveryHint.tsx` | consumer of `Banner` (path-not-found) | **real** — should reuse shared `Banner` |
| `PortfolioEmpty` | Empty-portfolio state (FRD-03) | `src/app/portfolio/_components/PortfolioEmpty/PortfolioEmpty.tsx` | — | **real** |
| `BusinessSnapshot` | Shipped-project business snapshot (active users / return / verdict, FRD-03) | `src/app/portfolio/_components/BusinessSnapshot/BusinessSnapshot.tsx` | real read-only data | **real** |
| `WorkspaceShell` / `WorkspaceHeader` / `Tabbar` | Project workspace shell, header (title + status chip + progress bar), subtab bar (FRD-04) | `src/app/projects/[slug]/_components/{workspace-header,tabbar}.tsx` | tabs Resumen·Work orders·Party·Documentos·Comandos | **real** |
| `ObjectivesBar` | "Objetivos de la misión" header progress bar (FRD-04) | `src/app/projects/[slug]/_components/objectives-bar.tsx` | consumer of `ProgressBar` | **real** |
| `SnapshotPanel` | Probable-green snapshot panel (FRD-04/14): icon + last-green FRD + sha + `git worktree` command | `src/app/projects/[slug]/_components/snapshot-panel/snapshot-panel.tsx` | `running`, building-now line, staleness warning | **real** |
| `TabSummary` / `DecisionCard` / `ActivityLog` | Resumen tab: doc panel + decision points + activity log (FRD-04) | `src/app/projects/[slug]/_components/tab-summary/tab-summary.tsx` | decisions warn-bg + `/pandacorp:decide` cmd; dotted-rule log rows | **real** |
| `TabDocuments` / `DocNav` / `DocView` | Documents tab: doc-nav rail + rendered markdown (FRD-04/08) | `src/app/projects/[slug]/_components/tab-documents/tab-documents.tsx`; `src/app/manual/DocNav.tsx` | `.navitem` nav + `.panel.doc` body | **real** |
| `TabCommands` / `CommandsBox` | Commands tab: build-mode panel + stage-relevant `/pandacorp:*` rows (FRD-04/11) | `src/app/projects/[slug]/_components/tab-commands/tab-commands.tsx` | uses `CmdRow` | **real** |
| `BuildModeSelector` | 4-mode picker (Pro/Equilibrado/Potente/Profundo) → surfaces the matching `/pandacorp:implement…` command (FRD-11); read/copy, not a build trigger | `src/app/projects/[slug]/_components/mode-selector/mode-selector.tsx` | `mode` (pro/balanced/powerful/deep), selected = read-only data | **real** |
| `WoBoard` / `KanbanColumn` use | Work-orders kanban — todo·progress·review·fail·done (FRD-05/12), read-only | `src/app/projects/[slug]/_components/wo-board/wo-board.tsx` | uses `KanbanColumn`; horizontal scroll | **real** |
| `WorkOrderCard` | WO card (`.card`): wrapping title + FRD chip; `fail` danger variant (NOT a 2nd card) | `src/app/projects/[slug]/_components/wo-board/wo-board.tsx` (card) | `wo`, `fail` variant | **real** |
| `WoDetail` | Single work-order detail (Resumen / Documento completo) (FRD-05) | `src/app/projects/[slug]/_components/wo-detail/wo-detail.tsx` | uses `Tabs`, `DocView` | **real** |
| `WoFrdFilter` / `WoFrdFilteredBoard` / `WoEmpty` / `WoProgress` | WO board filter, filtered board, empty state, progress (FRD-05) | `src/app/projects/[slug]/_components/wo-*/…` | — | **real** |
| `SkillCard` | Configuración/Manual skill card: wand tile, `/cmd`, run-location, party thumbnails (FRD-07/08) | `src/app/configuration/SkillList.tsx` (+ `SkillDetail.tsx`) | `skill`; reused in Manual Referencia | **real** (aliases: `gxSkillCard`) |
| `AgentCard` | Agent card: pixel avatar + model chip + NV/title line (FRD-07/08) | `src/app/configuration/AgentList.tsx` (+ `AgentDetail.tsx`) | `agent`; reused in Manual Referencia | **real** (aliases: `gxAgentCard`) |
| `RuleCard` | Decision-rule card: gavel/check tile, asks-you vs auto split (FRD-07/08) | `src/app/configuration/_rules/DecisionRulesSection/DecisionRulesSection.tsx` | `rule`; ●/● by icon+text | **real** (aliases: `gxRuleCard`) |
| `StandardCard` | Standard card grouped by domain: book tile + severity + enforcement badges (FRD-07/08) | `src/app/configuration/StandardsSection/StandardsSection.tsx` | `standard`, `SeverityBadge`/`EnforcementBadge` | **real** (aliases: `gxStdCard`) |
| `SectionHero` | Section banner (`gxHero`): `rpgpanel rpggrid` + 46px accent `itemslot` + title + sub (FRD-07/08/17) | `src/app/configuration/ConfigurationShell.tsx` (+ `ManualShell.tsx`) | `title`, `sub`, `icon` | **real** (aliases: `gxHero`) |
| `FlowDiagram` | Skill mini-flow graph: agent/action/gate/safe/io nodes + `↓` arrows + loop chip (FRD-07) | `src/app/configuration/FlowDiagram.tsx` | `nodes`, clickable agent nodes (per `AVCOL`) | **real** (aliases: `flowDiagram`/`flowNode`) |
| `AgentChips` | Clickable jump-to-agent pills (FRD-07) | (in `SkillDetail.tsx`) | `agentIds` | **real** (aliases: `agentChips`) |
| Manual diagrams | Pipeline/Team/Channels/Arch/CockpitData/Snapshot concept diagrams (data+tokens, no images) (FRD-08) | `src/app/manual/DocReader.tsx` (+ helpers) | `PipelineDiagram`/`TeamDiagram`/`ChannelsDiagram`/`ArchDiagram`/`CockpitDataDiagram`/`SnapshotMini` | **real** (in `DocReader`) |
| Manual readers | Landing / Quickstart / GuideDoc / DocPage / RefSection (Diátaxis page kinds) (FRD-08) | `src/app/manual/{ManualShell,DocReader,Reference*}.tsx` | reuses Config cards in Referencia | **real** |
| `GuildBar` | Guild/status top bar (`topbar`): logo + title + NV level pill + guild title + inline `XpBar` (FRD-09) | `src/components/modules/GuildBar/GuildBar.tsx` | level, title, xp | **real** |
| `GuildHero` | Character-sheet hero (`logrosHero`): `Shield` crest + guild title + summary + full `XpBar` + party roster (FRD-09/10) | `src/app/achievements/page.tsx` (hero block) | level, title, roster | **real** (in achievements page; aliases: `logrosHero`) |
| `StatRadar` | "Atributos del gremio" 6-axis SVG radar — accent polygon + glow, pixel-font axis labels (FRD-09/10) | `src/app/achievements/StatsPanel.tsx` | `axes`, values | **real** (in `StatsPanel`; aliases: `statRadar`) |
| `ChainCard` | Tier chain card (Bronze→Legend ladder) — `ItemSlot` medal + `TierBadge` ladder + `XpBar` + next-tier; spot/mini variants (FRD-10) | `src/app/achievements/ChainCard/ChainCard.tsx` | `chain`, `variant` (card/spot/mini); date+project stamp | **real** (aliases: `rpgChainCard`/`rpgChainSpot`/`rpgChainMini`) |
| `TrophyCard` | One-time trophy (`rpgOneCard` unlocked / `rpgTrophyLock` locked hover-reveal / secret silhouette) (FRD-10) | `src/app/achievements/UniquesSection/UniquesSection.tsx` (+ `SecretsPanel`) | `trophy`, `locked`, `secret`; `:focus-within` reveal | **real** (aliases: `rpgOneCard`/`rpgTrophyLock`) |
| `AlmostThere` | "Próximas hazañas · a un paso de caer" (Zeigarnik top-3 nearest, FRD-10) | `src/app/achievements/AlmostThere.tsx` | top-3 chains by % | **real** (aliases: `questsNear`) |
| `HeroStat` / `StatLedgerRow` | Record stat tile + ledger row with tier pip (FRD-10) | `src/app/achievements/StatsPanel.tsx` | pixel numeral, `tabular-nums`, tier `.node` | **real** |
| `KpiHeader` / `StatTile` | "Pulso de la fábrica" ≤5 KPI tiles — pixel 30px numeral + state accent (FRD-12/18) | `src/app/_observability/KpiHeader/KpiHeader.tsx` | `kpis[]` (cap 5), `dStat` tiles | **real** (aliases: `dStat`/`Pulso`) |
| `Pulso` | Dashboard pulse section host (FRD-18) | `src/components/modules/Pulso/Pulso.tsx` | conversion metric | **real** |
| `Digest` / `EventCard` | "Desde tu última visita" digest + event cards — `.secondary` tile, status icon, title+source+`ago()`; `isNew` border + `dim` (FRD-12/18) | `src/components/modules/Digest/Digest.tsx` | `events`, `seenMarker`; `isNew`/`dim` variants | **real** (aliases: `digestSection`/`evCard`) |
| `FreshnessBadge` / `FreshnessChip` | Live / no-signal data-freshness chip — icon+text+color (en vivo/sin señal + timestamp) (FRD-12) | `src/app/_observability/FreshnessBadge/FreshnessBadge.tsx` | `signal`, `ago` | **real** |
| `TuTurno` / `QueueRow` | Human-gate queue — 34px icon badge + title/sub + inline `CmdRow`, priority-tinted (FRD-18) | `src/components/dashboard/TuTurno/TuTurno.tsx` | `items[]`, priority order; `qrow` | **real** (aliases: `qrow`) |
| `Cartera` / `ProjectCard` | "Construcción y cartera" project card — status/live/stalled/bugs chips, progress bar, next-command, inline blocker (FRD-18) | `src/components/dashboard/Cartera/Cartera.tsx` | `project`; `.panel`, fail blocker line | **real** |
| `Progreso` | "Tu progreso" gamification foot — `RpgPanel` + medal + next milestone + operator `XpBar` (FRD-18) | `src/components/dashboard/Progreso/Progreso.tsx` | level, achievement, milestone | **real** |
| `EventsRateChart` / `TimelineView` / `RpgTimelineToggle` / `WorkOrderDag` | Observability dataviz: events-rate chart, timeline view, RPG↔timeline toggle, work-order DAG (FRD-12) | `src/app/_observability/{EventsRateChart,TimelineView,RpgTimelineToggle,dag/WorkOrderDag}/…` | dependency-chain highlight, jump-to-error | **real** (the FRD's DAG/timeline beyond the prototype, now built) |
| `ProposalCard` | Proposal card (FRD-17), 4 kinds: candidate lesson / promotion / prune / self-suggestion — kind tag + icon + evidence + command + dismiss | `src/app/proposals/_components/ProposalCard/ProposalCard.tsx` | `kind`, `evidence`, `command`, `candidate` (eval-gate) treatment | **real** |
| `ProposalStream` / `DismissableProposalStream` | Proposal list grouped by kind, dismissible (FRD-17) | `src/app/proposals/_components/{ProposalStream,DismissableProposalStream}/…` | `proposals[]`, dismiss store | **real** |
| `PromotionsQueue` / `PromotionState` | Durable promotions queue — proposed → tú revisas → approved · rejected (FRD-17) | `src/components/modules/PromotionsQueue/PromotionsQueue.tsx` | `lessons` (`promotion: proposed`), target chip | **real** |
| `MemoryHealthPanel` | Self-learning loop health — 3 `tabular-nums` counters + `Banner`-style staleness nudge (FRD-17) | `src/components/modules/MemoryHealth/MemoryHealth.tsx` | pending notes / candidates / last-run; nudge | **real** — staleness nudge should reuse shared `Banner` |
| `ProposalsBadge` / `ProposalsChip` | Top-bar open-count badge + per-project rail proposals chip (FRD-17) | `src/components/modules/ProposalsBadge/ProposalsBadge.tsx` | `count`; consumers of `CountBadge`/`Chip` | **real** |
| `StatusChips` | Portfolio-rail decisions/bugs/rethink chips — counts `tabular-nums` + Spanish label (FRD-14) | `src/app/portfolio/_components/status-chips/status-chips.tsx` | `pendingDecisions`, `pendingBugs`, `rethinkPending`; consumer of `CountBadge` | **real** |

> Reuse-before-create reminders captured from the FDDs: `WorkOrderCard` is the `.card` primitive with
> a `fail` variant (not a 2nd card); the Manual **Referencia** reuses Config's `SkillCard`/`AgentCard`/
> `RuleCard`/`StandardCard` verbatim; `RailItem` (`.rail`), top `.tab` and docs `.navitem` are three
> distinct nav surfaces — pick the right one, do not fork. `ProposalsBadge`/`ProposalsChip`/
> `StatusChips`/`CountBadge` are all `Chip`/`CountBadge` presets, not new pills.

---

## 3. Cross-cutting — the Party set + FRD-13 a11y primitives

### Party — La Fragua (FRD-06) & La Campaña (FRD-02)

Party-scoped (under `src/app/projects/[slug]/_party/` and the board card-detail). They render the
pixel-RPG Party canvas faithfully to the approved prototype (`docs/design/prototype/party-proposal.html`,
`party-pipeline.html`); sprite/grid/room sizes, state machines and keyframes are the `party` token
group, the surface skin the `rpgSkin` group. **This pixel-RPG / "guild" style is Mission Control's own
internal-tool identity — it is NOT a template for product apps.**

| Name | Purpose | Path | Key props / variants | Status |
|---|---|---|---|---|
| `Room` | Pixel-art zone room (Forge/Tribunal/Bóveda; the 6 Campaña phases) + label + count/badge | `src/app/projects/[slug]/_party/Room/Room.tsx` | `zone`, `state` (cool/hot/active/done/locked), `label`, `count` | **planned** (composed in `FraguaScene`/`CampaignPipeline` today) |
| `StoneBridge` | PNG stone connector between rooms; active one **flows** the deliverable | `src/app/projects/[slug]/_party/StoneBridge/StoneBridge.tsx` | `orientation` (h/v), `flow`, `pos` | **planned** |
| `FlowStrip` | Always-visible whole-pipeline strip lighting the active beat(s) + hover tooltips (8 beats) | `src/app/projects/[slug]/_party/FlowStrip/FlowStrip.tsx` | `beats`, `activeKeys`; hidden in embed | **planned** |
| `PowerOffOverlay` | Factory-off treatment derived from real state (desaturate map, tidy sprites, "Fábrica apagada") | `src/app/projects/[slug]/_party/PowerOffOverlay/PowerOffOverlay.tsx` | derived `off`; today `PartyEmptyState` | **planned** (today: `PartyEmptyState/PartyEmptyState.tsx` — **real**) |
| `MissionBar` | Real mission surface (`.quest`): FRD pips + global WO counter + **effort as read-only data** (DR-061) | `src/app/projects/[slug]/_party/MissionBar/MissionBar.tsx` | `frdPips`, `done`, `total`, `effort` (read-only) | **planned** |
| `DemoControls` | **DR-061** wrapper — dashed-border + `SOLO DEMO` tag + one-line note for preview-only controls; never ships read-only | `src/app/projects/[slug]/_party/DemoControls/DemoControls.tsx` | `note`, children; demo-only | **planned** |
| `AgentSprite` | 52/54/58px pixel implementer/specialist sprite (1 = 1 running WO) with halo, progress, tag | `src/app/projects/[slug]/_party/AgentSprite/AgentSprite.tsx` | `role`, `size`, `state` (work/review/carry/vault/split/idle/walking/say-on) | **planned** (in `FraguaScene`) |
| `JudgeSprite` | The single reviewer per FRD — dim until the gate opens, then paces the Tribunal | `src/app/projects/[slug]/_party/JudgeSprite/JudgeSprite.tsx` | `active`, `judgingTarget` | **planned** |
| `SpeechBubble` | Agent speech bubble (`sayin`; even columns talk higher) | `src/app/projects/[slug]/_party/SpeechBubble/SpeechBubble.tsx` | `text`, `raised`, via `say-on` | **planned** |
| `Tooltip` | Hover tooltip for a sprite/beat (WO id+title; phase role+name) | `src/app/projects/[slug]/_party/Tooltip/Tooltip.tsx` | `content`, anchor | **planned** |
| `Parchment` | The travelling 📜 = the real Status-Note hand-off between dependent WOs | `src/app/projects/[slug]/_party/Parchment/Parchment.tsx` | `from`, `to` (Build Plan dependency) | **planned** |
| `DeepRelay` | Deep-mode sequential 3-step relay within one WO (test-writer → backend → frontend) | `src/app/projects/[slug]/_party/DeepRelay/DeepRelay.tsx` | `step`, contract published | **real** |
| `EventFeed` | Bitácora del gremio — role icon + `tabular-nums` timestamp, failure first-class, capped + pinnable | `src/app/projects/[slug]/_party/EventFeed/EventFeed.tsx` | `events`, `pinned` | **real** |
| `AchievementToast` | "¡Logro desbloqueado!" toast on WO close (Party-scoped), reduced-motion variant | `src/app/projects/[slug]/_party/AchievementToast/AchievementToast.tsx` | `wo`, reduced-motion; distinct from core `Toast` | **real** |
| `FraguaScene` | The La Fragua living-map scene composition (stage + rooms + bridges + sprites) | `src/app/projects/[slug]/_party/FraguaScene/FraguaScene.tsx` | `snapshot` (derived from events) | **real** |
| `PartyScene` / `PartyTab` | Party tab shell + scene host | `src/app/projects/[slug]/_party/{PartyScene,PartyTab}/*.tsx` | — | **real** |

### FRD-13 a11y primitives (also listed in Core §1, repeated here as the cross-cutting set)

The visual/a11y contract every surface inherits — see §1 for `StateBadge`, `ThemeToggle`, `LiveRegion`,
`useKeyboardNav`, and the design-token runtime (`src/app/_design/tokens/tokens.ts`, `globals.css`).
These enforce: state by **icon+shape+text** (never color alone), visible focus ring, `tabular-nums` on
every number, light/dark both first-class, `prefers-reduced-motion` respected, WCAG AA contrast in both
themes.

| Name | Purpose | Path | Status |
|---|---|---|---|
| `StateBadge` | Canonical state idiom — icon + shape + label + color | `src/components/core/StateBadge/StateBadge.tsx` | **real** |
| `ThemeToggle` | Light/dark switch (both first-class) | `src/components/core/ThemeToggle/ThemeToggle.tsx` | **real** |
| `LiveRegion` | `aria-live` polite announcer | `src/components/a11y/LiveRegion.tsx` | **real** |

---

### Notes

- *(planned)* rows are the primitives this re-anchor (DR-054/056) factors out of the approved
  prototype; some are composed inline today (e.g. inside `FraguaScene`, `wo-board`, the achievements
  page). The foundation wave implements them as named, reusable components against the frozen tokens +
  the per-FRD `mocks/`. *(real)* rows exist today at the cited path.
- **One banner, one chip, one panel, one tab, one command-row, one section-head.** The aliases noted
  in each row (`gxHero`/`secthead`/`.stab`/`cmdRow`/`frdChip`/…) are the same primitive named
  differently across FDDs — collapse to the canonical row, never fork.
