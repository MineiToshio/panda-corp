# Component inventory — Mission Control · Órbita

> The single list of shared components (and app-wide framing patterns) the build reuses. **Check before you create** (DR-057): reuse an existing row, then adapt or extend it (a variant or a prop), and only then create new and append a row. A second banner, card, tab bar, search width, section heading or command box that re-implements a row below is rejected at review. The framing patterns keep Mission Control **one coherent application** (DR-062).
>
> **Frozen 2026-10-22 FROM the owner-approved Órbita prototype** (`docs/design/prototype/index.html`, approved 2026-10-21). Seeded from `docs/design/freeze/fidelity.config.json` (`components`, 137 entries) and the catalogue `docs/design/prototype/components.html`; measured styles in `docs/design/prototype/reference/computed-styles.json`; portable CSS by family in `docs/design/prototype/reference/css/` (README lists which file holds which component). Every component consumes **tokens only** (`docs/design/design-tokens.json`, root `DESIGN.md`); no hardcoded colour, spacing, radius or shadow.
>
> **Reading the columns.** *Component* is the canonical name; the other names a row lists under *Prototype* (the `Config:` list) are configuration entries or aliases folded into the same row, never separate components. *Prototype* is the selector in the approved prototype. *Path* is the build target under the project-structure rule (`components/core` primitives, `components/modules` composed reusables, a route's `_components/` for one route); the blueprints may relocate a module but not rename it or fork it. *Status*: **restyle** = a v1 component with that name exists and adopts the Órbita look in place (no second copy); **new** = no v1 equivalent; **fold** = a variant of another row.
>
> Reuse order before creating anything: `components/core` → `components/modules` → the parent route's `_components/` → the route itself.

## Foundation — the persistent app shell (built FIRST, DR-075)

The shell belongs to no single FRD: the foundation wave builds it before any surface, and every route mounts into it from `app/layout.tsx`. Its contract is at the end of this file (`## AppShell nav contract`).

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| **`AppShell`** | The persistent frame: skip link, sidebar (desktop and tablet rail, phone drawer), scrim, phone top bar, `main#content`, phone bottom nav. Mounted once in `app/layout.tsx`; no route renders without it. Grid `252px \| 1fr`; `64px \| 1fr` when collapsed; `76px \| 1fr` on tablet; one column on phone. | `src/components/modules/AppShell/AppShell.tsx` | `.app#app`, `aside#sidebar`, `.scrim#scrim`, `.main`, `main#content.page` | `sidebar: "expanded" \| "collapsed"` (remembered per browser), drawer `open`; client for drawer and rail state; `data-sidebar`, `data-open`, `data-float` | restyle (`AppShell`) |
| **`Nav`** | The seven top-level destinations as real links (`next/link`), current page by pathname, `aria-current="page"`; the idea detail highlights Tablero. | `src/components/modules/Nav/Nav.tsx` | `nav.navgroup[aria-label="Secciones"]` | `items[]` of `{ label, path, icon, tone, mini, count? }`; count alert variant for Inicio | restyle (`Nav`) |
| `Sidebar` | The 252px sticky column on `--bg-2`: brand, plugin pill, `Nav`, Proyectos group, guild card, collapse toggle. | `src/components/modules/AppShell/Sidebar.tsx` | `#sidebar` (config: Sidebar) | children by slot; collapse toggle `aria-pressed` (desktop only); floats open over the page on pointer or focus when collapsed | new |
| `NavItem` | One destination: tinted icon, label, optional count, mini label (tablet rail), amber `.raildot` on the collapsed rail when Inicio has owner items. | `src/components/modules/Nav/NavItem.tsx` | `.navitem` (config: NavItem) | `tone`, `current`, `count`, `alert`, `mini`; min-height 40 (44 on the phone drawer, 46 on the tablet rail) | new |
| `ProjectNavItem` | A project row in the sidebar: avatar tile with initials in the project's phase hue, name, «Fase · pct%», full `aria-label` «<Proyecto>: <Fase>, <pct>% de work orders verificados». | `src/components/modules/Nav/ProjectNavItem.tsx` | `#projlist .navitem`, `.pav` (config: ProjectNavItem) | `project`; at most five by last commit, then «Ver los N»; the group header is collapsible and remembered | new |
| `GuildCard` | Sidebar guild block: crest with the level, rank name, «175 / 200 XP al nivel 23», gold bar; links to Logros; reduced to the crest on the rails. | `src/components/modules/GuildBar/GuildCard.tsx` | `#sidebar .guildcard` (config: GuildCard) | `level`, `rankName`, `xp`, `pctToNext`; derives from the guild reader | restyle (`GuildBar`) |
| `PluginPill` | Coral sidebar pill «Plugin desactualizado» (title: «Instalado X · repositorio Y») linking to the Inicio banner; renders only while the plugin is behind. | `src/components/modules/AppShell/PluginPill.tsx` | `#sidebar .plugin-pill` (config: PluginPill) | `installed`, `source`; one tone (coral) | new |
| `PendingPill` | Sidebar pill «⎇ N pendientes» (alert variant when any repository is «Depurar ya», hidden or calm at zero) linking to Inicio's «Árboles de trabajo» (FRD-21, DR-096). **Drawn** in the captured state `shell-pending-chip` (markup `a.plugin-pill.pending-pill`, `pendingPill()` in `prototype.js`): a branch icon and the label «N pendientes» (or «Árboles» when nothing is countable), suffixed « · depurar ya» or « · sin leer» in the alert variant; the alert variant swaps the icon for an alert icon (state by icon and text, never colour alone). | `src/components/modules/AppShell/PendingPill.tsx` | `#sidebar .pending-pill` (state `shell-pending-chip`) | `count`, `alert`; mirrors `PluginPill` | restyle (`PendingMergeBadge`) |
| `TopBar` | Phone only (< 760px): sticky bar with the menu button, logo 30px and `#where` (small caps «MISSION CONTROL» over the page name). | `src/components/modules/AppShell/TopBar.tsx` | `.topbar`, `#menu`, `#where` (config: TopBar) | `title`, `subtitle`; menu button `aria-expanded`, `aria-controls="sidebar"` | new |
| `BottomNav` | Phone only: five columns, 52px items: Inicio · Tablero · Portafolio · Docs · Más (opens the drawer). The short label of Documentación is «Docs» (the prototype's `mini`), never «Manual». | `src/components/modules/AppShell/BottomNav.tsx` | `nav#bottomnav` (config: BottomNav) | links by `NavItem` ids; «Más» is a `button[data-action="drawer"]` | new |
| `SkipLink` | First focusable element «Saltar al contenido»; moves focus to `main#content`. The prototype's router quirk is not reproduced: the app uses a real in-page anchor. | `src/components/modules/AppShell/SkipLink.tsx` | `a.skip` (config: SkipLink) | none | new |
| `ThemeToggle` | Small sun/moon icon button that switches light and dark (M2 owner decision 5, 2026-10-22, resolves D-8). Placed in the sidebar footer next to the «Colapsar» toggle (`button.side-toggle`, the button is `.theme-btn` with `data-action="toggle-theme"`) and, on phones, inside the drawer. Starts from the system preference (`prefers-color-scheme`), remembers the owner's choice per browser, and sets `data-theme` on `<html>` with no server round-trip. Its accessible name states the action in Spanish; the exact string and the icon logic are those of the prototype's M2 button (copy files win on wording). Restyle of the v1 `ThemeToggle` to Órbita (same name, no second copy); the demo bar's `#theme` button is a separate prototype affordance and does not ship. | `src/components/modules/AppShell/ThemeToggle.tsx` (restyle of `ThemeToggle`) | the theme button the prototype draws in the sidebar footer and the phone drawer (round M2); not the demo-bar `#theme` | `theme: "light" \| "dark"` (derived from the stored choice, else the system preference); icon `sun` / `moon` | restyle (`ThemeToggle`) |
| `Footer` | Prototype-only text («propuesta de diseño, no es la app real», capture stamp). **Not product copy**: the build omits the text; keep the frame spacing only if the app needs a footer. | `src/components/modules/AppShell/Footer.tsx` | `.foot` (config: Footer) | none | new (optional) |

## Framing patterns (app-wide — one of each, used everywhere, DR-062)

Every surface uses these and nothing else for the same job. A surface that invents its own variant is a cohesion defect. Rules in `DESIGN.md` § Shared component rules.

| Pattern | Purpose | Path | Notes |
|---|---|---|---|
| `PageHead` (page title block) | ONE title block per page: optional `Crumbs`, optional eyebrow, ONE `h1` (32px display), subtitle ≤ 70ch, actions at the right (flex-wrap). **The `h1` equals the nav label** (Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración); drill-ins (idea, project) use the item's own name. | `src/components/core/PageHead/PageHead.tsx` (restyle of `PageTitle` + `PageLayout`) | `.pagehead` (config: PageHead). The prototype eyebrow is the teal-dot capture stamp; the build keeps the slot and style. The Inicio `h1` is «Inicio» (the «Centro de mando» wording lives in the subtitle). |
| `Crumbs` | Breadcrumb trail on drill-ins and the work-order detail; the last item is `aria-current="page"`. | `src/components/core/Crumbs/Crumbs.tsx` | `nav.crumbs` (config: Crumbs) |
| `CardHeader` | Tinted 26px icon tile (`BadgeIcon` sm) + display title of ONE size (19px / 700, any heading level) + count pill in the SAME hue + optional action. Used by every card AND every report band. | `src/components/core/Card/Card.tsx` (part of `Card`) | `.card-head`, `.card-title` (config: CardHeader). The count pill inherits `--tone`. |
| `SectionHeading` | The ONE heading for sections outside cards: display title in TEXT colour (15px / 700), icon in the section hue, hairline, muted note and optional link at the right. | `src/components/core/SectionHead/SectionHead.tsx` (restyle) | `.saga-head`, `.saga-line` (config: SectionHeading, SectionHeadingLink) |
| `Tabs` | The ONE tab pattern: 46px buttons with a 15px icon and optional count badge; selected = text colour, tinted icon and a 2.5px bottom bar in the tab's hue; overflow arrows with 28px fades; arrow keys move; the selected tab scrolls into view on phones. Used for the project workspace, idea tabs, Logros, Propuestas, Configuración, Observabilidad views of a work order. | `src/components/core/Tabs/Tabs.tsx` (restyle) | `.tabs-wrap > .tabs[role=tablist]` (config: Tabs). `tone` per tab. |
| `Segmented` | View switch (Tarjetas / Lista / Cuentas, Diagrama / Esquema, Por FRD / Tablero / Dependencias): `aria-pressed` buttons, neutral selected state. | `src/components/core/Segmented/Segmented.tsx` | `.seg` (config: Segmented) |
| `Chip` family | 24px chip, 12px / 600, hue on `--tint-strong`; `plain` neutral; `outline` hairline; `CountPill` is a chip beside a title; `FilterChip` (34px, selected = neutral `--surface-3`, never a hue); `.illus` dashed «Ilustrativo». One pill primitive, many variants. | `src/components/core/Chip/Chip.tsx` (+ `CountPill.tsx`, `FilterChip.tsx`; hue tones, `variant`, `icon`; vocabulary in `Chip/vocabulary.ts`; `CountBadge`/`TierBadge` stay v1 until WO-13-013) | `.chip`, `.chipbtn` (config: Chip, ChipPlain, ChipOutline, CountPill, FilterChip) |
| `CommandBox` | The ONE command-chip: terminal icon (violet; tinted by a toned container) + mono `code` + 36px copy icon button «Copiar <comando>»; wraps only at «:» and spaces; compact `CommandCompact` in list rows. Mission Control never runs a command. | `src/components/core/CmdRow/CmdRow.tsx` (restyle) | `.cmd`, `.ask-cmd` (config: CommandBox, CommandCompact) |
| `ListRow` | Row of icon tile + title + small muted line + chips + chevron, min 56px, `divided` hairlines; on phones chips and commands move under the title. | `src/components/core/ListRow/ListRow.tsx` | `.lrow`, `.divided` (config: ListRow) |
| `EmptyState` / `Notice` | `.empty` dashed box with a 22px icon and one sentence; `.notice` tinted by tone with an icon (upgrade, error, unavailable source). Every surface designs both. | `src/components/core/EmptyState/EmptyState.tsx`, `src/components/core/Notice/Notice.tsx`, `src/components/core/Notice.tsx` (restyle of `Banner` for notices) | `.empty`, `.notice` (config: EmptyState, Notice) |
| `AlertBanner` | The only coral alert banner: the plugin warning, first element of Inicio, mirrored by `PluginPill`. Consumer of `Notice` (one banner, DR-057). | `src/components/core/Banner/Banner.tsx` (restyle) | `.alert-banner` (config: AlertBanner) |
| `MoreBar` («Mostrar más») | Full-width dashed 40px bar «Mostrar N más · quedan M» at the end of a paged list. | `src/components/core/MoreBar/MoreBar.tsx` | `.morebtn` (config: MoreBar) |
| `SearchField` / `SelectField` | One field height (40px), search at most 480px wide (full width on phones); selects are `.field` with a chevron; `Switch` for «Ocultar columnas vacías». | `src/components/core/Field/Field.tsx` | `.field.search`, `.field`, `.switch` (config: SearchField, SelectField, Switch) |
| `Dialog` | One native `dialog#dlg`: width `min(680px, 100vw − 32px)`, radius 22px, tinted sticky head with an uppercase kicker in the dialog's hue, display title, ✕, 20px body; `DialogConfirm` adds Cancelar / verb and an optional reason; `DialogSheet` is the label \| content rows layout (128px labels) for FRD details. Native Escape and focus return. | `src/components/core/Modal/Modal.tsx` (restyle; one `Modal` core) | `#dlg` (config: Dialog, DialogConfirm, DialogSheet) |
| `Toast` | `#toast` inverted pill, bottom centre, 2.6s, for simulated writes and copy; `AchievementToast` (gold, «Ver», «Cerrar aviso», closes after 9s) is a distinct component. | `src/components/core/Toast/Toast.tsx` (restyle) | `#toast` (config: Toast) |
| Card pairs | Two cards side by side end at the same height; below 1024px one column, actionable side first. A layout rule on `.grid-2` / `.home-grid`, not a component. | Surface-owned `.grid-2` / `.home-grid` layouts | `.grid-2`, `.home-grid` |

## Primitives — `components/core/`

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `Icon` | The inline SVG icon set (65 icons exported to `docs/design/prototype/icons/`); 18px, 1.8 stroke, `sm` 15px, `lg` 22px. Exported SVGs only, never redrawn. | `src/components/core/Icon/Icon.tsx` (data in `iconData.ts`) | `.i` | `name`, `size: "sm" \| "md" \| "lg"`, `label?` (Spanish accessible name; decorative without it) | built (WO-13-010) |
| `Card` | The card surface: `--surface`, hairline `--line`, radius 16, padding 20/24, optional `data-tone`; variants `flush` (no padding, divided list inside), `tinted` (top gradient of the hue), plus `CardFoot` (top hairline, actions) and `CardHeader`. | `src/components/core/Card/Card.tsx` | `.card`, `.card.flush`, `.card.tinted`, `.card-foot` (config: Card, CardFlush, CardTinted, CardFoot) | `tone`, `flush`, `tinted`, `title`, `icon`, `count`, `action`, `level` (heading level) | restyle (`Panel`) |
| `BadgeIcon` | The tinted icon tile: 32px (`sm` 26, `lg` 44), radius by size, icon in the hue on `--tint-strong`. | `src/components/core/BadgeIcon/BadgeIcon.tsx` | `.badge-icon` (config: BadgeIcon) | `tone`, `size: "sm" \| "md" \| "lg"` | built (WO-13-011) |
| `Button` | 40px (`sm` 32px) action button; the primary inverts; `toned` uses the hue; `danger` is outlined coral and never an attractive primary; `ghost`; `IconButton` 40px square; `Link` inline action. One primary action per screen. | `src/components/core/Button/Button.tsx` (restyle) | `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.sm`, `.btn.toned`, `.iconbtn`, `.link` (config: Button, ButtonPrimary, ButtonGhost, ButtonSmall, ButtonToned, IconButton, Link) | `variant: "default" \| "primary" \| "ghost" \| "toned" \| "danger"`, `size`, `tone`, `iconOnly` | restyle |
| `ButtonLink` | Navigation link sharing Button styles; button look supports sizes and a 44px phone touch target. | `src/components/core/Button/ButtonLink.tsx` | `.btn`, `.link` | `href`, `look`, `size`, `children` | shared |
| `KeyValue` | Definition list: muted `dt`, `dd` that wraps. | `src/components/core/KeyValue/KeyValue.tsx` | `.kv` (config: KeyValue) | `items[]` | built (WO-13-011) |
| `Table` | Data table with uppercase 12px heads on `--surface-2`, hairline rows; becomes one card per row below 1024px. | `src/components/core/Table/Table.tsx` | `table.t`, `.table-wrap` (config: Table) | `columns`, `rows`, `stackBelow: 1024` | new |
| `StateDot` | 7px dot plus state word; never colour alone. | `src/components/core/StateDot/StateDot.tsx` | `.state-dot`, `.dot` (config: StateDot) | `state`, `variant="workOrder"` (default) or `variant="repository"` | built (WO-13-011; adapted WO-21-003) |
| `Avatar` | Project initials tile in the phase hue; agent sprite avatar. | `src/components/core/Avatar/Avatar.tsx` (restyle) | `.pav` (config: Avatar) | `initials`, `tone`, `size: "md"`; agent: `role`, `pixelated` | restyle |
| `Ring` | Conic progress ring with centred percentage and tooltip; 52px (`lg` 76px); green at 100%. | `src/components/core/Ring/Ring.tsx` | `.ring` (config: Ring) | `pct`, `tone`, `size`, `tip` (role=img, label «109 de 110 work orders verificados») | built (WO-13-011) |
| `ProgressBar` / `StackBar` | 6px bar in a hue; 8px stacked bar of work-order states; both with an accessible text alternative. | `src/components/core/ProgressBar/ProgressBar.tsx` (restyle) | `.bar`, `.stackbar` (config: ProgressBar, StackBar) | `pct`, `tone`; `segments[]` of `{ state, count }` | restyle |
| `StateTile` | Work-order state tile with count and bar; doubles as a combinable filter (`aria-pressed`). | `src/app/projects/[slug]/_components/StateTile.tsx` | `.state-tile` (config: StateTile) | `state`, `count`, `pressed` | new |
| `CopyText` | Click-to-copy text with a light sweep and a «Copiar» hint on hover-capable pointers (logins, skill commands). | `src/components/core/CopyText/CopyText.tsx` | `.copy-text` (config: CopyText) | `value`, `hint` | built (WO-13-011) |
| `Markdown` | Rendered markdown in the document type's hue (h1 tinted underline, h2 tinted, h4-h6 as small labels, tinted table heads and zebra rows, tinted code); tables keep whole words and scroll sideways with a hint. Also the mapping for the captured Manual (`.manual-live`). | `src/components/core/Markdown/Markdown.tsx` (restyle) | `.md`, `#paper .md` (config: Markdown) | `tone`, `compact` | restyle |
| `Paper` | Typed document reader: header with type chip, path and copy button, then `Markdown`. | `src/components/modules/DocumentReader/Paper.tsx` | `#paper` (config: Paper) | `type`, `path`, `html` | new |
| `PhaseStepper` | Six-segment phase stepper (past 55% hue, current full hue with halo, future neutral) with labels; `compact` variant for cards and the project header. | `src/components/core/PhaseStepper/PhaseStepper.tsx` | `.stepper`, `.stepper.compact` (config: Stepper, StepperCompact) | `phase`, `compact`, per-phase tooltips | built (WO-13-011) |
| `Rarity chip` | Común / Poco común / Raro / Épico / Leyenda as a toned chip (text always shown). | `src/components/core/Chip/Chip.tsx` (fold) | `.chip[data-tone]` | `rarity` → tone | restyle (`TierBadge`) |

## Modules — `components/modules/` and route `_components/`

Composed from the rows above; never re-implement a primitive inside one.

### Inicio

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `AskRow` | One-line «Tu turno» item: icon, title, project · kind · age, scoped command with copy, «Detalles» dialog. | `src/app/(dashboard)/_components/AskRow.tsx` | `.ask-row` (config: AskRow) | `item`, `command`, `age` | restyle (`TuTurno`) |
| `TurnRow` | A row of the owner-turn list grouped by kind (decisions, changes ready). | `src/app/(dashboard)/_components/TurnRow.tsx` | `.turn` (config: TurnRow) | `kind`, `tone` | new |
| `FlightGroup` | Collapsible «En marcha» group (Construyéndose ahora, Esperan la revisión, Borradores). | `src/app/(dashboard)/_components/FlightGroup.tsx` | `details.flight-group` (config: FlightGroup) | `title`, `count`, `open` | new |
| `ProjectCard` | Portfolio overview card: avatar, phase chip, six-step stepper, ring, «Etapa N de 6 · último cambio hace …», counts, «Siguiente · <command>». | `src/components/modules/ProjectCard/ProjectCard.tsx` | `.proj-card` (config: ProjectCard) | `project`, `compact` | new |
| `KpiTiles` | «Pulso» tiles with display numbers and small labels (Proyectos, FRDs, WO verificados). | `src/components/modules/Pulso/Pulso.tsx` (restyle) | `.pulse` (config: KpiTiles) | `items[]` | restyle |
| `FunnelRow` | Idea funnel row per phase with bar and count; discarded counted apart. | `src/app/(dashboard)/_components/FunnelRow.tsx` | `.funnel .frow` (config: FunnelRow) | `phase`, `count`, `max`, optional `report: { caption, tone }` | new |
| `WorktreesTable` | «Árboles de trabajo»: Proyecto · Sin integrar · Sobrantes · Estado, state by the legend rule (Depurar ya · Revisar pronto · Al día · Limpio); a row opens the branch dialog. | `src/components/modules/Worktrees/WorktreesTable.tsx` | `.wt-table` (config: WorktreesTable) | `rows`, `state` | restyle (`FactoryWorktrees`) |
| `WorktreesCard` | Repository states, scroll hint, read-error notices, legend and cleanup command. | `src/components/modules/Worktrees/WorktreesCard.tsx` | `#worktrees-card` (config: WorktreesCard) | `rows: WorktreesByRepo` | built (WO-21-003) |
| `WorktreesBranchDialog` | Repository branch details with shared Modal focus lifecycle. | `src/components/modules/Worktrees/WorktreesBranchDialog.tsx` | `worktrees-factory-dialog` | `repository`, `onClose` | built (WO-21-003) |
| `LastAchievement` | Inicio's last-achievement tile. | `src/app/(dashboard)/_components/LastAchievement.tsx` | `.last-ach` (config: LastAchievement) | `trophy` | new |
| `ProgressList` | «Últimos avances» lines (icon, status label, subject, date), built only from structured sources. | `src/app/projects/[slug]/_components/ProgressList.tsx` | `.progress-list` (config: ProgressList) | `items[]` | new |

### Tablero and idea

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `PhaseNav` | Phase selector chips with counts that jump to a column (tablet and phone). | `src/app/board/_components/PhaseNav.tsx` | `.phase-nav` (config: PhaseNav) | `phases`, `current` | new |
| `BoardColumn` | Equal-width phase column with head, count chip and cards; narrow when empty, shows its 0. | `src/app/board/_components/BoardColumn.tsx` (restyle of `KanbanColumn`) | `.kanban.ideas .kcol` (config: BoardColumn) | `phase`, `count`, `empty` | restyle |
| `IdeaCard` | Board card: title, favourite star, category and return chips, score; `IdeaCardProject` variant adds the project progress line. | `src/components/modules/IdeaCard/IdeaCard.tsx` (restyle) | `.kcard` (config: IdeaCard, IdeaCardProject) | `idea`, `project?` | restyle |
| `DigestHero` | Report-band hero of the Spec, Arquitectura and Propuesta tabs. | `src/app/board/_components/ReportBand/DigestHero.tsx` | `.dhero` (config: DigestHero) | `eyebrow`, `title`, `lead`, `chips` | new |
| `ReportBand` | Band with the card header and label \| content rows (`.brow`, 128px labels). Also hosts the Propuesta blocks folded here: features (`.feat`), risks (`.risk`), quote (`.pquote`), checks (`.checks`), score bar (`.score-bar`), decision box (`.pbox`), gauge card (`.gcard`), legal (`.legal`). | `src/app/board/_components/ReportBand/ReportBand.tsx` | `.band`, `.brow` (config: ReportBand) | `tone`, `icon`, `title`, `count`, `rows[]` | new |
| `FrdCard` | Fully clickable FRD card: code, coloured kind tag (UI pink, Infra slate, Tool/CLI teal, API blue, Data gold), state stack bar once built (planned count before). | `src/components/modules/Spec/FrdCard.tsx` | `.frdc` (config: FrdCard) | `frd`, `kind`, `progress?` | new |
| `EnvRow` / `EnvFold` | Environment variable as label \| content row grouped by `.env.example` sections, «Sin descripción en .env.example» with a count, first group open, subsequent groups collapsed; count and warning chips in each summary. | `src/components/modules/ReportBand/EnvRow.tsx` | `.envrow`, `details.env-fold` (config: EnvRow, EnvFold) | `name`, `text`, `group` | new |
| `AdrRow` | Decision (ADR) row opening the ADR dialog. | `src/app/board/_components/ReportBand/AdrRow.tsx` | `.adr-row` (config: AdrRow) | `adr` | new |
| `PlanMosaic` | State mosaic of the plan (hidden before Construcción). | `src/app/board/_components/ReportBand/PlanMosaic.tsx` | `.mosaic` (config: PlanMosaic) | `rows[]` | new |
| `CampaignRoom` | Campaña room on the dark map (`--map-*`): pixel-art zone, name tag, cast sprites idling or roaming, active room pulsing, corridors carrying the hand-off artifact. | `src/components/modules/CampaignPipeline/CampaignRoom.tsx` | `.room`, `.corridor` (config: CampaignRoom) | `phase`, `state: "done" \| "current" \| "locked"`, `cast` | restyle (`CampaignPipeline`) |
| `PhaseSheet` | Phase sheet below the map: tinted head with number, state chip and prev/next; Descripción; Entra y sale (Lee → Escribe); Equipo; Qué puedes correr with «Siguiente paso · avanza a …». | `src/components/modules/CampaignPipeline/PhaseSheet.tsx` | `.phase-sheet` (config: PhaseSheet) | `phase` | restyle |
| `TeamMember` | Stage sprite, name, role and one sentence. | `src/components/modules/CampaignPipeline/TeamMember.tsx` | `.tmember` (config: TeamMember) | `member` | new |
| `BuildModeCard` | Selectable build mode card: icon, tag, 1-4 power meter, hint; Equilibrado preselected (FRD-11). | `src/components/modules/BuildModePicker/BuildModeCard.tsx` | `.mode` (config: BuildModeCard) | `mode`, `pressed` | restyle (`BuildModeSelector`) |
| `BuildModePicker` | Shared per-project mode cards, session selection with best-effort browser persistence and exact copyable command. Command-box copy stays 36 px visually with a 44 px touch hit area. | `src/components/modules/BuildModePicker/BuildModePicker.tsx` | `.mode-grid`, `[data-testid="mode-cmd"]` | `project`, `onModeChange?`; balanced server snapshot | implemented |

### Portafolio and project workspace

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `ProjectHero` | Full project header on Resumen only: title, project switcher, hero stats (ring, counts), full stepper. | `src/app/projects/[slug]/_components/ProjectHero/ProjectHero.tsx` | `.hero` (config: ProjectHero, HeroStats) | `project` | new |
| `ProjectHeroCompact` | One-line header on every other tab: initials, name, phase, «n/m WO · pct», compact stepper, «Cambiar proyecto». | `src/app/projects/[slug]/_components/ProjectHeroCompact/ProjectHeroCompact.tsx` | `.hero.compact` (config: ProjectHeroCompact) | `project` | new |
| `ProjectSwitcher` | «Cambiar proyecto» button that opens the searchable project dialog, ordered by last commit. | `src/components/modules/ProjectSwitcher/ProjectSwitcher.tsx` | `.switcher` (config: ProjectSwitcher) | `projects[]` | new |
| `FraguaScene` | La Fragua as the main scene of the Resumen (dark in both themes): verdict headline, health chip, forging bar (role=img with counts), four stations, courier and foot chips. The demo scene control is **not** part of it (DR-061). | `src/app/projects/[slug]/_components/Fragua/FraguaScene.tsx` | `section.fragua` (config: FraguaScene) | `project`, `running` (drives live mode), `health` | new (replaces `party/*`) |
| `FraguaStation` | One of Cola · Taller · Revisión · Bóveda: decorative crew, plate (name, count, sub-label), up to 8 tokens then «+N»; `FraguaStationEmpty` draws three dashed ghost slots and the empty message. One station per row below 900px. | `src/app/projects/[slug]/_components/Fragua/FraguaStation.tsx` | `.fr-station[data-station]` (config: FraguaStation, FraguaStationEmpty) | `station`, `tokens[]`, `count` | new |
| `FraguaToken` | 44×40px tinted work-order tile (FRD number over order number); hover or focus opens `#tok-tip` with code, state chip, title, one sentence, FRD. | `src/app/projects/[slug]/_components/Fragua/FraguaToken.tsx` | `.token[data-wo]`, `#tok-tip` (config: FraguaToken) | `wo`, `station` | new |
| `SnapshotPanel` | «Último commit en verde» with FRD, short SHA and the copyable `git worktree add` command; only while a build runs. **Planned**: M1 state `project-snapshot`. | `src/app/projects/[slug]/_components/snapshot-panel/SnapshotPanel.tsx` | (S2.1 draws it) | `running`, `lastGreenSha` | restyle (`SnapshotPanel`) |
| `AccountsTable` | Cuentas: service name opens its dashboard in a new tab, login is click-to-copy, environment chips in one teal hue, status; ordered configured → proposed → inactive then A-Z; one card per row below 1024px. Reused by the global third Portafolio view («Cuentas») planned as `portfolio-accounts`. | `src/components/modules/ServicesDirectory/AccountsTable.tsx` | `.acc-table` (config: AccountsTable) | `services`, `projectId?` | restyle (`ServicesDirectory`) |

### Work orders and observability

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `FrdRow` | Collapsed FRD group: name, stack bar, n/m and percentage; «Verificado · N derivas» badge when drift is recorded. | `src/app/projects/[slug]/_components/wo/FrdRow.tsx` | `details.frd-row` (config: FrdRow) | `frd`, `drift?` | new |
| `WorkOrderRow` | Work-order row: id, title, state chip, dependency count in a fixed-width column. | `src/app/projects/[slug]/_components/wo/WorkOrderRow.tsx` | `.worow` (config: WorkOrderRow) | `wo` | restyle (`WoBoard` row) |
| `WorkOrderColumn` / `WorkOrderCard` | Tablero: column capped at 8 cards (4 on phones) with «Mostrar más», empty column collapses to one line; card with id, title, FRD; `fail` variant (coral, alert icon, «Bloqueado» column) is a variant of the SAME card. | `src/app/projects/[slug]/_components/wo/WorkOrderCard.tsx` | `.wo-kanban .kcol`, `.wocard` (config: WorkOrderColumn, WorkOrderCard) | `wo`, `state` | restyle |
| `WoSteps` | Flow header Planificado → En curso → En revisión → Verificado with the «Ahora:» sentence. | `src/app/projects/[slug]/_components/wo/WoSteps.tsx` | `.wo-steps` (config: WoSteps) | `state` | new |
| `CriterionList` | «Cómo se comprueba»: one card per acceptance criterion, id tag, EARS keywords marked. | `src/app/projects/[slug]/_components/wo/CriterionList.tsx` | `.crit` (config: CriterionList) | `criteria[]` | new |
| `DependencyButton` | Chip-button for an upstream or downstream work order in the fact sheet. | `src/app/projects/[slug]/_components/wo/DependencyButton.tsx` | `.wo-detail-grid .btn.sm[data-wo]` (config: DependencyButton) | `wo` | fold (`Button` sm) |
| `DependencyFrdBox` / `DependencyFrdItem` | «Por FRD» map: compound box per FRD (state stack bar, work orders in chain order, 3 columns, 2 boxes per row), aggregated cross-FRD lines with count and «⇄»; below 900px an ordered list whose FRDs unfold (`.dl-frd`). | `src/app/projects/[slug]/_components/deps/DependencyFrdBox.tsx` | `.fdag-box`, `.dl-frd` (config: DependencyFrdBox, DependencyFrdItem) | `frd`, `edges[]` | new (replaces `WoDag`) |
| `DependencyNode` | «Por work order» node 176×46px tinted by state, curved edges; click lights the upstream and downstream chain and dims the rest. | `src/app/projects/[slug]/_components/deps/DependencyNode.tsx` | `.dag-node` (config: DependencyNode) | `wo`, `focus` | new |
| `DependencyList` / `DependencySide` | Below 900px the work-order level is a list by build step; `DependencySide` is the «Orden en foco» card with «Depende de · N», «Desbloquea · N» and «Abrir orden». | `src/app/projects/[slug]/_components/deps/DependencySide.tsx` | `.dag-list .lrow`, `.dag-side` (config: DependencyList, DependencySide) | `focus` in the URL | new |
| `ModelDiagram` / `SchemaList` | Data model: Diagrama (268px entity cards, PK/FK badges, selection lights relations; toolbar − % + fit reset fullscreen) and Esquema (collapsed Prisma-like accordions, one open at a time; relations list `.rel-row` with cardinalities folded here). **The app's current layout engine stays** (M1, owner-approved 2026-10-16): only the Órbita styling changes. | `src/components/modules/DataModelViewer/DataModelViewer.tsx` (restyle) | `#diagram`, `.entity`, `.schema-list` (config: ModelDiagram, SchemaList) | `result: DataModelResult`, `view: "Diagrama" \| "Esquema"`; phones open on Esquema | restyle |

### Documentos and Documentación

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `DocIndex` / `DocItem` | Document index ordered by purpose, type filter chips with counts, search; on the RIGHT from 900px, folded below that behind a button that reads «Elegir documento · N» (project Documentos, N = number of documents) or «Índice · <página>» (Documentación reader, the current page title), as captured. | `src/components/modules/DocumentReader/DocIndex.tsx` | `#doc-index`, `.ditem`, `.dgroup` (config: DocIndex, DocItem) | `groups`, `query`, `type` | new |
| `IdeaDocsRail` / `IdeaDocsItem` | An idea's documents rail (picked from a folded list below 900px). | `src/app/board/_components/IdeaDocs/IdeaDocs.tsx` | `.idocs-rail`, `.idocs-item` (config: IdeaDocsRail, IdeaDocsItem) | `docs[]` | restyle (`CardDetail` Documentos) |
| `DocsGroupCard` / `DocsSteps` | Documentación home: «Empieza aquí» numbered tutorial («Después, entiende lo esencial»), «Guías para el día a día», «Explorar por tipo»; pair of cards of equal height (`.docs-pair`, `.docs-sub` folded here). | `src/app/manual/_components/DocsHome.tsx` | `.docs-group`, `.docs-steps` (config: DocsGroupCard, DocsSteps) | `group`, `steps[]` | restyle (`Manual` landing) |

### Logros

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `GuildHero` | Hero above all five Logros tabs: crest XL, rank, level, XP bar, hero stats. | `src/components/modules/GuildHero/GuildHero.tsx` (restyle) | `.guild-hero` (config: GuildHero) | `level`, `rank`, `xp` | restyle |
| `NextRankCard` | «Tu siguiente rango»: current → next emblem, XP left, how XP is earned. | `src/app/achievements/_components/NextRankCard.tsx` | `.nr` (config: NextRankCard) | `current`, `next` | new |
| `MissionCard` | Mission chain card: head, slot, title, tier chip, nodes, bar, foot; spot variant; untouched missions muted and last. | `src/app/achievements/_components/MissionCard.tsx` | `.mcard` (config: MissionCard) | `chain`, `spot` | restyle (`ChainCard`) |
| `TrophyCard` / `SecretTile` / `SealTile` | Trophy tile (locked/unlocked, rarity chip, date and project), secret tile (an unlocked secret becomes a normal tile with its condition), seal tile of the conquered bar. Trophy progress card (`.tprog`) folded into `TrophyCard`. | `src/app/achievements/_components/TrophyCard.tsx` | `.tcard`, `.secret`, `.seal` (config: TrophyCard, SecretTile, SealTile) | `trophy`, `locked` | restyle |
| `RankRow` / `EraGroup` | Rank ladder row (emblem on the left, level band, state) and era group collapsed when more than one step beyond the current rank. | `src/app/achievements/_components/RankLadder.tsx` | `.rank`, `details.era` (config: RankRow, EraGroup) | `rank`, `current`, `far` | restyle (`RankLadder`) |
| `RadarChart` / `ColumnChart` / `LineChart` | SVG charts with token colours: six-axis radar (guild attributes), column and line charts for statistics. | `src/app/achievements/_components/charts/` | `svg.radar`, `.cols`, `.linechart` (config: RadarChart, ColumnChart, LineChart) | `axes`, `series` | restyle (`StatRadar`) |
| `StatKpi` / `RecordTile` / `LedgerCard` / `TransitionRow` | Statistics KPI, record tile (with «sin datos aún» state), ledger card and phase-transition row (10 at a time, two-line cards on phones). | `src/app/achievements/_components/Stats.tsx` | `.kpi`, `.hstat`, `.ledger`, `.trans li` (config: StatKpi, RecordTile, LedgerCard, TransitionRow) | `value`, `noData` | restyle (`HeroStat`, `StatLedgerRow`) |
| `AchievementToast` | Gold notice for a new trophy: «Ver», «Cerrar aviso», closes after 9s, once per browser. | `src/components/modules/AchievementToast/AchievementToast.tsx` | `.ach-toast` (config: AchievementToast) | `trophy` | restyle |

### Propuestas and Configuración

| Component | Purpose | Path | Prototype | Key props / variants | Status |
|---|---|---|---|---|---|
| `ProposalActionRow` | «Qué te toca, en orden»: count, reason, command, where to run it, link. | `src/app/proposals/_components/ProposalActionRow.tsx` | `.pa-row` (config: ProposalActionRow) | `action` | restyle (`ProposalCard`) |
| `LessonFlow` | Four-step lesson flow with who moves each step. | `src/app/proposals/_components/LessonFlow/LessonFlow.tsx` | `.lf` (config: LessonFlow) | none | new |
| `SignalGroup` | «Señales automáticas» group by kind; a signal that flags most of its population is marked unreliable. | `src/app/proposals/_components/SignalGroup.tsx` | `.sig-group` (config: SignalGroup) | `kind`, `items[]` | new |
| `AreaBar` | «Por tema» bar in plain names that filters the backlog. | `src/app/proposals/_components/AreaBar.tsx` | `.area-bar` (config: AreaBar) | `area`, `count`, `pressed` | new |
| `ConfigTile` / `ConfigRow` | Configuración hub count tile; catalog row with icon, name, description and a copy-on-click command. | `src/app/configuration/_components/ConfigRow.tsx` | `.cfg-tile`, `.cfg-row` (config: ConfigTile, ConfigRow) | `kind` (skill violet, agent blue, rule pink, standard teal) | restyle (`SkillCard`, `StandardCard`) |
| `AgentCard` | Agent card: sprite, name, model tier label (neutral), description; grouped by tier. | `src/app/configuration/_components/AgentCard.tsx` | `.agent-card` (config: AgentCard) | `agent` | restyle |
| `RuleRow` | Decision rule as a native accordion (the recorded exception to reveal-more-as-dialog): id, Auto / Owner chip, default text. | `src/app/configuration/_components/RuleRow.tsx` | `details.rule-row` (config: RuleRow) | `rule` | restyle (`RuleCard`) |

## Not components (prototype-only, never built)

- The demo bar (`.demo`, its own theme button `#theme`) and La Fragua's scene control (`.demo-inline`, «Demo · Estado real / Apagada / Encendida / Simulación»): marked `data-demo-only`, hidden with `?demo=off` (DR-061). The real scene reads the project's `running` flag and heartbeat. The product theme control is the separate `ThemeToggle` row (D-8 resolved at M2: a theme button is drawn in the sidebar footer and the phone drawer).
- The footer text and the capture stamp («Captura de proyectos · …», «Captura de la fábrica · …», `.stamp`, `#foot-stamp`): prototype-only, not a component and not product copy; the build implements neither (the Documentación `.stamp` eyebrow naming the rendered-pages source is likewise drawn by the prototype for its capture). Also `preview.html`, `OPEN-MOCKUP.md`.
- The engine log (`.feed .entry`) is a collapsed `details` inside the Resumen, built from `FlightGroup`'s pattern, not a component.

## Drawn from the M1 decisions (each is a captured, configured state; reuse, do not add components)

The 12-state safety batch is made of existing rows: `wo-failed` (`WorkOrderCard` fail variant + «Bloqueado» column), `build-no-signal` («Sin señal · último evento hace N» on the Inicio card, `ProjectCard` and `FraguaScene` via `Chip`), `backlog-errors`, `model-invalid`, `worktrees-unreadable`, `stats-stream-error`, `accounts-source-error` (all `Notice` error variants), `portfolio-path-missing` (`Chip` + `CommandBox`), `factory-empty` and `home-calm` (`EmptyState`), `wo-frd-drift` (`FrdRow` badge), `project-change-rebuilds` and `idea-discarded-reason` (`Notice` + `Dialog`). Also `shell-pending-chip` (`PendingPill`), `project-snapshot` (`SnapshotPanel`), `portfolio-accounts` (`Segmented` third option + `AccountsTable`).

## Carried over from v1 (behaviour, no visual change)

These are not restyled rows; they stay as they are and are listed so nothing re-implements them: `useLiveSnapshot` (`src/hooks/useLiveSnapshot.ts`, the SSE transport), `LiveRegion` and `useKeyboardNav` (`src/components/a11y/`), `useUrlState`, `NavigationSeedProvider` and `NavigationCanonical` (FRD-25 persistent navigation: the selected tab derives from the URL; canonical defaults redirect on the server; NavigationCanonical only marks exact URLs; client selections use its patched native history bridge, retaining managed entries across reload, anchor changes and Back/Forward), `NavigationProvider`, `useBackgroundRefresh` and `NavigationLink` (headless shared pending-transition coordination for workspace/sidebar navigation and live refresh), `SectionedMarkdown`, `GraphControls` (the data-model toolbar), `FreshnessBadge` (DR-066 graded freshness; backs the «Sin señal» state), `useModelLayout` and the layout engine of the data model, `ManualNavContext`, and the `skill-flows` data (kept for the Manual; its interactive `FlowGraph` is out of v2, B-15).

## Retired with the Atelier skin (do not extend)

`Panel` / `RpgPanel` (`rpgpanel`, `rpggrid`), `ItemSlot`, `Shield` and `XpBar` as pixel-RPG primitives (the guild crest and gold bar are now `GuildCard` / `GuildHero`), `DocHeading`, `CelebrationSurface` and `CelebrationWatcher` (B-18), `ProjectRail` and `RailItem` (the rail is gone), `ProposalsDismiss` (B-28), `Digest` (B-30), the whole `party/*` set (`Room`, `StoneBridge`, `FlowStrip`, `PowerOffOverlay`, `MissionBar`, `DemoControls`, `AgentSprite`, `JudgeSprite`, `SpeechBubble`, `Tooltip`, `Parchment`, `DeepRelay`, `EventFeed`, `PartyScene`, `PartyTab`), `TimelineView` and `WoDag` (Observabilidad has no timeline; the dependency map is new), (`ThemeToggle` is NOT retired: it stays as the product theme control, restyled, see its row in the shell table.)

## AppShell nav contract (DR-075)

Recorded FROM the approved prototype's markup (`docs/design/prototype/prototype.template.html`, `renderSidebar()` and `renderBottomNav()` in `prototype.js`), never from the app's route list. `/pandacorp:architecture` parses this section to seed `e2e/shell.ts` (Shell-Presence Gate). Paths below are the app's routes for each prototype destination (FRD-19 current routes, `src/components/modules/Nav/Nav.tsx`); the prototype's own hash id is given after each line.

- **Shell landmark selector:** `aside#sidebar` (the sidebar, `aria-label="Navegación principal"`; present in the DOM at every width, off-canvas and `inert` on phones). The frame that wraps it is `.app#app`.
- **Top-level destinations** (from the prototype's persistent nav, one `{label, path}` per line, in order):
  - `{ label: "Inicio", path: "/" }` (prototype `#inicio`, amber home icon, count of owner items)
  - `{ label: "Tablero", path: "/board" }` (prototype `#tablero`, teal kanban, idea count; the idea detail highlights this item)
  - `{ label: "Portafolio", path: "/portfolio" }` (prototype `#portfolio`, blue folder; the project workspace lives under it)
  - `{ label: "Propuestas", path: "/proposals" }` (prototype `#propuestas`, pink bulb, count of owner actions)
  - `{ label: "Logros", path: "/achievements" }` (prototype `#logros`, gold trophy)
  - `{ label: "Documentación", path: "/manual" }` (prototype `#documentacion`, violet book; short rail and bottom-nav label «Docs»)
  - `{ label: "Configuración", path: "/configuration" }` (prototype `#configuracion`, slate settings; short rail label «Ajustes»)
- **Shell-exempt routes** (legitimately render WITHOUT the shell): none (the prototype has no route that renders without the shell; the FRD-19 `SHELL_EXEMPT` drill-ins of v1 are gone, `/projects/**` and `/configuration` now sit inside the shell).
- **Mobile drawer/toggle:** below 760px the sidebar becomes an off-canvas drawer (`min(300px, 86vw)`, slides by `translateX` in 220ms, `inert` when closed, scrim `#scrim`, closes on route change) toggled by `button#menu` in the sticky top bar (`aria-label="Abrir menú"`, `aria-controls="sidebar"`, `aria-expanded`) or by «Más» in the sticky bottom nav (`nav#bottomnav`, items Inicio · Tablero · Portafolio · Docs · Más). From 760px to 1179px the same sidebar is a 76px icon rail with mini labels (no toggle); from 1180px it is the 252px sidebar, collapsible with `button.side-toggle` («Colapsar» / «Fijar abierta», `aria-pressed`) to a 64px rail that floats open over the page on pointer or focus.
- **Build artifacts:** `app/layout.tsx` mounts `AppShell` once; the nav component is `Nav` (with `NavItem`, `ProjectNavItem`, `GuildCard`, `PluginPill`, `PendingPill`, `ThemeToggle`); the foundation wave builds them before any surface. Extra items in the sidebar that are **not** destinations: the plugin pill, the pending-merge pill (`PendingPill`, drawn in `shell-pending-chip`), the theme button (`ThemeToggle`, sidebar footer and phone drawer), the Proyectos group (up to five projects by last commit, then «Ver los N»), the guild card.

## S1A primitive completion (2026-10-30)

The restyle rows for Button, CommandBox, CopyButton, Toast, Avatar, Tabs, SectionHeading, AlertBanner,
Dialog, Markdown and PageHead compatibility wrappers are implemented in place. Canonical mappings:
CommandBox = `CmdRow` (`variant="box"`), Dialog = `Modal`, SectionHeading = `SectionHead`, AlertBanner =
`Banner`. `CommandCompact` is exported beside CmdRow. All prior consumer props remain accepted.
Button/Tabs/Modal's additive API is published in FRD-13's blueprint; each work order's dated S1A
Status Note records the remaining exports. Avatar uses `agentId` for an agent or `name`/`initials`
for a project; sprite rendering is always pixelated. PageLayout renders a section so the shell owns
one main landmark. The early table's `iconOnly` concept is the separate `IconButton`; Button accepts
an optional `icon` while its existing `ariaLabel` names an icon-only use.

### Reader failure clarification (2026-10-31)

- `ObservabilidadPanel` reuses `Notice`: separate its localized read-failure text and inline source path with a literal space.
- `PortfolioOverview` reuses `Table` and `Link`: an unknown open-change count for an existing project displays "No se pudo leer" linking to its Cambios tab. The canonical counter keeps its typed unknown result; no partial total is shown. Missing project folders keep the absent-source placeholder.

### Per-file read failures (2026-10-31)

| Component | Purpose | Path | Notes |
| --- | --- | --- | --- |
| FileReadErrors | Shared coral Notice naming failed source files and localized reasons beside valid data. | `src/components/modules/FileReadErrors/FileReadErrors.tsx` | Paths wrap at phone widths; optional contextual heading. Used by Observability, FRD progress, recent progress, La Fragua and Changes. |

ProjectCard, ProjectNavItem, ProjectSwitcher and both workspace hero variants show the number of
unread work-order files when the strict published plan is incomplete. Portfolio comparison uses the
same count and underlines error links. No numeric total/ring is derived from the tolerant reader.

## Board and proposal close-out (2026-10-31)

- `IdeaPitch` reuses `DigestHero`, `ReportBand`, `Chip` and `Markdown`: structured pitches omit the
  hero title/lead; legacy cards show a solution summary paper. Type/platform chips retain icons.
- `DigestHero` omits its heading when `title` is empty, preserving existing nonempty callers.
- Proposal rows use Inter and their band hue; Vision, risk and score grids stack on phones.
- `BoardColumn` count chips use `--tint` mixed with `--surface`, matching the approved pale counts.

### Proposal review refinements (2026-10-31)

`ReportBand` accepts `level?: 2 | 3 | 4` (default 3); structured IdeaPitch bands use 2. `DigestHero`
eyebrows use line-height 1.2 across callers, matching the shared oracle. IdeaPitch's decision widgets
live in its scoped `PitchDecision.tsx`; Evidence forwards the host reader resolver. Legacy summary
papers follow the shared paper geometry and expose a localized empty state when prose is absent.
IdeaHeader scopes the oracle 40px favourite and 32px small navigation actions to the idea header;
other FavouriteButton and ButtonLink consumers retain their current sizing.

### Logros visual closure (2026-10-31)

`TrophyCard` (`src/app/achievements/_components/trophies/TrophyCard.tsx`) supports `catalogue` (horizontal rarity-line card), `near` (gold-tinted target with category) and `recent` (vertical chips tile). `SecretTile` renders a compact locked hint row. `NextRankCard` uses 64px dark discs and 56px pixel sprites; `RadarChart` uses teal geometry, radial axes and vertex markers. `GuildHero`'s public API is unchanged.

Independent review refinement (2026-10-31): catalogue cards use flexible text, inline extra-small date evidence, 42px earned / 34px locked slots and 7px rarity dots. Locked cards name their state accessibly. Secret hints use a decorative violet question mark; seal tiles place the axis before the count with gold bars. The summary badge is 19px, rank discs shrink to 52px/44px on phones, and the 230px radar uses medium labels with a 4% visual floor. Recent tiles omit project text; summary links are medium semibold.


## Architecture closure contract (2026-10-31)

- `ReportBand` reuses CardHeader's optional `count` as a CountPill alongside the category icon.
- `AdrRow` preserves the entire decision in its dialog; its inline ID chip and one-line summary
  keep the report compact. `EnvFold` supports `defaultOpen`; the first group starts open, with count and warning chips in each summary.
- `ArchitectureDigest` renders stack rows in a semantic three-column table shared by both entries.
- `ModelDiagram` opens/resets/focuses at 100%, zooms within 30–200%, and uses a readable title-only
  overview below 100%. Selecting a title returns to detail; Schema remains the complete textual
  alternative. The ELK layout and canonical data-model artifact remain unchanged.

The architecture plan uses compact state tiles with full work-order labels in accessible names
and native tooltips. FRD summaries are clamped to three lines in a four-column desktop grid;
their full content remains in the existing FRD dialog. Integration prose uses a compact bullet list.


### Independent review corrections (2026-10-31)

The environment note remains visible above the groups. Each summary exposes its CountPill and a
missing-description warning; the first group opens by default, as in the approved prototype.
Plan rows show both the FRD id and its title, followed by the existing POR FRD card grid and a
short explanation. Compact ADR titles use the medium token; keyboard focus reveals their complete
text. The stack table declares column-header scope. Duplicate authored ADR ids use composite
React keys without rewriting the source project.

The model starts at the upper-left graph origin at 100%. An entity URL instead focuses that entity
at 100%. Focus entering an entity centers its header and cancels native scroll offsets so the camera
remains the only scroll authority; pointer and keyboard navigation share this behavior. ELK allows
6 nodes per layer with an aspect ratio of 1.3 to reduce excessive width. If a 30% fit still clips
the graph, the viewer visibly asks the user to use search or Schema; titles remain at least 12px.
The existing localized model query values, including `?model=Esquema`, are unchanged; migrating
those values to English is a separate CONV-18 change.

GraphControls renders its percentage at the 12px minimum and rotates the up/down icons to match
their directional labels. Keyboard focus reveals complete ADR titles and FRD summaries; activation opens the full ADR document.

## Proposals visual closure (2026-10-31)

- `LessonFlow`: left-aligned icon/number/label tiles using the existing stage tones.
- `ProposalsSummary`: definition-list health counters, shared Chip owner badge, arrow links,
  neutral inline upkeep note and `--s3` action gaps, `--s4` health-column gaps and `--s6` section gaps.
- `PromotionsQueue` / `LessonRow`: outlined type chips; divided recent rows compose
  the selection button, Nueva Chip and CommandCompact as sibling controls.
- `ProposalStream`: native candidates disclosure with BadgeIcon and rotating chevron.

Independent review restored `band-sub` for recent discoveries, the global `grow` and
`clamp-2` lesson-title hooks, and responsive two-column health facts. Summary title
and subtitle form one wrapping header group; candidates use the card-title type scale
and keep their hint adjacent to the chevron.

## Shell and portfolio close-out (2026-10-31)

- `ProjectNavItem` carries the current project through nested workspace routes and reuses the raised navigation surface.
- `TopBar` accepts a streamed location slot; `ShellLocation` derives project identity and tab from canonical navigation and the sidebar project resolver. Project name is the primary line, tab the small uppercase line.
- `Segmented` options accept optional decorative catalogue icons, without changing button labels or pressed state.
- `Ring` explicitly disables box shadow so the Tailwind utility sharing its global class cannot add an outline.
- `AccountsTable` keeps the directory summary compact on phones; identity and organization details stay in the existing account dialog.
- Inicio card icons and guild rank typography, and Configuration tab icons, command typography and rules-tile hue follow the approved prototype.

### Independent review follow-up (2026-10-31)

- `Avatar`, sidebar and phone location reuse `projectDisplayName`, including full real names with descriptive subtitles.
- `ProjectSwitcher` supplies `data-compact` through Button: intrinsic Summary width, full phone width only for compact tabs.
- `Table` positions its scroll wrapper relatively so clipped accessible headers do not increase page width.
- `Segmented` keeps neutral selected buttons with blue active icons. Hero Rings use a 60 px phone size; the portfolio toolbar has a 44 px separation from its cards.

### Workspace close-out (2026-10-31, lane H)

FrdCard uses a violet identity chip, right-aligned kind tag, de-prefixed title and done/total alongside the live stack. Spec arranges these in four/two/one columns at desktop/tablet/phone widths. Stack consumers use WORK_ORDER_STACK_STATES (done, review, in_progress, blocked, todo; reader fail maps to blocked), independently from board/filter order. DigestHero supports an omitted eyebrow for workspace Spec. ProjectHero hides visual step labels on phones while PhaseStepper preserves its accessible full names. Summary places its right-aligned command above FraguaScene, whose eyebrow is uppercase, and its collapsed engine log keeps the hint in the header.

### Lane H independent-review corrections (2026-10-31)

FrdCard IDs use the mono fcode treatment (violet tint, r-xs, 4px vertical / 7px horizontal padding) rather than a rounded Chip. The engine-log heading uses h2, the shared slate BadgeIcon and the shared hide-sm utility. PhaseStepper exposes hideLabelsOnMobile for ProjectHero instead of styling a test identifier. Empty FRD progress rows retain an accessible empty stack track. Workspace Spec uses s6 between its notice and bands, with layers notice icon and flag/search document actions. The green seeAll footer class is isolated from DecisionsCard links.

### Integration corrections (2026-10-31)

- `Tabs`: circular spacing-8 overflow buttons, pill radius, strong hairline border and small shadow, retaining directional edge gradients.
- `FrdCard`: inline Markdown summaries with inherited small code text.
- `FileReadErrors`: reused by both report digests for structured work-order errors; diagnostic source strings remain available to nonvisual consumers.
- `GuildHero` / dashboard `Progreso`: proportional figures in prose; numeric elements opt into tabular figures individually.

### Integrated gate repairs (2026-10-31)

Tabs share the 32px control width with the focus-reveal geometry, plus a 2px rounding clearance.
IdeaHeader uses spacing-1 action gaps on phones, retaining the approved 32px links. ProposalStream
allows its candidates summary to wrap. RadarChart marks its bounded SVG coordinate surface for
the responsive helper: painted labels fit, although end-anchored text metrics report overflow.

### Tablet project collection (2026-10-31, lane M)

Cartera and PortfolioOverview share the `proj-cards` collection hook: two columns
at 760–1179px with an odd final ProjectCard spanning the complete row in either
theme. ProjectCard itself and its public props remain unchanged.

ArchitectureDigest reuses ReportBand’s stack table: below 1024px each row stacks
its three cells, with visually clipped (accessible) column headers. Desktop keeps
the three-column table; both idea and project entry points share this rule.

Table columns accept optional `mobileSpan: main | end | full`. Below 1024px, rows
using these spans become three-column fact cards; ordinary tables retain their
existing layout. Portfolio comparison uses this option, with the work-order count
above its full-width bar.

Architecture stack layer labels use `--text-2`. The environment completeness Chip
uses `outline` to meet AA on its tinted report band in both themes.

GuildHero moves counts below the identity below 900px, left-aligned. SummaryTab
recent trophy tiles use an auto-fill 180px minimum (spacing-token calculation),
fitting three columns at 768px and one on phones.

### Item-35 closure, lane N (2026-10-31)

- `MissionCard` at `src/app/achievements/_components/missions/MissionCard.tsx` retains one chain layout, connected tier nodes and gold bars. Only `spot` exposes the large percentage and blue highlighted header. Untouched phone chains hide nodes/track, retaining their accumulated footer.
- `RankLadder` at `src/app/achievements/RankLadder/RankLadder.tsx` uses flat era dividers, dark medal discs, neutral grade badges and green/gold state chips; only locked sprites are desaturated.
- `ColumnChart` / `LineChart` in `src/app/achievements/_components/charts/` show visible week/value labels, teal columns and violet area/point geometry, preserving the full accessible series alternative.
- `PortfolioOverview` scopes comparison table/card styles locally; no additional Table variant is introduced. Decision/ADR details reuse Modal, Notice and ButtonLink, with amber ADR document treatment.

### Independent review follow-up, lane N (2026-10-31)

FunnelRow's optional report variant reuses the shared metric source in a count-caption bar layout; it leaves Inicio's phase rows unchanged. RecordTile places its metric-level chip alongside the label. Statistics omits the summary-only radar narrative. ColumnChart and LineChart shorten visible ISO weeks while keeping full accessible series descriptions. AdrDocument removes only its leading Markdown title so the modal does not repeat it.


### Manual, Configuration and workspace reading close-out (2026-10-31, lane O)

- SkillsCatalog reuses Card/CardHeader, BadgeIcon and CopyButton; internal engines have no copy action. AgentsCatalog uses compact tier-colored cards with explicit effort only. RulesCatalog keeps defaults inside the existing accordion; StandardsCatalog keeps filters outside the compact metadata card.
- DocsHome adds the approved category icon tiles and arrow footer. DocIndex supports optional item icon/tone and group defaultOpen, retaining open-by-default compatibility for Manual and conditional groups for project documents.
- Paper accepts optional copyValue and icon; existing callers without copyValue still copy the path. Project documents copy their original source and render parsed body text. documentPresentation owns their shared hue/icon and translated category label.
- WoViews reuses Segmented option icons; its wrapping toolbar is independent from the right-aligned expand-all action.

DocH uses plain token-based heading typography without the legacy accent bar. PipelineDiagram
keeps its existing content and stacks each phase vertically on phones to preserve command width.


### Lane O independent review corrections (2026-10-31)

- CopyButton adds a text variant with shared clipboard feedback; skill rows use it without important overrides.
- DocIndex no longer owns type filters; project filters remain outside it. Toggle icons are configurable (book for Manual, file for project documents), and every item/summary has a spacing-10 target floor.
- Paper retains path copying when content is unavailable. Document metadata failures use the same Paper and index with an alert plus raw code, rather than replacing the route.
- RulesCatalog resets reveal state without remounting its search. Standard chips use a spaced wrapper, and Manual uses a compact group breadcrumb on phones.

### Markdown security contract (2026-10-31)

The existing `Markdown` image override sets `referrerPolicy="no-referrer"` for every embed. Its
visual tokens and layout are unchanged; no new component or image-fetch service is introduced.
