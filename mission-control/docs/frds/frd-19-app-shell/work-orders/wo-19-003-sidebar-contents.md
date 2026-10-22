---
id: WO-19-003
type: work-order
slug: sidebar-contents
title: 'WO-19-003 — Sidebar contents: projects, counts, collapse rail, theme button, guild card, pills, achievement notice'
status: ACTIVE
parent: FRD-19
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: high
reopen_count: 0
artifacts:
  - "src/components/modules/AppShell/{Sidebar,SidebarProjects,PluginPill,PendingPill,ThemeToggle,AppShell}.tsx"
  - "src/components/modules/AppShell/useSidebarPreference.ts"
  - "src/components/modules/AppShell/_tests/{sidebar,pills,theme-toggle,collapse}*.test.tsx"
  - "src/components/modules/Nav/{Nav,NavItem,ProjectNavItem}.tsx"
  - "src/components/modules/Nav/_tests/{nav-counts,project-nav-item}*.test.tsx"
  - "src/components/modules/{GuildBar,AchievementToast}/**"
  - "src/components/core/ThemeToggle/**"
  - "src/app/layout.tsx"
  - "src/app/_tests/layout.sidebar*.test.tsx"
  - "e2e/shell-sidebar.spec.ts"
source_requirements: [REQ-19-005, REQ-09-008, REQ-15-006, REQ-21-001, AC-19-005.1, AC-19-005.2, AC-19-005.3, AC-19-005.5, AC-09-008.1, AC-09-008.2, AC-15-006.1, AC-21-008.1, AC-21-008.2]
dependsOn: [WO-19-002, WO-18-002, WO-17-008, WO-21-003, WO-04-013, WO-03-007]
last_updated: 2026-10-22
---

# WO-19-003 — Sidebar contents: projects, counts, collapse rail, theme button, guild card, pills, achievement notice

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`../blueprint.md`](../blueprint.md) (CMP-19-projects, CMP-19-nav-counts, CMP-19-collapse,
> CMP-19-theme-toggle; hosted components CMP-09-guild-card, CMP-09-achievement-notice of
> [FRD-09](../../frd-09-gamification/blueprint.md), CMP-15-pill of
> [FRD-15](../../frd-15-plugin-out-of-sync-warning/blueprint.md), and FRD-21's pending pill).

## Summary

Fills the shell of WO-19-002 with everything the sidebar carries in the approved prototype: the
Proyectos group (five projects by last commit, folding remembered), the per-destination counts and
the rail dot, the «Colapsar» 64 px rail that floats open on pointer or focus and «Fijar abierta», the
sun/moon theme button in the footer and the phone drawer, the guild card (crest on the rails), the
coral «Plugin desactualizado» pill, the «⎇ N pendientes» pill with its alert variants, and the gold
achievement notice raised once per browser. It folds FRD-09's card and notice, FRD-15's pill and
FRD-21's pill here (each would be under 20 minutes alone, DR-100).

## In Scope

All data is read on the server in the root layout through the existing request-cached resolvers
(DR-115: one resolver per fact; nothing is re-derived here) and passed to the sidebar slots of
WO-19-002. Browser-local preferences use the prototype's keys and are not factory writes.

1. **Proyectos group (CMP-19-projects, `SidebarProjects` + `ProjectNavItem`):** up to five projects
   ordered by last commit (descending) from WO-03-007's `getProjectOverview()` (`src/lib/portfolio/`, the
   one project-card list resolver, DR-115); each row `a.navitem` to the project's
   workspace with the initials avatar (`Avatar`, phase hue from the shared vocabulary), the name and
   «<Fase> · <pct>%» (the phase and verified-work-order percentage values `getProjectOverview()` exposes,
   the same the `ProjectCard` shows; nothing re-derived here), the
   full accessible name from `shell.projects.itemAriaWithOrders` / `itemAriaNoOrders`; the catalogue's
   «Ver los N» link to `/portfolio` when there are more (no captured state has six or more projects:
   reported as a DR-130 gap); the header is
   `button[data-action="toggle-projects"]` with `aria-expanded`, `aria-controls="projlist"`, the title
   `shell.projects.toggleTitle` and the project count; folding is remembered under
   `orbita-projects-open` (folded: the header becomes the pill with a right chevron and `#projlist` is
   hidden). On the rails only the avatars show; on the collapsed rail a hairline replaces the header.
2. **Counts (CMP-19-nav-counts, `Nav` + `NavItem`):** Inicio = `ownerTurnItems().count` (`src/lib/inicio/`,
   WO-18-002; decisions resolved in their own file excluded, WO-04-013), alert variant (amber) with the
   description `shell.navCount.decisions`; Tablero = active (non-discarded) ideas from the ideas reader
   the board uses; Propuestas = `ownerActions().badgeCount` (`src/lib/proposals/`, WO-17-008; it replaces
   the v1 `ProposalsBadge`) with the description
   `shell.navCount.proposals`, absent at zero (no manufactured urgency). The visible number is
   `aria-hidden` and the description is attached with `aria-describedby`, so every destination link's
   accessible name stays exactly its label (Shell-Presence contract). `.raildot` on Inicio while it has
   items, shown only on the rails.
3. **Collapse (CMP-19-collapse, `useSidebarPreference` + `AppShell`):** from 1180 px, the footer's
   `button.side-toggle[data-action="toggle-sidebar"]` with `aria-pressed`, label «Colapsar» / «Fijar
   abierta» and accessible name from `shell.sidebar.collapse` / `shell.sidebar.pin`, icon `panelClose` /
   `panelOpen`; `.app[data-sidebar]` switches `expanded` ↔ `collapsed` (64 px rail); the choice is stored
   under `orbita-sidebar` and painted before hydration from the `<html data-sidebar-pref>` attribute the
   WO-13-010 boot script sets. While collapsed, pointer entry or keyboard focus inside the rail sets
   `#sidebar[data-float="true"]`: the full sidebar floats over the page with `--shadow-panel` by
   transform only (no animated width, REQ-13-005), the content does not move, focus is not trapped,
   leaving clears it. Below 1180 px there is no collapse control (the tablet rail and the phone drawer).
4. **Theme button (CMP-19-theme-toggle, `AppShell/ThemeToggle.tsx`):** `button.theme-btn[data-action="toggle-theme"]`
   next to the collapse control in the footer, icon-only in the sidebar and rails and a labelled row in
   the phone drawer (the same control): sun while dark, moon while light; accessible name and title
   `shell.theme.toLight` / `toDark`, row label `shell.theme.labelLight` / `labelDark`. It reads the
   current theme from `<html data-theme>` with a server snapshot during hydration (no mismatch) and
   switches through IF-13-theme (`applyTheme` + `persistTheme`, key `orbita-theme`). Only light and dark
   exist. The v1 `src/components/core/ThemeToggle/` (with its high-contrast option) is deleted (map §6.C
   item 23, owner default O1); its tests go with it.
5. **Guild card (CMP-09-guild-card, `GuildBar/GuildCard.tsx`):** `a.guildcard` to `/achievements` with
   the crest (`.crest`, the guild level), the rank name, the progress line `shell.guild.progress` (XP inside
   the current level over the level's span, from IF-09-guild-state's level and the engine's
   `xpForLevel`), a gold `ProgressBar` at `pctToNext`, accessible name `shell.guild.aria`. Honest zero
   state with no outcomes (never a fake fill, FRD-09). On the 64 px and 76 px rails only the crest (plus
   the short gold bar on tablet). Data from `getGuildState()` (ledger-merged, WO-09-006). The v1 top-bar
   `GuildBar.tsx` stays unmounted on disk until WO-13-013 deletes it.
6. **Plugin pill (CMP-15-pill, `PluginPill`):** only while `getPluginSyncState()` reports `drift`
   (either runtime behind, IF-15-sync): `a.plugin-pill[data-tone="coral"]` to `/` (the banner is
   Inicio's first element, WO-18-002), `alert` icon, «Plugin desactualizado» (`shell.plugin.outdated`),
   title `shell.plugin.title` with the behind runtime's installed and source versions. Nothing renders
   for `in-sync` or `unknown`.
7. **Pending pill (`PendingPill`, the component FRD-21's blueprint traces REQ-21-001 / AC-21-008.1 /
   AC-21-008.2 to):** from `pendingPillSummary()` (`src/lib/pendingMerge/`, WO-21-003; shape `{ count,
   urgent, unreadable, hidden }`): `a.plugin-pill.pending-pill` to `/#` + `WORKTREES_CARD_ID` (the
   `worktrees-card` anchor exported by the same module and carried by Inicio's «Árboles de trabajo» card,
   WO-21-003); label `shell.pending.label` (plural, the uncapped count as drawn) or
   `shell.pending.labelNone` when the count is 0 but a repository is unreadable, suffixed
   `shell.pending.labelUrgent` / `labelUnread` in the alert variant (`labelUnread` wins when both apply, as
   captured in `worktrees-unreadable`); alert variant = coral tone + `alert` icon (state by icon and text), calm = slate + `branch`
   icon; title from `shell.pending.titleBranches` + `titleUnread` + `titleSuffix`, repeated in an
   `.sr-only` span; hidden when nothing is pending and every repository was read. Icon-only on rails.
8. **Achievement notice (CMP-09-achievement-notice, `AchievementToast`):** mounted once in the root
   layout. The newest trophy for which `lastAchievement().fresh` (`src/lib/inicio/`, WO-18-002: flagged
   new or unlocked within 7 days of `now()`, clock from WO-01-010) holds, the one predicate shared with
   Inicio's «Nuevo» chip, and whose id is not in the
   browser-local `orbita-ach-seen` list raises `div.ach-toast[role="status"]` (polite, takes no focus):
   gold card bottom right (above the bottom navigation on phones), trophy tile, the catalogue's notice
   eyebrow (AC-09-008.2; the real-unlock wording is captured in this FRD's `shell-achievement-notice` state),
   the trophy's title and description as data, «Ver» to `/achievements/trophies` and the close
   `IconButton` named «Cerrar aviso» (`logros.notice.closeAria`, drawn in FRD-09's notice state).
   «Ver», the close button and the 9-second timer all close it and record the id; reloading never raises
   the same trophy again. The prototype's `?achievement=preview` review affordance is not built (its
   label is not in the catalogue and no AC asks for it); the real-unlock notice is reproduced as this FRD's
   `shell-achievement-notice` from its `oracle-recipes.json` double (a fixture trophy unlocked within 7 days
   of the frozen clock); FRD-09's `guild-achievement-notice` (preview mode) keeps the recipe's fallback with
   the eyebrow line masked in L3.

Removals in this WO (map §6.C items 2 and 23): the theme control's high-contrast option (the whole v1
`core/ThemeToggle` module, superseded by the shell's `ThemeToggle`); the v1 top-bar guild block is
replaced by the guild card (its file is deleted by WO-13-013).

## Out of Scope

- The shell frame, nav links, active rule, drawer, top bar, bottom navigation, skip link (WO-19-002).
- The Inicio plugin banner and the «Árboles de trabajo» card (WO-18-002, WO-21-003), the resolvers it
  reads (WO-18-002, WO-17-008, WO-21-003, WO-03-007, WO-09-006, FRD-15, FRD-10 readers): read only here.
- Any celebration other than the notice (out of v2, FRD-09).

## Requirements & Acceptance Criteria

REQ-19-005 (sidebar projects, counts, rail, theme), FRD-09 REQ-09-008 (guild card, notice), FRD-15
REQ-15-006 (sidebar pill), FRD-21 REQ-21-001 / AC-21-008 (pending pill). AC-19-005.4 is WO-19-002's.

- **AC-19-005.1** — THE sidebar SHALL list up to five projects by last commit in its Proyectos group, each row with a phase-hued avatar, "Fase · pct%" and a full `aria-label`, followed by "Ver los N" when there are more, and SHALL remember in this browser whether the group is folded.
- **AC-19-005.2** — THE navigation SHALL show, per destination, the count of what needs attention (Inicio: the owner's items, Tablero: ideas, Propuestas: owner actions), and on the collapsed rail a dot WHEN Inicio has items.
- **AC-19-005.3** — WHEN the owner collapses the sidebar ("Colapsar", accessible name "Colapsar la barra lateral"), THE shell SHALL show a 64 px icon rail, SHALL remember the choice in this browser, and WHILE collapsed SHALL float the rail open over the page on pointer or focus without moving the content; "Fijar abierta" (accessible name "Fijar abierta la barra lateral") SHALL pin it open again.
- **AC-19-005.5** — THE shell SHALL offer a theme button (sun/moon) in the sidebar footer next to "Colapsar" and, on phones, inside the drawer; WHEN the owner has not chosen a theme, THE shell SHALL start from the system preference (`prefers-color-scheme`); WHEN the owner activates the button, THE shell SHALL switch between the light and dark themes, SHALL remember the choice in this browser (it wins over the system preference on later visits), and SHALL keep the button's accessible name stating the theme it switches to ("Tema claro" while dark, "Tema oscuro" while light).
- **AC-09-008.1** — THE shell SHALL show, in the sidebar, a guild card with the crest carrying the guild level, the rank name, "N / M XP al nivel L", a gold progress bar and a link to Logros; on the collapsed rail (desktop 64 px, tablet 76 px) THE card SHALL be reduced to the crest.
- **AC-09-008.2** — WHEN a trophy is flagged new or was unlocked within the last 7 days, THE system SHALL raise the gold achievement notice ("¡Nuevo logro!") once per browser, with the actions "Ver" and "Cerrar aviso", and SHALL close it automatically after 9 seconds. (drawn in FRD-09's guild-achievement-notice)
- **AC-15-006.1** — WHILE the installed plugin is behind the source (AC-15-002.1), THE sidebar SHALL show a coral "Plugin desactualizado" pill whose title names both versions ("Instalado 9.140.0 · repositorio 9.141.0") and which links to the banner on Inicio.
- **AC-21-008.1** — WHILE at least one branch has work outside `main`, or a repository could not be read, THE sidebar SHALL show the pill "⎇ N pendientes" (N = branches with work outside `main`, across every repository), whose title reads "N ramas sin integrar en main. Abre «Árboles de trabajo» en Inicio.", and WHEN it is activated THE system SHALL open Inicio's "Árboles de trabajo" card; WHILE nothing is pending and every repository was read, THE pill SHALL be hidden.
- **AC-21-008.2** — WHEN a repository is in the state "Depurar ya" or could not be read, THE pill SHALL show an alert icon and the text "· depurar ya" or "· sin leer" after the count. (drawn in FRD-21's worktrees-unreadable)

**Fidelity criterion.** The built sidebar matches `mocks/app-shell.html` `shell-expanded`,
`shell-rail-collapsed`, `shell-rail-float`, `shell-projects-folded` and `shell-pending-chip`, FRD-21's
`pending-merge.html#shell-pending-chip-open` and FRD-09's `gamification.html#guild-achievement-notice`
(and the guild card in `#guild-rank-ladder`) in layout, structure, components and density on the frozen
tokens, with the recorded hooks (`[data-action="toggle-sidebar"]`, `[data-action="toggle-projects"]`,
`#projlist`, `#sidebar[data-float]`, `.guildcard`, `.plugin-pill`, `.pending-pill`, `.theme-btn`,
`.ach-toast`, `.raildot`); verified by the preview smoke and shell gates here and the fidelity diff at
close-out (`shell-rail-float` sets `data-float` by script, F6).

**Completeness (DR-100).** Error / empty paths: a reader error never blanks the sidebar (each slot
degrades alone: no count, no pill, no projects rows, never a fabricated zero; a pending-merge read
error is the pill's «sin leer» variant by contract); zero projects show the header with count 0 and no
rows; storage unavailable keeps preferences for the view. Keyboard: every control is a native button or
link; the floating rail opens on focus; the notice's buttons are reachable and it never steals focus.
Accessibility: link names exactly the labels, descriptions for counts, `aria-pressed` /
`aria-expanded` states, AA contrast in both themes. Reduced motion: no float or notice animation.
Performance: the layout reads go through request-cached resolvers (no extra git or file pass per slot);
no layout shift on hydration (collapsed state painted from the boot attribute).

## Reuse (components.md)

Create or restyle the inventoried rows: `SidebarProjects` host, `ProjectNavItem` (new), `GuildCard`
(restyle of `GuildBar`), `PluginPill` (new), `PendingPill` (restyle of `PendingMergeBadge`, whose v1
module WO-19-002 removed), `ThemeToggle` (restyle, moved to `AppShell/` as components.md places it),
`AchievementToast` (restyle; a module of its own, distinct from the `Toast` primitive). Reuse:
`NavItem`, `Sidebar`, `AppShell` (WO-19-002); `Avatar`, `ProgressBar`, `Chip`, `Button`, `IconButton`,
`BadgeIcon` (WO-13-011); `Icon`, `t()`, IF-13-theme (WO-13-010).

## Installs

None.

## Visual reference

- **Mock screens:** `docs/frds/frd-19-app-shell/mocks/app-shell.html#shell-expanded`,
  `#shell-rail-collapsed`, `#shell-rail-float`, `#shell-projects-folded`, `#shell-pending-chip`;
  `docs/frds/frd-21-pending-merge/mocks/pending-merge.html#shell-pending-chip-open`;
  `docs/frds/frd-09-gamification/mocks/gamification.html#guild-achievement-notice` and `#guild-rank-ladder`
  (guild card). Oracle states: the same ids (`guild-achievement-notice` via its fallback double), plus the
  scenario states `shell-theme-toggled` (light theme chosen: «Tema claro» / «Cambiar a tema claro» on the
  button) and `shell-achievement-notice` (real-unlock notice «¡Nuevo logro!»), each reproduced from its
  `docs/design/prototype/reference/oracle-recipes.json` double in `e2e/shell-sidebar.spec.ts` and at the
  close-out Visual QA.
- **Token slice:** `--rail-c` 64, `--rail` 76, `--sidebar` 252, `--shadow-panel` (float), `--gold` and its
  tint (guild card, notice), `--coral` (plugin and alert pending pill), `--slate` (calm pending pill),
  `--amber` (Inicio count and rail dot), the phase hues (project avatars), `--surface-3` (folded pill),
  `--shadow-toast`, `--r-pill`, `--fs-xs` / `--fs-sm`, `--dur`, `--ease`. Portable CSS:
  `docs/design/prototype/reference/css/48-sidebar-rail.css`, `35-late-additions.css`,
  `56-freeze-additions.css`, `45-logros-hall.css` (`.ach-toast`).
- **FDD pointers:** `docs/frds/frd-19-app-shell/fdd.md`, `docs/frds/frd-09-gamification/fdd.md`,
  `docs/frds/frd-15-plugin-out-of-sync-warning/fdd.md`, FRD-21's `fdd.md`.
- **Assets:** the icons `alert`, `branch`, `panelClose`, `panelOpen`, `sun`, `moon`, `trophy`, `x`,
  `list`, `chevD`, `chevR` (the guild crest shows the level as text; no image).

## Tests (owned)

- `AppShell/_tests/sidebar.test.tsx`: five rows by last commit, «Ver los N» only above five, row names,
  fold toggle remembered (`orbita-projects-open`), zero-project state.
- `Nav/_tests/nav-counts.test.tsx`: counts from injected resolver values, Propuestas absent at zero,
  each link's accessible name exactly its label with the count as description, rail dot rule.
- `Nav/_tests/project-nav-item.test.tsx`: phase hue, «<Fase> · <pct>%», the no-orders variant.
- `AppShell/_tests/collapse.test.tsx`: `aria-pressed`, labels and names switch, preference stored, float
  attribute on pointer and focus, cleared on leave; no control below 1180 px.
- `AppShell/_tests/theme-toggle.test.tsx`: system default (dark when the system is not light), switch,
  persistence wins over the system, accessible name names the target theme, no high-contrast state.
- `AppShell/_tests/pills.test.tsx`: plugin pill only for `drift` with both versions in the title; pending
  pill calm / urgent / unread / hidden states and its link to `#worktrees-card`.
- `GuildBar/_tests/GuildCard.test.tsx`: level, rank, «N / M XP al nivel L» numbers from the engine,
  honest zero, crest-only on rails, link to Logros.
- `AchievementToast/_tests/AchievementToast.test.tsx` (fake timers + fixed `now()`): the worked
  example of AC-09-008.2 (2 days → raised once, closes after 9 s, not raised after reload; 9 days → none),
  «Ver» and «Cerrar aviso» record the id, polite status, no focus move.
- `src/app/_tests/layout.sidebar.test.tsx`: the layout passes each slot its resolver data and mounts the
  notice once.
- `e2e/shell-sidebar.spec.ts` (the behaviour spec): at 1440 «Colapsar» gives a 64 px rail without moving
  the page content, survives reload, pointer hover floats it, «Fijar abierta» restores; folding Proyectos
  survives reload; the theme button switches and the choice survives reload against the opposite system
  preference; the pending pill opens Inicio at «Árboles de trabajo». Light and dark; `gotoHydrated`.

### Derogated tests (map §3.3, BL-0051)

- Implementer-authored: the v1 `src/components/core/ThemeToggle/_tests/*` are deleted with the module
  (high-contrast removed); WO-19-002's `Nav` / `AppShell` tests are extended, not weakened.
- Reviewer-authored, not edited: `src/lib/gamification/_tests/gamification.integration.reviewer.test.tsx`
  keeps compiling (the top-bar `GuildBar` file stays until WO-13-013).
- Visual baselines: never touched (close-out re-bless).

## Definition of done

- Owned tests green; the Shell-Presence gate still matches every destination name exactly; smoke green;
  `.pandacorp/verify.sh` green.
- FRD-19's gate can run: every FRD-19 AC is now owned by a built WO.
- Status Note records the browser-local keys and the resolvers each slot reads.

## Dependencies

WO-19-002 (shell, slots, `NavItem`), WO-18-002 (`ownerTurnItems()`, Inicio card ids and the banner),
WO-17-008 (`ownerActions()`), WO-21-003 (`pendingPillSummary()`), WO-04-013 (resolved-in-file
decisions excluded from the Inicio count), WO-03-007 (`getProjectOverview()`: order, phase, percentage).
Reads, through those and the kept readers, WO-09-006's guild state, FRD-15's `getPluginSyncState()` and FRD-10's achievements
reader; WO-13-010's theme util and boot seam. Cites LESSON-0310 (float and hover only on hover-capable
pointers; focus opens it too), LESSON-0077 (counts read through one resolver each).

## Status Note
