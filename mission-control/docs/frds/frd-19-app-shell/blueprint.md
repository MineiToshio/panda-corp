---
id: BP-19
type: blueprint
slug: app-shell
title: 'Blueprint — FRD-19 Global app shell (v2 «Órbita» sidebar)'
status: DRAFT
parent: FRD-19
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: 2026-10-22
---

# Blueprint — FRD-19 Global app shell (v2 «Órbita» sidebar)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049) for [FRD-19](./frd.md) / [FDD-19](./fdd.md). The platform
> ([`docs/product/architecture.md`](../../product/architecture.md) §7 «Shell and layout», Route map) is
> referenced, not restated. The nav contract is `docs/design/components.md` § AppShell nav contract
> (DR-075); the visual system, copy accessor, icons and primitives are FRD-13's
> ([blueprint](../frd-13-visual-system-accessibility/blueprint.md)).

## Purpose

The persistent Órbita shell that frames every route: a 252 px sidebar (collapsible to a 64 px rail) on
desktop, a 76 px icon rail on tablets, a sticky top bar, bottom navigation and off-canvas drawer on
phones, the skip link, the 1180 px content frame and the seven destinations with exactly one active. It
also hosts the sidebar's global content: the Proyectos group, the counts, the theme button, and the
components FRD-09, FRD-15 and FRD-21 place in it (guild card and achievement notice, plugin pill,
pending pill). It replaces the v1 top navigation and its route exemptions; it owns the Shell-Presence
contract (`e2e/shell.ts`) and the gated route list (`e2e/routes.ts`).

## Components & Interfaces

| ID | Kind | Name / location | Responsibility | Traces | WO |
|---|---|---|---|---|---|
| CMP-19-app-shell | client component | `AppShell` (`src/components/modules/AppShell/AppShell.tsx`) | Frame `.app#app` with `aside#sidebar`, scrim, `main#content.page`, phone bars; grid per breakpoint; drawer state; collapse state (from WO-19-003) | REQ-19-001, REQ-19-003, REQ-19-004, REQ-19-005 | WO-19-002, WO-19-003 |
| CMP-19-sidebar | component | `Sidebar` (`AppShell/Sidebar.tsx`) | Brand link and the ordered slots: pills, nav, projects, guild, footer | REQ-19-001 (AC-19-001.3) | WO-19-002, WO-19-003 |
| CMP-19-nav | client component | `Nav` + `NavItem` (`src/components/modules/Nav/`) | Seven `next/link` destinations, icon, tone, label and mini label, `aria-current`; counts and rail dot from WO-19-003 | REQ-19-001, REQ-19-002, REQ-19-005 | WO-19-002, WO-19-003 |
| IF-19-nav-active | pure function | `Nav/navActive.ts` | pathname → active destination or none (exact `/`; whole-segment families; workspace → Portafolio; idea → Tablero) | REQ-19-002 | WO-19-002 |
| IF-19-nav-destinations | constants | `NAV_DESTINATIONS` in `src/lib/constants.ts` | id, path, label key, mini key, icon, tone of the seven destinations (single source for the app) | REQ-19-001 | WO-19-002 |
| CMP-19-topbar | component | `TopBar` (`AppShell/TopBar.tsx`) | Phone sticky bar: `button#menu`, logo, `#where` | REQ-19-003 | WO-19-002 |
| CMP-19-bottom-nav | component | `BottomNav` (`AppShell/BottomNav.tsx`) | Phone bottom navigation: Inicio, Tablero, Portafolio, Docs, «Más» | REQ-19-003 | WO-19-002 |
| CMP-19-drawer | behaviour | inside `AppShell` | Off-canvas sidebar below 760 px: open by `#menu` / «Más», inert when closed, closes on Escape (focus return), outside press, link activation, route change | REQ-19-003 | WO-19-002 |
| CMP-19-skip-link | component | `SkipLink` (`AppShell/SkipLink.tsx`) | First focusable element; real in-page anchor to `main#content` | REQ-19-001 (AC-19-001.5), FRD-13 REQ-13-009 | WO-19-002 |
| IF-19-shell-contract | test seed | `e2e/shell.ts`, `e2e/routes.ts` | Landmark `aside#sidebar`, seven destinations, `SHELL_EXEMPT = []`, `NAV_TOGGLE = "#menu"`; every v2 surface listed | REQ-19-004 | WO-19-002 |
| CMP-19-projects | component | `SidebarProjects` + `ProjectNavItem` | Five projects by last commit, phase-hued avatar, «Fase · pct%», «Ver los N», fold remembered | REQ-19-005 (AC-19-005.1) | WO-19-003 |
| CMP-19-nav-counts | behaviour | `Nav` / `NavItem` | Inicio, Tablero, Propuestas counts as descriptions (names stay exact); rail dot | REQ-19-005 (AC-19-005.2) | WO-19-003 |
| CMP-19-collapse | hook + control | `useSidebarPreference`, footer `side-toggle` | 64 px rail, remembered, float on pointer / focus without moving content, «Fijar abierta» | REQ-19-005 (AC-19-005.3) | WO-19-003 |
| CMP-19-theme-toggle | client component | `ThemeToggle` (`AppShell/ThemeToggle.tsx`) | Sun / moon button in the footer and the drawer; system default; remembered; name states the target theme; uses FRD-13's IF-13-theme | REQ-19-005 (AC-19-005.5), FRD-13 REQ-13-001 | WO-19-003 |
| (hosted) | components | CMP-09-guild-card, CMP-09-achievement-notice ([FRD-09](../frd-09-gamification/blueprint.md)); CMP-15-pill ([FRD-15](../frd-15-plugin-out-of-sync-warning/blueprint.md)); FRD-21's pending pill (`PendingPill`) | Built by WO-19-003 into the shell's slots and the root layout | FRD-09 REQ-09-008, FRD-15 REQ-15-006, FRD-21 REQ-21-001 | WO-19-003 |

### Traceability (REQ / AC → component → work order)

| REQ | ACs | Components | WO |
|---|---|---|---|
| REQ-19-001 | AC-19-001.1..5 | CMP-19-app-shell, CMP-19-sidebar, CMP-19-nav, IF-19-nav-destinations, CMP-19-skip-link | WO-19-002 |
| REQ-19-002 | AC-19-002.1, AC-19-002.2 | CMP-19-nav, IF-19-nav-active | WO-19-002 |
| REQ-19-003 | AC-19-003.1..5 | CMP-19-app-shell, CMP-19-topbar, CMP-19-bottom-nav, CMP-19-drawer | WO-19-002 (the collapse control of AC-19-003.1 is AC-19-005.3's, WO-19-003) |
| REQ-19-004 | AC-19-004.1, AC-19-004.2 | CMP-19-app-shell, IF-19-shell-contract | WO-19-002 |
| REQ-19-005 | AC-19-005.4 | CMP-19-app-shell (responsive pattern) | WO-19-002 |
| REQ-19-005 | AC-19-005.1, .2, .3, .5 | CMP-19-projects, CMP-19-nav-counts, CMP-19-collapse, CMP-19-theme-toggle | WO-19-003 |
| (cross-FRD) | AC-09-008.1, AC-09-008.2, AC-15-006.1, AC-21-008.1, AC-21-008.2 | hosted components | WO-19-003 |

## Contracts

**Shell structure.** One `AppShell` mounted by the root layout inside the onboarding guard (the
onboarding gate is the whole view when the profile is absent). Markup keeps the prototype's recorded
hooks: `a.skip`, `.app#app[data-sidebar]` (`data-testid="app-shell"`), `aside#sidebar[data-open][data-float]`
named «Navegación principal», `.scrim#scrim`, `.topbar` with `button#menu` and `#where`, `main#content.page`
(`tabIndex=-1`), `nav#bottomnav`. The shell adds exactly one `<main>`; v2 surfaces render none (a v1 page's
own `<main>` is a transient inner landmark until its surface WO rebuilds it).

**Slots (WO-19-002 → WO-19-003).** `Sidebar` accepts optional nodes in a fixed order: `pills`, then the
nav, `projects`, `guild`, `footer`. `Nav` / `NavItem` accept optional per-destination counts. Empty slots
render nothing. The layout (a Server Component) reads each slot's data through the existing
request-cached resolvers and passes it down; client components only hold browser-local state.

**Active destination (IF-19-nav-active).** Input: pathname. Output: one destination id or none. Rules:
`/` exact → Inicio; whole-segment families `/board` → Tablero; `/portfolio`, `/projects` → Portafolio;
`/proposals`, `/achievements`, `/manual`, `/configuration` → their destination; anything else → none.
Invariant: at most one destination is current; the result is identical on server and client.

**Accessible names.** Each destination link's name is exactly its label at every width (the hidden one of
`.lbl` / `.mini` is not rendered); counts are descriptions (`aria-describedby`) with the catalogue's
sentences, never part of the name. All strings come from `t()` (`shell.*`).

**Drawer.** Phone only. State `open`; openers `#menu` (`aria-expanded`) and «Más»; while closed
`aside#sidebar` is `inert`; on close focus returns to the opener that opened it; route change closes it.

**Browser-local preferences** (not factory writes): `orbita-theme` (FRD-13 IF-13-theme), `orbita-sidebar`
(collapsed / expanded, painted before hydration through `<html data-sidebar-pref>` set by FRD-13's boot
script), `orbita-projects-open`, `orbita-ach-seen`. Storage unavailable: the state lasts the view.

**Shell-Presence contract (IF-19-shell-contract).** `e2e/shell.ts` exports `SHELL_SELECTOR =
"aside#sidebar"`, the seven `{ label, path }` (Inicio `/`, Tablero `/board`, Portafolio `/portfolio`,
Propuestas `/proposals`, Logros `/achievements`, Documentación `/manual`, Configuración `/configuration`),
`SHELL_EXEMPT = []`, `NAV_TOGGLE = "#menu"`, seeded from components.md, never from the app's constants.
`e2e/shell.spec.ts` stays verbatim. `e2e/routes.ts` lists every v2 surface (Inicio, Tablero, an idea page,
Portafolio, a workspace, Propuestas, Logros, Documentación, Configuración).

No API or Server Action contract (read-only shell; DR-060 not applicable).

## Visual spec per UI work order

| WO | Mocks and oracle states | Assets |
|---|---|---|
| WO-19-002 | `mocks/app-shell.html#shell-expanded` (375, 768, 1280), `#shell-drawer-open` (375); FRD-13 `visual-system-accessibility.html#a11y-skip-link-focus` | brand PNG; `home`, `kanban`, `folder`, `bulb`, `trophy`, `book`, `settings`, `menu` icons |
| WO-19-003 | `#shell-rail-collapsed`, `#shell-rail-float`, `#shell-projects-folded`, `#shell-pending-chip` (768, 1280); FRD-21 `pending-merge.html#shell-pending-chip-open`; FRD-09 `gamification.html#guild-achievement-notice`, `#guild-rank-ladder` (guild card) | `alert`, `branch`, `panelClose`, `panelOpen`, `sun`, `moon`, `trophy`, `x`, `list`, `chevD`, `chevR` icons |

Portable CSS: `docs/design/prototype/reference/css/18-app-frame.css`, `34-responsive.css`,
`48-sidebar-rail.css`, `52-phone-pass.css`, `53-phone-tablet-pass.css`. The prototype footer text and
capture stamp are prototype-only and are not built.

## Test-side supersession (map §3.3, BL-0051)

- WO-19-002 rewrites the shell's own tests, `e2e/shell.ts`, `e2e/routes.ts`, `e2e/shell-usability.spec.ts`,
  the shell case of `e2e/persistent-navigation.spec.ts` and of
  `src/app/manual/_tests/persistentNavigation.test.tsx`; deletes the tests of the removed top bar,
  `PendingMergeBadge` and `CelebrationWatcher`; removes with `git rm` the two reviewer suites whose
  subject it deletes (`AppShell/_tests/usability.reviewer.test.tsx`, the v1 top-bar disclosure;
  `CelebrationWatcher/_tests/wo-09-003-celebration-watcher.reviewer.test.tsx`).
- To keep every later gate compiling, modules still imported by other FRDs' reviewer suites are only
  unmounted here and deleted by FRD-13's WO-13-013: `ProposalsBadge` (FRD-17 gate suites), the top-bar
  `GuildBar` and `CelebrationSurface` (FRD-09 integration suite), `Nav/navTab.ts`.
- Visual baselines: every page changes with the sidebar; re-blessed at the close-out Visual QA only.

## Dependencies & Risks

- **Upstream:** FRD-13 WO-13-012 (and through it WO-13-010 / WO-13-011: tokens, `t()`, `Icon`, theme util,
  primitives); FRD-25 WO-25-001 (no shell exemption in the URL contract); FRD-01 WO-01-008 (onboarding
  guard in `layout.tsx`); for the contents, WO-18-002, WO-17-008, WO-21-003, WO-04-013 and the kept
  readers of FRD-03, FRD-09, FRD-10, FRD-15.
- **Downstream:** every surface renders inside the shell; FRD-13's WO-13-013 deletes the leftovers.
- **Risk: nested `<main>` during the transition.** v1 pages keep their `<main>` until rebuilt; the gates
  find the shell's `main` first; every v2 surface WO renders none (ledger to their authors).
- **Risk: link names drifting from labels** once counts and mini labels exist; mitigated by the
  accessible-name contract and the Shell-Presence gate's exact-name match.
- **Risk: first-paint flash** of the collapsed rail and the theme; mitigated by FRD-13's boot script.
- Lessons applied: LESSON-0066 / LESSON-0185 (hydration-safe e2e, no `networkidle`), LESSON-0364
  (keep the 1180 px envelope, remove only inner caps), LESSON-0310 (hover only on hover-capable pointers;
  focus also opens the float), LESSON-0077 (one resolver per count).

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-19-002 | WO-13-012, WO-25-001, WO-01-008 | `src/components/modules/{AppShell,Nav}/**`, `src/app/layout.tsx`, `src/app/_tests/layout*.test.tsx`, `src/app/{not-found,error}.tsx`, `src/app/_tests/error-net.test.tsx`, `src/lib/constants.ts`, `e2e/shell.ts`, `e2e/routes.ts`, `e2e/shell-usability.spec.ts`, `e2e/persistent-navigation.spec.ts`, `src/app/manual/_tests/persistentNavigation.test.tsx`, `src/components/modules/{PendingMergeBadge,CelebrationWatcher}/**` | true | W3 · WO-21-003, WO-26-001, WO-02-015, WO-02-017, WO-02-018, WO-02-020, WO-06-013, WO-07-006, WO-08-003, WO-08-004, WO-12-007, WO-14-005, WO-22-002, WO-04-013 |
| WO-19-003 | WO-19-002, WO-18-002, WO-17-008, WO-21-003, WO-04-013 | `src/components/modules/AppShell/{Sidebar,SidebarProjects,PluginPill,PendingPill,ThemeToggle,AppShell}.tsx`, `src/components/modules/AppShell/useSidebarPreference.ts`, `src/components/modules/AppShell/_tests/{sidebar,pills,theme-toggle,collapse}*.test.tsx`, `src/components/modules/Nav/{Nav,NavItem,ProjectNavItem}.tsx`, `src/components/modules/Nav/_tests/{nav-counts,project-nav-item}*.test.tsx`, `src/components/modules/{GuildBar,AchievementToast}/**`, `src/components/core/ThemeToggle/**`, `src/app/layout.tsx`, `src/app/_tests/layout.sidebar*.test.tsx`, `e2e/shell-sidebar.spec.ts` | false | W6 · WO-04-011, WO-04-012, WO-05-008, WO-05-009, WO-11-004, WO-10-017 |

- **Order.** WO-19-002 is the last foundation step (W3): after it every route renders the sidebar with
  the seven destinations (the Shell-Presence gate checks exactly that). WO-19-003 lands in W6 because it
  consumes resolvers that surface WOs build in W3 to W5.
- **Disjointness.** W3: the shell owns its module folders, `layout.tsx`, `constants.ts`, the not-found and
  error pages, the e2e shell seeds and the two navigation test files named above; no other W3 WO writes
  them (WO-21-003 writes `src/app/page.tsx`, the manual WOs own other `src/app/manual/_tests/*` files).
  W6: the panel WOs write their own `_panels` / component folders; only WO-19-003 writes `layout.tsx`
  and the shell folders.
- **Shared files (map §0.1).** `src/app/layout.tsx`: WO-13-010 (W0), WO-19-002 (W3), WO-19-003 (W6),
  WO-13-013 (W7). `src/lib/constants.ts`: WO-19-002 in W3. `e2e/persistent-navigation.spec.ts`: WO-25-001
  (W0), WO-19-002 (W3, shell case only), WO-04-010 (W5).
- **Cross-FRD.** Upstream FRD-13, FRD-25, FRD-01 (W3); FRD-18, FRD-17, FRD-21, FRD-04 (W6). Downstream:
  FRD-13's WO-13-013 (W7).

## Work Orders

WO-19-002 (W3, foundation) → WO-19-003 (W6). Index: [`work-orders/README.md`](work-orders/README.md).

## Superseded (v1 history)

- WO-19-001 global app shell (v1 top bar, six destinations, exempt drill-ins) → WO-19-002, WO-19-003

## Readiness check (DR-100)

REQ-19-001..005 map to the components above; the 19 ACs of FRD-19 are owned once (15 by WO-19-002,
4 by WO-19-003); the five cross-FRD ACs hosted here are owned by WO-19-003; `dependsOn` is acyclic and
names live work orders; same-wave artifacts are disjoint by design; the shell is a foundation WO; no
open clarification marker remains.
