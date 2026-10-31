---
id: FRD-19
type: frd
title: 'FRD-19 — Global app shell (persistent sidebar navigation)'
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-19-app-shell/mocks/app-shell.html
last_updated: '2026-10-22'
floor: false
---
# FRD-19 — Global app shell (persistent sidebar navigation)

The persistent **sidebar shell** that frames every surface of Mission Control: the brand, the seven destinations with their counts, the Proyectos group, the guild card and the global pills, exactly the approved Órbita prototype (`docs/design/prototype/index.html`, landmark `aside#sidebar`). On tablets it is an icon rail, on phones a sticky top bar with a bottom navigation and an off-canvas drawer. It is the answer to *"how do I get from any surface to any other surface"* — the menu the operator opens the app expecting to see.

> **Design freeze amendment (2026-10-22, S2.2).** The top navigation with six destinations (1100 px disclosure, 1240 px frame, exempt drill-ins) was replaced by the sidebar of the approved prototype (contradiction C-01 of `docs/design/freeze/reconciliation.md`). The nav contract for `e2e/shell.ts` is: landmark `aside#sidebar`, the seven labels and paths below, no exempt route, and the phone drawer toggled by `#menu`. Prototype-drawn behaviours are REQ-19-005 (AC-19-005.1 to AC-19-005.4).

**Why this FRD exists (the re-anchor).** The per-FRD sharding (DR-056) built each surface in
isolation but left the **global shell orphaned**: `layout.tsx` only mounted a guild bar + a loose
proposals badge, with **no navigation at all** — opening the app, "the menu doesn't even appear."
The visual gate verified *consistency* (each surface matches its own baseline), not *fidelity* to the
prototype, so a whole missing menu shipped green. DR-075 introduced the **Shell-Presence Gate**
(`e2e/shell.spec.ts`) that asserts the app against the prototype's nav contract; this FRD is the
canonical owner of that contract and of the shell that satisfies it. It is a deliberate app-shell FRD
anchored to the PRD (DR-076 wording: a deliberate, PRD-anchored shell FRD with foundation work orders
is correct — only an orphan auto-emitted greenfield `frd` is forbidden).

It composes existing layers — the guild level/XP block ([FRD-09](../frd-09-gamification/frd.md)), the
Propuestas destination ([FRD-17](../frd-17-proposals-inbox/frd.md)), the plugin pill
([FRD-15](../frd-15-plugin-out-of-sync-warning/frd.md)), the pending-merge pill
([FRD-21](../frd-21-pending-merge/frd.md)) and the visual/accessibility system
([FRD-13](../frd-13-visual-system-accessibility/frd.md)). Every surface ([FRD-18](../frd-18-dashboard/frd.md) Inicio,
[FRD-02](../frd-02-ideas-board/frd.md) Tablero, [FRD-03](../frd-03-portfolio/frd.md) Portafolio, FRD-17 Propuestas,
[FRD-10](../frd-10-achievements-hall/frd.md) Logros, [FRD-08](../frd-08-documentation/frd.md) Documentación,
[FRD-07](../frd-07-configuration/frd.md) Configuración) renders inside this shell.

## Scope (Phase A)

This FRD covers the global shell: persistent identity, seven destinations and responsive navigation on desktop, tablet and phone (owner decision 2026-10-21: Mission Control targets all three). Historical Phase A desktop-only gate coverage remains historical.

## Layout (the prototype sidebar)
```
┌──────────────┬───────────────────────────────────────────────────────────┐
│ Pandacorp    │                                                           │
│ MISSION      │   content frame (max 1180 px, 40 px gutters)              │
│ CONTROL      │                                                           │
│ Inicio       │                                                           │
│ Tablero      │                                                           │
│ Portafolio   │                                                           │
│ Propuestas n │                                                           │
│ Logros       │                                                           │
│ Documentación│                                                           │
│ Configuración│                                                           │
│ Proyectos ▾  │                                                           │
│ (pills)      │                                                           │
│ guild card   │                                                           │
│ Colapsar     │                                                           │
└──────────────┴───────────────────────────────────────────────────────────┘
```
- **Brand** — "Pandacorp" over "MISSION CONTROL"; the brand link's accessible name is "Pandacorp Mission Control: ir a Inicio". **Raster exception (M2 decision 4, 2026-10-22):** the brand mark is the existing raster guild emblem `docs/design/prototype/assets/pandacorp.png`, served with its original bytes; it is a recorded exception to the vector-logo rule (Mission Control is an internal tool), and no requirement here demands a vector logo.
- **Destinations** — the seven top-level destinations, each with the count of what needs attention (AC-19-005.2).
- **Proyectos** — the recent-projects group (AC-19-005.1).
- **Pills** — "Plugin desactualizado" (FRD-15 AC-15-006.1) and "⎇ N pendientes" (FRD-21 AC-21-008.1), when they apply.
- **Guild card, collapse control and theme button** (FRD-09 AC-09-008.1; AC-19-005.3; AC-19-005.5).

## Acceptance criteria (EARS)

### REQ-19-001 — Persistent global navigation shell
- **AC-19-001.1** The app SHALL render a single persistent navigation shell (the landmark
  `aside#sidebar`) on every surface (Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación,
  Configuración), so all seven destinations are reachable from any surface without using the
  browser back button.
- **AC-19-001.2** The shell SHALL contain exactly the seven top-level destinations, each a
  link to its correct route: Inicio→`/`, Tablero→`/board`, Portafolio→`/portfolio`,
  Propuestas→`/proposals`, Logros→`/achievements`, Documentación→`/manual`, Configuración→`/configuration`.
  No dead hrefs (`#`/`/`-placeholders), no extra top-level destinations.
- **AC-19-001.3** The shell SHALL host the brand, the guild card (FRD-09 AC-09-008.1), the Propuestas count
  and the global pills "Plugin desactualizado" and "⎇ N pendientes".
- **AC-19-001.4** Navigation between destinations SHALL be client-side (`next/link`), not a full page
  reload.
- **AC-19-001.5** A keyboard-reachable **skip link** "Saltar al contenido" SHALL be the first focusable element of the page
  and SHALL move focus to the main content region in place, without routing to another screen (WCAG 2.2 SC 2.4.1).

### REQ-19-002 — Active destination indication
- **AC-19-002.1** WHEN the current route matches a destination, that destination SHALL be marked
  active — both programmatically (`aria-current="page"`) and visually — and **exactly one**
  destination SHALL be active at a time (not color-alone — `aria-current` carries the meaning).
- **AC-19-002.2** The active match SHALL be exact for Inicio (`/`) and per path for the other six;
  the project workspace is a drill-in of Portafolio and keeps Portafolio active [ASSUMPTION: since no route is exempt from the shell any more, the workspace needs an active destination; Portafolio is the surface it opens from — source: C-01 and FRD-04]. WHEN the route is unmatched (for example `not-found`), no destination SHALL be marked active (no false highlight).

### REQ-19-003 — Responsive navigation and bounded frame
- **AC-19-003.1** WHEN the viewport is 1180 px or wider, THE shell SHALL display the expanded sidebar with full labels and the collapse control (AC-19-005.3).
- **AC-19-003.2** WHEN the viewport is from 760 px through 1179 px, THE shell SHALL display a 76 px icon rail with mini labels ("Docs" for Documentación and "Ajustes" for Configuración are the short forms).
- **AC-19-003.3** WHEN the viewport is 759 px or narrower, THE shell SHALL show a sticky top bar with the brand and a menu toggle (`#menu`, accessible name "Abrir menú", with `aria-expanded` and `aria-controls="sidebar"`), a bottom navigation (Inicio · Tablero · Portafolio · Docs · Más) and an off-canvas drawer holding the full sidebar, opened by the toggle or by "Más"; WHILE the drawer is closed it SHALL be inert. Every link SHALL have a target of at least 44 px by design (24 px is only the gated floor).
- **AC-19-003.4** WHEN Escape is pressed with the drawer open, THE shell SHALL close it and restore focus to its opener; outside pointer-down, destination activation (including the current route) and route changes SHALL also close it.
- **AC-19-003.5** WHEN rendering page content, THE shell SHALL center a content frame of at most 1180 px with a 40 px gutter on each side, and shrink to narrower viewports; shared digest panels SHALL fill their host without the narrower 920px inner panel cap, while prose MAY retain a readable line-length cap. Model-only fullscreen SHALL continue to fill the browser viewport.

### REQ-19-004 — Shell scope: no exempt route
- **AC-19-004.1** The shell SHALL render on EVERY route, including the project workspace (`/projects/**`) and Configuración (`/configuration`); no route is exempt, and the workspace keeps its own header and back control inside the content frame.
- **AC-19-004.2** The Shell-Presence Gate (`e2e/shell.ts`) SHALL mirror this contract with an empty exempt set; the app and the gate SHALL not drift.

### REQ-19-005 — Sidebar projects, counts, rail and mobile patterns (added 2026-10-22, design freeze)
- **AC-19-005.1** — THE sidebar SHALL list up to five projects by last commit in its Proyectos group, each row with a phase-hued avatar, "Fase · pct%" and a full `aria-label`, followed by "Ver los N" when there are more, and SHALL remember in this browser whether the group is folded.
- **AC-19-005.2** — THE navigation SHALL show, per destination, the count of what needs attention (Inicio: the owner's items, Tablero: ideas, Propuestas: owner actions), and on the collapsed rail a dot WHEN Inicio has items.
- **AC-19-005.3** — WHEN the owner collapses the sidebar ("Colapsar", accessible name "Colapsar la barra lateral"), THE shell SHALL show a 64 px icon rail, SHALL remember the choice in this browser, and WHILE collapsed SHALL float the rail open over the page on pointer or focus without moving the content; "Fijar abierta" (accessible name "Fijar abierta la barra lateral") SHALL pin it open again.
- **AC-19-005.4** — THE shell SHALL become an icon rail on tablets and a top bar, bottom navigation and drawer on phones (REQ-19-003).
- **AC-19-005.5** — THE shell SHALL offer a theme button (sun/moon) in the sidebar footer next to "Colapsar" and, on phones, inside the drawer; WHEN the owner has not chosen a theme, THE shell SHALL start from the system preference (`prefers-color-scheme`); WHEN the owner activates the button, THE shell SHALL switch between the light and dark themes, SHALL remember the choice in this browser (it wins over the system preference on later visits), and SHALL keep the button's accessible name stating the theme it switches to ("Tema claro" while dark, "Tema oscuro" while light).

**Worked example (AC-19-005.5).** A first visit on a system set to dark opens the dark theme and the button reads "Tema claro". The owner presses it: the app turns light, the button reads "Tema oscuro", and reloading keeps light even though the system is still dark.

**Worked example (AC-19-005.3).** On a 1440 px screen the owner presses "Colapsar": the sidebar becomes a 64 px rail and the content keeps its position. Moving the pointer over the rail floats the full sidebar over the page; moving away closes it. Reloading keeps the rail. "Fijar abierta" restores the expanded sidebar.

## Edge cases
- **Onboarding gate (FRD-01).** WHEN the factory profile is absent, the `OnboardingGate` is the entire
  view (AC-01-001.1) and the shell SHALL NOT render behind it.
- **Unknown route.** A route that matches no destination (e.g. `not-found`) SHALL render with no
  destination active — never a stray highlight (AC-19-002.2).
- **Empty proposals.** The Propuestas destination stays present for navigation with no count when there is
  nothing for the owner; the shell does not manufacture urgency.
- **No pending branches.** The "⎇ N pendientes" pill is hidden when nothing is pending (FRD-21).

## Traceability
- REQ-19-001 → AC-19-001.1..5 → `CMP-19-app-shell`, `CMP-19-nav` → WO-19-001
- REQ-19-002 → AC-19-002.1..2 → `CMP-19-nav` → WO-19-001
- REQ-19-003 → AC-19-003.1..5 → `CMP-19-app-shell` (responsive) → WO-19-001
- REQ-19-004 → AC-19-004.1..2 → `CMP-19-app-shell` (scope), `e2e/shell.ts` → WO-19-001
- REQ-19-005 → AC-19-005.1..5 → new work orders at the v2 change
- Reuses: the guild card (FRD-09), the Propuestas destination (FRD-17), the visual system (FRD-13).

## Notes
- **Visual source:** the approved whole-app prototype sidebar (`docs/design/prototype/index.html`) — the
  frozen design contract. This FRD does not invent new visuals.
- **Independent verification:** the Shell-Presence Gate (`e2e/shell.spec.ts`, DR-075) is the
  author-independent fidelity check — it asserts the rendered app against this FRD's nav contract
  seeded into `e2e/shell.ts`, so the contract here and the running shell cannot silently diverge.
- The prototype footer text "propuesta de diseño, no es la app real" and the capture stamp belong to the prototype only; the build omits them.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
