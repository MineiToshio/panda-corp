# Component inventory — Mission Control (the PDD's living component list)

The build's foundation work order implements these shared primitives/modules first; every later
agent **reuses** them (DR-057). One inventory per project — never duplicated per feature. Seeded from
the frozen design system (`docs/design/design-tokens.json`, root `DESIGN.md`), which was extracted
from the owner-approved prototype (`docs/design/prototype/`, DR-054/056). Each row:
**name · purpose · path · key props/variants**. All components consume tokens only — no hardcoded
colors/spacing/radii.

> Reuse order before creating anything new (project-structure rule): `components/core` →
> `components/modules` → the route's `_components/` → the route itself. A component used by a single
> route/feature lives in that feature's folder (the Party primitives below live under the Party
> feature folder, not the global roots, because they are Party-scoped).

## Core primitives (`src/components/core/`)

| Name | Purpose | Path | Key props / variants |
|---|---|---|---|
| `StateBadge` | Status pill conveying state by **icon + text + color** (never color alone) | `src/components/core/StateBadge/StateBadge.tsx` | `state` (ok/warn/danger/info), icon slot |
| `XpBar` | RPG striped XP/progress bar (rpgSkin `xpbar`) | `src/components/core/XpBar/XpBar.tsx` | `value`, `max`, segmented stripes |
| `CopyButton` | Copy-to-clipboard button (commands, ids, paths) | `src/components/core/CopyButton/CopyButton.tsx` | `value`, copied state |
| `DiscardButton` | Discard action (the app's only write) | `src/components/core/DiscardButton/DiscardButton.tsx` | confirm flow |
| `ThemeToggle` | Light/dark theme switch (both first-class) | `src/components/core/ThemeToggle/ThemeToggle.tsx` | — |
| `Avatar` | Pixel-art agent/role avatar | `src/components/core/Avatar/Avatar.tsx` | `role`, `size`, `pixelated` |
| `CelebrationSurface` | Achievement/celebration surface, reduced-motion aware | `src/components/core/CelebrationSurface/CelebrationSurface.tsx` | reduced-motion variant |

## Shared modules (`src/components/modules/`)

| Name | Purpose | Path | Key props / variants |
|---|---|---|---|
| `IdeaCard` | Board idea card (category + return labels, score, building indicator) | `src/components/modules/IdeaCard/IdeaCard.tsx` | `idea`, `recommended`, `building` |
| `CategoryFilter` | Filter the board by `project_type` | `src/components/modules/CategoryFilter/CategoryFilter.tsx` | `selected`, `onChange` |
| `BoardLegend` | Legend for category/return/score | `src/components/modules/BoardLegend/BoardLegend.tsx` | — |
| `CampaignPipeline` | La Campaña 6-phase trail (board card-detail Campaña tab) | `src/components/modules/CampaignPipeline/CampaignPipeline.tsx` | `activePhase`, `onPhaseClick` |
| `GuildBar` | Guild/status bar chrome | `src/components/modules/GuildBar/GuildBar.tsx` | — |
| `ProjectRow` / `PortfolioTable` | Portfolio rows/table | `src/components/modules/{ProjectRow,PortfolioTable}/*.tsx` | `project` |

## Party primitives — La Fragua (FRD-06) & La Campaña (FRD-02)

Party-scoped (live under the Party feature folder, `src/app/projects/[slug]/_party/`, and the board
card-detail). These render the pixel-RPG Party canvas faithfully to the approved prototype
(`docs/design/prototype/party-proposal.html`, `party-pipeline.html`); their sprite/grid/room sizes,
state machines and keyframes are the `party` token group, the surface skin the `rpgSkin` group.

| Name | Purpose | Path | Key props / variants |
|---|---|---|---|
| `Room` | A pixel-art zone room (Forge/Tribunal/Bóveda; the 6 Campaña phases) with label + count/badge chips | `src/app/projects/[slug]/_party/Room/Room.tsx` *(planned)* | `zone` (backend/tribunal/boveda/research/…), `state` (cool/hot/active/done/locked), `label`, `count` |
| `StoneBridge` | PNG stone connector between rooms (forge→tribunal `bridge-h`, tribunal→vault `bridge-v`; Campaña room→room, active one **flows** the deliverable) | `src/app/projects/[slug]/_party/StoneBridge/StoneBridge.tsx` *(planned)* | `orientation` (h/v), `flow` (active deliverable travels), `pos` |
| `FlowStrip` | Always-visible whole-pipeline strip that **lights the active beat(s)** + hover tooltips (8 beats: Fundación→…→Integración) | `src/app/projects/[slug]/_party/FlowStrip/FlowStrip.tsx` *(planned)* | `beats`, `activeKeys`, per-beat tooltip; hidden in embed |
| `PowerOffOverlay` | Factory-off treatment **derived from real state** (no build/agents): desaturates the map, tidies sprites into rooms, shows "Fábrica apagada" + the `/pandacorp:implement` note | `src/app/projects/[slug]/_party/PowerOffOverlay/PowerOffOverlay.tsx` *(planned)* (today: `PartyEmptyState`) | derived `off` flag; the empty/no-signal state |
| `DemoControls` | **DR-061 convention** — wraps preview-only controls (mode/effort picker, pause/reset) in a **dashed-border block + `SOLO DEMO` tag + one-line note**; does NOT ship in the read-only app | `src/app/projects/[slug]/_party/DemoControls/DemoControls.tsx` *(prototype-only / planned)* | `note`, children; demo-only |
| `MissionBar` | Real mission surface (`.quest`): FRD pips + global WO counter + **effort shown as read-only data** (DR-061) | `src/app/projects/[slug]/_party/MissionBar/MissionBar.tsx` *(planned)* | `frdPips`, `done`, `total`, `effort` (read-only) |
| `AgentSprite` | A 52/54/58px pixel `implementer`/specialist sprite (1 = 1 running WO in La Fragua) with halo, progress, tag | `src/app/projects/[slug]/_party/AgentSprite/AgentSprite.tsx` *(planned)* | `role`, `size`, `state` (work/review/carry/vault/split/idle/walking/say-on) |
| `JudgeSprite` | The single `reviewer` per FRD — dim until the gate opens, then paces the Tribunal (4 lenses + visual judge) | `src/app/projects/[slug]/_party/JudgeSprite/JudgeSprite.tsx` *(planned)* | `active` (gate open), `judgingTarget` |
| `SpeechBubble` | Agent speech bubble (`sayin` keyframe; even columns talk higher) | `src/app/projects/[slug]/_party/SpeechBubble/SpeechBubble.tsx` *(planned)* | `text`, `raised`, shown via `say-on` |
| `Tooltip` | Hover tooltip for a sprite/beat (WO id+title; phase role+name) | `src/app/projects/[slug]/_party/Tooltip/Tooltip.tsx` *(planned)* | `content`, anchor |
| `Parchment` | The travelling 📜 = the real `Status Note` hand-off between dependent WOs | `src/app/projects/[slug]/_party/Parchment/Parchment.tsx` *(planned)* | `from`, `to` (Build Plan dependency) |
| `DeepRelay` | Deep-mode sequential 3-step relay within one WO (test-writer → backend-dev →📄→ frontend-dev, "Opus") | `src/app/projects/[slug]/_party/DeepRelay/DeepRelay.tsx` | `step`, contract published |
| `EventFeed` | Bitácora del gremio — role icon + `tabular-nums` timestamp, failure first-class, capped+pinnable | `src/app/projects/[slug]/_party/EventFeed/EventFeed.tsx` | `events`, `pinned` |
| `AchievementToast` | "¡Logro desbloqueado!" toast on WO close, reduced-motion variant | `src/app/projects/[slug]/_party/AchievementToast/AchievementToast.tsx` | `wo`, reduced-motion |
| `FraguaScene` | The La Fragua living-map scene composition (stage + rooms + bridges + sprites) | `src/app/projects/[slug]/_party/FraguaScene/FraguaScene.tsx` | `snapshot` (derived from events) |
| `PartyScene` / `PartyTab` | Party tab shell + scene host | `src/app/projects/[slug]/_party/{PartyScene,PartyTab}/*.tsx` | — |

> Rows tagged *(planned)* are the primitives this re-anchor (DR-054/056) factors out of the approved
> prototype; the current `_party` implementation composes some of them inline (e.g. inside
> `FraguaScene`) and `PartyEmptyState` covers the power-off/empty case. The foundation/Party work
> orders implement them as named, reusable components against the `party` + `rpgSkin` tokens and the
> per-FRD mocks (`docs/frds/frd-06-party/mocks/`, `docs/frds/frd-02-ideas-board/mocks/`). Existing
> paths (no tag) are real today.
