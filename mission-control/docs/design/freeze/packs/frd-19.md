# Context pack · FRD-19 · Global app shell (persistent top navigation)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-19 copy, S2.1 builds, S2.2 amendments, S2.3-19 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-19-app-shell/frd.md` (id FRD-19, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 5 under `states["frd-19-app-shell"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 14 AC lines: 3 drawn · 6 partially drawn · 4 not drawn · 1 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-19#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-19-001.1 · partial · `shell-expanded`

> - **AC-19-001.1** The app SHALL render a single persistent navigation shell (the landmark
>   `[data-app-shell]`) at the top of every top-level surface (Inicio, Tablero, Portfolio, Propuestas,
>   Logros, Documentación), so all six destinations are reachable from any surface without using the
>   browser back button.

**Prototype:** One persistent shell frames every route: the sidebar `aside` (aria-label "Navegación principal") plus, on phones, the top bar and the bottom navigation. The `[data-app-shell]` landmark of the e2e contract is not part of the prototype.

### AC-19-001.2 · partial · `shell-expanded`

> - **AC-19-001.2** The shell SHALL contain exactly the six prototype top-level destinations, each a
>   link to its correct route: Inicio→`/`, Tablero→`/board`, Portfolio→`/portfolio`,
>   Propuestas→`/proposals`, Logros→`/achievements`, Documentación→`/manual`. No dead hrefs
>   (`#`/`/`-placeholders), no extra top-level destinations.

**Prototype:** SEVEN destinations, not six: Inicio · Tablero · Portafolio · Propuestas · Logros · Documentación · Configuración (hash routes `#inicio … #configuracion`). The label is "Portafolio" (FRD: "Portfolio"); Configuración is a normal destination (FRD: exempt drill-in). The five-project list ("Proyectos", collapsible) and a "Ver los N" link (only beyond five projects) are extra.

### AC-19-001.3 · drawn · `shell-expanded`

> - **AC-19-001.3** The shell SHALL host the guild identity block (brand + level/XP, reusing the
>   `GuildBar` module — DR-057) and the proposals badge (reusing the `ProposalsBadge` module) alongside
>   the nav, matching the prototype `topbar()`.

**Prototype:** Brand block (logo + "Pandacorp / MISSION CONTROL"), the guild card (crest with level, rank name, "175 / 200 XP al nivel 23", gold bar) and Propuestas with its action count badge (4) live in the sidebar; Inicio carries its own count (6) and Tablero its idea count (10).

### AC-19-001.4 · behaviour only · `shell-expanded`

> - **AC-19-001.4** Navigation between destinations SHALL be client-side (`next/link`), not a full page
>   reload.

**Prototype:** Client-side navigation: hash routing in the prototype; the app uses next/link.

### AC-19-001.5 · drawn · `a11y-skip-link-focus`

> - **AC-19-001.5** A keyboard-reachable **skip link** SHALL be the first focusable element of the page
>   and SHALL move focus to the main content region (WCAG 2.2 SC 2.4.1).

**Prototype:** "Saltar al contenido" is the first focusable element and focus lands on `#content` (`main`, tabindex -1). PROTOTYPE DEFECT: the link is `href="#content"` and the hash router reads it as an unknown screen, so activating it from #tablero re-renders Inicio (verified: hash becomes #content, H1 "Centro de mando"). The real app uses a real in-page anchor.

### AC-19-002.1 · drawn · `shell-expanded`

> - **AC-19-002.1** WHEN the current route matches a destination, that destination SHALL be marked
>   active — both programmatically (`aria-current="page"`) and visually (the `.tab` active treatment) —
>   and **exactly one** destination SHALL be active at a time (not color-alone — `aria-current` carries
>   the meaning).

**Prototype:** The current destination has `aria-current="page"`, a raised background and a tinted icon; exactly one item at a time (the idea detail highlights Tablero, a project route highlights Portafolio and the project row).

### AC-19-002.2 · partial · `shell-expanded`

> - **AC-19-002.2** The active match SHALL be exact for Inicio (`/`) and exact-per-path for the other
>   five; WHEN the route is an exempt drill-in (see REQ-19-004) or otherwise unmatched, no destination
>   SHALL be marked active (no false highlight).

**Prototype:** Highlight follows the screen; idea detail maps to Tablero and unknown hashes fall back to Inicio. The "no false highlight on drill-ins" rule does not apply (drill-ins keep the shell).

### AC-19-003.1 · partial · `shell-expanded`, `shell-rail-collapsed`, `shell-rail-float`, `shell-projects-folded`

> - **AC-19-003.1** WHEN the viewport is wider than 1100px, THE shell SHALL display all six destinations inline and hide the disclosure toggle.

**Prototype:** From 1180 px the sidebar is pinned open at 252 px (collapsible to a 64 px icon rail with a "Colapsar" / "Fijar abierta" button); there is no top navigation and no disclosure toggle at that width.

### AC-19-003.2 · not drawn · `shell-rail-collapsed`, `shell-drawer-open`

> - **AC-19-003.2** WHEN the viewport is 1100px or narrower, THE shell SHALL place a minimum 44px toggle beside the brand at the top-right of the same header, hide the closed navigation, and reveal all destinations in a full-width row within that header; the toggle SHALL expose an accessible open/close label, `aria-expanded` and `aria-controls`.

**Prototype:** The 1100 px single-header disclosure is replaced by three tiers: 760-1179 px a 76 px icon rail with a mini label under each icon; below 760 px a sticky top bar (menu button "Abrir menú", logo, "Inicio / MISSION CONTROL"), a bottom navigation (Inicio · Tablero · Portafolio · Manual · Más) and an off-canvas drawer with scrim.

### AC-19-003.3 · not drawn · `shell-drawer-open`

> - **AC-19-003.3** WHEN the navigation is open at 600px or narrower, THE shell SHALL use two destination columns; from 601px through 1100px it SHALL use three. Every link, including the nested Propuestas badge destination, SHALL have a minimum 44px target height and remain within the header bounds at 320px, 390px, 768px and 1024px.

**Prototype:** No two/three-column destination grid; the drawer is a single column with 44 px items; bottom nav items are 52 px high.

### AC-19-003.4 · partial · `shell-drawer-open`

> - **AC-19-003.4** WHEN Escape is pressed with the menu open, THE shell SHALL close it and restore toggle focus; outside pointer-down, destination activation (including the current route) and route changes SHALL also close it.

**Prototype:** The phone drawer closes on route change, scrim tap and Escape (focus returns to the "Abrir menú" button); Tab is trapped inside while open, focus moves to the first link on open and `inert` applies when closed. The toggle sits in the sticky top bar, not beside a brand at the right of the same header. Captured only as the open drawer (`shell-drawer-open`).

### AC-19-003.5 · partial · `shell-expanded`

> - **AC-19-003.5** WHEN rendering page content, THE shell SHALL retain the original centered 1240px maximum outer application frame, including its consistent header/content gutters, and shrink to narrower viewports; shared digest panels SHALL fill their host without the narrower 920px inner panel cap, while prose MAY retain a readable line-length cap. Model-only fullscreen SHALL continue to fill the browser viewport.

**Prototype:** Content is centred in a 1180 px frame plus 40 px gutters (1260 px outer); the AC says 1240 px including gutters.

### AC-19-004.1 · not drawn · `shell-expanded`

> - **AC-19-004.1** The drill-in surfaces that navigate via their own in-context header + back control —
>   the project workspace (`/projects/**`) and Configuration (`/configuration`) — SHALL render WITHOUT
>   the global topbar (they are sub-destinations reached from inside another surface, not top-level
>   nav), matching the prototype where entering a project/config replaces the top nav with a contextual
>   header.

**Prototype:** Project workspace and Configuración render INSIDE the shell (sidebar present); the exemption list does not exist.

### AC-19-004.2 · not drawn · `shell-expanded`

> - **AC-19-004.2** The exempt set SHALL be the single contract mirrored by the Shell-Presence Gate
>   (`e2e/shell.ts` `SHELL_EXEMPT = ['/projects/**', '/configuration']`); the app and the gate SHALL not
>   drift.

**Prototype:** `SHELL_EXEMPT` has nothing to mirror: the nav contract for the Shell-Presence Gate must list the seven destinations and no exempt route.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `shell-expanded` | `#inicio` | (none) | full page | `AC-19-001.1` `AC-19-001.2` `AC-19-001.3` `AC-19-001.4` `AC-19-002.1` `AC-19-002.2` `AC-19-003.1` `AC-19-003.5` `AC-19-004.1` `AC-19-004.2` |
| `shell-rail-collapsed` | `#inicio` | click `[data-action="toggle-sidebar"]` | full page; widths 1280 | `AC-19-003.1` `AC-19-003.2` |
| `shell-rail-float` | `#inicio` | click `[data-action="toggle-sidebar"]` → js `document.querySelector('#sidebar').dataset.float = 'true'` | capture viewport; widths 1280 | `AC-19-003.1` |
| `shell-projects-folded` | `#inicio` | click `[data-action="toggle-projects"]` | full page; widths 1280 | `AC-19-003.1` |
| `shell-drawer-open` | `#inicio` | click `#menu` → wait for `#sidebar[data-open="true"]` | capture viewport; widths 375 | `AC-19-003.2` `AC-19-003.3` `AC-19-003.4` |

States cited above that belong to another FRD folder (captured there, reused here): `a11y-skip-link-focus`.

**Not drawn (4)**: `AC-19-003.2`, `AC-19-003.3`, `AC-19-004.1`, `AC-19-004.2`.

**Partially drawn (6)**: `AC-19-001.1`, `AC-19-001.2`, `AC-19-002.2`, `AC-19-003.1`, `AC-19-003.4`, `AC-19-003.5`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `shell-expanded`

- sidebar: Pandacorp | MISSION CONTROL | Plugin desactualizado | Inicio | 6 | Tablero | 10 | Portafolio | Propuestas | 4 | Logros | Documentación | Configuración | PROYECTOS | 5 | FT | Funko Tracker | Construcción · 81% | MC | Mission Control | Construcción · 99% | PS | PandaSaga | Arquitectura · 0% | PC | PandaCast | Arquitectura | PV | PersonalPage v2 | Lanzamiento · 76% | 22 | Portador de Luz III | 175 / 200 XP al nivel 23 | Colapsar
- top bar (phone): InicioMission Control
- bottom nav (phone): InicioTableroPortafolioManualMás

### `shell-rail-collapsed`

- sidebar: FT | MC | PS | PC | PV | 22
- top bar (phone): InicioMission Control
- bottom nav (phone): InicioTableroPortafolioManualMás

### `shell-rail-float`

- sidebar: Pandacorp | MISSION CONTROL | Plugin desactualizado | Inicio | 6 | Tablero | 10 | Portafolio | Propuestas | 4 | Logros | Documentación | Configuración | PROYECTOS | 5 | FT | Funko Tracker | Construcción · 81% | MC | Mission Control | Construcción · 99% | PS | PandaSaga | Arquitectura · 0% | PC | PandaCast | Arquitectura | PV | PersonalPage v2 | Lanzamiento · 76% | 22 | Portador de Luz III | 175 / 200 XP al nivel 23 | Fijar abierta
- top bar (phone): InicioMission Control
- bottom nav (phone): InicioTableroPortafolioManualMás

### `shell-projects-folded`

- sidebar: Pandacorp | MISSION CONTROL | Plugin desactualizado | Inicio | 6 | Tablero | 10 | Portafolio | Propuestas | 4 | Logros | Documentación | Configuración | PROYECTOS | 5 | 22 | Portador de Luz III | 175 / 200 XP al nivel 23 | Colapsar
- top bar (phone): InicioMission Control
- bottom nav (phone): InicioTableroPortafolioManualMás

### `shell-drawer-open`

- sidebar: Pandacorp | MISSION CONTROL | Plugin desactualizado | Inicio | 6 | Tablero | 10 | Portafolio | Propuestas | 4 | Logros | Documentación | Configuración | PROYECTOS | 5 | FT | Funko Tracker | Construcción · 81% | MC | Mission Control | Construcción · 99% | PS | PandaSaga | Arquitectura · 0% | PC | PandaCast | Arquitectura | PV | PersonalPage v2 | Lanzamiento · 76% | 22 | Portador de Luz III | 175 / 200 XP al nivel 23
- top bar (phone): Inicio | MISSION CONTROL
- bottom nav (phone): Inicio | Tablero | Portafolio | Manual | Más

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- Destination labels "Inicio, Tablero, Portfolio, Propuestas, Logros, Documentación" | "Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración" (mini labels on the rail and bottom nav: "Inicio, Tablero, Portafolio, Propuestas, Logros, Manual, Ajustes").
- Skip link "skip link" (copy not quoted) | "Saltar al contenido".
- Toggle accessible label "open/close" | "Abrir menú" (phone top bar); desktop toggle "Colapsar la barra lateral" / "Fijar la barra lateral abierta" (aria-label) with visible "Colapsar" / "Fijar abierta".
- Guild identity "NV n · rank · xp bar" in the header | crest with the level number, rank name and "175 / 200 XP al nivel 23" in the sidebar guild card.
- Brand text "Pandacorp Mission Control" | "Pandacorp" over "MISSION CONTROL".
- "Propuestas ◦ n" nested badge | "Propuestas 4" count in the item.

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- FRD-19 describes a TOP navigation shell (six destinations, 1100 px toggle, bounded 1240 px header frame, exempt drill-ins); the approved shell is a persistent SIDEBAR with seven destinations, collapsible rail, tablet rail, phone top bar + bottom nav + drawer, and no exempt route (owner decision recorded in the proposal, "deliberately departs from the earlier prefer-top-navigation advice").
- Configuración became a first-class destination; the e2e contract `e2e/shell.ts` (`SHELL_EXEMPT = ['/projects/**', '/configuration']`) must be rewritten from the prototype's nav (shell contract: landmark `aside#sidebar`, nav `a.navitem`, labels above).
- 2026-10-21 decision: phone and tablet are targets, so the small-screen shell gates apply from v2.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Round 5 (iteration 1): persistent sidebar with the seven sections, the five projects (phase and progress) and the guild card; icon rail on tablet; top bar, bottom navigation and drawer on phone; counts show what needs attention; content keeps the 1180 px reading frame.
- Iteration 21 (owner): collapsible sidebar on desktop "as in PandaTrack": pinned open at 252 px by default or collapsed to a 64 px icon rail; while collapsed, pointing at it (or keyboard focus) floats it open over the page without pushing content; the button at the bottom says "Colapsar" / "Fijar abierta"; the choice is remembered per browser; tablet keeps its rail, phone its drawer.
- Iteration 2: the project list orders by last commit, shows at most five with "Ver los N", the "Proyectos" header collapses (remembered); a coral "Plugin desactualizado" pill sits under the brand when the plugin is behind.
- Iteration 12 rule: any secondary sidebar that would sit next to the app sidebar goes on the RIGHT.
- Iteration 26: phone/tablet pass; focus is kept clear of the sticky bars (scroll margin, WCAG 2.4.11).

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
