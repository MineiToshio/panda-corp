---
id: WO-19-002
type: work-order
slug: appshell-frame-navigation
title: 'WO-19-002 — AppShell frame and navigation (sidebar, tablet rail, phone bars and drawer, Shell-Presence contract)'
status: ACTIVE
parent: FRD-19
foundation: true
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - "src/components/modules/{AppShell,Nav}/**"
  - "src/app/layout.tsx"
  - "src/app/_tests/layout*.test.tsx"
  - "src/app/{not-found,error}.tsx"
  - "src/app/_tests/error-net.test.tsx"
  - "src/lib/constants.ts"
  - "e2e/shell.ts"
  - "e2e/routes.ts"
  - "e2e/shell-usability.spec.ts"
  - "e2e/persistent-navigation/destinations.spec.ts"
  - "src/components/modules/{PendingMergeBadge,CelebrationWatcher}/**"
source_requirements: [REQ-19-001, REQ-19-002, REQ-19-003, REQ-19-004, REQ-19-005, AC-19-001.1, AC-19-001.2, AC-19-001.3, AC-19-001.4, AC-19-001.5, AC-19-002.1, AC-19-002.2, AC-19-003.1, AC-19-003.2, AC-19-003.3, AC-19-003.4, AC-19-003.5, AC-19-004.1, AC-19-004.2, AC-19-005.4]
dependsOn: [WO-13-012, WO-25-001, WO-01-008]
last_updated: 2026-10-30
---

# WO-19-002 — AppShell frame and navigation (sidebar, tablet rail, phone bars and drawer, Shell-Presence contract)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`../blueprint.md`](../blueprint.md) (CMP-19-app-shell, CMP-19-sidebar, CMP-19-nav,
> IF-19-nav-active, IF-19-nav-destinations, CMP-19-topbar, CMP-19-bottom-nav, CMP-19-drawer,
> CMP-19-skip-link, IF-19-shell-contract). Nav contract: `docs/design/components.md`
> § AppShell nav contract (DR-075).

## Summary

Replaces the v1 top navigation with the Órbita persistent shell on every route: the `AppShell` frame
(252 px sidebar from 1180 px, 76 px icon rail with mini labels from 760 to 1179 px, phone sticky top
bar, bottom navigation and off-canvas drawer below 760 px), the brand, the seven destinations as real
links with exactly one active, the skip link that moves focus to `main#content` in place, the 1180 px
content frame, no exempt route, and the Shell-Presence seeds `e2e/shell.ts` / `e2e/routes.ts`. The
sidebar's contents (projects, counts, collapse, theme button, guild card, pills, notice) are slots that
WO-19-003 fills.

## In Scope

1. **`AppShell`** (restyle in place, `AppShell/AppShell.tsx`, client): markup and hooks as the prototype
   records them: `a.skip` first, then `.app#app` (`data-testid="app-shell"`, `data-sidebar="expanded"`
   in this WO) holding `aside#sidebar` (accessible name «Navegación principal», `data-open` for the
   drawer), `.scrim#scrim`, and `.main` with the phone `TopBar`, `main#content.page` (`tabIndex={-1}`,
   the skip target and the page frame) and the phone `BottomNav`. Grid `252px | 1fr` (desktop),
   `76px | 1fr` (tablet), one column (phone). Content frame at most `--content` (1180 px), centred, with
   the `.page` gutters 40 / 24 / 16 px (frozen overrides). The shell renders no other landmark around
   the page and adds no second `<main>`.
2. **Drawer (phone, below 760 px):** the same `aside#sidebar`, off-canvas `min(300px, 86vw)`, slides in by
   `transform` (220 ms, `--ease`; none under reduced motion), over the scrim. Opened by `button#menu`
   (TopBar) or by «Más» (`BottomNav`); `aria-expanded` on `#menu`, `aria-controls="sidebar"` on both
   openers; `inert` while closed (phone only; never inert at tablet or desktop); focus moves to the first
   link on open; closes on Escape (focus returns to the opener that opened it), pointer-down outside
   (the scrim), activating any destination (including the current route) and any route change.
3. **`Sidebar`** (new, `AppShell/Sidebar.tsx`): `--bg-2` column, sticky, full height; the brand link
   (`a.brand` to `/`, accessible name «Pandacorp Mission Control: ir a Inicio» from `shell.brand.aria`,
   the raster mark `/brand/pandacorp.png` with empty `alt`, «Pandacorp» over «MISSION CONTROL»); then,
   in the prototype's order, optional slots `pills`, the `Nav`, `projects`, `guild` and `footer` (all
   empty in this WO; WO-19-003 fills them; AC-19-001.3 is met by the brand plus these hosts).
4. **`Nav` + `NavItem`** (restyle `Nav/Nav.tsx`, new `Nav/NavItem.tsx`): `nav.navgroup` named «Secciones»
   (`shell.sidebar.sectionsAria`); seven `a.navitem` (`next/link`, client-side) from
   `NAV_DESTINATIONS`, each with its `Icon` and tone (Inicio amber `home`, Tablero teal `kanban`,
   Portafolio blue `folder`, Propuestas pink `bulb`, Logros gold `trophy`, Documentación violet `book`,
   Configuración slate `settings`), the full label `.lbl` and the mini label `.mini` («Docs», «Ajustes»
   for the two long ones). At any width exactly one of `.lbl` / `.mini` is rendered (the other
   `display: none`), so each link's accessible name is exactly its label (the Shell-Presence gate
   matches names exactly). The current destination has `aria-current="page"`, the raised surface and
   the bolder label; `data-testid="app-nav-<id>"` with the ids `inicio`, `tablero`, `portfolio`,
   `propuestas`, `logros`, `documentacion`, `configuracion`; `Nav` keeps `data-testid="app-nav"`.
5. **Active rule (IF-19-nav-active):** `Nav` consumes `activeDestinationPath(pathname)` from
   `src/lib/navigation` (WO-25-001, the single source of the rule, DR-115; no exemption list, AC-25-010.1)
   and only maps the returned root path to its destination id in `Nav/navActive.ts`; it keeps no second copy
   of the path table. The rule it consumes: `/` exactly → Inicio; `/board` and everything under it (idea
   pages) → Tablero; `/portfolio` and `/projects` and everything under them (the workspace) → Portafolio;
   `/proposals`, `/achievements`, `/manual`, `/configuration` families → their destination; any other path
   → none (no false highlight); a prefix only matches whole path segments.
6. **`TopBar`** (new, phone only): sticky 58 px bar with `button#menu` («Abrir menú», `menu` icon), the
   30 px logo and `#where` («MISSION CONTROL» in small caps over the active destination's label).
   **`BottomNav`** (new, phone only): `nav#bottomnav` named «Accesos rápidos» (`shell.bottomNav.aria`),
   five 52 px columns: Inicio, Tablero, Portafolio, Docs (links, `aria-current` on the active one) and
   «Más» (`button[data-action="drawer"]`, `aria-controls="sidebar"`, opens the drawer).
7. **`SkipLink`** (new): `a.skip` to `#content` with the catalogue's skip-link label «Saltar al
   contenido» (captured in this FRD's `shell-skip-link` state; FRD-13's `a11y-skip-link-focus` focuses the
   same link), the first focusable element, off-screen until focused; activation
   moves focus to `main#content` in place (a real in-page anchor, never a route).
8. **Navigation constants (IF-19-nav-destinations, `src/lib/constants.ts`):** `NAV_DESTINATIONS` (id,
   path, label key, mini key, icon, tone) and the route constants the shell uses. The e2e contract is
   seeded from the prototype, not from these constants (author-independent check).
9. **Root layout:** mounts `<AppShell>{children}</AppShell>` once, inside the onboarding guard (the
   onboarding gate still replaces the whole view when the profile is absent, edge case of FRD-19);
   removes the top-bar mounts and their server reads (`GuildBar`, `ProposalsBadge` with
   `countOpenProposals`, `PendingMergeBadge` with `getPendingMerge`, `CelebrationWatcher`), so `layout.tsx`
   imports neither `countOpenProposals` nor `getPendingMerge` (both unused entry points retired here
   during S1B round 2 by owner instruction); keeps
   `GamificationLedgerSync` and WO-13-010's fonts, boot script and Tabler link.
10. **Not-found and error pages** (`src/app/not-found.tsx`, `src/app/error.tsx`): they render inside the
    shell, so their top-level `<main>` becomes a plain wrapper (the shell owns `main#content`).
    `global-error.tsx` replaces the root layout and keeps its own `<main>`.
11. **Shell-Presence seeds (IF-19-shell-contract):** `e2e/shell.ts` rewritten from components.md
    § AppShell nav contract: `SHELL_SELECTOR = "aside#sidebar"`, the seven `{ label, path }` in order
    (label «Portafolio»), `SHELL_EXEMPT = []`, `NAV_TOGGLE = "#menu"`. `e2e/routes.ts` lists every v2
    surface up front: Inicio `/`, Tablero `/board`, the idea page `/board/idea-in-pipeline` and its
    explicit tab `/board/idea-in-pipeline/proposal`, the idea data-model route
    `/board/idea-in-pipeline/architecture`, Portafolio `/portfolio`, the workspace
    `/projects/mission-control`, Propuestas `/proposals`, `/proposals/memory` and `/proposals/backlog`, Logros
    `/achievements`, Documentación `/manual`, Configuración `/configuration` (names = the nav labels plus the
    sub-view; the `blessed` flags of already-blessed surfaces kept, new surfaces `blessed: false` until their
    FRD gate). The FRD-02, FRD-17, FRD-18, FRD-21 and FRD-22 behaviour specs and the smoke gate need these
    routes (ledger B, G).
12. **Removals (map §6.C items 1, 2 and 3, first half):** the top navigation and its exemptions
    (`AppShell/ShellNavigation.tsx`, `AppShell/shellScope.ts`, `AppShell/shell.module.css`,
    `AppShell/copy.es.ts`, the v1 header markup and `[data-nav-toggle]`), the `PendingMergeBadge`
    module, and the `CelebrationWatcher` module (tiered celebrations), each with its tests. Unmounted
    but NOT deleted here, because other FRDs' reviewer suites still import them until their own gates
    re-bless: `ProposalsBadge`, `GuildBar` (top-bar component), `CelebrationSurface`, `Nav/navTab.ts`
    (WO-13-013 deletes them).

## Out of Scope

- The sidebar's contents: counts, Proyectos group, collapse to the 64 px rail and its float, theme
  button, guild card, pills, achievement notice (WO-19-003). AC-19-003.1's collapse control is
  AC-19-005.3's control, delivered by WO-19-003 into the footer slot.
- Rebuilding any page. A v1 page that still renders its own `<main>` (through `PageLayout` or
  directly) sits inside `main#content` until its surface WO rebuilds it on `PageHead`; every v2
  surface WO renders no `<main>` (ledger).
- The URL codec (WO-25-001); the workspace tabs and their e2e (WO-04-010).

## Requirements & Acceptance Criteria

REQ-19-001 to REQ-19-004 and the responsive pattern of REQ-19-005.

- **AC-19-001.1** The app SHALL render a single persistent navigation shell (the landmark `aside#sidebar`) on every surface (Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración), so all seven destinations are reachable from any surface without using the browser back button.
- **AC-19-001.2** The shell SHALL contain exactly the seven top-level destinations, each a link to its correct route: Inicio→`/`, Tablero→`/board`, Portafolio→`/portfolio`, Propuestas→`/proposals`, Logros→`/achievements`, Documentación→`/manual`, Configuración→`/configuration`. No dead hrefs (`#`/`/`-placeholders), no extra top-level destinations.
- **AC-19-001.3** The shell SHALL host the brand, the guild card (FRD-09 AC-09-008.1), the Propuestas count and the global pills "Plugin desactualizado" and "⎇ N pendientes".
- **AC-19-001.4** Navigation between destinations SHALL be client-side (`next/link`), not a full page reload.
- **AC-19-001.5** A keyboard-reachable **skip link** "Saltar al contenido" SHALL be the first focusable element of the page and SHALL move focus to the main content region in place, without routing to another screen (WCAG 2.2 SC 2.4.1).
- **AC-19-002.1** WHEN the current route matches a destination, that destination SHALL be marked active — both programmatically (`aria-current="page"`) and visually — and **exactly one** destination SHALL be active at a time (not color-alone — `aria-current` carries the meaning).
- **AC-19-002.2** The active match SHALL be exact for Inicio (`/`) and per path for the other six; the project workspace is a drill-in of Portafolio and keeps Portafolio active [ASSUMPTION: since no route is exempt from the shell any more, the workspace needs an active destination; Portafolio is the surface it opens from — source: C-01 and FRD-04]. WHEN the route is unmatched (for example `not-found`), no destination SHALL be marked active (no false highlight).
- **AC-19-003.1** WHEN the viewport is 1180 px or wider, THE shell SHALL display the expanded sidebar with full labels and the collapse control (AC-19-005.3).
- **AC-19-003.2** WHEN the viewport is from 760 px through 1179 px, THE shell SHALL display a 76 px icon rail with mini labels ("Docs" for Documentación and "Ajustes" for Configuración are the short forms).
- **AC-19-003.3** WHEN the viewport is 759 px or narrower, THE shell SHALL show a sticky top bar with the brand and a menu toggle (`#menu`, accessible name "Abrir menú", with `aria-expanded` and `aria-controls="sidebar"`), a bottom navigation (Inicio · Tablero · Portafolio · Docs · Más) and an off-canvas drawer holding the full sidebar, opened by the toggle or by "Más"; WHILE the drawer is closed it SHALL be inert. Every link SHALL have a target of at least 44 px by design (24 px is only the gated floor).
- **AC-19-003.4** WHEN Escape is pressed with the drawer open, THE shell SHALL close it and restore focus to its opener; outside pointer-down, destination activation (including the current route) and route changes SHALL also close it.
- **AC-19-003.5** WHEN rendering page content, THE shell SHALL center a content frame of at most 1180 px with a 40 px gutter on each side, and shrink to narrower viewports; shared digest panels SHALL fill their host without the narrower 920px inner panel cap, while prose MAY retain a readable line-length cap. Model-only fullscreen SHALL continue to fill the browser viewport.
- **AC-19-004.1** The shell SHALL render on EVERY route, including the project workspace (`/projects/**`) and Configuración (`/configuration`); no route is exempt, and the workspace keeps its own header and back control inside the content frame.
- **AC-19-004.2** The Shell-Presence Gate (`e2e/shell.ts`) SHALL mirror this contract with an empty exempt set; the app and the gate SHALL not drift.
- **AC-19-005.4** — THE shell SHALL become an icon rail on tablets and a top bar, bottom navigation and drawer on phones (REQ-19-003).

**Fidelity criterion.** The built shell matches `mocks/app-shell.html` `shell-expanded` (375, 768, 1280)
and `shell-drawer-open` (375), and FRD-13's `a11y-skip-link-focus`, in layout, structure, components and
density on the frozen tokens, with the recorded hooks (`aside#sidebar`, `#menu`, `#scrim`,
`nav#bottomnav`, `.navitem`, `.navgroup`, `a.skip`, `main#content`, `data-open`, `data-sidebar`); verified
by the preview smoke and shell gates here and the fidelity diff at close-out.

**Completeness (DR-100).** Keyboard: skip link first, tab order brand → nav, drawer focus in on open and
back to the opener on close, no focus trap on desktop. Focus never under the sticky top bar or bottom
navigation (`scroll-padding`, AC-13-010.3). Touch: 44 px design targets in the drawer and bottom
navigation. Reduced motion: no drawer slide. No hydration mismatch (the active state derives from the
pathname on both server and client). Performance: the shell is one client boundary; the brand PNG loads
with the shell (accepted trade-off, ADR-0012); no layout shift when the drawer state changes.

## Reuse (components.md)

Restyle in place: `AppShell`, `Nav`. Create (rows already inventoried): `Sidebar`, `NavItem`, `TopBar`,
`BottomNav`, `SkipLink`. Reuse: `Icon`, `t()`, tokens (WO-13-010); `IconButton` (WO-13-011). `Footer` is
prototype-only and is not built.

## Installs

None.

## Visual reference

- **Mock screens:** `docs/frds/frd-19-app-shell/mocks/app-shell.html#shell-expanded` (1280 sidebar, 768
  rail, 375 top bar and bottom navigation) and `#shell-drawer-open` (375);
  `docs/frds/frd-13-visual-system-accessibility/mocks/visual-system-accessibility.html#a11y-skip-link-focus`.
  Oracle states: `shell-expanded`, `shell-drawer-open`, `shell-skip-link` (scenario state, skip link focused
  with its text; `oracle-recipes.json` double), `a11y-skip-link-focus`. Screenshots in each
  FRD's `mocks/screenshots/`.
- **Token slice:** `--sidebar` 252, `--rail` 76, `--content` 1180, `--bg-2` (sidebar), `--surface`
  (raised current item), `--line`, `--text`, `--text-2`, the seven destination hues and `--tint`,
  `--shadow-panel` (drawer), `--backdrop` (scrim), `.page` gutters (`--s10` / `--s6` / `--s4`), `--dur`,
  `--ease`, `--fs-sm` / `--fs-xs` (labels, mini labels). Portable CSS:
  `docs/design/prototype/reference/css/18-app-frame.css`, `34-responsive.css`, `48-sidebar-rail.css`,
  `52-phone-pass.css`, `53-phone-tablet-pass.css`.
- **FDD pointer:** `docs/frds/frd-19-app-shell/fdd.md` (Screens, States, Nav contract).
- **Assets:** `/brand/pandacorp.png` and the `home`, `kanban`, `folder`, `bulb`, `trophy`, `book`,
  `settings`, `menu` icons (staged by WO-13-010).

## Tests (owned)

- `src/components/modules/Nav/_tests/navActive.test.ts`: the mapping from `activeDestinationPath` to the
  destination id over a path table (root, each family, nested idea and workspace paths for both
  `/portfolio/<p>` and `/projects/<p>`, near-miss prefixes such as `/manual-other`, unknown paths → none);
  cites AC-25-010.1 (re-verified here, owned by WO-25-001).
- `src/components/modules/Nav/_tests/Nav.test.tsx` (rewritten): seven links in order with the exact
  names and hrefs; exactly one `aria-current="page"`; mini labels on the rail.
- `src/components/modules/AppShell/_tests/AppShell.test.tsx` (rewritten): skip link is the first
  focusable and targets `#content`; drawer opens from `#menu` and from «Más», sets `aria-expanded`,
  is inert when closed on phones, closes on Escape with focus back to the opener, on scrim pointer-down,
  on destination activation and on a pathname change.
- `src/app/_tests/layout.shell.test.tsx`: the shell is mounted once around the page; the onboarding gate
  replaces it when the profile is absent; no top-bar badge is mounted. `layout.guard.test.tsx` kept and
  updated; `layout.guildbartop.test.tsx` and `layout.proposalsbadge.test.tsx` deleted (behaviour removed).
- `e2e/shell-usability.spec.ts` (the behaviour spec, rewritten for v2): at 1280 the 252 px sidebar and a
  content frame of at most 1180 px with 40 px gutters; at 768 the 76 px rail with «Docs» and «Ajustes»;
  at 375 the top bar, the five-item bottom navigation (targets at least 44 px), the drawer cycle
  (toggle, «Más», Escape with focus return, outside press, link activation, route change) and no
  horizontal overflow; the skip link moves focus to `main#content` without changing the URL path; the
  workspace and Configuración render the sidebar with Portafolio and Configuración active; a focused
  link is never under the sticky bars. Light and dark. `gotoHydrated`, no hard waits.
- `e2e/persistent-navigation/destinations.spec.ts` (split out of the core spec by WO-25-001): the shell
  test («nested destinations retain global highlights…») is updated (Configuración now has the shell;
  `#menu` replaces `[data-nav-toggle]`). The core `e2e/persistent-navigation.spec.ts` is not touched here.
- `src/components/modules/Nav/_tests/persistentNavigation.test.tsx` (split out of
  `src/app/manual/_tests/persistentNavigation.test.tsx` by WO-25-001; reconciliation 2026-10-22, the manual
  file is WO-08-003's): the prefix case runs through the new active rule; the `isShellExempt` assertions go
  with `shellScope.ts`.
- `src/app/_tests/error-net.test.tsx`: updated only if it pinned the page-level `<main>`.

### Derogated tests (map §3.3, BL-0051)

- Implementer-authored, rewritten or deleted here: the AppShell, Nav, ShellNavigation, PendingMergeBadge
  and CelebrationWatcher tests, the three `src/app/_tests/layout*` files listed above.
- Reviewer-authored, removed with `git rm` because their subject is deleted by this WO (rule 3,
  FRD-mandated removal): `src/components/modules/AppShell/_tests/usability.reviewer.test.tsx` (the v1
  top-bar disclosure, §6.C item 1; its v1 props no longer compile) and
  `src/components/modules/CelebrationWatcher/_tests/wo-09-003-celebration-watcher.reviewer.test.tsx`
  (the module is deleted, §6.C item 3). The FRD-19 gate reviewer writes the v2 acceptance.
- Visual baselines: every page changes (the sidebar); never touched here, re-blessed at the close-out
  Visual QA (map §3.3.4). `e2e/shell.spec.ts` is verbatim and untouched.

## Definition of done

- Owned tests and the Shell-Presence gate green against the new `e2e/shell.ts` (landmark on every
  `routes.ts` surface, seven destinations with exact names and hrefs).
- `.pandacorp/verify.sh` green; knip shows no orphan from the removed top bar.
- Status Note lists the `AppShell` / `Sidebar` slot props and `navActive` signature WO-19-003 builds on.

## Dependencies

WO-13-012 (primitives, after WO-13-010 / WO-13-011), WO-25-001 (no shell exemption in the URL
contract), WO-01-008 (onboarding guard in `layout.tsx`). Consumers: WO-19-003; every surface renders
inside it. Cites LESSON-0066 and LESSON-0185 (no `networkidle`, hydration-safe e2e), LESSON-0364 (only
inner content caps go; the 1180 px frame stays).

## Status Note

- 2026-10-30 (S1B round 2): opening the phone drawer makes visibility immediate while retaining its transform animation and reduced-motion override. The sticky sidebar uses the new `--z-sidebar` token (60), below the phone scrim (65). `#menu` reuses IconButton with additive id/className/ARIA props. Removed obsolete v1 shell CSS.
- 2026-10-30 (owner-directed early removal): deleted the unreferenced `src/lib/proposals/proposals.ts` (no tests or runtime consumers remain), the unused `getPendingMerge` wrapper/imports, and unused ButtonVariant/ButtonTone/TabDef exports here instead of WO-17-008 and WO-13-013. `readPending` and its tests remain. Reviewer suites and knip.json are unchanged.

### 2026-10-30 — S1B round 2 verification

Executed from `mission-control/`, with `export PORT=3943 PANDACORP_E2E_PORT=3943`:

```sh
pnpm knip
pnpm exec tsc --noEmit
pnpm exec biome check .
pnpm exec vitest run src/components/modules/AppShell src/components/modules/Nav src/app/_tests src/lib/proposals src/lib/pendingMerge --maxWorkers=2 --reporter=dot
```

All four commands exited 0. Knip emitted nine configuration hints; knip.json remains unchanged.
Biome checked 1153 files and emitted only the existing schema-version information (2.5.1 vs CLI
2.5.2). Vitest passed 20 files / 149 tests, including the unchanged reviewer suites in the selected
paths, with Node localStorage experimental warnings. The removed proposals folder has no test files.
After strengthening the menu selector to preserve its 44 px target against shared button styles,
`pnpm --dir mission-control exec biome check src/components/modules/AppShell/AppShell.module.css`
passed (one file). `git diff --check` passed. No remaining red check in this requested batch.
No full verify.sh, browser, Playwright or computed-style/fidelity verification was performed.
No reviewer tests, blessed visual baselines or .pandacorp files changed. Changes remain unstaged
and uncommitted on orch/s1b; no merge, push or merge-queue operation was performed.

### 2026-10-30 — S1B implementation, awaiting independent review

- Built on branch `orch/s1b`, in the assigned worktree only. No commit, stage, merge, push,
  merge queue, full verification gate or Chromium/Playwright run was performed, as instructed.
- Replaced the v1 header with the persistent sidebar (252 px), tablet rail (76 px), phone bars,
  scrim and drawer. Added catalogue-backed navigation, canonical active-family mapping, a skip
  link to the shell-owned `main#content`, route/link/outside/Escape dismissal, focus entry/return,
  phone keyboard containment, breakpoint-specific inertness and reduced-motion styles.
- `AppShellProps` is `{ children, pills?, projects?, guild?, footer? }`. The optional nodes are
  passed to `SidebarSlots` in brand → pills → Nav → projects → guild → footer order.
  `Sidebar` additionally receives `{ open, inert, sidebarRef, onNavigate }` from AppShell.
  `navActive(pathname: string): NavDestinationId | null` maps the result of
  `activeDestinationPath()` to the catalogue id; it does not duplicate route-family rules.
  `Nav()` owns all seven links. Counts, projects, guild and footer content remain WO-19-003 scope.
- R16: the inherited S1A `PageLayout` already renders a section. The owned integration test
  mounts it in AppShell and finds a single main. Error and not-found boundaries now use divs;
  `global-error.tsx` is untouched. Other legacy pages with direct main elements are outside this
  stream; no claim is made that every route has passed a browser landmark audit.
- RootLayout removes the old GuildBar, ProposalsBadge, PendingMergeBadge and CelebrationWatcher
  mounts and their server reads, preserving the onboarding guard, ledger sync, theme boot and
  font resources. Removed the pending badge and tiered watcher production modules and their
  implementer tests. Reviewer suites are deliberately untouched, including their now-retired imports.
- Seeded `e2e/shell.ts` with `aside#sidebar`, `#menu`, Portafolio and no exemptions. Added the five
  missing v2 route entries without changing blessing flags. Rewrote shell usability coverage for
  desktop/tablet/phone, both themes, focus, drawer dismissal, sticky-bar occlusion and client navigation;
  changed the destinations spec's toggle selector. These browser assertions have NOT been executed.
- The phone title order follows the higher-priority FDD/prototype: destination, then the small
  Mission Control product line. The initial native menu button was superseded in S1B round 2 by
  shared IconButton with additive id/className/ARIA support; the shell retains a 44 px touch target.
  No dependencies were installed.

Verification (all commands exported `PORT=3943 PANDACORP_E2E_PORT=3943`):

```sh
pnpm --dir mission-control exec tsc --project /private/tmp/s1b-tsconfig-owned.json --noEmit --incremental false
pnpm --dir mission-control exec tsc --project /private/tmp/s1b-tsconfig.json --noEmit --incremental false
pnpm --dir mission-control exec biome check src/components/modules/AppShell/{AppShell.tsx,AppShell.module.css,BottomNav.tsx,Sidebar.tsx,SkipLink.tsx,TopBar.tsx,useDrawer.ts,_tests/AppShell.test.tsx} src/components/modules/Nav/{Nav.tsx,NavItem.tsx,Nav.module.css,navActive.ts,_tests/Nav.test.tsx,_tests/navActive.test.ts} src/app/{layout,not-found,error}.tsx src/lib/constants.ts e2e/{shell.ts,routes.ts,shell-usability.spec.ts,persistent-navigation/destinations.spec.ts}
pnpm --dir mission-control exec vitest run src/components/modules/AppShell src/components/modules/Nav --exclude '**/*.reviewer.*' --reporter=dot
pnpm --dir mission-control exec vitest run src/components/modules/AppShell src/components/modules/Nav src/components/modules/PendingMergeBadge src/components/modules/CelebrationWatcher --reporter=dot
pnpm --dir mission-control exec vitest run src/app/_tests/layout.guard.test.tsx src/app/_tests/layout.guildbartop.test.tsx src/app/_tests/layout.proposalsbadge.test.tsx src/app/_tests/error-net.test.tsx --reporter=dot
```

- The temporary TypeScript configs extend this worktree's tsconfig and list only the four module
  folders, the three changed app files, constants, the four e2e files and ambient setup. Owned config
  excludes reviewer files; the second includes them. This checkout has no generated next-env.d.ts;
  the configs load the installed Next global/image declarations directly, without writing a generated
  file into the worktree. Transitive imports are typechecked normally.
- Owned TypeScript: PASS. Biome: PASS, 22 changed source/test files. Owned Vitest: PASS, 4 suites,
  36 tests. Initial RED before implementation: 10 failed / 6 passed, then patched in place.
- Module-folder Vitest including unchanged reviewers: RED, 4 suites passed / 2 failed; 34 tests
  passed / 5 failed at that run (before two additional passing owned focus tests). Failures are the
  old AppShell menu-label assertions and the removed CelebrationWatcher import.
- TypeScript including those reviewers: RED, two diagnostics: old `levelBar`/`proposalsBadge`
  props in AppShell usability, and the missing removed CelebrationWatcher module.
- Targeted layout/error run: guard and error-net PASS (13 tests); old guild-topbar and proposals-badge
  suites RED (7 tests), because this WO intentionally removes their global mounts. These files were
  not edited: the worker's explicit allowlist excludes them.

Reviewer reconciliation required (no reviewer-owned file was edited or removed):

1. Remove `AppShell/_tests/usability.reviewer.test.tsx` and
   `CelebrationWatcher/_tests/wo-09-003-celebration-watcher.reviewer.test.tsx`, as the WO derogates
   their v1 subjects. Replace with independent v2 shell acceptance.
2. Rewrite `src/lib/navigation/_tests/v2-boundaries.reviewer.test.tsx`: it still constructs AppShell
   with the removed v1 slot props. Reconcile the shell assertions in
   `e2e/frd25-gate-regressions.reviewer.spec.ts` with the sidebar and Portafolio label, and run them.
3. Remove/reconcile the retired `src/app/_tests/layout.guildbartop.test.tsx` and
   `layout.proposalsbadge.test.tsx`; replace their global-mount contract with v2 layout acceptance.
   Keep `layout.guard.test.tsx` and `error-net.test.tsx` (both passed).
4. Run `e2e/shell-usability.spec.ts`, `e2e/persistent-navigation/destinations.spec.ts` and the untouched
   shell-presence gate, then perform responsive/fidelity review and reviewer-owned baseline updates.
5. The plan's BUILD_MODES importer checks remain unrun here (outside the worker's test scope):
   `mode-selector.reviewer.test.tsx`, `frd-11-gate.reviewer.test.tsx`,
   `frd-11-gate-opus.reviewer.test.tsx`, `src/lib/_tests/build-modes.adversarial.test.ts`.
   BUILD_MODES itself was not changed.

No full gate, build, browser behaviour, screenshots, axe run or visual fidelity has been verified.
The remaining reds above must be reconciled by the reviewer/orchestrator before landing.
