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
| `Button` | The primary action / nav-back / small / **destructive** action button (1 primary per screen) | `src/components/core/Button/Button.tsx` | `variant` (primary/secondary/ghost), `tone` (default/**danger** — `primary`+`danger`=filled red, `secondary`+`danger`=red outline; tone-aware hover keeps the fill solid), `size`; `≥44px` hit area | **real** (WO-13-007) |
| `Chip` | Status / count / label pill — **the one pill primitive** (`.chip`) | `src/components/core/Chip/Chip.tsx` | `tone` (ok/warn/danger/info/accent/secondary); `frd`/`verde`/`live` are tone presets, not new components | **real** (WO-13-007; aliases: `frdChip`, `chip2`, `dchip`, `bchip`, `live`/`sin-señal` chips) |
| `CountBadge` | Numeric pill for rail/badge counts (decisions/bugs/proposals), `tabular-nums`, canvas-colored numeral, 17px min | `src/components/core/CountBadge/CountBadge.tsx` | `count`, `tone` (warn/danger/accent) | **real** (WO-13-007; a `Chip` count preset; keep as named variant, not a fork) |
| **`Banner`** | **THE shared warn/info/ok/danger banner** — a **rounded card** (full `bd2` hairline border + `radius-md`, prototype `bBanner`; never a top/bottom-only strip) with left status icon + heading + detail + optional **full-width command row** (delegates to `CmdRow`), dismissible, multi-item + collapse. **Single source for ALL app banners.** | `src/components/core/Banner/Banner.tsx` | `tone` (warn/info/ok/danger), `kind` (drift/orphan/gate/error/inline), `icon?` (Tabler glyph, falls back to the tone SVG), `commandRow?`, `dismissible?`, `items[]` + `collapseAfter` | **real** (WO-13-007 — **DR-057 dup-fix; see ⚠ note below**) |
| `Panel` / `RpgPanel` | The app-wide surface — base `.panel` re-skinned by the RPG embossed override (`rpgpanel`/`rpggrid`); `.secondary` is the resting-tile variant | `src/components/core/Panel/Panel.tsx` | `variant` (panel/rpgpanel/secondary), `grid?` (rpggrid), `glow?` (warn/accent), `spot?`, elevation (shadow-0/1/2) | **real** (WO-13-007; aliases: `.panel`, `.rpgpanel`, `.rpggrid`, `.secondary`, `.rpghall` wrapper) |
| `Toast` | Transient bottom confirmation ("copiado") — small, sober, NOT a celebration | `src/components/core/Toast/Toast.tsx` | `message`, `visible`, `durationMs?`, `onDismiss?`; reduced-motion via CSS | **real** (WO-13-007); distinct from `AchievementToast` (Party) |
| `CopyButton` | **Icon** copy-to-clipboard affordance (`ti-copy` → `ti-check` on copy; prototype's icon, never the word "copiar"). Neutral chrome (card bg + `bd2` border); copied/idle state lives on the `aria-label`. Optional `label` renders text before the icon. | `src/components/core/CopyButton/CopyButton.tsx` | `value`, `label?`, accessible label (copiar↔copiado) | **real** |
| `CmdRow` | Mono command row (`.cmd`): leading `ti-terminal-2` glyph, inset on canvas, `bd2` hairline, `mono` + `tabular-nums`, with a `CopyButton` | `src/components/core/CmdRow/CmdRow.tsx` | `command`, `copy?` (default true); **THE command-chip primitive** | **real** (WO-13-007; aliases: `cmdRow`, `docCmd`, `CommandChip`, `CommandClip`) |
| **`PageLayout`** | **THE standard page chrome (DR-062, 2026-06-22)** — the page's single `<main>` + the `PageTitle` + the body slot, so the title block lands in the SAME place with the SAME spacing on every surface. **Every top-level page wraps its body in this** (header stays in `AppShell`). Handles dynamic `tail` (Propuestas/Logros count) and conditional titles (Tablero vs an open card). | `src/components/core/PageLayout/PageLayout.tsx` | `icon`, `title`, `subtitle?`, `tail?`, `testId?`, `ariaLabel?`, `children` | **real** — **no bespoke per-screen `<main>`/title markup.** Exceptions: shell-exempt drill-ins (`/configuration`, `/projects/**`) and the full-height two-pane Manual shell (its own scroll model) — follow-up to flow them under `PageLayout` |
| **`PageTitle`** | **The ONE light page-title block (DR-062)** — accent `itemslot` icon + H1 (= the nav label) + optional subtitle; **NOT a heavy panel**. Rendered by `PageLayout` (above); the Referencia section heroes delegate to it. | `src/components/core/PageTitle/PageTitle.tsx` | `icon`, `title` (= nav label), `subtitle?`, `tail?` (count pill / status slot) | **real** (WO-13-006; aliases: `pageHead`; `gxHero` delegates to it) — **the cohesion title; no per-screen ad-hoc title markup** |
| **`SectionHead`** | **The ONE section header (DR-062)** — display-font label + trailing 1px rule + optional right count (`.secthead`); reused on every surface's section dividers | `src/components/core/SectionHead/SectionHead.tsx` | `label`, `count?`, `icon?`, `rightHtml?` | **real** (WO-13-006; aliases: `secthead`, `SectHead`, `SectionHeader`, `.ln`) — **no bespoke section header per screen** |
| **`Tabs`** / `SubTabs` | **The ONE tab pattern (DR-062)** — tab/sub-tab pill switcher; reused for the top nav, the project tab bar (Resumen·Work orders·Party·**Observabilidad**·Documentos·Comandos), the Observabilidad Línea-de-tiempo↔DAG toggle, WO/config/logros sub-tabs | `src/components/core/Tabs/Tabs.tsx` | `level` (top `.tab` / sub `.stab`), `active`, `onChange`; `SubTabs` alias; `aria` tab semantics; arrow-key nav | **real** (WO-13-006; aliases: `.tab`, `.stab`, `SubTabs`, `DetailTabs`, `cfgTabs`, `logrosTabs`, `tabProp` count-tab); distinct from `RailItem`/`.navitem` — **no ad-hoc switcher per screen** |
| `ProgressBar` | Mission-objectives bar — accent fill, `var(--ok)` at 100%, `done/tot · pct%` | `src/components/core/ProgressBar/ProgressBar.tsx` | `done`, `total`, `ariaLabel?`; `role=progressbar`, stripe overlay | **real** (WO-13-007; today `objectives-bar.tsx` / `wo-progress.tsx` inline → should migrate) |
| `XpBar` | RPG striped XP/progress bar (`rpgSkin.xpbar`), segmented stripes, accent fill | `src/components/core/XpBar/XpBar.tsx` | `xp`, `next`, `pctToNext`, `label`, `nextTitle`, `size?: "compact" \| "full" \| "track"` — compact=9px×90px inline (GuildBar topbar), full=18px full-width with label+subtitle (GuildHero, default), **track=18px full-width bar only** (caller renders its own labels — `Progreso`); `role=progressbar` | **real** (WO-09-003/004) |
| `Shield` | The crest medallion (`rpgSkin.shield`, 96×96, accent-bordered glowing) with pixel NIVEL numeral | `src/components/core/Shield/Shield.tsx` | `level`, `size` (sm/md/lg), `glow` (bool, default true) | **real** (WO-13-008) |
| `TierBadge` | Común→Leyenda rarity medal — tier **name text always rides with color** (never color/metal-name alone) | `src/components/core/TierBadge/TierBadge.tsx` | `tier` (1–5), `name` (Spanish label: Común/Poco común/Raro/Épico/Leyenda, always visible) | **real** (WO-13-008; aliases: `.node` ladder pip) |
| `ItemSlot` | Pixel-art medal/icon slot (`rpgSkin.itemslot`, `image-rendering:pixelated`) | `src/components/core/ItemSlot/ItemSlot.tsx` | `icon`, `size` (px, default 40), `tone` (accent/warn/ok/danger), `lock`, `reveal`, `aria-label` | **real** (WO-13-008; aliases: `.itemslot`, `.lockslot`, `.lockchip`) |
| `Avatar` | Pixel-art agent/role avatar (per-agent `AVCOL` color) | `src/components/core/Avatar/Avatar.tsx` | `role`/`id`, `size`, `pixelated` | **real** |
| `RankEmblem` | The guild rank's self-framed pixel-art medal (`/ranks/<sprite>.png`); Tabler `icon` fallback when no sprite; overlays a small **roman-numeral grade badge** (I·II·III) when `grade∈{1,2,3}`. Reused by `GuildBar` (18px), `GuildHero` (32px), `RankLadder` (88/104/124px) | `src/components/core/RankEmblem/RankEmblem.tsx` | `sprite?`, `icon?`, `size`, `grade?`, `alt?` | **real** (FRD-09 rank ladder, phases 4–5) |
| `StateBadge` | Status pill conveying state by **icon + shape + text + color** (never color alone) — the canonical FRD-13 a11y idiom | `src/components/core/StateBadge/StateBadge.tsx` | `state` (ok/warn/danger/info/working/idle/failed/reviewing/blocked), label, `aria-label` | **real** |
| `ThemeToggle` | Light/dark theme switch (both first-class) | `src/components/core/ThemeToggle/ThemeToggle.tsx` | — | **real** |
| `DocHeading` | Page/section reading heading — accent ledge + title (`docH`) | `src/components/core/DocHeading/DocHeading.tsx` | `title`, `level` (1–4, default 2); accent left-border ledge | **real** (WO-13-007; aliases: `docH`) |
| `KanbanColumn` | Fixed-width WO column (`.col`, 224px, header label + count, vertical-scroll body for WO cards) | `src/components/core/KanbanColumn/KanbanColumn.tsx` | `label`, `count`, `danger?` (header in `--color-danger`, used for "Falló"), `children` | **real** (WO-13-008; `danger` variant added WO-05-003) |
| `CelebrationSurface` | Full-screen **auto-firing** celebration/level-up overlay (FRD-09) — `release` (rocket crest + XP + achievement chips) and `levelup` (big pixel NV numeral + rank + `XpBar`) kinds over a dimmed/blurred backdrop, with confetti; the reserved expressive moment, **fired by the milestone (release / XP threshold), never a button** | `src/components/core/CelebrationSurface/CelebrationSurface.tsx` | `kind` (release/levelup); `Confetti` child; reduced-motion variant (confetti → static) | **real** (prototype `bOverlay`/`bConfetti`, ~L1433/~L1432) |
| `DiscardButton` | Discard action (one of the bounded writes) with confirm flow | `src/components/core/DiscardButton/DiscardButton.tsx` | confirm flow | **real** |
| `FavoriteButton` | **Star toggle** marking an idea as a favourite (visual-only, REQ-02-012; the board's third write). Icon-only `ti-star`↔`ti-star-filled` (gold `--color-warn`), optimistic UI; used as a card corner overlay + in the card-detail header | `src/components/core/FavoriteButton/FavoriteButton.tsx` | `slug`, `favorite`, `favoriteAction`; aria-pressed + Spanish aria-label | **real** (WO-02-012) |
| `LiveRegion` | `aria-live="polite"` announcer — announce events without stealing focus | `src/components/a11y/LiveRegion.tsx` | `message`, politeness | **real** |
| `useKeyboardNav` | Keyboard list-navigation hook (a11y primitive) | `src/components/a11y/useKeyboardNav.ts` | list nav | **real** |
| design tokens | Frozen token runtime (`AGENT_ROLES`/`AGENT_COLOR`, surfaces/text/borders/accent/status/tiers) | `src/app/_design/tokens/tokens.ts` + `src/app/globals.css` | the contract; no hardcoded literals | **real** |

> ⚠ **The shared `Banner` — DR-057 duplicate-banner fix (the defect that started DR-057).**
> Banners used to **each re-declare an identical** `BANNER_STYLE` / `ICON_STYLE` / `CMD_ROW_STYLE` /
> `RECALL_STYLE` block (e.g. `PluginSyncBanner`, FRD-15) — this was the exact duplicate-banner bug.
> **There MUST be ONE core `Banner` primitive** (variants: tone warn/info/ok/danger; `kind`
> drift/gate/error/inline; optional command row; dismissible; multi-item + collapse). The dashboard
> health banners (FRD-18 gate/drift), the portfolio path-not-found warning (FRD-03), the inline
> tab/board read-error banners (FRD-04/05), and the memory-health staleness nudge (FRD-17) are all
> **consumers of that one `Banner`**, not new components — see the modules below tagged
> *"refactor onto shared `Banner`"*. (FRD-16 `OrphansBanner` was removed 2026-06-22.)

---

## 2. Modules — composed, surface-specific but reusable

`src/components/modules/` and route-local `_components/`. Built FROM the core primitives above; never
re-implement a primitive inside one.

| Name | Purpose | Path | Key props / variants | Status |
|---|---|---|---|---|
| `PluginSyncBanner` | Plugin-drift warning banner (FRD-15) | `src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx` | `kind="drift"` consumer of `Banner` | **real** — ⚠ **refactor onto shared `Banner`** |
| `OnboardingGate` | First-boot onboarding gate banner (FRD-01) | `src/app/_components/OnboardingGate/OnboardingGate.tsx` | `kind="gate"` consumer of `Banner` | **real** — should reuse shared `Banner` |
| `IdeaCard` | Board idea card (category + return labels, score, building indicator) | `src/components/modules/IdeaCard/IdeaCard.tsx` | `idea`, `recommended`, `building` | **real** |
| `BoardLegend` | **One-line** legend for category/return/score (prototype `boardView` footer — compact `<p>`, not a panel) | `src/components/modules/BoardLegend/BoardLegend.tsx` | — | **real** |
| `IntakeModal` | New-idea intake modal (board) — celeste "TABLERO" badge + description, **Tabler icons** (not emojis) in category-accent slots, `ti-x` close, reuses `CmdRow` | `src/app/board/_components/IntakeModal/IntakeModal.tsx` | `open`, `onClose`; focus-trap, Escape, return-focus | **real** |
| `CardDetail` | Board card detail — three icon tabs Campaña · Documentos · Comandos (FRD-02); Documentos = rail (210px) + reader; Comandos = `CmdRow`(s) | `src/app/board/_components/CardDetail/CardDetail.tsx` | active tab persisted; uses `Tabs`, `CmdRow` | **real** |
| `CampaignPipeline` | La Campaña 6-phase trail (board card-detail Campaña tab, FRD-02); active phase ficha open by default; CSS-road connectors | `src/components/modules/CampaignPipeline/CampaignPipeline.tsx` | `slug`, `activePhase`, `onEnterForge`; phase rooms + road connectors + roaming cast | **real** |
| `RoamingCast` | The cast of a Campaña phase room — rAF roam in the active room (walk/idle bob, lead halo, speech on meet), idle-bob when done, static+dimmed when locked; honors reduced-motion | `src/components/modules/CampaignPipeline/RoamingCast.tsx` | `members` (role/label/lead), `homes`, `state` (current/done/locked) | **real** |
| `ProjectRail` / `RailItem` | Portfolio rail — selectable nav primitive (`.rail`/`.rail.on`): status icon + title + count badges + stage line | `src/components/modules/ProjectRail/ProjectRail.tsx` | `project`, `selected`; distinct from `Tabs` and docs `.navitem` | **real** |
| `ProjectRow` / `PortfolioTable` | Portfolio rows / table | `src/components/modules/{ProjectRow,PortfolioTable}/*.tsx` | `project` | **real** |
| `SectionedMarkdown` | Renders a body as titled, colour-coded sections — auto-detects `## Heading` mode (backlog items, change-queue items) vs leading `**Label:**` mode (memory lessons); falls back to plain markdown | `src/components/modules/SectionedMarkdown/SectionedMarkdown.tsx` | `body`; used by `BacklogDetail`, `LessonDetail`, `ChangeDetail` (FRD-22, FRD-17, FRD-04) | **real** (promoted from `app/proposals/_components/` when a third cross-route consumer appeared) |
| `RecoveryHint` | Path-not-found recovery (clone/sync command) on a rail row (FRD-03) | `src/app/portfolio/_components/RecoveryHint/RecoveryHint.tsx` | consumer of `Banner` (path-not-found) | **real** — should reuse shared `Banner` |
| `PortfolioEmpty` | Empty-portfolio state (FRD-03) | `src/app/portfolio/_components/PortfolioEmpty/PortfolioEmpty.tsx` | — | **real** |
| `BusinessSnapshot` | Shipped-project business snapshot (active users / return / verdict, FRD-03) | `src/app/portfolio/_components/BusinessSnapshot/BusinessSnapshot.tsx` | real read-only data | **real** |
| `WorkspaceShell` / `WorkspaceHeader` / `Tabbar` | Project workspace shell, header (title + status chip + progress bar), subtab bar (FRD-04) | `src/app/projects/[slug]/_components/{workspace-header,tabbar}.tsx` | tabs Resumen·Work orders·Party·Documentos·Comandos | **real** |
| `ObjectivesBar` | "Objetivos de la misión" header progress bar (FRD-04) | `src/app/projects/[slug]/_components/objectives-bar.tsx` | consumer of `ProgressBar` | **real** |
| `SnapshotPanel` | Probable-green snapshot panel (FRD-04/14): icon + last-green FRD + sha + `git worktree` command | `src/app/projects/[slug]/_components/snapshot-panel/snapshot-panel.tsx` | `running`, building-now line, staleness warning | **real** |
| `VersionFreshness` | Resumen overlay-freshness badge (FRD-20): project `overlay_version` vs factory `OVERLAY_VERSION` — `behind` warn + copyable `/pandacorp:upgrade`, `up-to-date` ok, `unknown` nothing | `src/app/projects/[slug]/_components/version-freshness/version-freshness.tsx` | `state` (OverlayFreshnessState); **consumer of shared `Banner`** (tones warn/ok), not a new banner | **real** |
| `TabSummary` / `DecisionCard` / `ActivityLog` | Resumen tab: doc panel + decision points + activity log (FRD-04) | `src/app/projects/[slug]/_components/tab-summary/tab-summary.tsx` | decisions warn-bg + `/pandacorp:decide` cmd; dotted-rule log rows | **real** |
| `TabDocuments` / `DocNav` / `DocView` | Documents tab: doc-nav rail + rendered markdown (FRD-04/08) | `src/app/projects/[slug]/_components/tab-documents/tab-documents.tsx`; `src/app/manual/DocNav.tsx` | `.navitem` nav + `.panel.doc` body | **real** |
| `TabCommands` / `CommandsBox` | Commands tab: build-mode panel + stage-relevant `/pandacorp:*` rows (FRD-04/11) | `src/app/projects/[slug]/_components/tab-commands/tab-commands.tsx` | uses `CmdRow` | **real** |
| `BuildModeSelector` | 4-mode picker (Pro/Equilibrado/Potente/Profundo) → surfaces the matching `/pandacorp:implement…` command (FRD-11); read/copy, not a build trigger | `src/app/projects/[slug]/_components/mode-selector/mode-selector.tsx` | `mode` (pro/balanced/powerful/deep), selected = read-only data | **real** |
| `WoBoard` / `KanbanColumn` use | Work-orders kanban — todo·progress·review·fail·done (FRD-05/12), read-only | `src/app/projects/[slug]/_components/wo-board/wo-board.tsx` | uses `KanbanColumn`; horizontal scroll | **real** |
| `WorkOrderCard` | WO card (`.card`): wrapping title + FRD chip; `fail` danger variant (NOT a 2nd card) | `src/app/projects/[slug]/_components/wo-board/wo-board.tsx` (card) | `wo`, `fail` variant | **real** |
| `WoDetail` | Single work-order detail (Resumen / Documento completo) (FRD-05) | `src/app/projects/[slug]/_components/wo-detail/wo-detail.tsx` | uses `Tabs`, `DocView` | **real** |
| `WoFrdFilter` / `WoFrdFilteredBoard` / `WoEmpty` / `WoProgress` | WO board filter, filtered board, empty state, progress (FRD-05) | `src/app/projects/[slug]/_components/wo-*/…` | — | **real** |
| `SkillCard` | Configuración/Manual skill card: wand tile, `/cmd`, run-location, party thumbnails (FRD-07/08) | `src/app/configuration/SkillList.tsx` (+ `SkillDetail.tsx`) | `skill`; reused in Manual Referencia | **real** (aliases: `gxSkillCard`) |
| `SkillDetail` | The curated skill detail (FRD-07/08): plain-language explainer (from `skill-flows`) + interactive `FlowGraph` + the full `SKILL.md` as **markdown** in a collapsible — NOT a raw `<pre>` dump | `src/app/configuration/SkillDetail.tsx` | `skill`, `onBack`; consumes `getSkillFlow` + `ManualNavContext` | **real** (FRD-08 docs-upgrade) |
| `AgentCard` | Agent card: pixel avatar + model chip + NV/title line (FRD-07/08) | `src/app/configuration/AgentList.tsx` (+ `AgentDetail.tsx`) | `agent`; reused in Manual Referencia | **real** (aliases: `gxAgentCard`) |
| `RuleCard` | Decision-rule card: gavel/check tile, asks-you vs auto split (FRD-07/08) | `src/app/configuration/_rules/DecisionRulesSection/DecisionRulesSection.tsx` | `rule`; ●/● by icon+text | **real** (aliases: `gxRuleCard`) |
| `StandardCard` | Standard card grouped by domain: book tile + severity + enforcement badges (FRD-07/08) | `src/app/configuration/StandardsSection/StandardsSection.tsx` | `standard`, `SeverityBadge`/`EnforcementBadge` | **real** (aliases: `gxStdCard`) |
| `SectionHero` | Section banner (`gxHero`): `rpgpanel rpggrid` + 46px accent `itemslot` + title + sub (FRD-07/08/17) | `src/app/configuration/ConfigurationShell.tsx` (+ `ManualShell.tsx`) | `title`, `sub`, `icon` | **real** (aliases: `gxHero`) |
| `FlowDiagram` | Skill agent **mini-flow** parsed from the body — agent/action/gate/safe/io nodes + `↓` arrows + loop chip. **Now the FALLBACK** in `SkillDetail` when a skill has no curated flow (`FlowGraph` is the primary; every real skill has a curated flow) (FRD-07) | `src/app/configuration/FlowDiagram.tsx` | `nodes`, clickable agent nodes (per `AVCOL`) | **real** (aliases: `flowDiagram`/`flowNode`) |
| `AgentChips` | Clickable jump-to-agent pills (FRD-07) | (in `SkillDetail.tsx`) | `agentIds` | **real** (aliases: `agentChips`) |
| **`FlowGraph`** | **The interactive, step-by-step skill flow (FRD-08)** — typed step nodes (action/gate/safe/io/loop, colour-coded by token) + `↓` arrows + "en paralelo" tag + loop badge; skill/agent `calls` are **clickable nodes** that cross-navigate (skill → its own flow, agent → its card) via `ManualNavContext`. Reads the curated `skill-flows` layer | `src/components/modules/manual-diagrams/FlowGraph.tsx` | `flow` (`SkillFlow`); nodes `flow-call-{skill,agent}-<ref>` | **real** (FRD-08 docs-upgrade; `flow-graph`/`flow-step-N`/`flow-loop`) |
| `skill-flows` (data) | Hand-authored "for-dummies" explainer + typed step flow per skill — the SOURCE for `FlowGraph`; accuracy contract = the real `SKILL.md` + decision rules (DR-046) | `src/lib/manual/skill-flows.ts` | `getSkillFlow(slug)` → `SkillFlow \| undefined`; 23 authored flows | **real** (FRD-08 docs-upgrade) |
| `ManualNavContext` | The Manual's in-page cross-navigation (`goToSkill`/`goToAgent`) — provided by `ManualShell`, consumed by `FlowGraph`'s clickable nodes to open the target's Reference detail; no-op default outside the provider | `src/app/manual/ManualNavContext.tsx` | `useManualNav()`, `ManualNavProvider` | **real** (FRD-08 docs-upgrade) |
| `PipelineDiagram` | "El recorrido de una idea" — 6 colored phase chips (118px) + description + `CmdRow`, joined by `↓` connectors (FRD-08) | `src/components/modules/manual-diagrams/PipelineDiagram.tsx` | none (static phase data); reuses `CmdRow` + `DownArrow` | **real** (FRD-08 re-anchor; `data-testid="manual-diagram-pipeline"`) |
| `TeamDiagram` | The agent roster grouped by phase — role cards (`Avatar` + id + role) (FRD-08) | `src/components/modules/manual-diagrams/TeamDiagram.tsx` | none (static groups); reuses `Avatar`; presentational (agent detail lives in Referencia → Agentes) | **real** (`manual-diagram-team`) |
| `ChannelsDiagram` | The 3 feedback channels (bug/iterate/decide) — `Panel` rows with status icon + mono cmd + caption (FRD-08) | `src/components/modules/manual-diagrams/ChannelsDiagram.tsx` | none; reuses `Panel` + `IconRow` | **real** (`manual-diagram-channels`) |
| `SnapshotMini` | "Probar sin parar al agente" — 2 boxes (agent/you) over a shared `git` bar (FRD-08) | `src/components/modules/manual-diagrams/SnapshotMini.tsx` | none | **real** (`manual-diagram-snapshot`) |
| `ArchDiagram` | The factory region (plugin/MC/ideas/portfolio chips) + products below as separate repos (FRD-08) | `src/components/modules/manual-diagrams/ArchDiagram.tsx` | none; reuses `Chip` | **real** (`manual-diagram-arch`) |
| `CockpitDataDiagram` | File sources (mono list) → arrow → Mission Control box ("solo lee") (FRD-08) | `src/components/modules/manual-diagrams/CockpitDataDiagram.tsx` | none | **real** (`manual-diagram-cockpit-data`) |
| `SelfLearningLoop` | The self-learning loop — Capturar→Refinar→Cuaderno→Recuperar + Revisar→Tú decides→Promover rows + footer (FRD-08) | `src/components/modules/manual-diagrams/SelfLearningLoop.tsx` | none; reuses `MiniNode` + `RightArrow` | **real** (`manual-diagram-self-learning`) |
| `HooksDiagram` | The 3 hook panels (PreToolUse/Stop/Eventos) — `Panel` rows with status icon + mono hook name (FRD-08) | `src/components/modules/manual-diagrams/HooksDiagram.tsx` | none; reuses `Panel` + `IconRow` | **real** (`manual-diagram-hooks`) |
| `StacksTable` | The 4 golden-path archetypes (A–D) — `Panel` rows: accent letter + name + deploy + mono stack (FRD-08) | `src/components/modules/manual-diagrams/StacksTable.tsx` | none; reuses `Panel` | **real** (`manual-diagram-stacks`) |
| `StateTable` | Estado/archivos `<table>`: file (mono) · what it stores · who writes it (FRD-08) | `src/components/modules/manual-diagrams/StateTable.tsx` | none | **real** (`manual-diagram-state-table`) |
| `DocH` | Manual section heading — 6×18px accent bar with glow + 18px display title (prototype `docH`); distinct from core `DocHeading` (FRD-08) | `src/components/modules/manual-diagrams/DocH.tsx` | `title`, `level` (1–3) | **real** (`manual-doc-h`) |
| Manual readers | Slug→React page registry rendering each Diátaxis page (Landing / Quickstart / 7 Guides / 12 Concepts) as composed UI (DocH + `Panel` cards + `CmdRow` + chips + the diagrams); unmapped slug → react-markdown fallback. Referencia reuses the Config catalog cards (DR-046). (FRD-08) | `src/app/manual/manualPages.tsx` (+ `DocReader.tsx`, prose atoms in `manual-diagrams/prose.tsx`) | `getManualPageComponent(slug)`; reuses Config cards in Referencia | **real** (FRD-08 re-anchor) |
| **`AppShell`** | **The persistent global shell (FRD-19)** — `[data-app-shell]` `<header>` (rpgpanel): brand (logo + "Pandacorp Mission Control") + embedded `GuildBar` on the left, the mobile `[data-nav-toggle]` + `Nav` on the right; skip link first; wraps page content in `#main-content`. Mounted once in `app/layout.tsx`; hidden on the exempt drill-ins (`/projects/**`, `/configuration`). | `src/components/modules/AppShell/AppShell.tsx` | `levelBar`, `proposalsBadge` (slots), `children`; client (drawer state + `usePathname` scope); `shellScope.ts` mirrors `e2e/shell.ts` SHELL_EXEMPT | **real** (WO-19-001) |
| **`Nav`** | **The six top-level destinations (FRD-19, CMP-19-nav)** — real `next/link`s styled as the `.tab` pill, active by `usePathname()` (`aria-current`); Inicio·Tablero·Portfolio·**Propuestas**·Logros·Documentación. The Propuestas slot is `ProposalsBadge`. Shared `.tab` look via `navTab.ts` (reused by `ProposalsBadge`). | `src/components/modules/Nav/Nav.tsx` (+ `navTab.ts`) | `proposalsBadge` slot; client; distinct from `Tabs` (panel switcher) / `RailItem` (`.rail`) / docs `.navitem` | **real** (WO-19-001) |
| `GuildBar` | Guild/status block: NV level pill (granular level) + **`RankEmblem` + rank name** + inline `XpBar` (FRD-09). Standalone rpgpanel by default; the `embedded` variant (FRD-19) drops the panel chrome + margin to sit inside the `AppShell` topbar. | `src/components/modules/GuildBar/GuildBar.tsx` | `outcomes: GuildOutcomes`, `embedded?`; derives level/rank/xp via `computeGuildLevel`; renders `RankEmblem` (18px, with grade); compact `XpBar` (size="compact") | **real** (WO-09-003; rank emblem FRD-09 phase 5; `embedded` WO-19-001) |
| `GuildHero` | Character-sheet hero (`logrosHero`): rpgpanel + `Shield` crest + **`RankEmblem` (32px, w/ grade) + rank title** + summary (feats/trophies/missions) + full `XpBar` + party `Avatar` roster + 3 stat badges (FRD-09/10) | `src/components/modules/GuildHero/GuildHero.tsx` | `level`, `title`, `xp`, `next`, `pctToNext`, `nextTitle`, `rankIcon?`, `rankSprite?`, `rankGrade?`, `featsCount`, `trophiesCount`, `trophiesTotal`, `missionsActive`, `partyRoster`, `statsLanzados`, `statsRacha`, `statsVelocidad` | **real** (WO-09-003; rank emblem FRD-09 phase 5; aliases: `logrosHero`) |
| `StatRadar` | "Atributos del gremio" 6-axis SVG radar — 4 grid rings + 6 spokes + accent data polygon + glow + pixel-font axis labels (FRD-09/10) | `src/app/achievements/StatsPanel.tsx` (named export `StatRadar`) | `axes: StatRadarAxes` (produccion/velocidad/calidad/constancia/ideacion/alcance, each 0–100) | **real** (WO-09-003; in `StatsPanel`; aliases: `statRadar`) |
| `ChainCard` | Tier chain card (Bronze→Legend ladder) — `ItemSlot` medal + `TierBadge` ladder + `XpBar` + next-tier; spot/mini variants (FRD-10) | `src/app/achievements/ChainCard/ChainCard.tsx` | `chain`, `variant` (card/spot/mini); date+project stamp | **real** (aliases: `rpgChainCard`/`rpgChainSpot`/`rpgChainMini`) |
| `TrophyCard` | One-time trophy (`rpgOneCard` unlocked / `rpgTrophyLock` locked hover-reveal / secret silhouette) (FRD-10) | `src/app/achievements/UniquesSection/UniquesSection.tsx` (+ `SecretsPanel`) | `trophy`, `locked`, `secret`; `:focus-within` reveal | **real** (aliases: `rpgOneCard`/`rpgTrophyLock`) |
| `AlmostThere` | "Próximas hazañas · a un paso de caer" (Zeigarnik top-3 nearest, FRD-10) | `src/app/achievements/AlmostThere.tsx` | top-3 chains by % | **real** (aliases: `questsNear`) |
| `HeroStat` / `StatLedgerRow` | Record stat tile + ledger row with tier pip (FRD-10) | `src/app/achievements/StatsPanel.tsx` | pixel numeral, `tabular-nums`, tier `.node` | **real** |
| `HallTabs` | **5-tab** client shell for the Achievements Hall (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**) — receives pre-computed data + the guild `level` from page.tsx Server Component and manages active tab state | `src/app/achievements/_components/HallTabs.tsx` | `chains`, `uniques`, `secrets`, `readerData`, `trophiesCount`, `trophiesTotal`, `level`, `hero`; `data-testid="logros-tabs"` | **real** (WO-10-005; Rangos tab FRD-09 phase 2) |
| `RankLadder` | The **Rangos** tab: the 40-rung guild rank ladder as an enriched, era-sectioned climb — large `RankEmblem` per rank + flavor caption + level band + XP threshold + state marker; 6 eras; current-rank glow + progress; summit treatment. Reads FRD-09 `RANKS` + co-located `ladderMeta` (flavor + eras) | `src/app/achievements/RankLadder/RankLadder.tsx` (+ `ladderMeta.ts`) | `level: GuildLevel`; `data-testid="rank-ladder"`/`rank-row` | **real** (FRD-09 phases 2/6) |
| `Pulso` | Dashboard pulse section host (FRD-18) | `src/components/modules/Pulso/Pulso.tsx` | conversion metric | **real** (supersedes the orphaned `KpiHeader`/`deriveKpis`, removed DR-092/DR-115 — never mounted, divergent mechanism vs `WorkOrder.state`) |
| `Digest` / `EventCard` | "Desde tu última visita" digest + event cards — `.secondary` tile, status icon, title+source+`ago()`; `isNew` border + `dim` (FRD-12/18) | `src/components/modules/Digest/Digest.tsx` | `events`, `seenMarker`; `isNew`/`dim` variants | **real** (aliases: `digestSection`/`evCard`) |
| `FreshnessBadge` / `FreshnessChip` | Live / no-signal data-freshness chip — icon+text+color (en vivo/sin señal + timestamp) (FRD-12) | `src/app/_observability/FreshnessBadge/FreshnessBadge.tsx` | `signal`, `ago` | **real** |
| `TuTurno` / `QueueRow` | Human-gate queue — 34px icon badge + title/sub + inline `CmdRow`, priority-tinted (FRD-18) | `src/components/dashboard/TuTurno/TuTurno.tsx` | `items[]`, priority order; `qrow` | **real** (aliases: `qrow`) |
| `Cartera` / `ProjectCard` | "Construcción y cartera" project card — status/live/stalled/bugs chips, progress bar, next-command, inline blocker (FRD-18) | `src/components/dashboard/Cartera/Cartera.tsx` | `project`; `.panel`, fail blocker line | **real** |
| `Progreso` | "Tu progreso" gamification foot — `RpgPanel` + medal + next milestone + operator `XpBar` (FRD-18) | `src/components/dashboard/Progreso/Progreso.tsx` | level, achievement, milestone | **real** |
| `DashboardLiveWatcher` | Invisible client component — subscribes to `useLiveSnapshot` SSE transport and calls `router.refresh()` on new events; renders `null`; provides event-driven real-time update for the Inicio dashboard (FRD-18, AC-18-001.2) | `src/components/dashboard/DashboardLiveWatcher/DashboardLiveWatcher.tsx` | no props; side-effect only | **real** (WO-18-001) |
| `CelebrationWatcher` | Global auto-fire wiring — subscribes to `useLiveSnapshot`, extracts the most-recent result event, passes it to `CelebrationSurface`; renders nothing when no result event is active; mounted once in `app/layout.tsx` (FRD-09, AC-09-006.1–5, DR-061) | `src/components/modules/CelebrationWatcher/CelebrationWatcher.tsx` | no props; `"use client"` side-effect + render | **real** (WO-09-003) |
| `GamificationLedgerSync` | **Invisible** fire-and-forget ledger snapshot — `"use client"` component that calls `snapshotGamificationLedger(liveOutcomes)` once after hydration; renders `null`; never blocks the render; mounted in `app/page.tsx` (WO-09-006, AC-09-006.2) | `src/components/dashboard/GamificationLedgerSync/GamificationLedgerSync.tsx` | `liveOutcomes: GuildOutcomes`; no visible output | **real** (WO-09-006) |
| `ObservabilidadTab` | The **Observabilidad** project tab (sibling of Party) — eye-search icon strip + "2 vistas sobre los MISMOS work orders" eyebrow + the **Línea de tiempo ↔ DAG** toggle (shared `SubTabs`, DR-062) + Party hint; host for `TimelineView` and `WoDag`; live via `useLiveSnapshot`; derives `GanttWorkOrder[]` from events via `toTimeline()` (FRD-12) | `src/app/projects/[slug]/_observability/ObservabilidadTab/ObservabilidadTab.tsx` | `workOrders: WorkOrder[]`, `project: string`; defaults to "timeline" view | **real** (WO-12-005) |
| `TimelineView` | WO→tasks→actions Gantt-style timeline: 150px label col + 1fr bar track; `GanttWorkOrder[]` input; duration bars positioned by `start/dur` as % of total, nested faint (55% opacity) task sub-bars, time axis, first-error note, state icons (`WOICON`/`WO_COLOR_VAR`); `tabular-nums`; empty-state (FRD-12) | `src/app/projects/[slug]/_observability/TimelineView/TimelineView.tsx` | `workOrders: GanttWorkOrder[]`, `total: number` | **real** (WO-12-005, prototype `bTimeline` ~L1156) |
| `WoDag` | **Dagre SVG dependency graph** — `rankdir:LR` Dagre layout, rounded card nodes (NW=156 NH=58, state dot + Tabler icon + WO-id·FRD mono), cubic-bezier edges + SVG arrowhead markers; chain-highlight (`dagChain`: upstream+downstream, accent edges, non-chain `opacity:0.32`); "saltar al primer error" (`firstError()`); "seguir al paso activo" toggle (running WO gets accent drop-shadow + "▶ paso activo" caption); live via `useLiveSnapshot`; matches prototype `bDag()`/`bDagChain()` ~L1169 (FRD-12) | `src/app/projects/[slug]/_observability/WoDag/WoDag.tsx` | `workOrders: WorkOrder[]`, `project?: string`; consumes `toDag`/`dagChain`/`firstError` from `dag.ts` | **real** (WO-12-006, prototype `bDag`/`bDagChain` ~L1169) |
| `EventsRateChart` / `RpgTimelineToggle` | Events-rate chart; the legacy RPG↔timeline toggle (now superseded by `ObservabilidadTab`'s 2-view toggle) (FRD-12) | `src/app/_observability/{EventsRateChart,RpgTimelineToggle}/…` | — | **real** |
| `ProposalCard` | Proposal card (FRD-17), 4 kinds: candidate lesson / promotion / prune / self-suggestion — `itemslot` icon + `LESSON-NNNN` id + eval-gate/target chip + title + evidence; **command only when its group doesn't carry one** (clean title+evidence otherwise) | `src/app/proposals/_components/ProposalCard/ProposalCard.tsx` | `kind`, `evidence`, `command?`, `candidate` (eval-gate) treatment | **real** (prototype `bPropCard`, ~L1394) |
| `ProposalStream` / `DismissableProposalStream` | Proposal list grouped by kind with a **GROUP-level activating command** under the title when the group shares one skill (candidates+prune → `/pandacorp:memory`); lessons grouped (candidates then prunable adjacent), dismissible (FRD-17) | `src/app/proposals/_components/{ProposalStream,DismissableProposalStream}/…` | `proposals[]`, `groupCmd?`, dismiss store | **real** (prototype `bPropGroup`, ~L1401) |
| `PromotionsQueue` / `PromotionState` | Durable promotions queue — proposed → tú revisas → approved · rejected (FRD-17) | `src/components/modules/PromotionsQueue/PromotionsQueue.tsx` | `lessons` (`promotion: proposed`), target chip | **real** |
| `MemoryHealthPanel` | Self-learning loop health — 3 `tabular-nums` counters + `Banner`-style staleness nudge (FRD-17) | `src/components/modules/MemoryHealth/MemoryHealth.tsx` | pending notes / candidates / last-run; nudge | **real** — staleness nudge should reuse shared `Banner` |
| `ProposalsBadge` / `ProposalsChip` | The **Propuestas destination of the shell nav** (FRD-17/19, the prototype `tabProp()`): a `.tab` `next/link` to /proposals, active by route, accessible name "Propuestas", with the open count as a visible aria-hidden `CountBadge` (calm when 0). Per-project rail proposals chip is the sibling `ProposalsChip`. | `src/components/modules/ProposalsBadge/ProposalsBadge.tsx` | `openCount`; client (`usePathname` active); reuses `navTab` `.tab` visual + `CountBadge` | **real** (WO-17-007; nav-pill WO-19-001) |
| `StatusChips` | Portfolio-rail decisions/bugs/rethink chips — counts `tabular-nums` + Spanish label (FRD-14) | `src/app/portfolio/_components/status-chips/status-chips.tsx` | `pendingDecisions`, `pendingBugs`, `rethinkPending`; consumer of `CountBadge` | **real** |

> Reuse-before-create reminders captured from the FDDs: `WorkOrderCard` is the `.card` primitive with
> a `fail` variant (not a 2nd card); the Manual **Referencia** reuses Config's `SkillCard`/`AgentCard`/
> `RuleCard`/`StandardCard` verbatim; `RailItem` (`.rail`), top `.tab` and docs `.navitem` are three
> distinct nav surfaces — pick the right one, do not fork. `ProposalsBadge`/`ProposalsChip`/
> `StatusChips`/`CountBadge` are all `Chip`/`CountBadge` presets, not new pills.
>
> **Cohesion framing (DR-062) — one of each, everywhere.** Every top-level surface uses the **one
> `PageTitle`** light title block (icon + H1 = nav label + subtitle, never a heavy panel), the **one
> `SectionHead`** for section dividers and the **one `Tabs`** pattern for the top nav / project tab bar /
> Observabilidad toggle / sub-tabs. No FDD ships an ad-hoc title, section header or switcher — a bespoke
> per-screen title/header/tab is a DR-062 defect, rejected at review like a duplicate banner. The
> Referencia `gxHero` delegates to `PageTitle`; `compactProjectHeader` is the project workspace's own
> light header (FDD-04), not a second `PageTitle`.

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
| `Room` | Pixel-art zone room (Forge/Tribunal/Bóveda; the 6 Campaña phases) + label + count/badge | `src/components/modules/party/Room/Room.tsx` | `zone` (9 zones), `state` (cool/hot/active/done/locked), `label`, `labelNode?` (rich chip label, e.g. accent phase number), `count?`, `style?`, `children?`; root is `<section>` | **real** (WO-13-009) |
| `StoneBridge` | Connector between rooms; active one **flows** the deliverable. `variant`: `stone` (PNG, La Fragua) or `road` (CSS striped road, La Campaña) | `src/components/modules/party/StoneBridge/StoneBridge.tsx` | `orientation` (h/v), `flow`, `variant?` (stone/road), `deliverableEmoji?/Label?/State?`, `style?` | **real** (WO-13-009) |
| `FlowStrip` | Always-visible whole-pipeline strip lighting the active beat(s) + hover tooltips (8 beats) | `src/components/modules/party/FlowStrip/FlowStrip.tsx` | `beats: readonly FlowBeat[]`, `activeKeys: readonly string[]`; CSS-only hover tooltips; testid `flow-tip-{key}` | **real** (WO-13-009) |
| `PowerOffOverlay` | Factory-off treatment derived from real state (desaturate map, tidy sprites, "Fábrica apagada") — never a toggle | `src/components/modules/party/PowerOffOverlay/PowerOffOverlay.tsx` | `off: boolean` (derived, never user-toggled); `display:none` when `off=false` | **real** (WO-13-009) |
| `MissionBar` | Real mission surface (`.quest`): FRD pips + global WO counter + **effort as read-only data** (DR-061) | `src/components/modules/party/MissionBar/MissionBar.tsx` | `frdPips: readonly FrdPip[]`, `done`, `total`, `effort` (plain `<span>`, never button); pip testid `mission-bar-pip-{id}` | **real** (WO-13-009) |
| `DemoControls` | **DR-061** wrapper — dashed-border + `SOLO DEMO` tag + one-line note for preview-only controls; never ships read-only | `src/components/modules/party/DemoControls/DemoControls.tsx` | `note: string`, `children: ReactNode`; warn-toned badge | **real** (WO-13-009) |
| `AgentSprite` | 52px pixel implementer/specialist sprite (1 = 1 running WO) with halo, progress bar, WO-id tag | `src/components/modules/party/AgentSprite/AgentSprite.tsx` | **`agentRole`** (NOT `role`), `state` (work/carry/vault/say-on/idle/split/review), `woId`, `progress?`, `style?`; 52px normal / 42px in vault | **real** (WO-13-009) |
| `JudgeSprite` | The single reviewer per FRD — dim until the gate opens, then paces the Tribunal | `src/components/modules/party/JudgeSprite/JudgeSprite.tsx` | `active: boolean`, `judgingTarget?`, `style?`; inactive: opacity .45 + grayscale(.4) | **real** (WO-13-009) |
| `SpeechBubble` | Agent speech bubble (even-column `raised` offset); no `style` prop — scene positions via wrapper | `src/components/modules/party/SpeechBubble/SpeechBubble.tsx` | `text: string`, `raised?: boolean`; `aria-hidden` (decorative) | **real** (WO-13-009) |
| `Tooltip` | Hover tooltip for a sprite/beat — WO id+title or phase role+name | `src/components/modules/party/Tooltip/Tooltip.tsx` | `content: ReactNode`, `anchor?: CSSProperties`; `role="tooltip"`, mono font, accent border | **real** (WO-13-009) |
| `Parchment` | The travelling 📜 = the real Status-Note hand-off between dependent WOs; decorative overlay | `src/components/modules/party/Parchment/Parchment.tsx` | `from: string`, `to: string`, `style?: CSSProperties`; `aria-hidden`, `pointer-events:none`, warn glow | **real** (WO-13-009) |
| `DeepRelay` | Deep-mode sequential 3-step relay within one WO (test-writer → backend → frontend) | `src/app/projects/[slug]/_party/DeepRelay/DeepRelay.tsx` | `step`, contract published | **real** |
| `EventFeed` | Bitácora del gremio — role icon + `tabular-nums` timestamp, failure first-class, capped + pinnable | `src/app/projects/[slug]/_party/EventFeed/EventFeed.tsx` | `events`, `pinned` | **real** |
| `AchievementToast` | "¡Logro desbloqueado!" toast on WO close (Party-scoped), reduced-motion variant | `src/app/projects/[slug]/_party/AchievementToast/AchievementToast.tsx` | `wo`, reduced-motion; distinct from core `Toast` | **real** |
| `FraguaScene` | The La Fragua living-map scene composition (stage + rooms + bridges + sprites) | `src/app/projects/[slug]/_party/FraguaScene/FraguaScene.tsx` | `snapshot` (derived from events) | **real** |
| `PartyScene` / `PartyTab` | Party tab shell + scene host | `src/app/projects/[slug]/_party/{PartyScene,PartyTab}/*.tsx` | — | **real** |
| `FreshnessBadge` | DR-066 graded freshness chip for live surfaces (en vivo · datos de hace N min · sin señal); self re-grades every 30s; `data-volatile` (DR-088) | `src/components/modules/FreshnessBadge/FreshnessBadge.tsx` | `lastSignalAt: string \| null` | **real** |

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
| `useLiveSnapshot` | **The shared SSE live-transport hook (WO-01-009)** — opens `GET /api/live`, buffers the latest `LiveFrame` snapshot, debounces bursts, auto-reconnects, tears down on unmount. Reused by Party (FRD-06), Work orders (FRD-05), Inicio (FRD-18), Observabilidad (FRD-12). | `src/hooks/useLiveSnapshot.ts` | `project?`, `kinds?` options → `{ snapshot, connected, lastEventAt }` | **real** (WO-01-009; hook, not a React component — listed here for discoverability so no consumer re-invents it) |

---

### Notes

- *(planned)* rows are the primitives this re-anchor (DR-054/056) factors out of the approved
  prototype; some are composed inline today (e.g. inside `FraguaScene`, `wo-board`, the achievements
  page). The foundation wave implements them as named, reusable components against the frozen tokens +
  the per-FRD `mocks/`. *(real)* rows exist today at the cited path.
- **One banner, one chip, one panel, one tab, one command-row, one section-head.** The aliases noted
  in each row (`gxHero`/`secthead`/`.stab`/`cmdRow`/`frdChip`/…) are the same primitive named
  differently across FDDs — collapse to the canonical row, never fork.
